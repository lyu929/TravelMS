import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Trip, User } from '../../models';
import { PageState } from '../../shared/ui';
import { IconComponent } from '../../shared/icon.component';
import { BudgetComponent } from '../../shared/budget.component';
import { TripReviewComponent } from '../../shared/trip-review.component';
@Component({
  selector: 'app-trips',
  standalone: true,
  imports: [FormsModule, IconComponent, RouterLink, BudgetComponent, TripReviewComponent],
  template: ` <section class="page">
    <div class="page-heading">
      <div>
        <div class="eyebrow">THE JOURNEY COLLECTION</div>
        <h1>Your next destination<span class="title-dot">.</span></h1>
        <p>Good plans make room for great experiences.</p>
      </div>
      <button class="primary" (click)="open()" [disabled]="busy">
        <app-icon name="plus" />Plan a trip
      </button>
    </div>
    @if (error) {
      <div class="error" role="alert"><app-icon name="alert" />{{ error }}</div>
    }
    @if (showForm) {
      <section class="form-box">
        <div class="form-heading">
          <div>
            <h2>{{ editId ? 'A few changes to the plan' : 'Where are you headed?' }}</h2>
            <p>
              {{
                editId && form.status === 'REJECTED'
                  ? 'Update the details to submit your trip for approval again.'
                  : 'Add the essentials. We will keep everything organized.'
              }}
            </p>
          </div>
          <button
            class="icon-button"
            aria-label="Close trip form"
            (click)="close()"
            [disabled]="busy"
          >
            <app-icon name="close" />
          </button>
        </div>
        <form #tripForm="ngForm" (ngSubmit)="save(tripForm.valid)">
          <div class="form-row">
            <label
              >Destination<input
                name="destination"
                [(ngModel)]="form.destination"
                required
                maxlength="100"
                placeholder="City or destination"
            /></label>
            @if (auth.isAdmin) {
              <label
                >Traveler<select
                  name="user_id"
                  [(ngModel)]="form.user_id"
                  required
                  [disabled]="!!editId"
                >
                  <option [ngValue]="0" disabled>Select a traveler</option>
                  @for (user of users; track user.user_id) {
                    <option [ngValue]="user.user_id">
                      {{ user.first_name }} {{ user.last_name }}
                    </option>
                  }
                </select></label
              >
            } @else {
              <label
                >Budget (USD)<input
                  name="budget"
                  [(ngModel)]="form.estimated_budget"
                  type="number"
                  required
                  min="0"
                  max="99999999.99"
                  step="0.01"
              /></label>
            }
          </div>
          <div class="form-row">
            <label
              >Start date<input
                name="start_date"
                [(ngModel)]="form.start_date"
                type="date"
                required /></label
            ><label
              >End date<input
                name="end_date"
                [(ngModel)]="form.end_date"
                type="date"
                required
                [min]="form.start_date"
            /></label>
          </div>
          <div class="form-row">
            <label
              >Purpose<input
                name="purpose"
                [(ngModel)]="form.purpose"
                maxlength="200"
                placeholder="A conference, a workshop, a new adventure…"
            /></label>
            @if (auth.isAdmin) {
              <label
                >Budget (USD)<input
                  name="budget"
                  [(ngModel)]="form.estimated_budget"
                  type="number"
                  required
                  min="0"
                  max="99999999.99"
                  step="0.01"
              /></label>
            }
          </div>
          <div class="form-actions">
            <button class="primary" type="submit" [disabled]="busy">
              {{ busy ? 'Saving…' : editId ? 'Save changes' : 'Submit trip'
              }}<app-icon name="arrow" /></button
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
          aria-label="Search trips"
          placeholder="Search destinations or purpose…"
        />
      </div>
      <div class="filter-group">
        <span class="count-label">{{ counted(filtered.length, 'journey') }}</span
        ><select [(ngModel)]="statusFilter" aria-label="Filter trips by status">
          <option value="">All statuses</option>
          <option value="PLANNED">Pending approval</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Needs revision</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>
    </div>
    @if (loading) {
      <div class="loading-state">Finding your journeys…</div>
    } @else {
      <div class="trip-grid">
        @for (trip of filtered; track trip.trip_id; let i = $index) {
          <article class="trip-card">
            <div [class]="'trip-cover cover-' + (i % 3)" aria-hidden="true">
              <span class="city-code">{{ trip.destination.slice(0, 3).toUpperCase() }}</span
              ><app-icon name="plane" />
            </div>
            <div class="trip-content">
              <div class="trip-meta">
                <span>JOURNEY {{ trip.trip_id?.toString()?.padStart(3, '0') }}</span
                ><span class="badge status-{{ trip.status.toLowerCase() }}">{{
                  tripLabel(trip.status)
                }}</span>
              </div>
              <h2>
                <a class="trip-title-link" [routerLink]="['/trips', trip.trip_id]">{{
                  trip.destination
                }}</a>
              </h2>
              <p class="trip-purpose">{{ trip.purpose || 'A new place, a new perspective.' }}</p>
              <div class="trip-dates">
                <app-icon name="calendar" />{{ date(trip.start_date) }} — {{ date(trip.end_date) }}
              </div>
              @if (auth.isAdmin) {
                <div class="trip-owner">Traveler · {{ trip.user_name }}</div>
              }
              <app-budget [trip]="trip" />
              <a class="trip-detail-link" [routerLink]="['/trips', trip.trip_id]"
                >View journey <app-icon name="arrow"
              /></a>
              <div class="trip-footer">
                @if (auth.isAdmin) {
                  <app-trip-review [trip]="trip" (changed)="load()" />
                }
                @if (auth.isAdmin || ['PLANNED', 'REJECTED'].includes(trip.status)) {
                  <button
                    class="icon-button"
                    (click)="edit(trip)"
                    [attr.aria-label]="'Edit trip to ' + trip.destination"
                    [disabled]="busy"
                  >
                    <app-icon name="edit" /></button
                  ><button
                    class="icon-button danger"
                    (click)="remove(trip)"
                    [attr.aria-label]="'Delete trip to ' + trip.destination"
                    [disabled]="busy"
                  >
                    <app-icon name="trash" />
                  </button>
                } @else {
                  <span class="status-note">{{
                    trip.status === 'APPROVED'
                      ? 'Ready for your next chapter.'
                      : trip.status === 'COMPLETED'
                        ? 'A journey to remember.'
                        : 'Awaiting approval.'
                  }}</span>
                }
              </div>
            </div>
          </article>
        }
      </div>
      @if (!filtered.length) {
        <div class="empty-state">
          <app-icon name="compass" />
          <h3>
            {{
              trips.length ? 'No journeys match your search.' : 'Every journey starts with an idea.'
            }}
          </h3>
          <p>
            {{
              trips.length
                ? 'Try another destination or status.'
                : 'Add your first trip and let the planning begin.'
            }}
          </p>
          @if (!trips.length) {
            <button class="primary" (click)="open()">
              <app-icon name="plus" />Plan your first trip
            </button>
          }
        </div>
      }
    }
  </section>`,
})
export class TripsComponent extends PageState implements OnInit {
  trips: Trip[] = [];
  users: User[] = [];
  search = '';
  statusFilter = '';
  showForm = false;
  editId: number | null = null;
  private initialAction = true;
  form: Trip = {
    user_id: 0,
    destination: '',
    start_date: '',
    end_date: '',
    purpose: '',
    status: 'PLANNED',
    estimated_budget: 0,
  };
  constructor(
    private api: ApiService,
    public auth: AuthService,
    private route: ActivatedRoute,
  ) {
    super();
  }
  ngOnInit() {
    this.load();
    if (this.route.snapshot.queryParamMap.get('new')) this.open();
  }
  load() {
    this.run(
      forkJoin({
        trips: this.api.getTrips(),
        users: this.auth.isAdmin ? this.api.getUsers() : of([] as User[]),
      }),
      (data) => {
        this.trips = data.trips;
        this.users = data.users;
        if (this.initialAction) {
          this.initialAction = false;
          const editId = Number(this.route.snapshot.queryParamMap.get('edit'));
          if (editId) {
            const trip = this.trips.find((t) => t.trip_id === editId);
            if (trip && (this.auth.isAdmin || ['PLANNED', 'REJECTED'].includes(trip.status)))
              this.edit(trip);
            else this.error = 'That trip is not available for editing.';
          }
        }
      },
      '',
      true,
    );
  }
  get filtered() {
    const q = this.search.trim().toLowerCase();
    return this.trips.filter(
      (t) =>
        (!this.statusFilter || t.status === this.statusFilter) &&
        (!q || [t.destination, t.purpose, t.user_name].some((s) => s?.toLowerCase().includes(q))),
    );
  }
  open() {
    this.editId = null;
    this.form = {
      user_id: this.auth.user!.user_id,
      destination: '',
      start_date: '',
      end_date: '',
      purpose: '',
      status: 'PLANNED',
      estimated_budget: 0,
    };
    this.showForm = true;
    this.error = '';
  }
  close() {
    this.showForm = false;
    this.editId = null;
    this.error = '';
  }
  edit(trip: Trip) {
    this.form = { ...trip };
    this.editId = trip.trip_id!;
    this.showForm = true;
    this.error = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  save(valid: boolean | null) {
    if (!valid || !this.form.user_id) {
      this.error = 'Complete the required fields and select a traveler.';
      return;
    }
    if (this.form.end_date < this.form.start_date) {
      this.error = 'End date must be on or after start date.';
      return;
    }
    const request = this.editId
      ? this.api.updateTrip(this.editId, this.form)
      : this.api.createTrip(this.form);
    this.run(
      request,
      () => {
        this.close();
        this.load();
      },
      this.editId
        ? 'Your trip has been updated.'
        : 'Trip submitted. The next chapter is on its way.',
    );
  }
  remove(trip: Trip) {
    if (confirm('Delete this trip and its expenses? This cannot be undone.'))
      this.run(this.api.deleteTrip(trip.trip_id!), () => this.load(), 'Trip deleted.');
  }
}
