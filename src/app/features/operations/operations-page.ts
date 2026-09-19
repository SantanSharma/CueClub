import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataStoreService } from '../../core/services/data-store.service';
import { OrderFlowService } from '../../core/services/order-flow.service';
import { BadgeComponent } from '../../shared/ui/badge/badge';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { IconComponent } from '../../shared/ui/icon/icon';
import { TooltipDirective } from '../../shared/ui/tooltip/tooltip.directive';
import { addDays, formatCurrency, formatTime12, relativeDayLabel, todayStr } from '../../shared/util/format';

type Preset = 'today' | 'yesterday' | 'week' | 'custom';
type Filter = 'all' | 'running' | 'upcoming' | 'unpaid' | 'done';

/**
 * The merchant's home base: what is happening on the tables right now and
 * every booking / counter sale for the chosen day. Creation and detail both
 * happen in drawers so this list is never lost.
 */
@Component({
  selector: 'app-operations-page',
  imports: [FormsModule, IconComponent, BadgeComponent, EmptyStateComponent, TooltipDirective],
  template: `
    <div class="flex flex-col gap-5">
      <!-- Header -->
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">Operations</h1>
          <p class="mt-0.5 text-[13px] text-muted sm:text-sm">{{ contextLabel() }} · {{ rows().length }} order(s)</p>
        </div>
        <!-- New booking lives in the sidebar / mobile FAB so there is one primary CTA.
             This is the shortcut for the less common products-only path. -->
        <button
          type="button"
          class="btn btn-secondary hidden lg:inline-flex"
          (click)="flow.startSale()"
          [appTooltip]="'Sell drinks or snacks to someone who is not taking a table'"
        >
          <app-icon name="cart" [size]="16" /> Counter sale
        </button>
      </header>

      <!-- Date context -->
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="chip" [class.chip-active]="preset() === 'today'" (click)="setPreset('today')">Today</button>
        <button type="button" class="chip" [class.chip-active]="preset() === 'yesterday'" (click)="setPreset('yesterday')">Yesterday</button>
        <button type="button" class="chip" [class.chip-active]="preset() === 'week'" (click)="setPreset('week')">Last 7 days</button>
        <button type="button" class="chip" [class.chip-active]="preset() === 'custom'" (click)="setPreset('custom')">
          <app-icon name="calendar" [size]="14" /> Pick dates
        </button>
        @if (preset() === 'custom') {
          <div class="flex animate-fade-up items-center gap-2">
            <input class="input w-auto py-2" type="date" [ngModel]="from()" (ngModelChange)="from.set($event)" />
            <span class="text-xs text-muted">to</span>
            <input class="input w-auto py-2" type="date" [ngModel]="to()" (ngModelChange)="to.set($event)" />
          </div>
        }
      </div>

      <!-- Table status strip -->
      <section>
        <div class="mb-2 flex items-center gap-2">
          <h2 class="text-[13px] font-bold tracking-wide text-muted uppercase">Tables right now</h2>
          <span class="text-faint" [appTooltip]="'Live table state. Tap a free table to start a booking on it, or a busy one to open its bill.'">
            <app-icon name="help" [size]="14" />
          </span>
        </div>
        <div class="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 md:grid-cols-3 xl:grid-cols-4">
          @for (t of tableCards(); track t.id) {
            <button
              type="button"
              class="card min-w-[180px] flex-1 p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-raise)] sm:min-w-0"
              (click)="tapTable(t)"
            >
              <div class="flex items-center gap-2">
                <span class="h-2.5 w-2.5 shrink-0 rounded-full" [class]="t.dot"></span>
                <span class="text-[15px] font-bold text-ink">{{ t.name }}</span>
                <span class="ml-auto text-[11px] font-medium text-muted">{{ formatCurrency(t.rate) }}/hr</span>
              </div>
              <div class="mt-2"><app-badge [status]="t.status" [labelOverride]="t.badgeLabel" /></div>
              <p class="mt-2 truncate text-[12px] text-muted">{{ t.meta }}</p>
            </button>
          }
        </div>
      </section>

      <!-- Pulse -->
      <div class="grid grid-cols-3 gap-2.5 sm:gap-3">
        <div class="card px-3.5 py-3">
          <p class="text-[11px] font-medium tracking-wide text-muted uppercase">Takings</p>
          <p class="mt-0.5 text-lg font-extrabold text-ink tabular-nums sm:text-xl">{{ formatCurrency(periodTotals().revenue) }}</p>
        </div>
        <div class="card px-3.5 py-3">
          <p class="text-[11px] font-medium tracking-wide text-muted uppercase">Unpaid</p>
          <p class="mt-0.5 text-lg font-extrabold tabular-nums sm:text-xl" [class]="periodTotals().due > 0 ? 'text-danger' : 'text-ink'">
            {{ formatCurrency(periodTotals().due) }}
          </p>
        </div>
        <div class="card px-3.5 py-3">
          <p class="text-[11px] font-medium tracking-wide text-muted uppercase">In play</p>
          <p class="mt-0.5 text-lg font-extrabold text-ink tabular-nums sm:text-xl">
            {{ store.activeBookingsCount() }}<span class="text-sm font-semibold text-muted">/{{ store.tables().length }}</span>
          </p>
        </div>
      </div>

      <!-- Orders -->
      <section class="flex flex-col gap-3">
        <div class="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div class="relative flex-1">
            <span class="absolute top-1/2 left-3 -translate-y-1/2 text-faint"><app-icon name="search" [size]="16" /></span>
            <input class="input pl-9" type="text" placeholder="Search customer, mobile or table" [ngModel]="search()" (ngModelChange)="search.set($event)" />
          </div>
          <div class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            @for (f of filters; track f.id) {
              <button type="button" class="chip shrink-0" [class.chip-active]="filter() === f.id" (click)="filter.set(f.id)">
                {{ f.label }}
              </button>
            }
          </div>
        </div>

        @if (rows().length) {
          <!-- Desktop table -->
          <div class="card hidden overflow-hidden lg:block">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-line bg-canvas text-left">
                  <th class="px-4 py-2.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Customer</th>
                  <th class="px-4 py-2.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Type</th>
                  <th class="px-4 py-2.5 text-[11px] font-semibold tracking-wide text-muted uppercase">When</th>
                  <th class="px-4 py-2.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Status</th>
                  <th class="px-4 py-2.5 text-right text-[11px] font-semibold tracking-wide text-muted uppercase">Total</th>
                  <th class="px-4 py-2.5 text-right text-[11px] font-semibold tracking-wide text-muted uppercase">Due</th>
                  <th class="px-4 py-2.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Payment</th>
                  <th class="w-10"></th>
                </tr>
              </thead>
              <tbody class="stagger">
                @for (r of rows(); track r.billId) {
                  <tr class="row-hover cursor-pointer border-b border-line-soft last:border-0" (click)="flow.openDetail(r.billId)">
                    <td class="px-4 py-3">
                      <div class="font-semibold text-ink">{{ r.customerName }}</div>
                      <div class="text-xs text-muted">{{ r.mobile }}</div>
                    </td>
                    <td class="px-4 py-3">
                      <div class="font-medium text-ink-soft">{{ r.tableName || 'Counter' }}</div>
                      <div class="text-xs text-muted">{{ r.itemsLabel }}</div>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-ink-soft">{{ r.when }}</td>
                    <td class="px-4 py-3">
                      @if (r.bookingStatus) { <app-badge [status]="r.bookingStatus" /> } @else { <app-badge status="sale" /> }
                    </td>
                    <td class="px-4 py-3 text-right font-semibold tabular-nums">{{ formatCurrency(r.total) }}</td>
                    <td class="px-4 py-3 text-right font-semibold tabular-nums" [class]="r.due > 0 ? 'text-danger' : 'text-muted'">
                      {{ formatCurrency(r.due) }}
                    </td>
                    <td class="px-4 py-3"><app-badge [status]="r.paymentStatus" /></td>
                    <td class="pr-3 text-faint"><app-icon name="chevron-right" [size]="16" /></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Mobile / tablet cards -->
          <div class="stagger flex flex-col gap-2.5 lg:hidden">
            @for (r of rows(); track r.billId) {
              <button type="button" class="card card-pad text-left transition active:scale-[0.99]" (click)="flow.openDetail(r.billId)">
                <div class="flex items-start gap-3">
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-[15px] font-bold text-ink">{{ r.customerName }}</p>
                    <p class="text-xs text-muted">{{ r.mobile }}</p>
                  </div>
                  <div class="text-right">
                    <p class="text-[15px] font-extrabold text-ink tabular-nums">{{ formatCurrency(r.total) }}</p>
                    @if (r.due > 0) {
                      <p class="text-xs font-semibold text-danger tabular-nums">{{ formatCurrency(r.due) }} due</p>
                    }
                  </div>
                </div>
                <div class="mt-2.5 flex flex-wrap items-center gap-1.5">
                  @if (r.bookingStatus) { <app-badge [status]="r.bookingStatus" /> } @else { <app-badge status="sale" /> }
                  <app-badge [status]="r.paymentStatus" />
                  <span class="pill bg-surface-alt text-muted">{{ r.tableName || 'Counter' }} · {{ r.when }}</span>
                </div>
              </button>
            }
          </div>
        } @else {
          <div class="card">
            <app-empty-state
              icon="calendar"
              [title]="search() ? 'Nothing matches that search' : 'No orders for ' + contextLabel().toLowerCase()"
              description="Start a table booking or ring up a counter sale — you can add the customer as you go."
            >
              <div class="flex flex-wrap justify-center gap-2">
                <button type="button" class="btn btn-primary" (click)="flow.startBooking()">
                  <app-icon name="plus" [size]="16" /> New booking
                </button>
                <button type="button" class="btn btn-secondary" (click)="flow.startSale()">
                  <app-icon name="cart" [size]="16" /> Counter sale
                </button>
              </div>
            </app-empty-state>
          </div>
        }
      </section>
    </div>
  `,
  host: { class: 'block animate-fade-up' },
})
export class OperationsPage {
  store = inject(DataStoreService);
  flow = inject(OrderFlowService);
  formatCurrency = formatCurrency;

  preset = signal<Preset>('today');
  from = signal(todayStr());
  to = signal(todayStr());
  search = signal('');
  filter = signal<Filter>('all');

  filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'running', label: 'In play' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'unpaid', label: 'Unpaid' },
    { id: 'done', label: 'Completed' },
  ];

  setPreset(p: Preset): void {
    this.preset.set(p);
    const today = todayStr();
    if (p === 'today') {
      this.from.set(today);
      this.to.set(today);
    } else if (p === 'yesterday') {
      this.from.set(addDays(today, -1));
      this.to.set(addDays(today, -1));
    } else if (p === 'week') {
      this.from.set(addDays(today, -6));
      this.to.set(today);
    }
  }

  contextLabel = computed(() => {
    if (this.from() === this.to()) return relativeDayLabel(this.from());
    return `${relativeDayLabel(this.from())} – ${relativeDayLabel(this.to())}`;
  });

  tableCards = computed(() =>
    this.store.tables().map((t) => {
      const status = this.store.tableStatus(t.id);
      const dots: Record<string, string> = {
        available: 'bg-success',
        occupied: 'bg-danger',
        upcoming: 'bg-warn',
        maintenance: 'bg-faint',
      };
      let meta = 'Ready for the next customer';
      let badgeLabel: string | undefined;
      let billId: string | undefined;

      if (status === 'occupied') {
        const b = this.store.currentBookingForTable(t.id);
        if (b) {
          const c = this.store.customers().find((x) => x.id === b.customerId);
          meta = `${c?.name ?? 'Customer'} · till ${formatTime12(b.endTime)}`;
          billId = b.billId;
        }
      } else if (status === 'upcoming') {
        const b = this.store.nextBookingForTable(t.id);
        if (b) {
          const c = this.store.customers().find((x) => x.id === b.customerId);
          badgeLabel = `From ${formatTime12(b.startTime)}`;
          meta = `${c?.name ?? 'Customer'} booked`;
          billId = b.billId;
        }
      } else if (status === 'maintenance') {
        meta = 'Marked under maintenance in Settings';
      }

      return { id: t.id, name: t.name, rate: t.hourlyRate, status, dot: dots[status], meta, badgeLabel, billId };
    }),
  );

  tapTable(card: { status: string; billId?: string }): void {
    if (card.billId) {
      this.flow.openDetail(card.billId);
      return;
    }
    if (card.status === 'available') this.flow.startBooking();
  }

  /** Bookings and counter sales for the chosen window, newest first. */
  rows = computed(() => {
    const from = this.from();
    const to = this.to();
    const q = this.search().trim().toLowerCase();

    const bookingRows = this.store
      .bookings()
      .filter((b) => b.date >= from && b.date <= to)
      .map((b) => {
        const bill = this.store.billById(b.billId);
        const c = this.store.customers().find((x) => x.id === b.customerId);
        const table = this.store.tables().find((t) => t.id === b.tableId);
        const productCount = bill?.items.filter((i) => i.type === 'product').reduce((s, i) => s + i.qty, 0) ?? 0;
        return {
          billId: b.billId,
          customerName: c?.name ?? 'Unknown',
          mobile: c?.mobile ?? '',
          tableName: table?.name ?? '',
          when: `${formatTime12(b.startTime)}–${formatTime12(b.endTime)}`,
          sortKey: `${b.date} ${b.startTime}`,
          bookingStatus: b.status as string,
          paymentStatus: bill?.status ?? 'unpaid',
          total: bill?.total ?? b.finalPrice,
          due: (bill?.total ?? b.finalPrice) - (bill?.paidAmount ?? 0),
          itemsLabel: productCount ? `${b.durationHours}h · ${productCount} item(s)` : `${b.durationHours}h table time`,
        };
      });

    const saleRows = this.store
      .bills()
      .filter((b) => !b.bookingId)
      .filter((b) => {
        const d = b.createdAt.slice(0, 10);
        return d >= from && d <= to;
      })
      .map((b) => {
        const c = this.store.customers().find((x) => x.id === b.customerId);
        const count = b.items.reduce((s, i) => s + i.qty, 0);
        const time = new Date(b.createdAt);
        return {
          billId: b.id,
          customerName: c?.name ?? 'Unknown',
          mobile: c?.mobile ?? '',
          tableName: '',
          when: time.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }),
          sortKey: b.createdAt,
          bookingStatus: '',
          paymentStatus: b.status,
          total: b.total,
          due: b.total - b.paidAmount,
          itemsLabel: `${count} item(s)`,
        };
      });

    return [...bookingRows, ...saleRows]
      .filter((r) => !q || r.customerName.toLowerCase().includes(q) || r.mobile.includes(q) || r.tableName.toLowerCase().includes(q))
      .filter((r) => {
        switch (this.filter()) {
          case 'running':
            return r.bookingStatus === 'ongoing';
          case 'upcoming':
            return r.bookingStatus === 'upcoming';
          case 'unpaid':
            return r.due > 0;
          case 'done':
            return r.bookingStatus === 'completed' || (!r.bookingStatus && r.due <= 0);
          default:
            return true;
        }
      })
      .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  });

  periodTotals = computed(() => {
    const revenue = this.rows().reduce((s, r) => s + r.total, 0);
    const due = this.rows().reduce((s, r) => s + Math.max(0, r.due), 0);
    return { revenue, due };
  });
}
