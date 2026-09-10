import { CreatorSpecialty } from '../../features/user/data/creator.models';

export type UserRole = 'USER' | 'CREATOR' | 'MODERATOR' | 'ADMIN';
export type RegistrationRole = 'USER' | 'CREATOR';

export interface CurrentUser {
  id: number;
  email: string;
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  role: UserRole;
  specialties: CreatorSpecialty[];
  birthDate?: string | null;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshExpiresIn: number;
  user: CurrentUser;
}

export interface RegistrationResponse {
  userId: number;
  email: string;
  emailVerificationRequired: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  displayName: string;
  username: string;
  email: string;
  birthDate: string;
  password: string;
  role: RegistrationRole;
  bio?: string | null;
  specialties: CreatorSpecialty[];
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ResendVerificationEmailRequest {
  email: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface UpdateMyProfileRequest {
  displayName: string;
  bio: string | null;
  specialties: CreatorSpecialty[];
  birthDate: string;
}

export const USER_ROLE_OPTIONS: readonly { value: UserRole; label: string }[] = [
  { value: 'USER', label: 'Usuario' },
  { value: 'CREATOR', label: 'Creador' },
  { value: 'MODERATOR', label: 'Moderador' },
  { value: 'ADMIN', label: 'Administrador' },
];

export function userRoleLabel(role: UserRole): string {
  return USER_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}
