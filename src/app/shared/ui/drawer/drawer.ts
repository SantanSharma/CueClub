import { Component, HostListener, OnDestroy, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon';
import { lockBodyScroll, unlockBodyScroll } from '../../util/scroll-lock';

/**
 * Side panel on pointer devices, bottom sheet on phones.
 * Secondary detail and creation flows live here so the merchant never
 * loses the list they were working from.
 */
@Component({
  selector: 'app-drawer',
  imports: [IconComponent],
  template: `
    <div class="fixed inset-0 z-[120] flex justify-end">
      <div class="absolute inset-0 animate-fade-in bg-ink/40 backdrop-blur-[2px]" (click)="close.emit()"></div>

      <section
        class="relative flex h-full w-full flex-col overflow-hidden bg-canvas shadow-[var(--shadow-float)] animate-slide-up sm:animate-slide-left"
        [class]="widthClass()"
        role="dialog"
        aria-modal="true"
      >
        <header class="flex items-start gap-3 border-b border-line bg-surface px-4 py-3.5 sm:px-5 sm:py-4">
          <div class="min-w-0 flex-1">
            <h2 class="truncate text-[17px] leading-tight font-bold tracking-tight text-ink sm:text-lg">{{ title() }}</h2>
            @if (subtitle()) {
              <p class="mt-0.5 truncate text-[13px] text-muted">{{ subtitle() }}</p>
            }
          </div>
          <ng-content select="[drawer-header-action]"></ng-content>
          <button
            type="button"
            class="btn btn-ghost btn-icon -mr-1 shrink-0"
            (click)="close.emit()"
            aria-label="Close panel"
          >
            <app-icon name="close" [size]="18" />
          </button>
        </header>

        <div class="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
          <ng-content></ng-content>
        </div>

        <footer
          class="empty:hidden safe-bottom flex shrink-0 items-center justify-end gap-2 border-t border-line bg-surface px-4 py-3 sm:px-5"
        >
          <ng-content select="[drawer-footer]"></ng-content>
        </footer>
      </section>
    </div>
  `,
  host: { class: 'contents' },
})
export class DrawerComponent implements OnDestroy {
  title = input('');
  subtitle = input('');
  /** Tailwind max-width for the desktop panel. */
  size = input<'md' | 'lg' | 'xl'>('lg');
  close = output<void>();

  constructor() {
    lockBodyScroll();
  }

  ngOnDestroy(): void {
    unlockBodyScroll();
  }

  widthClass(): string {
    const sizes = {
      md: 'sm:max-w-md mt-auto sm:mt-0 max-h-[94vh] sm:max-h-none rounded-t-2xl sm:rounded-none',
      lg: 'sm:max-w-lg mt-auto sm:mt-0 max-h-[94vh] sm:max-h-none rounded-t-2xl sm:rounded-none',
      xl: 'sm:max-w-2xl mt-auto sm:mt-0 max-h-[94vh] sm:max-h-none rounded-t-2xl sm:rounded-none',
    };
    return sizes[this.size()];
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }
}
