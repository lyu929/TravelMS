import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Expense, Trip } from '../../models';
import { PageState, categories } from '../../shared/ui';
import { IconComponent } from '../../shared/icon.component';
import { ReceiptComponent } from '../../shared/receipt.component';
@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, ReceiptComponent],
  template: ` <section class="page">
    <div class="page-heading">
      <div>
        <div class="eyebrow">THE LITTLE DETAILS</div>
        <h1>Keep every expense in view<span class="title-dot">.</span></h1>
        <p>Airfare, a good meal, a place to stay. It all belongs here.</p>
      </div>
      <button class="primary" (click)="open()" [disabled]="busy">
        <app-icon name="plus" />Add expense
      </button>
    </div>
    @if (error) {
      <div class="error" role="alert"><app-icon name="alert" />{{ error }}</div>
    }
    @if (showForm) {
      <section class="form-box">
        <div class="form-heading">
          <div>
            <h2>{{ editId ? 'Refine the details' : 'One more detail, taken care of' }}</h2>
            <p>Record expenses for an approved or completed trip.</p>
          </div>
          <button
            class="icon-button"
            aria-label="Close expense form"
            (click)="close()"
            [disabled]="busy"
          >
            <app-icon name="close" />
          </button>
        </div>
        @if (!eligible.length) {
          <p class="field-hint">
            You need an approved trip before adding expenses.
            <a routerLink="/trips">View your trips</a>.
          </p>
        } @else {
          <form #expenseForm="ngForm" (ngSubmit)="save(expenseForm.valid)">
            <div class="form-row">
              <label
                >Trip<select
                  name="trip_id"
                  [(ngModel)]="form.trip_id"
                  (ngModelChange)="chooseTrip()"
                  required
                >
                  <option [ngValue]="0" disabled>Select a trip</option>
                  @for (trip of eligible; track trip.trip_id) {
                    <option [ngValue]="trip.trip_id">
                      {{ trip.destination }}{{ auth.isAdmin ? ' · ' + trip.user_name : '' }}
                    </option>
                  }
                </select></label
              ><label
                >Category<select name="category" [(ngModel)]="form.category" required>
                  @for (category of categories; track category.value) {
                    <option [value]="category.value">{{ category.label }}</option>
                  }
                </select></label
              >
            </div>
            <div class="form-row">
              <label
                >Amount (USD)<input
                  name="amount"
                  [(ngModel)]="form.amount"
                  type="number"
                  required
                  min="0.01"
                  max="99999999.99"
                  step="0.01"
                  placeholder="0.00" /></label
              ><label
                >Date<input
                  name="expense_date"
                  [(ngModel)]="form.expense_date"
                  type="date"
                  required
                  [min]="selectedTrip?.start_date || ''"
                  [max]="selectedTrip?.end_date || ''"
              /></label>
            </div>
            <div class="form-row">
              <label
                >Description<input
                  name="description"
                  [(ngModel)]="form.description"
                  maxlength="200"
                  placeholder="What was it for?" /></label
              ><label
                >Receipt link <span class="field-hint">Optional</span
                ><input
                  name="receipt_url"
                  [(ngModel)]="form.receipt_url"
                  type="url"
                  maxlength="500"
                  placeholder="https://…"
              /></label>
            </div>
            <p class="field-hint">
              After saving, attach a PNG, JPEG or PDF from the Receipt column (up to 5 MB).
            </p>
            <div class="form-actions">
              <button class="primary" type="submit" [disabled]="busy">
                {{ busy ? 'Saving…' : editId ? 'Save changes' : 'Save expense'
                }}<app-icon name="check" /></button
              ><button class="secondary" type="button" (click)="close()" [disabled]="busy">
                Cancel
              </button>
            </div>
          </form>
        }
      </section>
    }
    <div class="toolbar">
      <div class="search-box">
        <app-icon name="search" /><input
          [(ngModel)]="search"
          aria-label="Search expenses"
          placeholder="Search expenses or destinations…"
        />
      </div>
      <div class="filter-group">
        <span class="count-label">{{ counted(filtered.length, 'expense') }}</span
        ><select [(ngModel)]="categoryFilter" aria-label="Filter expenses by category">
          <option value="">All categories</option>
          @for (category of categories; track category.value) {
            <option [value]="category.value">{{ category.label }}</option>
          }
        </select>
      </div>
    </div>
    @if (loading) {
      <div class="loading-state">Organizing the little details…</div>
    } @else {
      <section class="panel">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Expense</th>
                <th>Trip</th>
                <th>Date</th>
                <th class="align-right">Amount</th>
                <th>Receipt</th>
                <th class="align-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (expense of filtered; track expense.expense_id) {
                <tr>
                  <td>
                    <div class="table-name">
                      <span class="mini-icon"
                        ><app-icon [name]="expense.category === 'FLIGHT' ? 'plane' : 'expenses'"
                      /></span>
                      <div>
                        <strong>{{ expense.description || categoryLabel(expense.category) }}</strong
                        ><small>{{ categoryLabel(expense.category) }}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {{ expense.destination }}
                    @if (auth.isAdmin) {
                      <small class="field-hint" style="display:block">{{
                        expense.user_name
                      }}</small>
                    }
                  </td>
                  <td class="muted">{{ date(expense.expense_date) }}</td>
                  <td class="align-right amount">{{ money(expense.amount) }}</td>
                  <td>
                    <app-receipt [expense]="expense" (changed)="load()" />
                  </td>
                  <td>
                    <div class="row-actions">
                      <button
                        class="icon-button"
                        (click)="edit(expense)"
                        [attr.aria-label]="'Edit expense ' + expense.expense_id"
                        [disabled]="busy"
                      >
                        <app-icon name="edit" /></button
                      ><button
                        class="icon-button danger"
                        (click)="remove(expense)"
                        [attr.aria-label]="'Delete expense ' + expense.expense_id"
                        [disabled]="busy"
                      >
                        <app-icon name="trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="empty-cell">
                    {{
                      expenses.length
                        ? 'No expenses match your search.'
                        : 'Your journey has details worth keeping. Add your first expense.'
                    }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="inline-summary">
          <span
            >Showing <strong>{{ counted(filtered.length, 'record') }}</strong></span
          ><span
            >Recorded total <strong>{{ money(filteredTotal) }}</strong></span
          ><span>Currency <strong>USD</strong></span>
        </div>
      </section>
    }
  </section>`,
})
export class ExpensesComponent extends PageState implements OnInit {
  expenses: Expense[] = [];
  trips: Trip[] = [];
  categories = categories;
  search = '';
  categoryFilter = '';
  showForm = false;
  editId: number | null = null;
  private initialAction = true;
  form: Expense = {
    trip_id: 0,
    category: 'FLIGHT',
    amount: 0,
    expense_date: '',
    description: '',
    receipt_url: '',
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
  }
  load() {
    this.run(
      forkJoin({ expenses: this.api.getExpenses(), trips: this.api.getTrips() }),
      (data) => {
        this.expenses = data.expenses;
        this.trips = data.trips;
        if (this.initialAction) {
          this.initialAction = false;
          if (this.route.snapshot.queryParamMap.get('new')) this.open();
        }
      },
      '',
      true,
    );
  }
  get eligible() {
    return this.trips.filter((t) => ['APPROVED', 'COMPLETED'].includes(t.status));
  }
  get selectedTrip() {
    return this.trips.find((t) => t.trip_id === this.form.trip_id);
  }
  get filtered() {
    const q = this.search.trim().toLowerCase();
    return this.expenses.filter(
      (e) =>
        (!this.categoryFilter || e.category === this.categoryFilter) &&
        (!q ||
          [e.description, e.destination, this.categoryLabel(e.category)].some((s) =>
            s?.toLowerCase().includes(q),
          )),
    );
  }
  get filteredTotal() {
    return this.filtered.reduce((sum, e) => sum + Number(e.amount), 0);
  }
  open() {
    this.editId = null;
    this.form = {
      trip_id:
        this.eligible.find(
          (t) => t.trip_id === Number(this.route.snapshot.queryParamMap.get('trip')),
        )?.trip_id ||
        this.eligible[0]?.trip_id ||
        0,
      category: 'FLIGHT',
      amount: 0,
      expense_date: '',
      description: '',
      receipt_url: '',
    };
    this.chooseTrip();
    this.showForm = true;
    this.error = '';
  }
  chooseTrip() {
    const trip = this.selectedTrip;
    if (
      trip &&
      (!this.form.expense_date ||
        this.form.expense_date < trip.start_date ||
        this.form.expense_date > trip.end_date)
    )
      this.form.expense_date = trip.start_date;
  }
  close() {
    this.showForm = false;
    this.editId = null;
    this.error = '';
  }
  edit(expense: Expense) {
    this.form = { ...expense };
    this.editId = expense.expense_id!;
    this.showForm = true;
    this.error = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  save(valid: boolean | null) {
    if (!valid || !this.form.trip_id || this.form.amount <= 0) {
      this.error = 'Select a trip and enter a valid positive amount and date.';
      return;
    }
    const { user_id, ...input } = this.form;
    const request = this.editId
      ? this.api.updateExpense(this.editId, input)
      : this.api.createExpense(input);
    this.run(
      request,
      () => {
        this.close();
        this.load();
      },
      'Expense saved. One less detail to remember.',
    );
  }
  remove(expense: Expense) {
    if (confirm('Delete this expense? Saved reports will keep their original totals.'))
      this.run(this.api.deleteExpense(expense.expense_id!), () => this.load(), 'Expense deleted.');
  }
}
