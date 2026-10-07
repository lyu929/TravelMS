import { ChangeDetectorRef, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
export const counted = (count: number, singular: string, plural = singular + 's') =>
  `${count} ${count === 1 ? singular : plural}`;
export const money = (value: number | undefined) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
export const dateLabel = (value: string | undefined) =>
  value
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(value.slice(0, 10) + 'T12:00:00Z'))
    : '—';
export const tripLabel = (status: string) =>
  (
    ({
      PLANNED: 'Pending approval',
      APPROVED: 'Approved',
      REJECTED: 'Needs revision',
      COMPLETED: 'Completed',
      CANCELLED: 'Cancelled',
    }) as Record<string, string>
  )[status] || status;
export const categoryLabel = (category: string) =>
  (
    ({
      FLIGHT: 'Airfare',
      LODGING: 'Accommodation',
      FOOD: 'Food & drinks',
      TRANSPORT: 'Transport',
      OTHER: 'Other',
    }) as Record<string, string>
  )[category] || category;
export const reportLabel = (status: string) =>
  (
    ({ GENERATED: 'Draft', SUBMITTED: 'Submitted', APPROVED: 'Approved' }) as Record<string, string>
  )[status] || status;
export const categories = [
  { value: 'FLIGHT', label: 'Airfare' },
  { value: 'LODGING', label: 'Accommodation' },
  { value: 'FOOD', label: 'Food & drinks' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'OTHER', label: 'Other' },
];
@Injectable({ providedIn: 'root' })
export class Notices {
  message = signal('');
  private timer?: ReturnType<typeof setTimeout>;
  show(message: string) {
    this.message.set(message);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.message.set(''), 4500);
  }
}
export abstract class PageState {
  counted = counted;
  loading = false;
  busy = false;
  error = '';
  money = money;
  date = dateLabel;
  tripLabel = tripLabel;
  categoryLabel = categoryLabel;
  reportLabel = reportLabel;
  private cdr = inject(ChangeDetectorRef);
  private destroy = inject(DestroyRef);
  protected notices = inject(Notices);
  run<T>(request: Observable<T>, success: (value: T) => void, message = '', loading = false) {
    this.error = '';
    this.busy = true;
    this.loading = loading;
    return request.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (value) => {
        this.busy = false;
        this.loading = false;
        success(value);
        if (message) this.notices.show(message);
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.busy = false;
        this.loading = false;
        this.error =
          error.error?.error ||
          (error.status === 0
            ? 'Cannot reach the server. Check that Waypoint is running.'
            : 'The request failed. Please try again.');
        this.cdr.markForCheck();
      },
    });
  }
}
