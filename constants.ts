// FIX BẢO MẬT (bản đơn giản): file này trước đây ghi sẵn tài khoản admin gốc
// (username + secret) và một user mặc định kèm secret. Vì đây là code frontend,
// mọi thứ trong file đều nằm trong bản JS công khai — ai mở web cũng đọc được
// username và secret của admin.
//
// Nay đã XÓA TOÀN BỘ tài khoản ghi sẵn: admin và user chỉ tồn tại trong
// database, code không chứa username hay secret của bất kỳ tài khoản nào.
// Admin gốc được nhận diện từ chính dữ liệu trong database:
// tài khoản admin có createdBy trống (null) chính là admin gốc.
//
// Chỉ còn giữ lại ID nội bộ của admin gốc để các dữ liệu cũ (chưa có
// createdBy) vẫn được tính là thuộc admin gốc như trước. ID này không phải
// username, không phải secret, không dùng để đăng nhập được.
export const ROOT_ADMIN_ID = 'admin-1';
