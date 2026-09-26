import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Booking } from '../../core/models/models';
import { DataStoreService } from '../../core/services/data-store.service';
import { OrderFlowService } from '../../core/services/order-flow.service';
import { BadgeComponent } from '../../shared/ui/badge/badge';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { IconComponent } from '../../shared/ui/icon/icon';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { TooltipDirective } from '../../shared/ui/tooltip/tooltip.directive';
import { elapsedLabel, formatClock, formatCurrency, formatDuration, formatTime12 } from '../../shared/util/format';

/** Where a table sits in the booking → session lifecycle. */
type FloorState = 'available' | 'booked' | 'in-play' | 'ended' | 'maintenance';

interface BookingRow {
  id: string;
  billId?: string;
  status: Booking['status'];
  running: boolean;
  customerLabel: string;
  extraGuests: number;
  bookedWindow: string;
  duration: string;
  sessionLine: string;
  total: number;
  due: number;
  startMinutes: number;
}

interface FloorCard {
  id: string;
  name: string;
  hourlyRate: number;
  state: FloorState;
  badge: string;
  feltClass: string;
  rows: BookingRow[];
}

const FELT: Record<FloorState, string> = {
  available: 'bg-success-soft',
  booked: 'bg-warn-soft',
  'in-play': 'bg-danger-soft',
  ended: 'bg-info-soft',
  maintenance: 'bg-surface-alt',
};

const BADGE: Record<FloorState, string> = {
  available: 'available',
  booked: 'upcoming',
  'in-play': 'occupied',
  ended: 'completed',
  maintenance: 'maintenance',
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Floor view — every table with its own day's bookings listed inside it.
 *
 * Sessions are started and ended from the row itself, and the running row is
 * highlighted, so the operator never has to work out which booking is live.
 * Booking and editing reuse the existing order drawers.
 */
@Component({
  selector: 'app-tables-page',
  imports: [RouterLink, IconComponent, BadgeComponent, EmptyStateComponent, TooltipDirective],
  template: `
    <div class="flex flex-col gap-5">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">Tables</h1>
          <p class="mt-0.5 text-[13px] text-muted sm:text-sm">
            {{ cards().length }} table(s) · {{ freeCount() }} free · {{ runningCount() }} session(s) running
          </p>
        </div>
        <button type="button" class="btn btn-secondary" (click)="book(null)"
          [appTooltip]="'Start a booking and pick the table inside the drawer'">
          <app-icon name="plus" [size]="16" /> New booking
        </button>
      </header>

      <div class="flex flex-wrap items-center gap-2">
        @for (l of legend; track l.state) {
          <span class="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-soft">
            <span class="h-2.5 w-2.5 rounded-full" [class]="l.dot"></span>
            {{ l.label }}
          </span>
        }
      </div>

      @if (cards().length) {
        <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
          @for (card of cards(); track card.id) {
            <article class="card card-pad flex flex-col gap-3">
              <div class="flex items-center gap-2">
                <h2 class="text-[16px] font-extrabold text-ink">{{ card.name }}</h2>
                <span class="text-[11px] font-medium text-muted">{{ formatCurrency(card.hourlyRate) }}/hr</span>
                @if (card.rows.length > 3) {
                  <span class="pill bg-surface-alt text-muted" [appTooltip]="'Scroll inside the table to see them all'">
                    {{ card.rows.length }} bookings
                  </span>
                }
                <span class="ml-auto"><app-badge [status]="card.badge" /></span>
              </div>

              <!-- The table: rails, pockets, and today's bookings on the felt -->
              <div class="relative rounded-2xl border-[6px] border-ink/85 p-2.5 sm:p-3" [class]="card.feltClass">
                <span class="pointer-events-none absolute -top-1 -left-1 h-3 w-3 rounded-full bg-ink/80"></span>
                <span class="pointer-events-none absolute -top-1 -right-1 h-3 w-3 rounded-full bg-ink/80"></span>
                <span class="pointer-events-none absolute -bottom-1 -left-1 h-3 w-3 rounded-full bg-ink/80"></span>
                <span class="pointer-events-none absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-ink/80"></span>
                <span class="pointer-events-none absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-ink/80"></span>
                <span class="pointer-events-none absolute -bottom-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-ink/80"></span>

                @if (card.state === 'maintenance') {
                  <div class="flex min-h-[112px] flex-col items-center justify-center gap-1.5 text-center">
                    <span class="flex h-9 w-9 items-center justify-center rounded-full bg-surface/80 text-ink-soft">
                      <app-icon name="ban" [size]="17" />
                    </span>
                    <p class="text-[13px] font-semibold text-ink">Under maintenance</p>
                    <p class="text-[11px] text-muted">Turn this off in Settings</p>
                  </div>
                } @else if (card.rows.length) {
                  <!-- Three rows (3 × ~104px + gaps) fit; the rest scroll,
                       with the next row just peeking to show there is more. -->
                  <div class="flex max-h-[21rem] flex-col gap-2 overflow-y-auto overscroll-contain pr-1">
                    @for (row of card.rows; track row.id) {
                      <div
                        class="rounded-xl border bg-surface/95 p-2.5 transition"
                        [class]="row.running ? 'border-danger/60 shadow-[var(--shadow-raise)] ring-2 ring-danger/25' : 'border-line'"
                      >
                        <div class="flex items-start gap-2.5">
                          <!-- tapping the body opens the booking to edit or settle -->
                          <button type="button" class="min-w-0 flex-1 text-left" (click)="openBooking(row)"
                            [appTooltip]="'Open this booking — items, payment and details'">
                            <span class="flex items-center gap-1.5">
                              @if (row.running) {
                                <span class="h-2 w-2 shrink-0 rounded-full bg-danger"></span>
                              }
                              <span class="truncate text-[14px] font-bold text-ink">{{ row.customerLabel }}</span>
                              @if (row.extraGuests > 0) {
                                <span class="pill bg-primary-soft text-primary-darker">+{{ row.extraGuests }}</span>
                              }
                              <app-badge [status]="row.status" />
                            </span>
                            <span class="mt-1 block text-[12px] text-ink-soft tabular-nums">
                              <span class="text-[10px] font-semibold tracking-wide text-muted uppercase">Booked</span>
                              {{ row.bookedWindow }} · {{ row.duration }}
                            </span>
                            <span class="block text-[12px] tabular-nums" [class]="row.running ? 'text-danger' : 'text-muted'">
                              <span class="text-[10px] font-semibold tracking-wide text-muted uppercase">Session</span>
                              {{ row.sessionLine }}
                            </span>
                          </button>

                          <div class="flex shrink-0 flex-col items-end gap-1.5">
                            <span class="text-[14px] font-extrabold text-ink tabular-nums">{{ formatCurrency(row.total) }}</span>
                            @if (row.due > 0) {
                              <span class="text-[11px] font-semibold text-danger tabular-nums">{{ formatCurrency(row.due) }} due</span>
                            }
                            @if (row.status === 'upcoming') {
                              <button type="button" class="btn btn-primary btn-sm" (click)="startSession(row)">
                                <app-icon name="play" [size]="13" /> Start
                              </button>
                            } @else if (row.status === 'ongoing') {
                              <button type="button" class="btn btn-primary btn-sm" (click)="endSession(row)">
                                <app-icon name="check-circle" [size]="13" /> End
                              </button>
                            } @else {
                              <button type="button" class="btn btn-secondary btn-sm" (click)="openBooking(row)">
                                <app-icon name="receipt" [size]="13" /> Bill
                              </button>
                            }
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                } @else {
                  <button type="button" class="flex min-h-[112px] w-full flex-col items-center justify-center gap-1.5 text-center" (click)="book(card.id)">
                    <span class="flex h-9 w-9 items-center justify-center rounded-full bg-surface/80 text-ink-soft">
                      <app-icon name="plus" [size]="17" />
                    </span>
                    <span class="text-[13px] font-semibold text-ink">Free — tap to book</span>
                    <span class="text-[11px] text-muted">Opens the usual booking drawer</span>
                  </button>
                }
              </div>

              <div class="flex flex-wrap gap-2">
                @if (card.state === 'maintenance') {
                  <a routerLink="/settings" class="btn btn-secondary btn-sm">
                    <app-icon name="settings" [size]="14" /> Open settings
                  </a>
                } @else {
                  <button type="button" class="btn btn-primary btn-sm" (click)="book(card.id)">
                    <app-icon name="plus" [size]="14" /> Book this table
                  </button>
                }
              </div>
            </article>
          }
        </div>
      } @else {
        <div class="card">
          <app-empty-state
            icon="grid"
            title="No tables set up yet"
            description="Add your pool tables and their hourly rates, and they will show up here as a floor plan."
          >
            <a routerLink="/settings" class="btn btn-primary"><app-icon name="settings" [size]="16" /> Add tables</a>
          </app-empty-state>
        </div>
      }
    </div>
  `,
  host: { class: 'block animate-fade-up' },
})
export class TablesPage {
  store = inject(DataStoreService);
  flow = inject(OrderFlowService);
  private toast = inject(ToastService);
  formatCurrency = formatCurrency;

  legend = [
    { state: 'available', label: 'Free', dot: 'bg-success' },
    { state: 'booked', label: 'Booked', dot: 'bg-warn' },
    { state: 'in-play', label: 'Session running', dot: 'bg-danger' },
    { state: 'ended', label: 'Session ended', dot: 'bg-info' },
    { state: 'maintenance', label: 'Maintenance', dot: 'bg-faint' },
  ];

  /** One card per configured table, each holding that table's own bookings. */
  cards = computed<FloorCard[]>(() =>
    this.store.tables().map((table) => {
      const rows = this.store
        .todaysBookings()
        .filter((b) => b.tableId === table.id && b.status !== 'cancelled')
        .map((b) => this.toRow(b))
        .sort((a, b) => a.startMinutes - b.startMinutes);

      let state: FloorState = 'available';
      if (table.underMaintenance) state = 'maintenance';
      else if (rows.some((r) => r.status === 'ongoing')) state = 'in-play';
      else if (rows.some((r) => r.status === 'upcoming')) state = 'booked';
      else if (rows.length) state = 'ended';

      return {
        id: table.id,
        name: table.name,
        hourlyRate: table.hourlyRate,
        state,
        badge: BADGE[state],
        feltClass: FELT[state],
        rows: state === 'maintenance' ? [] : rows,
      };
    }),
  );

  private toRow(booking: Booking): BookingRow {
    const bills = this.store.billsInGroup(booking.id);
    const total = bills.reduce((s, b) => s + b.total, 0);
    const paid = bills.reduce((s, b) => s + b.paidAmount, 0);
    const primary = this.store.customers().find((c) => c.id === booking.customerId);

    return {
      id: booking.id,
      billId: bills[0]?.id,
      status: booking.status,
      running: booking.status === 'ongoing',
      customerLabel: primary?.name ?? 'Walk-in',
      extraGuests: Math.max(0, booking.customerIds.length - 1),
      bookedWindow: `${formatTime12(booking.startTime)} – ${formatTime12(booking.endTime)}`,
      duration: formatDuration(booking.durationHours),
      sessionLine: this.sessionLine(booking),
      total,
      due: Math.max(0, total - paid),
      startMinutes: timeToMinutes(booking.startTime),
    };
  }

  /** Session times read separately from the booked window. */
  private sessionLine(booking: Booking): string {
    if (!booking.sessionStartedAt) return 'Not started';
    const started = formatClock(booking.sessionStartedAt);
    if (!booking.sessionEndedAt) return `Started ${started} · running ${elapsedLabel(booking.sessionStartedAt, null)}`;
    return `${started} – ${formatClock(booking.sessionEndedAt)} · ${elapsedLabel(booking.sessionStartedAt, booking.sessionEndedAt)}`;
  }

  freeCount = computed(() => this.cards().filter((c) => c.state === 'available').length);
  runningCount = computed(() => this.cards().reduce((n, c) => n + c.rows.filter((r) => r.running).length, 0));

  /** Opens the existing booking drawer with this table already chosen. */
  book(tableId: string | null): void {
    this.flow.startBooking(null, tableId);
  }

  openBooking(row: BookingRow): void {
    if (row.billId) this.flow.openDetail(row.billId);
  }

  startSession(row: BookingRow): void {
    this.store.startSession(row.id);
    this.toast.success(`Session started for ${row.customerLabel}`);
  }

  endSession(row: BookingRow): void {
    this.store.endSession(row.id);
    this.toast.success(`Session ended for ${row.customerLabel}`);
  }
}
