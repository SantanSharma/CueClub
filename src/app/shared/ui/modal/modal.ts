import { Component, HostListener, OnDestroy, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon';
import { lockBodyScroll, unlockBodyScroll } from '../../util/scroll-lock';

/** Centered dialog for short confirmations. Longer flows use app-drawer. */
@Component({
  selector: 'app-modal',
  imports: [IconComponent],
  template: `
    <div class="fixed inset-0 z-[140] flex items-end justify-center p-0 sm:items-center sm:p-6" (click)="onBackdrop($event)">
      <div class="absolute inset-0 animate-fade-in bg-ink/40 backdrop-blur-[2px]"></div>

      <div
        class="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-[var(--shadow-float)] animate-slide-up sm:rounded-2xl sm:animate-pop"
        [class]="widthClass()"
        role="dialog"
        aria-modal="true"
      >
        <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 class="text-base font-bold tracking-tight text-ink">{{ title() }}</h2>
          <button type="button" class="btn btn-ghost btn-icon -mr-1" (click)="close.emit()" aria-label="Close">
            <app-icon name="close" [size]="18" />
          </button>
        </header>

        <div class="flex flex-col gap-4 overflow-y-auto px-5 py-5">
          <ng-content></ng-content>
        </div>

        <footer class="empty:hidden safe-bottom flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">
          <ng-content select="[modal-footer]"></ng-content>
        </footer>
      </div>
    </div>
  `,
  host: { class: 'contents' },
})
export class ModalComponent implements OnDestroy {
  title = input('');
  size = input<'sm' | 'md'>('sm');
  close = output<void>();

  constructor() {
    lockBodyScroll();
  }

  ngOnDestroy(): void {
    unlockBodyScroll();
  }

  widthClass(): string {
    return this.size() === 'md' ? 'sm:max-w-lg' : 'sm:max-w-md';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }

  onBackdrop(ev: MouseEvent): void {
    if (ev.target === ev.currentTarget) this.close.emit();
  }
}
