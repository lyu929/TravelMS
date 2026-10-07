import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService),
    router = inject(Router);
  return (
    auth.isLoggedIn || router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } })
  );
};
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService),
    router = inject(Router);
  return auth.isAdmin || router.parseUrl(auth.isLoggedIn ? '/dashboard' : '/login');
};
export const loginGuard: CanActivateFn = () =>
  !inject(AuthService).isLoggedIn || inject(Router).parseUrl('/dashboard');
