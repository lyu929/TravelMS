import { Component, Input } from '@angular/core';
import { Trip } from '../models';
import { money } from './ui';
import { IconComponent } from './icon.component';
@Component({
  selector: 'app-budget',
  imports: [IconComponent],
  template: `<div [class]="'budget-summary budget-' + (trip.budget?.state || 'ON_TRACK')">
    <div class="budget-label">
      <span>{{ money(trip.spent) }} spent</span
      ><strong>{{ money(trip.estimated_budget) }} budget</strong>
    </div>
    <div
      class="budget-track"
      [class.over]="trip.budget?.state === 'OVER'"
      role="progressbar"
      aria-label="Budget used"
      aria-valuemin="0"
      aria-valuemax="100"
      [attr.aria-valuenow]="progress"
      [attr.aria-valuetext]="usage"
    >
      <span [style.width.%]="progress"></span>
    </div>
    @if (trip.budget; as budget) {
      <div class="budget-balance">
        <span>{{ budget.state === 'OVER' ? 'Over budget' : 'Remaining' }}</span>
        <strong>{{ money(budget.state === 'OVER' ? budget.overrun : budget.remaining) }}</strong>
        @if (budget.used_percent !== null) {
          <small>{{ budget.used_percent }}% used</small>
        }
      </div>
      @if (budget.state === 'OVER') {
        <div class="budget-warning" role="status">
          <app-icon name="alert" />{{ money(budget.overrun) }} above the budget.
        </div>
      } @else if (budget.state === 'NEAR') {
        <div class="budget-warning" role="status">
          <app-icon name="alert" />At least 80% used. Keep an eye on upcoming expenses.
        </div>
      } @else if (budget.state === 'UNSET') {
        <div class="field-hint">Set a budget to track your spending.</div>
      }
    }
  </div>`,
})
export class BudgetComponent {
  @Input({ required: true }) trip!: Trip;
  money = money;
  get progress() {
    return Math.min(
      100,
      Math.max(0, this.trip.budget?.used_percent ?? (this.trip.spent ? 100 : 0)),
    );
  }
  get usage() {
    return this.trip.budget?.used_percent === null
      ? 'No budget allocated'
      : `${this.trip.budget?.used_percent || 0}% of budget`;
  }
}
