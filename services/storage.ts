import { supabase } from './supabaseClient';
import { User } from '../types';
import { ROOT_ADMIN_ID } from '../constants';

// --- PHÂN QUYỀN ADMIN GỐC / ADMIN PHỤ + LINK CỔNG RIÊNG ---
// Mỗi admin phụ có một "cổng" (portal) riêng theo link: /chatgpt2faa/<ma-ngau-nhien>
// Mã link là chuỗi ngẫu nhiên (portalSlug), KHÔNG dùng username để tránh lộ tên admin.
// User chỉ đăng nhập được ở cổng của admin đã tạo ra mình, nên các admin khác nhau
// có thể tạo user trùng tên nhau mà không xung đột.

export const isRootAdmin = (user: User | null | undefined): boolean => {
  // Admin gốc = tài khoản admin KHÔNG có createdBy (admin phụ luôn có
  // createdBy là ID của admin đã tạo ra mình). Nhận diện từ dữ liệu trong
  // database, không so username ghi sẵn trong code như trước nữa.
  return !!user && user.isAdmin && !user.createdBy;
};

// ID của admin sở hữu một tài khoản.
// Dữ liệu cũ (createdBy null) coi như do admin gốc tạo.
export const ownerIdOf = (user: User): string => {
  return user.createdBy ?? ROOT_ADMIN_ID;
};

// Lấy tài khoản admin gốc từ database (admin có createdBy trống).
// Dùng làm chủ cổng chính thay cho tài khoản admin ghi sẵn trong code trước đây.
export const getRootAdmin = async (): Promise<User | null> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('isAdmin', true)
      .is('createdBy', null);
    if (error) throw error;
    const admins = ((data as User[]) || []).filter(u => !u.username.startsWith('__TRASH__'));
    return admins[0] ?? null;
  } catch (error) {
    console.error("Error finding root admin:", error);
    return null;
  }
};

// Lấy mọi dòng trùng username (không phân biệt hoa/thường), bỏ qua dòng đã vào thùng rác.
// Từ khi có phân quyền, username user thường có thể trùng nhau giữa các admin khác nhau,
// nên không dùng maybeSingle() cho username nữa.
const listByUsername = async (username: string): Promise<User[]> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('username', username);

  if (error) throw error;
  return ((data as User[]) || []).filter(u => !u.username.startsWith('__TRASH__'));
};

// --- MÃ LINK CỔNG NGẪU NHIÊN ---

const SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // bỏ ký tự dễ nhìn nhầm (0/o, 1/l/i)

const generatePortalSlug = (): string => {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => SLUG_ALPHABET[b % SLUG_ALPHABET.length]).join('');
};

// Sinh mã chưa ai dùng (kiểm tra trùng trong database, thử lại tối đa 5 lần)
const makeUniquePortalSlug = async (): Promise<string> => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generatePortalSlug();
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('portalSlug', slug);
    if (error) throw error;
    if (!data || data.length === 0) return slug;
  }
  throw new Error('Không tạo được mã link, hãy thử lại');
};

// Cấp mã link MỚI cho một admin (dùng khi tạo admin phụ, tự cấp cho dữ liệu cũ,
// hoặc đổi link khi link cũ bị lộ — link cũ ngừng hoạt động ngay sau khi đổi).
export const assignPortalSlug = async (adminId: string): Promise<string> => {
  const slug = await makeUniquePortalSlug();
  const { error } = await supabase
    .from('users')
    .update({ portalSlug: slug })
    .eq('id', adminId);
  if (error) throw error;
  return slug;
};

// --- SUPABASE METHODS ---

export const getStoredUsers = async (): Promise<User[]> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('createdAt', { ascending: false });

    if (error) throw error;

    // Database trống thì trả về danh sách rỗng.
    // (Đã bỏ cơ chế tự tạo tài khoản mặc định ghi sẵn trong code vì nó làm
    // lộ username + secret của admin trong bản JS công khai.)
    if (!data || data.length === 0) {
       return [];
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
    const rows = await listByUsername(username);
    // Ưu tiên trả về tài khoản admin nếu có nhiều dòng trùng tên
    const found = rows.find(u => u.isAdmin) ?? rows[0] ?? null;

    // Đã bỏ cơ chế tự khôi phục admin mặc định từ code: tài khoản admin chỉ
    // tồn tại trong database, code không giữ bản ghi sẵn nào của admin nữa.

    return found;
  } catch (error) {
    console.error("Error finding user:", error);
    return null;
  }
};

// Tìm tài khoản ADMIN theo username (dùng nội bộ + cầu nối chuyển đổi link cũ).
export const findAdminByUsername = async (username: string): Promise<User | null> => {
  try {
    const rows = await listByUsername(username);
    const admin = rows.find(u => u.isAdmin);
    if (admin) return admin;
    return null;
  } catch (error) {
    console.error("Error finding admin:", error);
    return null;
  }
};

// Xác định chủ cổng từ đoạn cuối của link (/chatgpt2faa/<slug>):
// - Ưu tiên khớp portalSlug (mã ngẫu nhiên).
// - Cầu nối chuyển đổi: admin phụ tạo ở bản trước CHƯA có mã thì vẫn vào được bằng
//   link tên cũ; ngay khi được cấp mã, link tên cũ hết hiệu lực.
export const findAdminBySlug = async (slug: string): Promise<User | null> => {
  const key = slug.trim().toLowerCase();
  if (!key) return null;
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('portalSlug', key);

    if (!error && data) {
      const admin = (data as User[]).find(u => u.isAdmin && !u.username.startsWith('__TRASH__'));
      if (admin) return admin;
    }

    const byName = await findAdminByUsername(key);
    if (byName && !byName.portalSlug) return byName;
    return null;
  } catch (error) {
    console.error("Error finding admin by slug:", error);
    return null;
  }
};

// Đăng nhập TRONG MỘT CỔNG cụ thể:
// - Nhập đúng username của chủ cổng -> đăng nhập với tư cách admin đó.
// - Ngược lại chỉ tìm user thường do chính chủ cổng tạo (createdBy trùng id của chủ cổng).
// User của admin khác (kể cả trùng tên) sẽ KHÔNG đăng nhập được ở cổng này.
export const findUserInPortal = async (username: string, portalAdmin: User): Promise<User | null> => {
  try {
    if (username.toLowerCase() === portalAdmin.username.toLowerCase()) {
      return portalAdmin;
    }
    const rows = await listByUsername(username);
    const mine = rows.filter(u => !u.isAdmin && ownerIdOf(u) === portalAdmin.id);
    return mine[0] ?? null;
  } catch (error) {
    console.error("Error finding user in portal:", error);
    return null;
  }
};

// Kiểm tra tên khi tạo USER THƯỜNG cho một admin:
// - Không được trùng tên bất kỳ tài khoản admin nào (tên admin là duy nhất toàn hệ thống).
// - Không được trùng user khác CỦA CÙNG admin đó.
// - Trùng tên user của admin khác thì ĐƯỢC PHÉP (mỗi cổng là một không gian riêng).
const assertNameAvailableForUser = async (username: string, ownerId: string) => {
  const rows = await listByUsername(username);
  if (rows.some(u => u.isAdmin)) {
    throw new Error("Tên này đã được dùng cho tài khoản admin, hãy chọn tên khác");
  }
  if (rows.some(u => !u.isAdmin && ownerIdOf(u) === ownerId)) {
    throw new Error("User này đã tồn tại");
  }
};

// Hàm nội bộ: chèn một tài khoản mới vào database
const insertAccount = async (
  username: string,
  secret: string,
  isAdmin: boolean,
  createdBy: string,
  portalSlug?: string
): Promise<User> => {
  const newUser: User = {
    id: crypto.randomUUID(),
    username,
    secret,
    isAdmin,
    createdAt: Date.now(),
    createdBy,
    ...(portalSlug ? { portalSlug } : {})
  };

  const { error } = await supabase.from('users').insert([newUser]);
  if (error) throw error;

  return newUser;
};

// Tạo user thường, thuộc quyền quản lý của admin đang đăng nhập (createdBy)
export const createUser = async (username: string, secret: string, createdBy: string): Promise<User> => {
  await assertNameAvailableForUser(username, createdBy);
  return insertAccount(username, secret, false, createdBy);
};

// Tạo admin phụ (chỉ admin gốc mới được gọi hàm này từ giao diện).
// Tên admin phụ phải duy nhất trên TOÀN hệ thống, và tài khoản được cấp ngay
// một mã link ngẫu nhiên để làm cổng riêng.
export const createSubAdmin = async (username: string, createdBy: string): Promise<User> => {
  // Tên trùng bất kỳ tài khoản nào đang có trong database (gồm admin gốc)
  // đều bị chặn ở bước kiểm tra dưới đây.
  const rows = await listByUsername(username);
  if (rows.length > 0) {
    throw new Error("Tên này đã có người dùng, hãy chọn tên khác cho admin phụ");
  }
  const slug = await makeUniquePortalSlug();
  return insertAccount(username, '', true, createdBy, slug);
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
          // Đồng thời gỡ portalSlug để không chiếm link cổng của admin khác.
          return { ...u, isAdmin: false, createdBy: importer.id, portalSlug: null };
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
