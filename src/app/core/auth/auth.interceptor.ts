import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { API_URL } from '../config/api.config';
import { AuthSessionService } from './auth-session.service';
import { AuthStore } from './auth.store';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authStore = inject(AuthStore);
  const authSession = inject(AuthSessionService);
  const token = authStore.accessToken();
  const authEndpoint = request.url.startsWith(`${API_URL}/auth/`);

  const outgoingRequest = token && !authEndpoint
    ? request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      })
    : request;

  return next(outgoingRequest).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        !token ||
        authEndpoint
      ) {
        return throwError(() => error);
      }

      return authSession.refresh().pipe(
        switchMap((response) =>
          next(
            request.clone({
              setHeaders: {
                Authorization: `Bearer ${response.accessToken}`,
              },
            }),
          ),
        ),
        catchError((refreshError) => {
          authStore.clear();
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
