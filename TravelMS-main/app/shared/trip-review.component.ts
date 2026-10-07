import { Component, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Trip, TripStatus } from '../models';
import { ApiService } from '../services/api.service';
import { PageState } from './ui';
import { IconComponent } from './icon.component';
@Component({
  selector: 'app-trip-review',
  imports: [FormsModule, IconComponent],
  template: `<div class="review-actions">
    @if (trip.status === 'PLANNED') {
      <button class="small-action approve" (click)="open('APPROVED')">
        <app-icon name="check" />Approve
      </button>
      <button class="small-action reject" (click)="open('REJECTED')">Revise</button>
    } @else if (trip.status === 'APPROVED') {
      <button class="small-action approve" (click)="open('COMPLETED')">
        <app-icon name="check" />Complete
      </button>
    } @else if (trip.status === 'REJECTED') {
      <button class="small-action approve" (click)="open('PLANNED')">Resubmit</button>
    }
    <dialog
      #reviewDialog
      class="review-dialog"
      (cancel)="cancel($event)"
      [attr.aria-labelledby]="'review-title-' + trip.trip_id"
    >
      <div class="form-heading">
        <div>
          <div class="eyebrow">TRIP REVIEW</div>
          <h2 [id]="'review-title-' + trip.trip_id">{{ title }}</h2>
          <p>{{ trip.destination }}</p>
        </div>
        <button class="icon-button" aria-label="Close review" (click)="close()" [disabled]="busy">
          <app-icon name="close" />
        </button>
      </div>
      <form #reviewForm="ngForm" (ngSubmit)="save(reviewForm.valid)">
        <label
          >Review comment {{ status === 'REJECTED' ? '(required)' : '(optional)' }}
          <textarea
            name="comment"
            [(ngModel)]="comment"
            [required]="status === 'REJECTED'"
            maxlength="1000"
            rows="4"
            placeholder="Explain your decision or the changes needed."
          ></textarea>
        </label>
        @if (error) {
          <div class="error" role="alert">{{ error }}</div>
        }
        <div class="form-actions">
          <button class="primary" type="submit" [disabled]="busy">
            {{ busy ? 'Saving…' : title }}
          </button>
          <button class="secondary" type="button" (click)="close()" [disabled]="busy">
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  </div>`,
})
export class TripReviewComponent extends PageState {
  @Input({ required: true }) trip!: Trip;
  @Output() changed = new EventEmitter<void>();
  @ViewChild('reviewDialog') dialog!: ElementRef<HTMLDialogElement>;
  status: TripStatus = 'APPROVED';
  comment = '';
  constructor(private api: ApiService) {
    super();
  }
  get title() {
    return (
      {
        APPROVED: 'Approve trip',
        REJECTED: 'Return for revision',
        COMPLETED: 'Complete trip',
        PLANNED: 'Resubmit trip',
      } as Record<string, string>
    )[this.status];
  }
  open(status: TripStatus) {
    this.status = status;
    this.comment = '';
    this.error = '';
    this.dialog.nativeElement.showModal();
  }
  close() {
    if (!this.busy) this.dialog.nativeElement.close();
  }
  cancel(event: Event) {
    if (this.busy) event.preventDefault();
  }
  save(valid: boolean | null) {
    if (!valid || (this.status === 'REJECTED' && !this.comment.trim())) {
      this.error = 'Explain what needs to change before returning this trip.';
      return;
    }
    this.run(
      this.api.updateTripStatus(this.trip.trip_id!, this.status, this.comment),
      () => {
        this.close();
        this.changed.emit();
      },
      'Trip review saved to activity.',
    );
  }
}
