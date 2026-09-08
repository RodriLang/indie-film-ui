import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../config/api.config';
import { AuthUser } from './auth.models';

@Injectable({ providedIn: 'root' })
export class CurrentUserApi {
  private readonly http = inject(HttpClient);

  updateBirthDate(birthDate: string): Observable<AuthUser> {
    return this.http.patch<AuthUser>(`${API_URL}/me/profile`, { birthDate });
  }

  grantAdultContentConsent(): Observable<AuthUser> {
    return this.http.put<AuthUser>(`${API_URL}/me/adult-content-consent`, {});
  }
}
