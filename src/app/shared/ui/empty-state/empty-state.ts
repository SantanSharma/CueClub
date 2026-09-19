import { Component, input } from '@angular/core';
import { IconComponent, IconName } from '../icon/icon';

@Component({
  selector: 'app-empty-state',
  imports: [IconComponent],
  template: `
    <div class="flex animate-fade-up flex-col items-center justify-center px-6 py-14 text-center">
      <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <app-icon [name]="icon()" [size]="22" />
      </div>
      <h3 class="text-[15px] font-semibold text-ink">{{ title() }}</h3>
      @if (description()) {
        <p class="mt-1 max-w-xs text-[13px] leading-relaxed text-muted">{{ description() }}</p>
      }
      <div class="mt-4 empty:hidden">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  host: { class: 'block' },
})
export class EmptyStateComponent {
  icon = input<IconName>('layers');
  title = input('Nothing here yet');
  description = input<string | undefined>(undefined);
}
