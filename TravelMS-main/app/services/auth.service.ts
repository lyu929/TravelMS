import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, firstValueFrom, of, tap } from 'rxjs';
import { User, UserInput, ProfileInput } from '../models';
export type AuthUser = User;
@Injectable({ providedIn: 'root' })
export class AuthService {
  private current = signal<User | null>(null);
  constructor(private http: HttpClient) {
    try {
      window.localStorage.removeItem('tms_user');
    } catch {
      /* Sessions also work when the browser blocks local storage. */
    }
  }
  get user() {
    return this.current();
  }
  get isLoggedIn() {
    return !!this.current();
  }
  get isAdmin() {
    return this.current()?.role === 'ADMIN';
  }
  restore() {
    return firstValueFrom(
      this.http.get<User>('/api/auth/me').pipe(
        tap((user) => this.current.set(user)),
        catchError(() => {
          this.clear();
          return of(null);
        }),
      ),
    );
  }
  login(email: string, password: string) {
    return this.http
      .post<User>('/api/auth/login', { email, password })
      .pipe(tap((user) => this.current.set(user)));
  }
  register(user: UserInput) {
    return this.http
      .post<User>('/api/auth/register', { ...user, role: 'USER' })
      .pipe(tap((user) => this.current.set(user)));
  }
  logout() {
    return this.http.post('/api/auth/logout', {}).pipe(tap(() => this.clear()));
  }
  updateProfile(profile: ProfileInput) {
    return this.http.put<User>('/api/profile', profile).pipe(tap((user) => this.current.set(user)));
  }
  changePassword(current_password: string, new_password: string, confirm_password: string) {
    return this.http.post('/api/auth/change-password', {
      current_password,
      new_password,
      confirm_password,
    });
  }
  clear() {
    this.current.set(null);
  }
}
