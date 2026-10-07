import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { User, UserInput } from '../../models';
import { PageState } from '../../shared/ui';
import { IconComponent } from '../../shared/icon.component';
@Component({
  selector: 'app-users',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: ` <section class="page">
    <div class="page-heading">
      <div>
        <div class="eyebrow">THE PEOPLE BEHIND THE PLANS</div>
        <h1>A workspace for every traveler<span class="title-dot">.</span></h1>
        <p>Manage your accounts and give each person the right access.</p>
      </div>
      <button class="primary" (click)="open()" [disabled]="busy">
        <app-icon name="plus" />Add person
      </button>
    </div>
    @if (error) {
      <div class="error" role="alert"><app-icon name="alert" />{{ error }}</div>
    }
    @if (showForm) {
      <section class="form-box">
        <div class="form-heading">
          <div>
            <h2>{{ editId ? 'Update their details' : 'A new face, a new journey' }}</h2>
            <p>Owners manage the workspace. Travelers manage their own journeys.</p>
          </div>
          <button
            class="icon-button"
            aria-label="Close person form"
            (click)="close()"
            [disabled]="busy"
          >
            <app-icon name="close" />
          </button>
        </div>
        <form #personForm="ngForm" (ngSubmit)="save(personForm.valid)">
          <div class="form-row">
            <label
              >First name<input
                name="first_name"
                [(ngModel)]="form.first_name"
                required
                maxlength="50" /></label
            ><label
              >Last name<input
                name="last_name"
                [(ngModel)]="form.last_name"
                required
                maxlength="50"
            /></label>
          </div>
          <div class="form-row">
            <label
              >Email address<input
                name="email"
                [(ngModel)]="form.email"
                type="email"
                email
                required
                maxlength="100" /></label
            ><label
              >Phone number<input
                name="phone_number"
                [(ngModel)]="form.phone_number"
                maxlength="20"
                placeholder="Optional"
            /></label>
          </div>
          <div class="form-row">
            <label
              >Access<select
                name="role"
                [(ngModel)]="form.role"
                [disabled]="editId === auth.user?.user_id"
              >
                <option value="USER">Traveler</option>
                <option value="ADMIN">Workspace owner</option>
              </select></label
            ><label
              >{{ editId ? 'New password' : 'Password'
              }}<input
                name="password"
                [(ngModel)]="form.password"
                type="password"
                [required]="!editId"
                minlength="8"
                autocomplete="new-password"
                [placeholder]="
                  editId ? 'Leave blank to keep the current password' : 'At least 8 characters'
                "
            /></label>
          </div>
          <div class="form-actions">
            <button class="primary" type="submit" [disabled]="busy">
              {{ busy ? 'Saving…' : editId ? 'Save changes' : 'Create account'
              }}<app-icon name="check" /></button
            ><button class="secondary" type="button" (click)="close()" [disabled]="busy">
              Cancel
            </button>
          </div>
        </form>
      </section>
    }
    <div class="toolbar">
      <div class="search-box">
        <app-icon name="search" /><input
          [(ngModel)]="search"
          aria-label="Search people"
          placeholder="Search by name or email…"
        />
      </div>
      <div class="filter-group">
        <span class="count-label"
          >{{ counted(users.length, 'person', 'people') }} in your workspace</span
        ><select [(ngModel)]="roleFilter" aria-label="Filter people by access">
          <option value="">All access levels</option>
          <option value="ADMIN">Owners</option>
          <option value="USER">Travelers</option>
        </select>
      </div>
    </div>
    @if (loading) {
      <div class="loading-state">Getting everyone together…</div>
    } @else {
      <section class="panel">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Person</th>
                <th>Email address</th>
                <th>Access</th>
                <th>Phone</th>
                <th class="align-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (user of filtered; track user.user_id) {
                <tr>
                  <td>
                    <div class="table-name">
                      <span class="people-avatar"
                        >{{ user.first_name[0] }}{{ user.last_name[0] }}</span
                      >
                      <div>
                        <strong
                          >{{ user.first_name }} {{ user.last_name }}
                          @if (user.user_id === auth.user?.user_id) {
                            <span class="self-tag">YOU</span>
                          }</strong
                        ><small>Joined {{ date(user.created_at) }}</small>
                      </div>
                    </div>
                  </td>
                  <td class="muted">{{ user.email }}</td>
                  <td>
                    <span class="badge">{{ user.role === 'ADMIN' ? 'Owner' : 'Traveler' }}</span>
                  </td>
                  <td class="muted">{{ user.phone_number || '—' }}</td>
                  <td>
                    <div class="row-actions">
                      <button
                        class="icon-button"
                        (click)="edit(user)"
                        [attr.aria-label]="'Edit ' + user.first_name"
                        [disabled]="busy"
                      >
                        <app-icon name="edit" />
                      </button>
                      @if (user.user_id !== auth.user?.user_id) {
                        <button
                          class="icon-button danger"
                          (click)="remove(user)"
                          [attr.aria-label]="'Delete ' + user.first_name"
                          [disabled]="busy"
                        >
                          <app-icon name="trash" />
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="empty-cell">No people match your search.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }
  </section>`,
})
export class UsersComponent extends PageState implements OnInit {
  users: User[] = [];
  search = '';
  roleFilter = '';
  showForm = false;
  editId: number | null = null;
  form: UserInput = {
    first_name: '',
    last_name: '',
    email: '',
    role: 'USER',
    phone_number: '',
    password: '',
  };
  constructor(
    private api: ApiService,
    public auth: AuthService,
    private router: Router,
  ) {
    super();
  }
  ngOnInit() {
    this.load();
  }
  load() {
    this.run(this.api.getUsers(), (users) => (this.users = users), '', true);
  }
  get filtered() {
    const q = this.search.trim().toLowerCase();
    return this.users.filter(
      (u) =>
        (!this.roleFilter || u.role === this.roleFilter) &&
        (!q || (u.first_name + ' ' + u.last_name + ' ' + u.email).toLowerCase().includes(q)),
    );
  }
  open() {
    this.editId = null;
    this.form = {
      first_name: '',
      last_name: '',
      email: '',
      role: 'USER',
      phone_number: '',
      password: '',
    };
    this.showForm = true;
    this.error = '';
  }
  close() {
    this.showForm = false;
    this.editId = null;
    this.error = '';
  }
  edit(user: User) {
    this.form = { ...user, password: '' };
    this.editId = user.user_id;
    this.showForm = true;
    this.error = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  save(valid: boolean | null) {
    if (!valid) {
      this.error = 'Complete the required fields. New passwords need at least 8 characters.';
      return;
    }
    const self = this.editId === this.auth.user?.user_id,
      changedPassword = !!this.form.password;
    const request = this.editId
      ? this.api.updateUser(this.editId, this.form)
      : this.api.createUser(this.form);
    this.run(
      request,
      () => {
        this.close();
        if (self && changedPassword) {
          this.auth.clear();
          this.router.navigate(['/login']);
          this.notices.show('Password updated. Please sign in again.');
        } else {
          if (self) this.auth.restore();
          this.load();
        }
      },
      'Account details saved.',
    );
  }
  remove(user: User) {
    if (
      confirm(
        'Delete ' +
          user.first_name +
          ' and all their trips, expenses and reports? This cannot be undone.',
      )
    )
      this.run(this.api.deleteUser(user.user_id), () => this.load(), 'Account deleted.');
  }
}
