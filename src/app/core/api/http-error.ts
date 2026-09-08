import { HttpErrorResponse } from '@angular/common/http';

interface ApiErrorBody {
  detail?: string;
  message?: string;
  title?: string;
  code?: string;
}

export function apiErrorMessage(
  error: unknown,
  fallback = 'Ocurrió un error. Intentá nuevamente.',
): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }

  const body = error.error as ApiErrorBody | string | null;

  if (typeof body === 'string' && body.trim()) {
    return body;
  }

  if (body && typeof body === 'object') {
    return body.detail || body.message || body.title || fallback;
  }

  return fallback;
}

export function apiErrorCode(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }

  const body = error.error as ApiErrorBody | null;

  if (!body || typeof body !== 'object') {
    return null;
  }

  return body.code ?? null;
}