import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DataStoreService } from '../../core/services/data-store.service';
import { OrderFlowService } from '../../core/services/order-flow.service';
import { SecurityService } from '../../core/services/security.service';
import { BadgeComponent } from '../../shared/ui/badge/badge';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { IconComponent } from '../../shared/ui/icon/icon';
import { ModalComponent } from '../../shared/ui/modal/modal';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { TooltipDirective } from '../../shared/ui/tooltip/tooltip.directive';
import { formatCurrency, formatTime12, relativeDayLabel } from '../../shared/util/format';

@Component({
  selector: 'app-customer-profile-page',
  imports: [RouterLink, DatePipe, IconComponent, BadgeComponent, EmptyStateComponent, ModalComponent, TooltipDirective],
  template: `
    @if (customer(); as c) {
      <div class="flex flex-col gap-5">
        <a routerLink="/customers" class="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-muted transition hover:text-ink">
          <app-icon name="arrow-left" [size]="15" /> All customers
        </a>

        <header class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex items-center gap-3">
            <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-[15px] font-extrabold text-primary-darker">
              {{ initials() }}
            </span>
            <div>
              <h1 class="text-2xl font-extrabold tracking-tight text-ink">{{ c.name }}</h1>
              <p class="flex items-center gap-1.5 text-[13px] text-muted">
                <app-icon name="phone" [size]="13" /> {{ c.mobile }}
              </p>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="btn btn-secondary" (click)="flow.startSale(c.id)">
              <app-icon name="cart" [size]="16" /> Counter sale
            </button>
            <button type="button" class="btn btn-primary" (click)="flow.startBooking(c.id)">
              <app-icon name="plus" [size]="16" /> New booking
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-icon text-faint hover:text-danger"
              (click)="confirmRemove.set(true)"
              aria-label="Remove customer"
              [appTooltip]="'Hides the customer from lists. Their bookings and bills stay in your records.'"
            >
              <app-icon name="trash" [size]="16" />
            </button>
          </div>
        </header>

        <div class="grid grid-cols-3 gap-2.5 sm:gap-3">
          <div class="card px-3.5 py-3">
            <p class="text-[11px] font-medium tracking-wide text-muted uppercase">Paid to date</p>
            <p class="mt-0.5 text-lg font-extrabold text-ink tabular-nums sm:text-xl">{{ formatCurrency(store.customerTotalSpend(c.id)) }}</p>
          </div>
          <div class="card px-3.5 py-3">
            <p class="flex items-center gap-1 text-[11px] font-medium tracking-wide text-muted uppercase">
              Outstanding
              <span class="text-faint" [appTooltip]="'Total still owed across all open bills for this customer'">
                <app-icon name="help" [size]="12" />
              </span>
            </p>
            <p class="mt-0.5 text-lg font-extrabold tabular-nums sm:text-xl" [class]="outstanding() > 0 ? 'text-danger' : 'text-ink'">
              {{ formatCurrency(outstanding()) }}
            </p>
          </div>
          <div class="card px-3.5 py-3">
            <p class="text-[11px] font-medium tracking-wide text-muted uppercase">Visits</p>
            <p class="mt-0.5 text-lg font-extrabold text-ink tabular-nums sm:text-xl">{{ bills().length }}</p>
          </div>
        </div>

        @if (openBills().length) {
          <section class="flex flex-col gap-2.5">
            <h2 class="text-[13px] font-bold tracking-wide text-muted uppercase">Open tabs</h2>
            @for (b of openBills(); track b.id) {
              <button type="button" class="card card-pad text-left transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-raise)]" (click)="flow.openDetail(b.id)">
                <div class="flex items-start gap-3">
                  <div class="min-w-0 flex-1">
                    <p class="text-[14px] font-semibold text-ink">{{ b.bookingId ? 'Table booking' : 'Counter sale' }}</p>
                    <p class="text-xs text-muted">{{ b.createdAt | date: 'MMM d, h:mm a' }} · {{ b.items.length }} line(s)</p>
                  </div>
                  <div class="text-right">
                    <p class="text-[15px] font-extrabold text-ink tabular-nums">{{ formatCurrency(b.total) }}</p>
                    <p class="text-xs font-semibold text-danger tabular-nums">{{ formatCurrency(b.total - b.paidAmount) }} due</p>
                  </div>
                </div>
                <div class="mt-2 flex items-center gap-1.5">
                  <app-badge [status]="b.status" />
                  <span class="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-primary">
                    Open bill <app-icon name="chevron-right" [size]="13" />
                  </span>
                </div>
              </button>
            }
          </section>
        }

        <section class="flex flex-col gap-2.5">
          <h2 class="text-[13px] font-bold tracking-wide text-muted uppercase">History</h2>
          @if (bills().length) {
            <div class="card overflow-hidden">
              @for (b of bills(); track b.id) {
                <button
                  type="button"
                  class="row-hover flex w-full items-center gap-3 border-b border-line-soft px-4 py-3 text-left last:border-0"
                  (click)="flow.openDetail(b.id)"
                >
                  <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-alt text-muted">
                    <app-icon [name]="b.bookingId ? 'grid' : 'cart'" [size]="15" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-[14px] font-medium text-ink">{{ bookingLabel(b.bookingId) }}</span>
                    <span class="block text-xs text-muted">{{ b.createdAt | date: 'MMM d, h:mm a' }}</span>
                  </span>
                  <app-badge [status]="b.status" />
                  <span class="w-20 text-right text-[14px] font-semibold tabular-nums">{{ formatCurrency(b.total) }}</span>
                  <app-icon name="chevron-right" [size]="15" />
                </button>
              }
            </div>
          } @else {
            <div class="card">
              <app-empty-state icon="receipt" title="No visits yet" description="Bookings and sales for this customer will appear here.">
                <button type="button" class="btn btn-primary" (click)="flow.startBooking(c.id)">
                  <app-icon name="plus" [size]="16" /> New booking
                </button>
              </app-empty-state>
            </div>
          }
        </section>
      </div>

      @if (confirmRemove()) {
        <app-modal title="Remove this customer?" (close)="confirmRemove.set(false)">
          <p class="text-[13px] leading-relaxed text-ink-soft">
            <strong>{{ c.name }}</strong> stops showing up in lists and searches. Their bookings, bills and payments stay in
            your records and reports.
          </p>
          @if (outstanding() > 0) {
            <p class="flex items-center gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-[13px] font-medium text-warn">
              <app-icon name="alert" [size]="15" /> They still owe {{ formatCurrency(outstanding()) }}.
            </p>
          }
          <div modal-footer>
            <button type="button" class="btn btn-ghost" (click)="confirmRemove.set(false)">Keep them</button>
            <button type="button" class="btn btn-danger" (click)="remove(c.id)">Remove customer</button>
          </div>
        </app-modal>
      }
    } @else {
      <div class="card">
        <app-empty-state icon="users" title="Customer not found">
          <a routerLink="/customers" class="btn btn-secondary">Back to customers</a>
        </app-empty-state>
      </div>
    }
  `,
  host: { class: 'block animate-fade-up' },
})
export class CustomerProfilePage {
  store = inject(DataStoreService);
  flow = inject(OrderFlowService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private security = inject(SecurityService);
  private toast = inject(ToastService);
  confirmRemove = signal(false);
  formatCurrency = formatCurrency;

  id = this.route.snapshot.paramMap.get('id') ?? '';
  customer = computed(() => this.store.customers().find((c) => c.id === this.id));
  bills = computed(() => this.store.customerBills(this.id));
  openBills = computed(() => this.bills().filter((b) => b.status !== 'paid'));
  outstanding = computed(() => this.store.customerOutstanding(this.id));
  initials = computed(() =>
    (this.customer()?.name ?? '')
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase(),
  );

  async remove(id: string): Promise<void> {
    this.confirmRemove.set(false);
    if (!(await this.security.guard('remove this customer'))) return;
    this.store.removeCustomer(id);
    this.toast.success('Customer removed');
    this.router.navigate(['/customers']);
  }

  bookingLabel(bookingId: string | null): string {
    if (!bookingId) return 'Counter sale';
    const b = this.store.bookingById(bookingId);
    if (!b) return 'Table booking';
    const table = this.store.tables().find((t) => t.id === b.tableId);
    return `${table?.name ?? 'Table'} · ${relativeDayLabel(b.date)} ${formatTime12(b.startTime)}`;
  }
}
