import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { AppShell } from './core/layout/app-shell/app-shell';

export const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () => import('./features/auth/pages/auth-page/auth-page').then((m) => m.AuthPage)
  },
  {
    path: 'watch/:slug',
    loadComponent: () => import('./features/production/pages/watch-page/watch-page').then((m) => m.WatchPage)
  },
  {
    path: '',
    component: AppShell,
    children: [
      {
        path: 'explore',
        loadComponent: () => import('./features/discovery/pages/explore-page/explore-page').then((m) => m.ExplorePage)
      },
      {
        path: 'search',
        loadComponent: () => import('./features/discovery/pages/search-page/search-page').then((m) => m.SearchPage)
      },
      {
        path: 'production/:slug',
        loadComponent: () => import('./features/production/pages/production-detail-page/production-detail-page').then((m) => m.ProductionDetailPage)
      },
      {
        path: 'creator/:username',
        loadComponent: () => import('./features/user/pages/creator-page/creator-page').then((m) => m.CreatorPage)
      },
      {
        path: 'profile',
        canActivate: [authGuard],
        loadComponent: () => import('./features/user/pages/creator-page/creator-page').then((m) => m.CreatorPage),
        data: { own: true }
      },
      {
        path: 'publish',
        canActivate: [roleGuard],
        data: { roles: ['CREATOR', 'MODERATOR', 'ADMIN'] },
        loadComponent: () => import('./features/production/pages/publish-page/publish-page').then((m) => m.PublishPage)
      },
      {
        path: 'studio/:slug',
        canActivate: [roleGuard],
        data: { roles: ['CREATOR', 'MODERATOR', 'ADMIN'] },
        loadComponent: () => import('./features/production/pages/publish-page/publish-page').then((m) => m.PublishPage)
      },
      {
        path: 'moderation',
        canActivate: [roleGuard],
        data: { roles: ['MODERATOR', 'ADMIN'] },
        loadComponent: () => import('./features/moderation/pages/moderation-queue-page/moderation-queue-page').then((m) => m.ModerationQueuePage)
      },
      {
        path: 'moderation/:slug',
        canActivate: [roleGuard],
        data: { roles: ['MODERATOR', 'ADMIN'] },
        loadComponent: () => import('./features/moderation/pages/moderation-detail-page/moderation-detail-page').then((m) => m.ModerationDetailPage)
      },
      {
        path: 'admin/users',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () => import('./features/admin-users/pages/user-admin-page/user-admin-page').then((m) => m.UserAdminPage)
      },
      { path: '', pathMatch: 'full', redirectTo: 'explore' }
    ]
  },
  { path: '**', redirectTo: 'explore' }
];
