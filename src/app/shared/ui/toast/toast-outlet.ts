import { Component, inject } from '@angular/core';
import { IconComponent } from '../icon/icon';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-outlet',
  imports: [IconComponent],
  template: `
    <div
      class="pointer-events-none fixed inset-x-4 bottom-[calc(var(--bottom-nav-h)+1rem)] z-[200] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:items-end"
    >
      @for (t of toast.toasts(); track t.id) {
        <div
          class="pointer-events-auto flex w-full max-w-sm animate-fade-up items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-3 shadow-[var(--shadow-float)]"
        >
          <span
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
            [class]="
              t.kind === 'success'
                ? 'bg-success-soft text-success'
                : t.kind === 'error'
                  ? 'bg-danger-soft text-danger'
                  : 'bg-info-soft text-info'
            "
          >
            <app-icon [name]="t.kind === 'success' ? 'check' : t.kind === 'error' ? 'alert' : 'info'" [size]="15" />
          </span>
          <p class="flex-1 text-[13px] leading-snug font-medium text-ink">{{ t.message }}</p>
          <button type="button" class="text-faint transition hover:text-ink" (click)="toast.dismiss(t.id)" aria-label="Dismiss">
            <app-icon name="close" [size]="14" />
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        --bottom-nav-h: 0px;
      }
      @media (max-width: 1023px) {
        :host {
          --bottom-nav-h: 62px;
        }
      }
    `,
  ],
  host: { class: 'contents' },
})
export class ToastOutletComponent {
  toast = inject(ToastService);
}
