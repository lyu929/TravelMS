import { Component } from '@angular/core';
import { returnUrl } from '../../shared/return-url';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PageState } from '../../shared/ui';
import { IconComponent } from '../../shared/icon.component';
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <div class="auth-page">
      <section class="auth-story">
        <a class="auth-brand" href="/login"
          ><span><app-icon name="compass" /></span>waypoint.</a
        >
        <div class="auth-story-copy">
          <div class="eyebrow">TRAVEL WITH INTENTION</div>
          <h1>A world to explore.<br />A place to keep<br />it all together.</h1>
          <p>
            Plan your journeys. Track the little details.<br />Make more room for the moments that
            matter.
          </p>
          <div class="story-line"><span></span><app-icon name="plane" /><span></span></div>
        </div>
        <div class="auth-story-footer">
          <span>YOUR JOURNEY, THOUGHTFULLY ORGANIZED.</span><span>EST. 2026</span>
        </div>
        <div class="auth-globe" aria-hidden="true"></div>
      </section>
      <section class="auth-form-area">
        <div class="auth-mobile-brand"><app-icon name="compass" />waypoint.</div>
        <div class="auth-card">
          <div class="eyebrow">YOUR PERSONAL TRAVEL WORKSPACE</div>
          <h2>{{ mode === 'login' ? 'Welcome back.' : 'Your next chapter starts here.' }}</h2>
          <p class="auth-description">
            {{
              mode === 'login'
                ? 'A little less paperwork. A lot more possibilities.'
                : 'Create an account and give your journeys a home.'
            }}
          </p>
          <div class="auth-tabs" role="tablist" aria-label="Account access">
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="mode === 'login'"
              [class.selected]="mode === 'login'"
              (click)="switchMode('login')"
            >
              Sign in</button
            ><button
              type="button"
              role="tab"
              [attr.aria-selected]="mode === 'register'"
              [class.selected]="mode === 'register'"
              (click)="switchMode('register')"
            >
              Create account
            </button>
          </div>
          @if (error) {
            <div class="error" role="alert"><app-icon name="alert" />{{ error }}</div>
          }
          @if (mode === 'login') {
            <form #loginForm="ngForm" (ngSubmit)="login(loginForm.valid)">
              <label for="login-email">Email address</label
              ><input
                id="login-email"
                name="email"
                [(ngModel)]="email"
                type="email"
                email
                required
                autocomplete="username"
                placeholder="you@example.com"
              /><label for="login-password">Password</label
              ><input
                id="login-password"
                name="password"
                [(ngModel)]="password"
                [type]="showPassword ? 'text' : 'password'"
                required
                autocomplete="current-password"
                placeholder="Enter your password"
              /><button
                type="button"
                class="text-button password-toggle"
                [attr.aria-pressed]="showPassword"
                (click)="showPassword = !showPassword"
              >
                {{ showPassword ? 'Hide password' : 'Show password' }}</button
              ><button type="submit" class="primary auth-submit" [disabled]="busy">
                {{ busy ? 'Signing you in…' : 'Sign in to your workspace'
                }}<app-icon name="arrow" />
              </button>
            </form>
            <div class="demo-box">
              <div>
                <strong>Demo accounts</strong
                ><small>Try two roles. Each button signs in to a different sample account.</small>
              </div>
              <div class="demo-buttons">
                <button
                  class="secondary"
                  type="button"
                  (click)="demo('owner')"
                  [disabled]="busy"
                  aria-label="Owner demo"
                >
                  Owner demo<small>Administrator</small></button
                ><button
                  class="secondary"
                  type="button"
                  (click)="demo('traveler')"
                  [disabled]="busy"
                  aria-label="Traveler demo"
                >
                  Traveler demo<small>Regular user</small>
                </button>
              </div>
            </div>
          } @else {
            <form #registerForm="ngForm" (ngSubmit)="register(registerForm.valid)">
              <div class="form-row">
                <label
                  >First name<input
                    name="first_name"
                    [(ngModel)]="reg.first_name"
                    required
                    maxlength="50"
                    autocomplete="given-name"
                    placeholder="Alex" /></label
                ><label
                  >Last name<input
                    name="last_name"
                    [(ngModel)]="reg.last_name"
                    required
                    maxlength="50"
                    autocomplete="family-name"
                    placeholder="Taylor"
                /></label>
              </div>
              <label
                >Email address<input
                  name="reg_email"
                  [(ngModel)]="reg.email"
                  type="email"
                  email
                  required
                  maxlength="100"
                  autocomplete="email"
                  placeholder="you@example.com" /></label
              ><label
                >Password<input
                  name="reg_password"
                  [(ngModel)]="reg.password"
                  type="password"
                  required
                  minlength="8"
                  autocomplete="new-password"
                  placeholder="At least 8 characters" /></label
              ><small class="field-hint"
                >Use at least 8 characters. Your account will have traveler access.</small
              ><button type="submit" class="primary auth-submit" [disabled]="busy">
                {{ busy ? 'Creating your workspace…' : 'Create your account'
                }}<app-icon name="arrow" />
              </button>
            </form>
          }
          <div class="auth-bottom">
            <app-icon name="leaf" /><span>Every great journey starts with a small step.</span>
          </div>
        </div>
        <div class="auth-copyright">waypoint. · Personal edition</div>
      </section>
    </div>
  `,
})
export class LoginComponent extends PageState {
  mode: 'login' | 'register' = 'login';
  email = '';
  password = '';
  showPassword = false;
  reg = {
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    phone_number: '',
    role: 'USER' as const,
  };
  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {
    super();
  }
  switchMode(mode: 'login' | 'register') {
    this.mode = mode;
    this.error = '';
  }
  private enter() {
    this.router.navigateByUrl(returnUrl(this.route.snapshot.queryParamMap.get('returnUrl')));
  }
  login(valid: boolean | null) {
    if (!valid) {
      this.error = 'Enter a valid email address and password.';
      return;
    }
    this.run(this.auth.login(this.email, this.password), () => this.enter());
  }
  register(valid: boolean | null) {
    if (!valid) {
      this.error = 'Complete the required fields and use a password of at least 8 characters.';
      return;
    }
    this.run(
      this.auth.register(this.reg),
      () => this.enter(),
      'Welcome to Waypoint. Your next journey awaits.',
    );
  }
  demo(role: string) {
    this.email = role + '@waypoint.local';
    this.password = 'Waypoint2026!';
    this.login(true);
  }
}
