import { PageResponse } from '../../../core/api/api.models';
import { UserRole } from '../../../core/auth/auth.models';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DISABLED';

export interface UserAdmin {
  id: number;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export interface UpdateUserRoleRequest {
  role: UserRole;
}

export type UserAdminPageResponse = PageResponse<UserAdmin>;

export const USER_STATUS_OPTIONS: readonly { value: UserStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'SUSPENDED', label: 'Suspendido' },
  { value: 'DISABLED', label: 'Deshabilitado' }
];

export function userStatusLabel(status: UserStatus): string {
  return USER_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}
