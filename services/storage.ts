import { supabase } from './supabaseClient';
import { User } from '../types';
import { DEFAULT_ADMIN, DEFAULT_USER } from '../constants';

// --- PHÂN QUYỀN ADMIN GỐC / ADMIN PHỤ ---

// Admin gốc là tài khoản mặc định của hệ thống (dinhtom)
export const isRootAdmin = (user: User | null | undefined): boolean => {
  return !!user && user.username.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase();
};

// ID của admin sở hữu một tài khoản.
// Dữ liệu cũ (createdBy null) coi như do admin gốc tạo.
export const ownerIdOf = (user: User): string => {
  return user.createdBy ?? DEFAULT_ADMIN.id;
};

// --- SUPABASE METHODS ---

export const getStoredUsers = async (): Promise<User[]> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('createdAt', { ascending: false });

    if (error) throw error;

    // Nếu database hoàn toàn trống (0 dòng), tự động thêm admin mặc định
    if (!data || data.length === 0) {
       console.log("Database empty, seeding defaults...");
       const defaults = [DEFAULT_ADMIN, DEFAULT_USER];
       const { error: insertError } = await supabase.from('users').insert(defaults);
       if (insertError) throw insertError;
       return defaults;
    }

    // LỌC BỎ CÁC USER ĐÃ BỊ "XÓA MỀM" (CÓ TÊN BẮT ĐẦU BẰNG __TRASH__)
    const activeUsers = (data as User[]).filter(u => !u.username.startsWith('__TRASH__'));

    return activeUsers;
  } catch (error) {
    console.error("Error fetching users:", error);
    return [];
  }
};

export const findUserByUsername = async (username: string): Promise<User | null> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('username', username)
      .maybeSingle();

    if (error) throw error;

    // Logic đảm bảo Admin mặc định luôn tồn tại nếu bị xóa nhầm
    // Lưu ý: Nếu admin đã bị chuyển vào trash (đổi tên), logic này sẽ không tìm thấy admin cũ và sẽ tạo lại admin mới (restore).
    if (!data && username.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase()) {
        console.log(`Admin '${DEFAULT_ADMIN.username}' missing. Restoring...`);
        const { error: upsertError } = await supabase
            .from('users')
            .upsert([DEFAULT_ADMIN]);

        if (!upsertError) return DEFAULT_ADMIN;
    }

    return data as User | null;
  } catch (error) {
    console.error("Error finding user:", error);
    return null;
  }
};

// Hàm nội bộ: tạo một tài khoản (user thường hoặc admin phụ)
const createAccount = async (
  username: string,
  secret: string,
  isAdmin: boolean,
  createdBy: string
): Promise<User> => {
  const existing = await findUserByUsername(username);
  if (existing) throw new Error("User này đã tồn tại");

  const newUser: User = {
    id: crypto.randomUUID(),
    username,
    secret,
    isAdmin,
    createdAt: Date.now(),
    createdBy
  };

  const { error } = await supabase.from('users').insert([newUser]);
  if (error) throw error;

  return newUser;
};

// Tạo user thường, thuộc quyền quản lý của admin đang đăng nhập (createdBy)
export const createUser = async (username: string, secret: string, createdBy: string): Promise<User> => {
  return createAccount(username, secret, false, createdBy);
};

// Tạo admin phụ (chỉ admin gốc mới được gọi hàm này từ giao diện).
// Admin phụ đăng nhập bằng username như bình thường và chỉ thấy user do chính họ tạo.
export const createSubAdmin = async (username: string, createdBy: string): Promise<User> => {
  if (username.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase()) {
    throw new Error("Tên này trùng với admin gốc");
  }
  return createAccount(username, '', true, createdBy);
};

export const updateUserSecret = async (id: string, newSecret: string) => {
  // Cập nhật secret dựa trên ID
  const { data, error } = await supabase
    .from('users')
    .update({ secret: newSecret })
    .eq('id', id)
    .select();

  if (error) throw error;
};

export const deleteUser = async (id: string) => {
  // --- CHIẾN LƯỢC XÓA: Ưu tiên Xóa Vĩnh Viễn -> Fallback Xóa Mềm ---

  // 1. Thử xóa vĩnh viễn (Hard Delete) khỏi Database
  // Nếu RLS cho phép, bản ghi sẽ biến mất hoàn toàn.
  const { error: deleteError } = await supabase
    .from('users')
    .delete()
    .eq('id', id);

  if (!deleteError) {
    return; // Thành công! Đã xóa sạch.
  }

  // 2. Nếu xóa vĩnh viễn thất bại (VD: Lỗi Permission RLS), thực hiện Soft Delete (Đưa vào thùng rác)
  console.warn("Hard delete failed, falling back to Soft Delete (Trash)", deleteError);

  const { data: userToCheck, error: fetchError } = await supabase
    .from('users')
    .select('username')
    .eq('id', id)
    .single();

  if (fetchError || !userToCheck) {
    throw new Error("Không tìm thấy user để xóa");
  }

  // Tạo tên mới đánh dấu là rác: __TRASH__<timestamp>__<original_name>
  const trashName = `__TRASH__${Date.now()}__${userToCheck.username}`;

  const { error: updateError } = await supabase
    .from('users')
    .update({ username: trashName })
    .eq('id', id);

  if (updateError) {
    console.error("Supabase Trash Error:", updateError);
    // Nếu cả Hard Delete và Soft Delete đều lỗi
    throw new Error("Không thể xóa user (Cả vĩnh viễn lẫn thùng rác): " + updateError.message);
  }
};

export const importUsers = async (jsonString: string, importer: User): Promise<boolean> => {
  try {
    const parsed: User[] = JSON.parse(jsonString);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const importerIsRoot = isRootAdmin(importer);
      const users: User[] = parsed
        .filter(u => u && u.id && u.username)
        .map(u => {
          if (importerIsRoot) {
            // Admin gốc import: giữ nguyên quyền admin trong file,
            // dòng nào thiếu createdBy thì gán cho admin gốc.
            return { ...u, createdBy: u.createdBy ?? importer.id };
          }
          // Admin phụ import: mọi dòng đều thành user thường thuộc về chính họ,
          // tránh việc import file backup để tự tạo tài khoản admin khác.
          return { ...u, isAdmin: false, createdBy: importer.id };
        });

      if (users.length === 0) return false;

      const { error } = await supabase.from('users').upsert(users);
      if (error) {
        console.error("Import error:", error);
        return false;
      }
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
};
