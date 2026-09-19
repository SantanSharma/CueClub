import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { DataStoreService } from '../../core/services/data-store.service';
import { OrderFlowService } from '../../core/services/order-flow.service';
import { IconComponent, IconName } from '../../shared/ui/icon/icon';
import { TooltipDirective } from '../../shared/ui/tooltip/tooltip.directive';

interface NavItem {
  label: string;
  path: string;
  icon: IconName;
  hint: string;
}

/** Daily work first, configuration and reporting last. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Operations', path: '/operations', icon: 'calendar', hint: "Today's bookings and counter sales — your main workspace" },
  { label: 'Customers', path: '/customers', icon: 'users', hint: 'Customer list, spend history and outstanding balances' },
  { label: 'Inventory', path: '/inventory', icon: 'box', hint: 'Stock levels, pricing and stock movement history' },
  { label: 'Analytics', path: '/analytics', icon: 'chart', hint: 'Revenue trends, product margins, expenses and CSV export' },
  { label: 'Settings', path: '/settings', icon: 'settings', hint: 'Tables, hourly rates and shop details' },
];

@Component({
  selector: 'app-sidebar-nav',
  imports: [RouterLink, RouterLinkActive, IconComponent, TooltipDirective],
  template: `
    <aside class="flex h-dvh w-[248px] flex-col border-r border-line bg-surface px-3 py-4">
      <a routerLink="/operations" class="mb-5 flex items-center gap-2.5 px-2">
        <span
          class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-darker text-white shadow-[var(--shadow-glow)]"
        >
          <app-icon name="cue" [size]="19" />
        </span>
        <span class="min-w-0">
          <span class="block text-[15px] leading-tight font-extrabold tracking-tight text-ink">CueClub</span>
          <span class="block truncate text-[11px] text-muted">{{ store.config().shopName }}</span>
        </span>
      </a>

      <button
        type="button"
        class="btn btn-primary btn-lg mb-5 w-full"
        (click)="flow.startBooking()"
        [appTooltip]="'Start a new table booking or counter sale — you can create the customer here too'"
        tooltipPlacement="right"
      >
        <app-icon name="plus" [size]="17" />
        New Booking
      </button>

      <nav class="flex flex-1 flex-col gap-1">
        @for (item of items; track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="!bg-primary-soft !text-primary-darker font-semibold"
            class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-muted transition hover:bg-surface-alt hover:text-ink"
            [appTooltip]="item.hint"
            tooltipPlacement="right"
          >
            <app-icon [name]="item.icon" [size]="18" />
            <span>{{ item.label }}</span>
          </a>
        }
      </nav>

      <div class="mt-3 rounded-xl border border-line bg-canvas p-3">
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 shrink-0 rounded-full bg-success"></span>
          <p class="truncate text-[13px] font-semibold text-ink">{{ store.config().shopName }}</p>
        </div>
        <p class="mt-0.5 text-[11px] text-muted">
          Open {{ store.config().openingTime }} – {{ store.config().closingTime }}
        </p>
      </div>
    </aside>
  `,
  host: { class: 'contents' },
})
export class SidebarNavComponent {
  items = NAV_ITEMS;
  store = inject(DataStoreService);
  flow = inject(OrderFlowService);
}
