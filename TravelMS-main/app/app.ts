import { Component, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from './services/auth.service';
import { IconComponent } from './shared/icon.component';
import { Notices } from './shared/ui';
import { AvatarComponent } from './shared/avatar.component';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, AvatarComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private path;
  page;
  today = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());
  constructor(
    public auth: AuthService,
    private router: Router,
    public notices: Notices,
  ) {
    this.path = toSignal(
      router.events.pipe(
        filter((event) => event instanceof NavigationEnd),
        map(() => router.url),
      ),
      { initialValue: router.url },
    );
    this.page = computed(
      () =>
        (
          ({
            dashboard: 'Overview',
            trips: 'Trips',
            expenses: 'Expenses',
            reports: 'Reports',
            users: 'People',
            settings: 'Settings',
          }) as Record<string, string>
        )[this.path().split('/')[1]?.split('?')[0]] || 'Overview',
    );
  }
  get initials() {
    return (
      (this.auth.user?.first_name[0] || '') + (this.auth.user?.last_name[0] || '')
    ).toUpperCase();
  }
  logout() {
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.notices.show('Sign out failed. Please try again.'),
    });
  }
}
