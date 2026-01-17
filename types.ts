export interface User {
  id: string;
  username: string;
  secret: string;
  isAdmin: boolean;
  createdAt: number;
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