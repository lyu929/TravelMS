import { Component, Input } from '@angular/core';
import { User } from '../models';
import { IconComponent } from './icon.component';
@Component({
  selector: 'app-avatar',
  imports: [IconComponent],
  template: `<span
    [class]="'profile-avatar avatar-' + (user?.avatar_key || 'initials')"
    aria-hidden="true"
  >
    @if (user?.avatar_key && user?.avatar_key !== 'initials') {
      <app-icon [name]="user!.avatar_key!" />
    } @else {
      {{ initials }}
    }
  </span>`,
})
export class AvatarComponent {
  @Input() user?: Partial<User> | null;
  get initials() {
    return ((this.user?.first_name?.[0] || '') + (this.user?.last_name?.[0] || '')).toUpperCase();
  }
}
