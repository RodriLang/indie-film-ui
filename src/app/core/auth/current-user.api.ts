import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../config/api.config';
import { CurrentUser, UpdateMyProfileRequest } from './auth.models';

@Injectable({ providedIn: 'root' })
export class CurrentUserApi {
  private readonly http = inject(HttpClient);

  getCurrentUser(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(`${API_URL}/me`);
  }

  updateProfile(request: UpdateMyProfileRequest): Observable<CurrentUser> {
    return this.http.put<CurrentUser>(`${API_URL}/me/profile`, request);
  }

  updateBirthDate(birthDate: string): Observable<CurrentUser> {
    return this.http.put<CurrentUser>(`${API_URL}/me/birth-date`, {
      birthDate,
    });
  }

  grantAdultContentConsent(): Observable<CurrentUser> {
    return this.http.put<CurrentUser>(
      `${API_URL}/me/adult-content-consent`,
      null,
    );
  }

  revokeAdultContentConsent(): Observable<CurrentUser> {
    return this.http.delete<CurrentUser>(`${API_URL}/me/adult-content-consent`);
  }

  becomeCreator(): Observable<CurrentUser> {
    return this.http.put<CurrentUser>(`${API_URL}/me/creator`, {});
  }
}
