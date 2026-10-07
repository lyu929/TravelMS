import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { User } from '../models';
const user: User = {
  user_id: 1,
  first_name: 'Alex',
  last_name: 'Taylor',
  role: 'USER',
  email: 'alex@example.invalid',
  phone_number: '',
};
describe('Server-backed sessions', () => {
  let auth: AuthService, http: HttpTestingController;
  let storageDescriptor: PropertyDescriptor | undefined;
  beforeEach(() => {
    storageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    const entries = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        setItem: (key: string, value: string) => entries.set(key, value),
        getItem: (key: string) => entries.get(key) ?? null,
        removeItem: (key: string) => entries.delete(key),
      },
    });
    window.localStorage.setItem('tms_user', '{forged administrator data');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http?.verify();
    if (storageDescriptor) Object.defineProperty(window, 'localStorage', storageDescriptor);
    else Reflect.deleteProperty(window, 'localStorage');
  });
  it('ignores and removes untrusted legacy local storage', () => {
    expect(auth.isLoggedIn).toBe(false);
    expect(window.localStorage.getItem('tms_user')).toBeNull();
  });
  it('restores identity from the server without persisting an editable role in local storage', async () => {
    const restored = auth.restore();
    http.expectOne('/api/auth/me').flush(user);
    await restored;
    expect(auth.user?.user_id).toBe(1);
    expect(auth.isAdmin).toBe(false);
    expect(window.localStorage.getItem('tms_user')).toBeNull();
  });
  it('clears identity when the server reports an expired session', async () => {
    const restored = auth.restore();
    http.expectOne('/api/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    await restored;
    expect(auth.user).toBeNull();
  });
  it('uses public traveler registration and clears the session after sign out', () => {
    auth.register({ ...user, role: 'ADMIN', password: 'Testing2026!' }).subscribe();
    const register = http.expectOne('/api/auth/register');
    expect(register.request.body.role).toBe('USER');
    register.flush(user);
    expect(auth.isLoggedIn).toBe(true);
    auth.logout().subscribe();
    http.expectOne('/api/auth/logout').flush({ success: true });
    expect(auth.user).toBeNull();
  });
});
