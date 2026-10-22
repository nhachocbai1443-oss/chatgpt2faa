export interface User {
  id: string;
  username: string;
  secret: string;
  isAdmin: boolean;
  createdAt: number;
  // ID của admin đã tạo tài khoản này (phân quyền cách ly dữ liệu).
  // null/không có = dữ liệu cũ từ trước khi có tính năng admin phụ -> thuộc về admin gốc.
  createdBy?: string | null;
}

export interface AuthState {
  isAuthenticated: boolean;
  currentUser: User | null;
}

// Using a simplified TOTP generation logic interface
export interface OTPData {
  token: string;
  period: number;
  remaining: number;
}
