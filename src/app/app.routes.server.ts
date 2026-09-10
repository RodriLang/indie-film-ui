import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'auth', renderMode: RenderMode.Client },
  { path: 'verify-email', renderMode: RenderMode.Client },
  { path: 'forgot-password', renderMode: RenderMode.Client },
  { path: 'reset-password', renderMode: RenderMode.Client },
  { path: 'profile', renderMode: RenderMode.Client },
  { path: 'credit-requests', renderMode: RenderMode.Client },
  { path: 'credit-requests/:requestId', renderMode: RenderMode.Client },
  { path: 'publish', renderMode: RenderMode.Client },
  { path: 'studio/:slug', renderMode: RenderMode.Client },
  { path: 'moderation', renderMode: RenderMode.Client },
  { path: 'moderation/:slug', renderMode: RenderMode.Client },
  { path: 'admin/users', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server },
];
