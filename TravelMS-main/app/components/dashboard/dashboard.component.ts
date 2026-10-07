import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Trip, Expense, Report } from '../../models';
import { PageState, categories } from '../../shared/ui';
import { IconComponent } from '../../shared/icon.component';
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: ` <section class="page dashboard-page">
    <div class="page-heading">
      <div>
        <div class="eyebrow">THE BIG PICTURE</div>
        <h1>{{ greeting }}, {{ auth.user?.first_name }}<span class="title-dot">.</span></h1>
        <p>Here's where your next chapter begins.</p>
      </div>
      <a class="button primary" routerLink="/trips" [queryParams]="{ new: 1 }"
        ><app-icon name="plus" />Plan a trip</a
      >
    </div>
    @if (error) {
      <div class="error" role="alert">
        <app-icon name="alert" />{{ error
        }}<button class="text-button" (click)="load()">Try again</button>
      </div>
    }
    @if (loading) {
      <div class="loading-state">Gathering your journeys…</div>
    } @else {
      <div class="hero-card">
        <div class="hero-copy">
          <span class="hero-tag"><span></span> A LITTLE PLANNING. A WORLD OF POSSIBILITIES.</span>
          <h2>Go places.<br />Keep everything together.</h2>
          <p>
            From your first idea to the final receipt.<br />Your journey, with a little more
            clarity.
          </p>
          <a routerLink="/trips" class="hero-link">Explore your trips <app-icon name="arrow" /></a>
        </div>
        <div class="journey-art" aria-hidden="true">
          <svg viewBox="0 0 380 280">
            <g fill="none" stroke="#cbd5ba" stroke-width="1">
              <ellipse cx="220" cy="147" rx="112" ry="108" />
              <ellipse cx="220" cy="147" rx="64" ry="108" />
              <path
                d="M112 118h216M112 176h216M220 39v216M135 80c50 40 110 40 170 0M135 212c50-40 110-40 170 0"
              />
            </g>
            <path
              d="M40 215C105 255 115 50 190 125S300 200 347 67"
              fill="none"
              stroke="#63846a"
              stroke-width="2"
              stroke-dasharray="5 6"
            />
            <circle cx="40" cy="215" r="6" fill="#e1a76c" />
            <circle cx="347" cy="67" r="6" fill="#174a3e" />
            <path
              d="m239 129-17 8-12-9-5 3 6 13-18 9 2 5 20-4 9 12 5-1-3-15 16-17z"
              fill="#174a3e"
            />
          </svg>
          <div class="art-note">
            <app-icon name="compass" /><span
              >YOUR NEXT DESTINATION<br /><strong>Somewhere worth going.</strong></span
            >
          </div>
        </div>
      </div>
      <div class="stats-grid">
        <article class="stat-card">
          <span class="stat-icon"><app-icon name="trips" /></span
          ><span class="stat-label">Total trips</span><strong>{{ trips.length }}</strong
          ><small>{{ upcoming.length }} on the horizon</small>
        </article>
        <article class="stat-card">
          <span class="stat-icon amber"><app-icon name="clock" /></span
          ><span class="stat-label">Pending approval</span><strong>{{ pending }}</strong
          ><small>{{ auth.isAdmin ? 'Ready for your review' : 'Waiting for a green light' }}</small>
        </article>
        <article class="stat-card">
          <span class="stat-icon blue"><app-icon name="wallet" /></span
          ><span class="stat-label">Travel spending</span><strong>{{ money(spent) }}</strong
          ><small>Across {{ counted(expenses.length, 'recorded expense') }}</small>
        </article>
        <article class="stat-card">
          <span class="stat-icon rose"><app-icon name="reports" /></span
          ><span class="stat-label">Expense reports</span><strong>{{ reports.length }}</strong
          ><small>{{ counted(reportsApproved, 'approved report') }}</small>
        </article>
      </div>
      <div class="dashboard-columns">
        <section class="panel">
          <div class="panel-heading">
            <div>
              <h2>On the horizon</h2>
              <p>Your upcoming journeys, at a glance.</p>
            </div>
            <a routerLink="/trips" class="small-link">View all <app-icon name="arrow" /></a>
          </div>
          <div class="upcoming-list">
            @for (trip of upcoming.slice(0, 3); track trip.trip_id) {
              <a [routerLink]="['/trips', trip.trip_id]" class="upcoming-item"
                ><span class="destination-symbol"><app-icon name="location" /></span>
                <div>
                  <h3>{{ trip.destination }}</h3>
                  <p>{{ date(trip.start_date) }} — {{ date(trip.end_date) }}</p>
                </div>
                <span class="badge status-{{ trip.status.toLowerCase() }}">{{
                  tripLabel(trip.status)
                }}</span></a
              >
            } @empty {
              <div class="empty-state compact">
                <app-icon name="compass" />
                <h3>Your next destination awaits.</h3>
                <p>Plan a trip to start your next chapter.</p>
                <a class="small-link" routerLink="/trips" [queryParams]="{ new: 1 }"
                  >Create your first trip <app-icon name="arrow"
                /></a>
              </div>
            }
          </div>
        </section>
        <section class="panel">
          <div class="panel-heading">
            <div>
              <h2>Where it goes</h2>
              <p>A thoughtful look at your spending.</p>
            </div>
            <span class="subtle-label">USD</span>
          </div>
          <div class="category-chart">
            @for (category of categoryTotals; track category.value) {
              <div class="category-row">
                <div>
                  <span>{{ category.label }}</span
                  ><strong>{{ money(category.total) }}</strong>
                </div>
                <div class="chart-track">
                  <span
                    [style.width.%]="spent ? (category.total / spent) * 100 : 0"
                    [class]="'category-fill category-' + category.value.toLowerCase()"
                  ></span>
                </div>
              </div>
            }
          </div>
          <div class="chart-total">
            <span>Total recorded</span><strong>{{ money(spent) }}</strong>
          </div>
        </section>
      </div>
      @if (budgetWatch.length) {
        <section class="panel budget-watch">
          <div class="panel-heading">
            <div>
              <h2>A little budget check-in</h2>
              <p>Journeys approaching or exceeding their budget.</p>
            </div>
            <app-icon name="wallet" />
          </div>
          <div class="budget-watch-list">
            @for (trip of budgetWatch; track trip.trip_id) {
              <a [routerLink]="['/trips', trip.trip_id]"
                ><div>
                  <strong>{{ trip.destination }}</strong
                  ><small>{{
                    trip.budget?.state === 'OVER'
                      ? money(trip.budget!.overrun) + ' over budget'
                      : trip.budget!.used_percent +
                        '% used · ' +
                        money(trip.budget!.remaining) +
                        ' remaining'
                  }}</small>
                </div>
                <span [class]="'budget-tag budget-' + trip.budget!.state">{{
                  trip.budget!.state === 'OVER' ? 'Over budget' : 'Near limit'
                }}</span
                ><app-icon name="arrow"
              /></a>
            }
          </div>
        </section>
      }
      <section class="panel recent-panel">
        <div class="panel-heading">
          <div>
            <h2>The latest details</h2>
            <p>Recent expenses across your journeys.</p>
          </div>
          <a routerLink="/expenses" class="small-link">All expenses <app-icon name="arrow" /></a>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Expense</th>
                <th>Trip</th>
                <th>Date</th>
                <th class="align-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              @for (expense of expenses.slice(0, 4); track expense.expense_id) {
                <tr>
                  <td>
                    <div class="table-name">
                      <span class="mini-icon"><app-icon name="expenses" /></span>
                      <div>
                        <strong>{{ expense.description || categoryLabel(expense.category) }}</strong
                        ><small>{{ categoryLabel(expense.category) }}</small>
                      </div>
                    </div>
                  </td>
                  <td>{{ expense.destination }}</td>
                  <td class="muted">{{ date(expense.expense_date) }}</td>
                  <td class="align-right amount">{{ money(expense.amount) }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="empty-cell">
                    Your expenses will appear here once you record them.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }
  </section>`,
})
export class DashboardComponent extends PageState implements OnInit {
  trips: Trip[] = [];
  expenses: Expense[] = [];
  reports: Report[] = [];
  categories = categories;
  greeting =
    new Date().getHours() < 12
      ? 'Good morning'
      : new Date().getHours() < 18
        ? 'Good afternoon'
        : 'Good evening';
  constructor(
    private api: ApiService,
    public auth: AuthService,
  ) {
    super();
  }
  ngOnInit() {
    this.load();
  }
  load() {
    this.run(
      forkJoin({
        trips: this.api.getTrips(),
        expenses: this.api.getExpenses(),
        reports: this.api.getReports(),
      }),
      (data) => {
        this.trips = data.trips;
        this.expenses = data.expenses;
        this.reports = data.reports;
      },
      '',
      true,
    );
  }
  get pending() {
    return this.trips.filter((t) => t.status === 'PLANNED').length;
  }
  get spent() {
    return this.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  }
  get reportsApproved() {
    return this.reports.filter((r) => r.report_status === 'APPROVED').length;
  }
  get upcoming() {
    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
    return this.trips
      .filter((t) => t.start_date >= today && ['PLANNED', 'APPROVED'].includes(t.status))
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
  }
  get budgetWatch() {
    return this.trips
      .filter((t) => t.budget && ['NEAR', 'OVER'].includes(t.budget.state))
      .sort((a, b) => (b.budget?.overrun || 0) - (a.budget?.overrun || 0));
  }
  get categoryTotals() {
    return categories.map((c) => ({
      ...c,
      total: this.expenses
        .filter((e) => e.category === c.value)
        .reduce((sum, e) => sum + Number(e.amount), 0),
    }));
  }
}
