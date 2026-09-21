import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BookingStatus } from '../../core/models/models';
import { DataStoreService } from '../../core/services/data-store.service';
import { OrderFlowService } from '../../core/services/order-flow.service';
import { SecurityService } from '../../core/services/security.service';
import { BadgeComponent } from '../../shared/ui/badge/badge';
import { DrawerComponent } from '../../shared/ui/drawer/drawer';
import { IconComponent } from '../../shared/ui/icon/icon';
import { QuantityStepperComponent } from '../../shared/ui/quantity-stepper/quantity-stepper';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { TooltipDirective } from '../../shared/ui/tooltip/tooltip.directive';
import { formatCurrency, formatTime12, relativeDayLabel } from '../../shared/util/format';

/**
 * Everything about one order — booking details, each customer's bill, their
 * payments, and the actions a merchant needs mid-shift. Split orders show one
 * tab per customer so money stays tracked per person.
 */
@Component({
  selector: 'app-order-detail-drawer',
  imports: [FormsModule, DatePipe, DrawerComponent, IconComponent, BadgeComponent, QuantityStepperComponent, TooltipDirective],
  template: `
    @if (activeBill(); as bill) {
      <app-drawer
        [title]="headerTitle()"
        [subtitle]="headerSubtitle()"
        size="lg"
        (close)="flow.closeDetail()"
      >
        <div class="flex flex-col gap-3">
          <!-- Status + booking actions -->
          <section class="card card-pad">
            <div class="flex flex-wrap items-center gap-2">
              <app-badge [status]="groupStatus()" />
              @if (booking(); as bk) {
                <app-badge [status]="bk.status" />
                <span class="pill bg-surface-alt text-muted">
                  <app-icon name="clock" [size]="12" />
                  {{ relativeDayLabel(bk.date) }} · {{ formatTime12(bk.startTime) }}–{{ formatTime12(bk.endTime) }}
                </span>
              } @else {
                <span class="pill bg-surface-alt text-muted">{{ bill.createdAt | date: 'MMM d, h:mm a' }}</span>
              }
            </div>

            @if (bills().length > 1) {
              <div class="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-canvas px-3 py-2.5">
                <div>
                  <p class="text-[11px] tracking-wide text-muted uppercase">Order total</p>
                  <p class="text-[15px] font-extrabold text-ink tabular-nums">{{ formatCurrency(groupTotal()) }}</p>
                </div>
                <div>
                  <p class="text-[11px] tracking-wide text-muted uppercase">Collected</p>
                  <p class="text-[15px] font-extrabold text-ink tabular-nums">{{ formatCurrency(groupPaid()) }}</p>
                </div>
                <div>
                  <p class="text-[11px] tracking-wide text-muted uppercase">Due</p>
                  <p class="text-[15px] font-extrabold tabular-nums" [class]="groupDue() > 0 ? 'text-danger' : 'text-success'">
                    {{ formatCurrency(groupDue()) }}
                  </p>
                </div>
              </div>
            }

            @if (booking(); as bk) {
              <div class="mt-3 flex flex-wrap gap-2">
                @if (bk.status === 'upcoming') {
                  <button type="button" class="btn btn-primary btn-sm" (click)="setStatus('ongoing')"
                    [appTooltip]="'Marks the table as in play right now'">
                    <app-icon name="play" [size]="14" /> Start session
                  </button>
                }
                @if (bk.status === 'ongoing') {
                  <button type="button" class="btn btn-primary btn-sm" (click)="setStatus('completed')"
                    [appTooltip]="'Frees the table. The bill stays open until it is paid.'">
                    <app-icon name="check-circle" [size]="14" /> Complete
                  </button>
                }
                <button type="button" class="btn btn-secondary btn-sm" (click)="edit()"
                  [appTooltip]="'Change table, time or the table charge'">
                  <app-icon name="edit" [size]="14" /> Edit
                </button>
                @if (bk.status !== 'cancelled' && bk.status !== 'completed') {
                  <button type="button" class="btn btn-danger btn-sm" (click)="setStatus('cancelled')">
                    <app-icon name="ban" [size]="14" /> Cancel
                  </button>
                }
              </div>
            }
          </section>

          <!-- Customer tabs for split orders -->
          @if (bills().length > 1) {
            <!-- Wraps rather than scrolls — with four or more people a hidden
                 overflow would clip names with no affordance. -->
            <div class="flex flex-wrap gap-2">
              @for (b of bills(); track b.id) {
                <button
                  type="button"
                  class="chip max-w-full"
                  [class.chip-active]="b.id === selectedBillId()"
                  (click)="selectedBillId.set(b.id)"
                >
                  <span class="min-w-0 truncate">{{ customerName(b.customerId) }}</span>
                  <span class="pill shrink-0 px-1.5 py-0 text-[11px]"
                    [class]="b.total - b.paidAmount > 0 ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'">
                    {{ formatCurrency(b.total - b.paidAmount) }}
                  </span>
                </button>
              }
            </div>
          }

          <!-- Bill -->
          <section class="card overflow-hidden">
            <div class="flex items-center justify-between border-b border-line px-4 py-3">
              <h3 class="text-[13px] font-semibold text-ink">
                {{ bills().length > 1 ? customerName(bill.customerId) + "'s bill" : 'Bill' }}
              </h3>
              @if (bill.status !== 'paid') {
                <button type="button" class="btn btn-ghost btn-sm" (click)="showItems.set(!showItems())">
                  <app-icon name="plus" [size]="14" /> Add item
                </button>
              }
            </div>

            @if (showItems()) {
              <div class="animate-fade-up border-b border-line bg-canvas px-4 py-3">
                <input class="input mb-2" type="text" placeholder="Search items" [ngModel]="productQuery()" (ngModelChange)="productQuery.set($event)" />
                <div class="flex max-h-60 flex-col overflow-y-auto">
                  @for (p of productMatches(); track p.id) {
                    <div class="flex items-center gap-3 border-b border-line-soft py-2 last:border-0">
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-[13px] font-medium text-ink">{{ p.name }}</span>
                        <span class="block text-[11px] text-muted">{{ formatCurrency(p.sellingPrice) }} · {{ p.stock }} left</span>
                      </span>
                      <button type="button" class="btn btn-secondary btn-sm" [disabled]="p.stock <= 0" (click)="addItem(p.id)">Add</button>
                    </div>
                  }
                </div>
              </div>
            }

            <div class="px-4 py-2">
              @for (item of bill.items; track item.id) {
                <div class="flex items-center gap-3 border-b border-line-soft py-2.5 last:border-0">
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-[14px] font-medium text-ink">{{ item.name }}</span>
                    <span class="block text-[11px] text-muted">{{ formatCurrency(item.unitPrice) }} each</span>
                  </span>
                  @if (item.type === 'product' && bill.status !== 'paid') {
                    <app-quantity-stepper
                      [value]="item.qty"
                      [min]="0"
                      [max]="stockCeiling(item.refId, item.qty)"
                      (valueChange)="setQty(bill.id, item.id, $event)"
                    />
                  } @else if (item.type === 'product') {
                    <span class="text-[13px] text-muted">×{{ item.qty }}</span>
                  }
                  <span class="w-20 text-right text-[14px] font-semibold tabular-nums">{{ formatCurrency(item.amount) }}</span>
                </div>
              } @empty {
                <p class="py-4 text-center text-[13px] text-muted">No items on this bill yet.</p>
              }
            </div>

            <div class="border-t border-line bg-canvas px-4 py-3">
              <div class="flex justify-between text-[13px] text-muted"><span>Total</span><span class="font-semibold text-ink tabular-nums">{{ formatCurrency(bill.total) }}</span></div>
              <div class="flex justify-between text-[13px] text-muted"><span>Paid</span><span class="tabular-nums">{{ formatCurrency(bill.paidAmount) }}</span></div>
              <div class="mt-1 flex justify-between border-t border-dashed border-line pt-2 text-[15px] font-bold"
                [class]="remaining() > 0 ? 'text-danger' : 'text-success'">
                <span>{{ remaining() > 0 ? 'Remaining' : 'Settled' }}</span>
                <span class="tabular-nums">{{ formatCurrency(remaining()) }}</span>
              </div>
            </div>
          </section>

          <!-- Payments -->
          <section class="card card-pad">
            <h3 class="mb-3 text-[13px] font-semibold text-ink">Payments</h3>

            @if (remaining() > 0) {
              <div class="flex flex-col gap-2 sm:flex-row">
                <div class="relative flex-1">
                  <span class="absolute top-1/2 left-3 -translate-y-1/2 text-sm font-semibold text-muted">₹</span>
                  <input class="input pl-7 font-semibold" type="number" inputmode="numeric" placeholder="Amount" [(ngModel)]="payAmount" />
                </div>
                <button type="button" class="btn btn-primary" [disabled]="!payAmount || payAmount <= 0" (click)="collect(bill.id)">
                  <app-icon name="wallet" [size]="15" /> Collect
                </button>
              </div>
              <div class="mt-2 flex flex-wrap gap-2">
                <button type="button" class="chip" (click)="payAmount = remaining()">Full {{ formatCurrency(remaining()) }}</button>
                <button type="button" class="chip" (click)="payAmount = Math.round(remaining() / 2)">Half</button>
                <button type="button" class="chip" (click)="markPaid(bill.id)"
                  [appTooltip]="'Records the whole remaining amount as received'">Settle in full</button>
              </div>
            } @else {
              <p class="flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2.5 text-[13px] font-medium text-success">
                <app-icon name="check-circle" [size]="15" /> This bill is fully paid.
              </p>
            }

            @if (payments().length) {
              <div class="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
                @for (p of payments(); track p.id) {
                  <div class="flex items-center justify-between gap-2 text-[13px]">
                    <span class="min-w-0 truncate text-muted">
                      {{ p.date | date: 'MMM d, h:mm a' }}
                      @if (p.actor && p.actor !== 'Admin') {
                        <span class="text-faint">· {{ p.actor }}</span>
                      }
                    </span>
                    <span class="font-semibold tabular-nums">{{ formatCurrency(p.amount) }}</span>
                  </div>
                }
              </div>
            }
          </section>

          <button type="button" class="btn btn-secondary w-full" (click)="viewCustomer(bill.customerId)">
            <app-icon name="users" [size]="15" /> View customer history
          </button>
        </div>
      </app-drawer>
    }
  `,
  host: { class: 'contents' },
})
export class OrderDetailDrawerComponent {
  billId = input.required<string>();

  store = inject(DataStoreService);
  flow = inject(OrderFlowService);
  private security = inject(SecurityService);
  private toast = inject(ToastService);
  private router = inject(Router);

  formatCurrency = formatCurrency;
  formatTime12 = formatTime12;
  relativeDayLabel = relativeDayLabel;
  Math = Math;

  showItems = signal(false);
  productQuery = signal('');
  payAmount = 0;
  selectedBillId = signal<string | null>(null);

  constructor() {
    // Follow the bill the caller opened; split orders then switch by tab.
    effect(() => {
      const incoming = this.billId();
      if (!this.selectedBillId() || !this.bills().some((b) => b.id === this.selectedBillId())) {
        this.selectedBillId.set(incoming);
      }
    });
  }

  private sourceBill = computed(() => this.store.billById(this.billId()));
  bills = computed(() => {
    const source = this.sourceBill();
    return source ? this.store.billsInGroup(source.groupId) : [];
  });
  activeBill = computed(() => this.bills().find((b) => b.id === this.selectedBillId()) ?? this.sourceBill());

  booking = computed(() => {
    const id = this.sourceBill()?.bookingId;
    return id ? this.store.bookingById(id) : undefined;
  });
  tableName = computed(() => this.store.tables().find((t) => t.id === this.booking()?.tableId)?.name ?? '');

  headerTitle = computed(() => {
    const list = this.bills();
    if (list.length > 1) return `${list.length} customers`;
    return this.customerName(this.activeBill()?.customerId ?? '');
  });

  headerSubtitle = computed(() => {
    const context = this.booking() ? this.tableName() : 'Counter sale';
    if (this.bills().length > 1) {
      return `${this.bills().map((b) => this.customerName(b.customerId)).join(', ')} · ${context}`;
    }
    const customer = this.store.customers().find((c) => c.id === this.activeBill()?.customerId);
    return `${customer?.mobile ?? ''} · ${context}`;
  });

  groupTotal = computed(() => this.bills().reduce((s, b) => s + b.total, 0));
  groupPaid = computed(() => this.bills().reduce((s, b) => s + b.paidAmount, 0));
  groupDue = computed(() => this.groupTotal() - this.groupPaid());
  groupStatus = computed(() => {
    if (this.groupDue() <= 0) return 'paid';
    return this.groupPaid() > 0 ? 'partial' : 'unpaid';
  });

  payments = computed(() => this.store.billPayments(this.activeBill()?.id ?? ''));
  remaining = computed(() => {
    const b = this.activeBill();
    return b ? b.total - b.paidAmount : 0;
  });

  productMatches = computed(() => {
    const q = this.productQuery().trim().toLowerCase();
    return this.store.products().filter((p) => !q || p.name.toLowerCase().includes(q));
  });

  customerName(customerId: string): string {
    return this.store.customers().find((c) => c.id === customerId)?.name ?? 'Unknown';
  }

  stockCeiling(productId: string, currentQty: number): number {
    return (this.store.productById(productId)?.stock ?? 0) + currentQty;
  }

  addItem(productId: string): void {
    const bill = this.activeBill();
    const product = this.store.productById(productId);
    if (!bill || !product) return;
    this.store.addProductToBill(bill.id, product, 1);
    this.toast.success(`${product.name} added`);
  }

  async setQty(billId: string, itemId: string, qty: number): Promise<void> {
    if (!(await this.security.guard('change this bill'))) return;
    this.store.setBillItemQty(billId, itemId, qty);
  }

  collect(billId: string): void {
    const amount = Math.min(this.payAmount, this.remaining());
    if (amount <= 0) return;
    this.store.addPayment(billId, amount);
    this.payAmount = 0;
    this.toast.success(this.remaining() <= 0 ? 'Bill settled' : `${formatCurrency(amount)} collected`);
  }

  markPaid(billId: string): void {
    this.store.markBillPaid(billId);
    this.payAmount = 0;
    this.toast.success('Bill settled');
  }

  async setStatus(status: BookingStatus): Promise<void> {
    const booking = this.booking();
    if (!booking) return;
    if (status === 'cancelled' && !(await this.security.guard('cancel this booking'))) return;
    this.store.updateBookingStatus(booking.id, status);
    const labels: Record<string, string> = { ongoing: 'Session started', completed: 'Booking completed', cancelled: 'Booking cancelled' };
    this.toast.success(labels[status] ?? 'Booking updated');
  }

  async edit(): Promise<void> {
    const booking = this.booking();
    if (!booking) return;
    if (!(await this.security.guard('edit this booking'))) return;
    this.flow.closeDetail();
    this.flow.editBooking(booking.id, booking.customerId);
  }

  viewCustomer(customerId: string): void {
    this.flow.closeDetail();
    this.router.navigate(['/customers', customerId]);
  }
}
