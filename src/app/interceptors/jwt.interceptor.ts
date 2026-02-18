
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { catchError, throwError } from 'rxjs';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.getToken();

  // optionally skip for auth endpoints
  const isAuthCall = /\/api\/jwt\/(login|register)$/i.test(req.url);
  if (!token || isAuthCall) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  });
  
  return next(authReq).pipe(
    catchError((error) => {
      // 🔒 If 401 Unauthorized (account deactivated/deleted), logout and redirect
      if (error.status === 401) {
        console.warn('⚠️ Session expired or account deactivated. Redirecting to login...');
        auth.logout();
        router.navigate(['/login'], { 
          queryParams: { 
            reason: 'session_expired',
            message: 'Your session has expired or your account has been deactivated.' 
          } 
        });
      }
      return throwError(() => error);
    })
  );
};
