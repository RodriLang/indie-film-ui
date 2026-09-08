import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthStore } from './auth.store';
import { UserRole } from './auth.models';

export const roleGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (!authStore.authenticated()) {
    return router.createUrlTree(['/auth'], {
      queryParams: { returnUrl: state.url }
    });
  }

  const allowedRoles = (route.data['roles'] as UserRole[] | undefined) ?? [];
  const role = authStore.user()?.role;

  if (role && allowedRoles.includes(role)) {
    return true;
  }

  return router.createUrlTree(['/explore']);
};
