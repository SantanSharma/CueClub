import { Component, OnDestroy, effect, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { OrderFlowService } from '../../core/services/order-flow.service';
import { IconComponent } from '../../shared/ui/icon/icon';
import { lockBodyScroll, unlockBodyScroll } from '../../shared/util/scroll-lock';

@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  template: `
    <nav
      class="safe-bottom fixed inset-x-0 bottom-0 z-[90] grid grid-cols-5 items-end border-t border-line bg-surface/95 px-1 pt-1.5 pb-1 backdrop-blur-lg"
    >
      <a
        routerLink="/operations"
        routerLinkActive="!text-primary"
        class="flex flex-col items-center justify-end gap-0.5 py-1 text-[10px] leading-tight font-medium text-muted transition active:scale-95"
      >
        <app-icon name="calendar" [size]="20" />
        <span>Operations</span>
      </a>
      <a
        routerLink="/customers"
        routerLinkActive="!text-primary"
        class="flex flex-col items-center justify-end gap-0.5 py-1 text-[10px] leading-tight font-medium text-muted transition active:scale-95"
      >
        <app-icon name="users" [size]="20" />
        <span>Customers</span>
      </a>

      <div class="flex items-end justify-center">
        <button
          type="button"
          class="flex h-14 w-14 -translate-y-4 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-darker text-white shadow-[var(--shadow-glow)] transition active:scale-95"
          (click)="flow.startBooking()"
          aria-label="New booking"
        >
          <app-icon name="plus" [size]="24" [strokeWidth]="2.5" />
        </button>
      </div>

      <a
        routerLink="/inventory"
        routerLinkActive="!text-primary"
        class="flex flex-col items-center justify-end gap-0.5 py-1 text-[10px] leading-tight font-medium text-muted transition active:scale-95"
      >
        <app-icon name="box" [size]="20" />
        <span>Stock</span>
      </a>
      <button
        type="button"
        class="flex flex-col items-center justify-end gap-0.5 py-1 text-[10px] leading-tight font-medium transition active:scale-95"
        [class]="moreOpen() ? 'text-primary' : 'text-muted'"
        (click)="moreOpen.set(!moreOpen())"
      >
        <app-icon name="more" [size]="20" />
        <span>More</span>
      </button>
    </nav>

    @if (moreOpen()) {
      <div class="fixed inset-0 z-[95] animate-fade-in bg-ink/40 backdrop-blur-[2px]" (click)="moreOpen.set(false)">
        <div
          class="safe-bottom absolute inset-x-0 bottom-0 animate-slide-up rounded-t-2xl bg-surface p-3 pb-20 shadow-[var(--shadow-float)]"
          (click)="$event.stopPropagation()"
        >
          <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-line"></div>
          <a
            routerLink="/analytics"
            (click)="moreOpen.set(false)"
            class="flex items-center gap-3 rounded-xl px-3 py-3.5 text-[15px] font-medium text-ink active:bg-surface-alt"
          >
            <app-icon name="chart" [size]="19" />
            Analytics &amp; Reports
          </a>
          <a
            routerLink="/settings"
            (click)="moreOpen.set(false)"
            class="flex items-center gap-3 rounded-xl px-3 py-3.5 text-[15px] font-medium text-ink active:bg-surface-alt"
          >
            <app-icon name="settings" [size]="19" />
            Settings
          </a>
        </div>
      </div>
    }
  `,
  host: { class: 'contents' },
})
export class BottomNavComponent implements OnDestroy {
  flow = inject(OrderFlowService);
  moreOpen = signal(false);
  private locked = false;

  constructor() {
    effect(() => {
      const open = this.moreOpen();
      if (open && !this.locked) {
        lockBodyScroll();
        this.locked = true;
      } else if (!open && this.locked) {
        unlockBodyScroll();
        this.locked = false;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.locked) unlockBodyScroll();
  }
}
