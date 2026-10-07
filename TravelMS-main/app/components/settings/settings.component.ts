import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { AvatarKey, ProfileInput } from '../../models';
import { PageState } from '../../shared/ui';
import { AvatarComponent } from '../../shared/avatar.component';
import { IconComponent } from '../../shared/icon.component';
@Component({
  selector: 'app-settings',
  imports: [FormsModule, AvatarComponent, IconComponent],
  templateUrl: './settings.component.html',
})
export class SettingsComponent extends PageState implements OnInit {
  profile: ProfileInput = {
    first_name: '',
    last_name: '',
    phone_number: '',
    avatar_key: 'initials',
  };
  avatars: { key: AvatarKey; label: string }[] = [
    { key: 'initials', label: 'Initials' },
    { key: 'compass', label: 'Compass' },
    { key: 'plane', label: 'Plane' },
    { key: 'leaf', label: 'Leaf' },
    { key: 'location', label: 'Explorer' },
  ];
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  showPasswords = false;
  passwordSaved = false;
  constructor(public auth: AuthService) {
    super();
  }
  ngOnInit() {
    const user = this.auth.user!;
    this.profile = {
      first_name: user.first_name,
      last_name: user.last_name,
      phone_number: user.phone_number || '',
      avatar_key: user.avatar_key || 'initials',
    };
  }
  saveProfile(valid: boolean | null) {
    if (!valid || !this.profile.first_name.trim() || !this.profile.last_name.trim()) {
      this.error = 'Enter your first and last name.';
      return;
    }
    this.run(
      this.auth.updateProfile(this.profile),
      (user) => {
        this.profile = {
          first_name: user.first_name,
          last_name: user.last_name,
          phone_number: user.phone_number || '',
          avatar_key: user.avatar_key || 'initials',
        };
      },
      'Your profile has been updated.',
    );
  }
  savePassword(valid: boolean | null) {
    this.passwordSaved = false;
    if (!valid) {
      this.error = 'Enter your current password and a new password with at least 8 characters.';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.error = 'The new passwords do not match.';
      return;
    }
    this.run(
      this.auth.changePassword(this.currentPassword, this.newPassword, this.confirmPassword),
      () => {
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.showPasswords = false;
        this.passwordSaved = true;
      },
      'Password updated. Other sessions have been signed out.',
    );
  }
}
