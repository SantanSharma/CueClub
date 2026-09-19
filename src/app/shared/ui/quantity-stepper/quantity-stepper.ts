import { Component, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon';

@Component({
  selector: 'app-quantity-stepper',
  imports: [IconComponent],
  template: `
    <div
      class="inline-flex items-center overflow-hidden rounded-xl border border-line bg-surface"
      [class.opacity-50]="disabled()"
    >
      <button
        type="button"
        class="flex h-10 w-10 items-center justify-center text-ink transition active:scale-95 disabled:text-faint sm:h-9 sm:w-9"
        [disabled]="disabled() || value() <= min()"
        (click)="change(-1)"
        aria-label="Decrease quantity"
      >
        <app-icon name="minus" [size]="16" />
      </button>
      <span class="min-w-9 text-center text-sm font-bold tabular-nums">{{ value() }}</span>
      <button
        type="button"
        class="flex h-10 w-10 items-center justify-center text-primary transition active:scale-95 disabled:text-faint sm:h-9 sm:w-9"
        [disabled]="disabled() || value() >= max()"
        (click)="change(1)"
        aria-label="Increase quantity"
      >
        <app-icon name="plus" [size]="16" />
      </button>
    </div>
  `,
  host: { class: 'inline-flex' },
})
export class QuantityStepperComponent {
  value = input(0);
  min = input(0);
  max = input(9999);
  disabled = input(false);
  valueChange = output<number>();

  change(delta: number): void {
    const next = this.value() + delta;
    if (next < this.min() || next > this.max()) return;
    this.valueChange.emit(next);
  }
}
