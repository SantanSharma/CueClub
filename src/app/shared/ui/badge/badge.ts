import { Component, computed, input } from '@angular/core';

const STATUS_MAP: Record<string, { label: string; cls: string; dot: string }> = {
  paid: { label: 'Paid', cls: 'bg-success-soft text-success', dot: 'bg-success' },
  partial: { label: 'Part Paid', cls: 'bg-warn-soft text-warn', dot: 'bg-warn' },
  unpaid: { label: 'Unpaid', cls: 'bg-danger-soft text-danger', dot: 'bg-danger' },
  available: { label: 'Free', cls: 'bg-success-soft text-success', dot: 'bg-success' },
  occupied: { label: 'In Play', cls: 'bg-danger-soft text-danger', dot: 'bg-danger' },
  upcoming: { label: 'Upcoming', cls: 'bg-warn-soft text-warn', dot: 'bg-warn' },
  maintenance: { label: 'Maintenance', cls: 'bg-surface-alt text-muted', dot: 'bg-faint' },
  ongoing: { label: 'In Play', cls: 'bg-danger-soft text-danger', dot: 'bg-danger' },
  completed: { label: 'Done', cls: 'bg-info-soft text-info', dot: 'bg-info' },
  cancelled: { label: 'Cancelled', cls: 'bg-surface-alt text-muted', dot: 'bg-faint' },
  'in-stock': { label: 'In Stock', cls: 'bg-success-soft text-success', dot: 'bg-success' },
  'low-stock': { label: 'Low Stock', cls: 'bg-warn-soft text-warn', dot: 'bg-warn' },
  'out-of-stock': { label: 'Out of Stock', cls: 'bg-danger-soft text-danger', dot: 'bg-danger' },
  booking: { label: 'Table', cls: 'bg-primary-soft text-primary-darker', dot: 'bg-primary' },
  sale: { label: 'Counter', cls: 'bg-info-soft text-info', dot: 'bg-info' },
};

@Component({
  selector: 'app-badge',
  template: `
    <span class="pill" [class]="entry().cls">
      @if (showDot()) {
        <span class="h-1.5 w-1.5 rounded-full" [class]="entry().dot"></span>
      }
      {{ label() }}
    </span>
  `,
  host: { class: 'inline-flex' },
})
export class BadgeComponent {
  status = input.required<string>();
  labelOverride = input<string | undefined>(undefined);
  showDot = input(true);

  entry = computed(() => STATUS_MAP[this.status()] ?? { label: this.status(), cls: 'bg-surface-alt text-muted', dot: 'bg-faint' });
  label = computed(() => this.labelOverride() ?? this.entry().label);
}
