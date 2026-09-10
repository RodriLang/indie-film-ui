import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../config/api.config';
import {
  AuthResponse,
  ForgotPasswordRequest,
  LoginRequest,
  RegistrationResponse,
  RegisterRequest,
  ResendVerificationEmailRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
} from './auth.models';

const CSRF_HEADERS = {
  'X-CSRF-Protection': '1',
};

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API_URL}/auth/login`, request, {
      withCredentials: true,
    });
  }

  register(request: RegisterRequest): Observable<RegistrationResponse> {
    return this.http.post<RegistrationResponse>(`${API_URL}/auth/register`, request);
  }

  refresh(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API_URL}/auth/refresh`, null, {
      withCredentials: true,
      headers: CSRF_HEADERS,
    });
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${API_URL}/auth/logout`, null, {
      withCredentials: true,
      headers: CSRF_HEADERS,
    });
  }

  verifyEmail(request: VerifyEmailRequest): Observable<void> {
    return this.http.post<void>(`${API_URL}/auth/email-verification/confirm`, request);
  }

  resendVerificationEmail(request: ResendVerificationEmailRequest): Observable<void> {
    return this.http.post<void>(`${API_URL}/auth/email-verification/resend`, request);
  }

  requestPasswordReset(request: ForgotPasswordRequest): Observable<void> {
    return this.http.post<void>(`${API_URL}/auth/password-reset/request`, request);
  }

  resetPassword(request: ResetPasswordRequest): Observable<void> {
    return this.http.post<void>(`${API_URL}/auth/password-reset/confirm`, request);
  }
}
