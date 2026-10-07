import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { AuthService } from './services/auth.service';
import { of } from 'rxjs';

describe('Waypoint workspace access', () => {
  const auth = {
    isLoggedIn: true,
    isAdmin: true,
    user: { first_name: 'Test', last_name: 'Owner' },
    logout: () => of({}),
  };
  beforeEach(async () => {
    auth.isLoggedIn = true;
    auth.isAdmin = true;
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
  });
  it('shows the branded workspace and administration navigation for owners', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.brand')?.textContent).toContain('waypoint');
    expect(root.querySelector('a[href="/users"]')?.textContent).toContain('People');
    expect(root.querySelector('main')).toBeTruthy();
  });
  it('does not show administration navigation to travelers', async () => {
    auth.isAdmin = false;
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('a[href="/users"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/trips"]')).toBeTruthy();
  });
  it('does not expose the workspace shell while signed out', async () => {
    auth.isLoggedIn = false;
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.sidebar')).toBeNull();
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
  });
});
