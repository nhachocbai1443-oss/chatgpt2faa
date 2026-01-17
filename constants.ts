import { User } from './types';

// User mặc định sẽ được tạo tự động nếu database trống
export const DEFAULT_ADMIN: User = {
  id: 'admin-1',
  username: 'dinhtom',
  secret: 'JBSWY3DPEHPK3PXP',
  isAdmin: true,
  createdAt: Date.now(),
};

export const DEFAULT_USER: User = {
  id: 'user-1',
  username: 'user',
  secret: '4KH4RR2TDG3WVA5OXW6ASIIWRM7V7TOX',
  isAdmin: false,
  createdAt: Date.now(),
};