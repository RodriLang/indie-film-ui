import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import {
  normalizePageResponse,
  PageResponse,
  SpringPageResponse
} from '../../../core/api/api.models';
import { UserRole } from '../../../core/auth/auth.models';
import { API_URL } from '../../../core/config/api.config';
import { UpdateUserRoleRequest, UserAdmin, UserStatus } from './user-admin.models';

@Injectable({ providedIn: 'root' })
export class UserAdminApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_URL}/admin/users`;

  findAll(
    query = '',
    role?: UserRole | null,
    status?: UserStatus | null,
    page = 0,
    size = 20
  ): Observable<PageResponse<UserAdmin>> {
    let params = new HttpParams()
      .set('page', page)
      .set('size', size);

    if (query.trim()) {
      params = params.set('query', query.trim());
    }

    if (role) {
      params = params.set('role', role);
    }

    if (status) {
      params = params.set('status', status);
    }

    return this.http
      .get<PageResponse<UserAdmin> | SpringPageResponse<UserAdmin>>(this.baseUrl, { params })
      .pipe(map((page) => normalizePageResponse(page)));
  }

  findById(userId: number): Observable<UserAdmin> {
    return this.http.get<UserAdmin>(`${this.baseUrl}/${userId}`);
  }

  updateRole(userId: number, request: UpdateUserRoleRequest): Observable<UserAdmin> {
    return this.http.patch<UserAdmin>(`${this.baseUrl}/${userId}/role`, request);
  }
}
