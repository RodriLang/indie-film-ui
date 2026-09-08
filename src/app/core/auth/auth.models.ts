export type UserRole = 'USER' | 'CREATOR' | 'MODERATOR' | 'ADMIN';

export interface AuthUser {
  id: number;
  email: string;
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  role: UserRole;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: AuthUser;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  username: string;
  displayName: string;
}

export const USER_ROLE_OPTIONS: readonly { value: UserRole; label: string }[] = [
  { value: 'USER', label: 'Usuario' },
  { value: 'CREATOR', label: 'Creador' },
  { value: 'MODERATOR', label: 'Moderador' },
  { value: 'ADMIN', label: 'Administrador' }
];

export function userRoleLabel(role: UserRole): string {
  return USER_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}
