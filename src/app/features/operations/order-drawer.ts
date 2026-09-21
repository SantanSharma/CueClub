import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SplitMode } from '../../core/models/models';
import { DataStoreService, allocateShares } from '../../core/services/data-store.service';
import { OrderFlowService } from '../../core/services/order-flow.service';
import { DrawerComponent } from '../../shared/ui/drawer/drawer';
import { IconComponent } from '../../shared/ui/icon/icon';
import { QuantityStepperComponent } from '../../shared/ui/quantity-stepper/quantity-stepper';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { TooltipDirective } from '../../shared/ui/tooltip/tooltip.directive';
import {
  addDays,
  addMinutesToTime,
  formatCurrency,
  formatTime12,
  relativeDayLabel,
  roundToNext30,
  timeToMinutes,
  todayStr,
} from '../../shared/util/format';

type Section = 'customer' | 'what' | 'when' | 'split' | 'items' | 'pay';
const DURATIONS = [0.5, 1, 1.5, 2, 3];

/**
 * The one creation flow: customers (with inline create) → booking or counter
 * sale → table & time → how the charge is split → items → payment.
 *
 * Every customer on the order gets their own bill, so each person's items,
 * payments and status stay independent while the order reads as one job.
 */
@Component({
  selector: 'app-order-drawer',
  imports: [FormsModule, DrawerComponent, IconComponent, QuantityStepperComponent, TooltipDirective],
  template: `
    <app-drawer
      [title]="isEdit() ? 'Edit booking' : mode() === 'booking' ? 'New booking' : 'New counter sale'"
      [subtitle]="isEdit() ? 'Change table, time or price' : 'Everything for these customers in one place'"
      size="lg"
      (close)="flow.close()"
    >
      <div class="flex flex-col gap-3">
        <!-- Customers -------------------------------------------------- -->
        <section class="card overflow-hidden">
          <button type="button" class="flex w-full items-center gap-3 px-4 py-3.5 text-left" (click)="toggle('customer')">
            <span class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
              [class]="customers().length ? 'bg-success-soft text-success' : 'bg-primary-soft text-primary'">
              @if (customers().length) { <app-icon name="check" [size]="14" /> } @else { {{ stepNo('customer') }} }
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[13px] font-semibold text-ink">
                {{ customers().length > 1 ? customers().length + ' customers' : 'Customer' }}
              </span>
              <span class="block truncate text-xs text-muted">{{ customerSummary() }}</span>
            </span>
            @if (!isEdit()) {
              <app-icon [name]="open() === 'customer' ? 'chevron-down' : 'chevron-right'" [size]="16" />
            }
          </button>

          @if (open() === 'customer' && !isEdit()) {
            <div class="animate-fade-up border-t border-line px-4 py-4">
              @if (customers().length) {
                <div class="mb-3 flex flex-wrap gap-2">
                  @for (c of customers(); track c.id; let first = $first) {
                    <span class="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary-soft py-1.5 pr-1.5 pl-2.5 text-[13px] font-medium text-ink">
                      {{ c.name }}
                      @if (first && customers().length > 1) {
                        <span class="text-[10px] font-bold tracking-wide text-primary uppercase">Primary</span>
                      }
                      <button type="button" class="rounded p-0.5 text-muted transition hover:text-danger" (click)="removeCustomer(c.id)" [attr.aria-label]="'Remove ' + c.name">
                        <app-icon name="close" [size]="13" />
                      </button>
                    </span>
                  }
                </div>
              }

              <div class="relative">
                <span class="absolute top-1/2 left-3 -translate-y-1/2 text-faint"><app-icon name="search" [size]="16" /></span>
                <input
                  class="input pl-9"
                  type="text"
                  [placeholder]="customers().length ? 'Add another customer…' : 'Search name or mobile number'"
                  [ngModel]="customerQuery()"
                  (ngModelChange)="onQuery($event)"
                  autocomplete="off"
                />
              </div>

              @if (matches().length) {
                <div class="mt-2 flex flex-col overflow-hidden rounded-xl border border-line">
                  @for (c of matches(); track c.id) {
                    <button
                      type="button"
                      class="flex items-center gap-3 border-b border-line px-3.5 py-2.5 text-left transition last:border-0 hover:bg-primary-soft"
                      (click)="addCustomer(c.id)"
                    >
                      <span class="flex h-8 w-8 items-center justify-center rounded-full bg-surface-alt text-xs font-bold text-ink-soft">
                        {{ initials(c.name) }}
                      </span>
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-[14px] font-medium text-ink">{{ c.name }}</span>
                        <span class="block text-xs text-muted">{{ c.mobile }}</span>
                      </span>
                      @if (store.customerOutstanding(c.id) > 0) {
                        <span class="pill bg-danger-soft text-danger">{{ formatCurrency(store.customerOutstanding(c.id)) }} due</span>
                      }
                    </button>
                  }
                </div>
              }

              @if (showInlineCreate()) {
                <div class="mt-2 rounded-xl border border-dashed border-primary/50 bg-primary-soft/50 p-3.5">
                  <p class="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-primary-darker">
                    <app-icon name="user-plus" [size]="15" />
                    New customer — add them right here
                  </p>
                  <div class="flex flex-col gap-2 sm:flex-row">
                    <input class="input" type="text" placeholder="Full name" [(ngModel)]="newName" />
                    <input class="input" type="tel" inputmode="numeric" placeholder="Mobile number" [(ngModel)]="newMobile" />
                  </div>
                  <button
                    type="button"
                    class="btn btn-primary btn-sm mt-2.5 w-full sm:w-auto"
                    [disabled]="!newName.trim() || !newMobile.trim()"
                    (click)="createCustomer()"
                  >
                    <app-icon name="check" [size]="15" />
                    Add &amp; continue
                  </button>
                </div>
              }

              @if (!customerQuery().trim() && !customers().length) {
                <p class="mt-2 text-xs text-muted">Start typing — if they're new, you can create them without leaving this screen.</p>
              }
              @if (customers().length === 1) {
                <p class="mt-2 text-xs text-muted">Add more people to split this order between them.</p>
              }
            </div>
          }
        </section>

        <!-- What ------------------------------------------------------- -->
        @if (!isEdit()) {
          <section class="card px-4 py-3.5">
            <div class="mb-2.5 flex items-center gap-2">
              <span class="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">{{ stepNo('what') }}</span>
              <span class="text-[13px] font-semibold text-ink">What are they buying?</span>
              <span
                class="ml-auto text-faint"
                [appTooltip]="'Table booking reserves a table and bills by the hour. Counter sale is products only — no table.'"
              >
                <app-icon name="help" [size]="15" />
              </span>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <button type="button" class="chip justify-center py-2.5" [class.chip-active]="mode() === 'booking'" (click)="setMode('booking')">
                <app-icon name="grid" [size]="15" />
                Table booking
              </button>
              <button type="button" class="chip justify-center py-2.5" [class.chip-active]="mode() === 'sale'" (click)="setMode('sale')">
                <app-icon name="cart" [size]="15" />
                Counter sale
              </button>
            </div>
          </section>
        }

        <!-- Table & time ----------------------------------------------- -->
        @if (mode() === 'booking') {
          <section class="card overflow-hidden">
            <button type="button" class="flex w-full items-center gap-3 px-4 py-3.5 text-left" (click)="toggle('when')">
              <span class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                [class]="tableId() && !conflict() ? 'bg-success-soft text-success' : 'bg-primary-soft text-primary'">
                @if (tableId() && !conflict()) { <app-icon name="check" [size]="14" /> } @else { {{ stepNo('when') }} }
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-[13px] font-semibold text-ink">Table &amp; time</span>
                <span class="block truncate text-xs" [class]="conflict() ? 'text-danger' : 'text-muted'">{{ whenSummary() }}</span>
              </span>
              <app-icon [name]="open() === 'when' ? 'chevron-down' : 'chevron-right'" [size]="16" />
            </button>

            @if (open() === 'when') {
              <div class="animate-fade-up flex flex-col gap-4 border-t border-line px-4 py-4">
                <div>
                  <span class="field-label">Date</span>
                  <div class="flex flex-wrap items-center gap-2">
                    <button type="button" class="chip" [class.chip-active]="date() === todayStr()" (click)="date.set(todayStr())">Today</button>
                    <button type="button" class="chip" [class.chip-active]="date() === tomorrow" (click)="date.set(tomorrow)">Tomorrow</button>
                    <input class="input w-auto flex-1 py-2" type="date" [ngModel]="date()" (ngModelChange)="date.set($event)" />
                  </div>
                </div>

                <div>
                  <span class="field-label">Table</span>
                  <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    @for (t of tableOptions(); track t.id) {
                      <button
                        type="button"
                        class="relative rounded-xl border p-3 text-left transition"
                        [class]="
                          t.id === tableId()
                            ? 'border-primary bg-primary-soft ring-4 ring-[var(--color-primary-ring)]'
                            : t.busy
                              ? 'border-line bg-danger-soft/40'
                              : 'border-line bg-surface hover:border-zinc-300'
                        "
                        (click)="tableId.set(t.id)"
                      >
                        <span class="block text-[14px] font-semibold text-ink">{{ t.name }}</span>
                        <span class="block text-[11px] text-muted">{{ formatCurrency(t.hourlyRate) }}/hr</span>
                        @if (t.busy) {
                          <span class="mt-1 block text-[11px] font-medium text-danger">Booked {{ t.busyLabel }}</span>
                        } @else {
                          <span class="mt-1 block text-[11px] font-medium text-success">Free</span>
                        }
                      </button>
                    }
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <span class="field-label">Starts</span>
                    <input class="input" type="time" [ngModel]="startTime()" (ngModelChange)="setStart($event)" />
                  </div>
                  <div>
                    <span class="field-label">Ends</span>
                    <input class="input" type="time" [ngModel]="endTime()" (ngModelChange)="setEnd($event)" />
                  </div>
                </div>
                <div class="flex flex-wrap gap-2">
                  @for (d of durations; track d) {
                    <button type="button" class="chip" [class.chip-active]="duration() === d" (click)="setDuration(d)">{{ d }}h</button>
                  }
                </div>

                @if (conflict()) {
                  <p class="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-[13px] font-medium text-danger">
                    <app-icon name="alert" [size]="15" />
                    {{ tableName() }} is already booked {{ conflict() }}. Pick another table or a different time.
                  </p>
                }

                <div>
                  <span class="field-label">Table charge</span>
                  <div class="flex items-center gap-2">
                    <div class="relative flex-1">
                      <span class="absolute top-1/2 left-3 -translate-y-1/2 text-sm font-semibold text-muted">₹</span>
                      <input class="input pl-7 font-semibold" type="number" inputmode="numeric" [ngModel]="price()" (ngModelChange)="setPrice($event)" />
                    </div>
                    @if (priceOverridden()) {
                      <button type="button" class="btn btn-ghost btn-sm" (click)="resetPrice()">Reset</button>
                    }
                  </div>
                  <p class="mt-1.5 text-xs" [class]="priceOverridden() ? 'text-primary font-medium' : 'text-muted'">
                    @if (priceOverridden()) {
                      Manual price · auto rate was {{ formatCurrency(autoPrice()) }}
                    } @else {
                      Auto: {{ duration() }}h × {{ formatCurrency(hourlyRate()) }}/hr
                    }
                  </p>
                </div>
              </div>
            }
          </section>
        }

        <!-- Split ------------------------------------------------------ -->
        @if (showSplit()) {
          <section class="card overflow-hidden">
            <button type="button" class="flex w-full items-center gap-3 px-4 py-3.5 text-left" (click)="toggle('split')">
              <span class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                [class]="splitValid() ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'">
                @if (splitValid()) { <app-icon name="check" [size]="14" /> } @else { {{ stepNo('split') }} }
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-[13px] font-semibold text-ink">Split the table charge</span>
                <span class="block truncate text-xs" [class]="splitValid() ? 'text-muted' : 'text-danger'">{{ splitSummary() }}</span>
              </span>
              <app-icon [name]="open() === 'split' ? 'chevron-down' : 'chevron-right'" [size]="16" />
            </button>

            @if (open() === 'split') {
              <div class="animate-fade-up flex flex-col gap-3 border-t border-line px-4 py-4">
                <div class="grid grid-cols-3 gap-2">
                  <button type="button" class="chip justify-center" [class.chip-active]="splitMode() === 'equal'" (click)="splitMode.set('equal')">Equally</button>
                  <button type="button" class="chip justify-center" [class.chip-active]="splitMode() === 'single'" (click)="splitMode.set('single')">One pays</button>
                  <button type="button" class="chip justify-center" [class.chip-active]="splitMode() === 'manual'" (click)="startManual()">Custom</button>
                </div>

                <div class="flex flex-col gap-2">
                  @for (c of customers(); track c.id) {
                    <div class="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                      <span class="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{{ c.name }}</span>

                      @switch (splitMode()) {
                        @case ('single') {
                          <button
                            type="button"
                            class="chip"
                            [class.chip-active]="payerId() === c.id"
                            (click)="payerId.set(c.id)"
                          >
                            {{ payerId() === c.id ? 'Paying' : 'Select' }}
                          </button>
                        }
                        @case ('manual') {
                          <div class="relative w-28">
                            <span class="absolute top-1/2 left-2.5 -translate-y-1/2 text-sm font-semibold text-muted">₹</span>
                            <input
                              class="input py-1.5 pl-6 text-right font-semibold"
                              type="number"
                              inputmode="numeric"
                              [ngModel]="manualShares()[c.id] ?? 0"
                              (ngModelChange)="setManualShare(c.id, $event)"
                            />
                          </div>
                        }
                        @default {
                          <span class="text-[14px] font-bold text-ink tabular-nums">{{ formatCurrency(shares()[c.id] ?? 0) }}</span>
                        }
                      }
                    </div>
                  }
                </div>

                @if (splitMode() === 'manual') {
                  <p
                    class="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium"
                    [class]="splitValid() ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'"
                  >
                    <app-icon [name]="splitValid() ? 'check' : 'alert'" [size]="15" />
                    @if (splitValid()) {
                      Allocated {{ formatCurrency(manualTotal()) }} — matches the table charge.
                    } @else {
                      Allocated {{ formatCurrency(manualTotal()) }} of {{ formatCurrency(price()) }} ·
                      {{ manualTotal() > price() ? formatCurrency(manualTotal() - price()) + ' over' : formatCurrency(price() - manualTotal()) + ' left' }}
                    }
                  </p>
                  <button type="button" class="btn btn-ghost btn-sm w-fit" (click)="startManual()">Reset to equal amounts</button>
                }
              </div>
            }
          </section>
        }

        <!-- Items ------------------------------------------------------ -->
        @if (!isEdit()) {
          <section class="card overflow-hidden">
            <button type="button" class="flex w-full items-center gap-3 px-4 py-3.5 text-left" (click)="toggle('items')">
              <span class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                [class]="cartCount() ? 'bg-success-soft text-success' : 'bg-surface-alt text-muted'">
                @if (cartCount()) { <app-icon name="check" [size]="14" /> } @else { {{ stepNo('items') }} }
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-[13px] font-semibold text-ink">
                  Drinks, snacks &amp; more
                  @if (mode() === 'booking') { <span class="font-normal text-muted">· optional</span> }
                </span>
                <span class="block truncate text-xs text-muted">
                  {{ cartCount() ? cartSummary() : 'Add items to this bill — stock updates automatically' }}
                </span>
              </span>
              <app-icon [name]="open() === 'items' ? 'chevron-down' : 'chevron-right'" [size]="16" />
            </button>

            @if (open() === 'items') {
              <div class="animate-fade-up border-t border-line px-4 py-4">
                @if (customers().length > 1) {
                  <div class="mb-3">
                    <span class="field-label">Adding to</span>
                    <!-- Wraps rather than scrolls so no one is hidden off-edge. -->
                    <div class="flex flex-wrap gap-2">
                      @for (c of customers(); track c.id) {
                        <button
                          type="button"
                          class="chip max-w-full"
                          [class.chip-active]="activeCustomer() === c.id"
                          (click)="activeCustomer.set(c.id)"
                        >
                          <span class="min-w-0 truncate">{{ c.name }}</span>
                          @if (cartCountFor(c.id)) {
                            <span class="pill shrink-0 bg-surface/30 px-1.5 py-0 text-[11px]">{{ cartCountFor(c.id) }}</span>
                          }
                        </button>
                      }
                    </div>
                  </div>
                }

                <div class="relative mb-2">
                  <span class="absolute top-1/2 left-3 -translate-y-1/2 text-faint"><app-icon name="search" [size]="16" /></span>
                  <input class="input pl-9" type="text" placeholder="Search items" [ngModel]="productQuery()" (ngModelChange)="productQuery.set($event)" />
                </div>
                <div class="flex max-h-72 flex-col overflow-y-auto">
                  @for (p of productMatches(); track p.id) {
                    <div class="flex items-center gap-3 border-b border-line-soft py-2.5 last:border-0">
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-[14px] font-medium text-ink">{{ p.name }}</span>
                        <span class="block text-xs" [class]="p.stock <= 0 ? 'text-danger' : 'text-muted'">
                          {{ formatCurrency(p.sellingPrice) }} · {{ p.stock > 0 ? p.stock + ' left' : 'Out of stock' }}
                        </span>
                      </span>
                      <app-quantity-stepper
                        [value]="qtyFor(p.id)"
                        [min]="0"
                        [max]="p.stock"
                        [disabled]="p.stock <= 0 || !activeCustomer()"
                        (valueChange)="setQty(p.id, $event)"
                      />
                    </div>
                  } @empty {
                    <p class="py-4 text-center text-[13px] text-muted">No items match "{{ productQuery() }}".</p>
                  }
                </div>
              </div>
            }
          </section>
        }

        <!-- Payment ---------------------------------------------------- -->
        @if (!isEdit()) {
          <section class="card overflow-hidden">
            <button type="button" class="flex w-full items-center gap-3 px-4 py-3.5 text-left" (click)="toggle('pay')">
              <span class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                [class]="paidNowTotal() > 0 ? 'bg-success-soft text-success' : 'bg-surface-alt text-muted'">
                @if (paidNowTotal() > 0) { <app-icon name="check" [size]="14" /> } @else { {{ stepNo('pay') }} }
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-[13px] font-semibold text-ink">Payment <span class="font-normal text-muted">· optional</span></span>
                <span class="block truncate text-xs text-muted">
                  {{ paidNowTotal() > 0 ? formatCurrency(paidNowTotal()) + ' collected now' : 'Leave empty to keep the tab running' }}
                </span>
              </span>
              <app-icon [name]="open() === 'pay' ? 'chevron-down' : 'chevron-right'" [size]="16" />
            </button>

            @if (open() === 'pay') {
              <div class="animate-fade-up flex flex-col gap-3 border-t border-line px-4 py-4">
                @for (c of customers(); track c.id) {
                  <div class="flex items-center gap-3">
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-[14px] font-medium text-ink">{{ c.name }}</span>
                      <span class="block text-xs text-muted">Owes {{ formatCurrency(customerTotal(c.id)) }}</span>
                    </span>
                    <div class="relative w-28">
                      <span class="absolute top-1/2 left-2.5 -translate-y-1/2 text-sm font-semibold text-muted">₹</span>
                      <input
                        class="input py-1.5 pl-6 text-right font-semibold"
                        type="number"
                        inputmode="numeric"
                        [ngModel]="payNow()[c.id] ?? 0"
                        (ngModelChange)="setPayNow(c.id, $event)"
                      />
                    </div>
                  </div>
                }
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="chip" (click)="collectAll()">Everyone pays in full</button>
                  <button type="button" class="chip" (click)="clearPayments()">Pay later</button>
                </div>
              </div>
            }
          </section>
        }
      </div>

      <!-- Footer ------------------------------------------------------- -->
      <div drawer-footer class="flex w-full items-center gap-3">
        <div class="min-w-0 flex-1">
          <p class="text-[11px] tracking-wide text-muted uppercase">Total</p>
          <p class="text-lg leading-tight font-extrabold text-ink tabular-nums">{{ formatCurrency(total()) }}</p>
        </div>
        <button type="button" class="btn btn-ghost" (click)="flow.close()">Cancel</button>
        <button type="button" class="btn btn-primary" [disabled]="!canSave()" (click)="save()">
          <app-icon name="check" [size]="16" />
          {{ isEdit() ? 'Save changes' : mode() === 'booking' ? 'Save booking' : 'Save sale' }}
        </button>
      </div>
    </app-drawer>
  `,
  host: { class: 'contents' },
})
export class OrderDrawerComponent {
  store = inject(DataStoreService);
  flow = inject(OrderFlowService);
  private toast = inject(ToastService);
  private router = inject(Router);

  formatCurrency = formatCurrency;
  todayStr = todayStr;
  durations = DURATIONS;
  tomorrow = addDays(todayStr(), 1);

  mode = computed(() => this.flow.state().mode);
  isEdit = computed(() => !!this.flow.state().editBookingId);

  open = signal<Section>('customer');
  customerIds = signal<string[]>([]);
  customerQuery = signal('');
  newName = '';
  newMobile = '';

  tableId = signal<string>('');
  date = signal(todayStr());
  startTime = signal(roundToNext30());
  endTime = signal(addMinutesToTime(roundToNext30(), 60));
  duration = signal(1);
  price = signal(0);
  priceOverridden = signal(false);

  splitMode = signal<SplitMode>('equal');
  manualShares = signal<Record<string, number>>({});
  payerId = signal<string | null>(null);

  /** customerId -> (productId -> qty). Each customer keeps their own items. */
  carts = signal<Record<string, Record<string, number>>>({});
  activeCustomer = signal<string | null>(null);
  productQuery = signal('');
  payNow = signal<Record<string, number>>({});

  constructor() {
    const state = this.flow.state();
    const editing = state.editBookingId ? this.store.bookingById(state.editBookingId) : undefined;

    if (editing) {
      this.customerIds.set(editing.customerIds);
      this.tableId.set(editing.tableId);
      this.date.set(editing.date);
      this.startTime.set(editing.startTime);
      this.endTime.set(editing.endTime);
      this.duration.set(editing.durationHours);
      this.price.set(editing.finalPrice);
      this.priceOverridden.set(editing.priceOverridden);
      this.splitMode.set(editing.splitMode);
      this.open.set('when');
    } else {
      if (state.customerId) {
        this.customerIds.set([state.customerId]);
        this.activeCustomer.set(state.customerId);
        this.open.set(state.mode === 'booking' ? 'when' : 'items');
      }
      this.tableId.set(this.firstFreeTableId());
    }

    // Keep the auto price in step with table and duration unless overridden.
    effect(() => {
      const auto = this.autoPrice();
      if (!this.priceOverridden()) this.price.set(auto);
    });
  }

  // ---------- sections ----------
  visibleSections = computed<Section[]>(() => {
    const sections: Section[] = ['customer'];
    if (!this.isEdit()) sections.push('what');
    if (this.mode() === 'booking') sections.push('when');
    if (this.showSplit()) sections.push('split');
    if (!this.isEdit()) sections.push('items', 'pay');
    return sections;
  });

  stepNo(section: Section): number {
    return this.visibleSections().indexOf(section) + 1;
  }

  toggle(section: Section): void {
    this.open.set(this.open() === section ? ('' as Section) : section);
  }

  setMode(mode: 'booking' | 'sale'): void {
    this.flow.state.update((s) => ({ ...s, mode }));
    this.open.set(mode === 'booking' ? 'when' : 'items');
  }

  // ---------- customers ----------
  customers = computed(() =>
    this.customerIds()
      .map((id) => this.store.customers().find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => !!c),
  );

  customerSummary = computed(() => {
    const list = this.customers();
    if (!list.length) return 'Search an existing customer or add a new one';
    if (list.length === 1) return `${list[0].name} · ${list[0].mobile}`;
    return list.map((c) => c.name).join(', ');
  });

  matches = computed(() => {
    const q = this.customerQuery().trim().toLowerCase();
    if (!q) return [];
    const chosen = this.customerIds();
    return this.store
      .customers()
      .filter((c) => !chosen.includes(c.id))
      .filter((c) => c.name.toLowerCase().includes(q) || c.mobile.includes(q))
      .slice(0, 5);
  });

  showInlineCreate = computed(() => this.customerQuery().trim().length >= 2 && this.matches().length === 0);

  onQuery(value: string): void {
    this.customerQuery.set(value);
    // Carry what they typed into the inline form so nothing is retyped.
    if (/^\d+$/.test(value.trim())) {
      this.newMobile = value.trim();
    } else {
      this.newName = value.trim();
    }
  }

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  }

  addCustomer(id: string): void {
    if (this.customerIds().includes(id)) return;
    this.customerIds.update((ids) => [...ids, id]);
    this.customerQuery.set('');
    if (!this.activeCustomer()) this.activeCustomer.set(id);
    if (!this.payerId()) this.payerId.set(id);
    if (this.splitMode() === 'manual') this.startManual();
    // First pick moves the merchant forward; later picks keep the list open.
    if (this.customerIds().length === 1) {
      this.open.set(this.mode() === 'booking' ? 'when' : 'items');
    }
  }

  removeCustomer(id: string): void {
    this.customerIds.update((ids) => ids.filter((x) => x !== id));
    this.carts.update(({ [id]: _removed, ...rest }) => rest);
    this.payNow.update(({ [id]: _dropped, ...rest }) => rest);
    this.manualShares.update(({ [id]: _share, ...rest }) => rest);
    if (this.activeCustomer() === id) this.activeCustomer.set(this.customerIds()[0] ?? null);
    if (this.payerId() === id) this.payerId.set(this.customerIds()[0] ?? null);
  }

  createCustomer(): void {
    const c = this.store.addCustomer(this.newName.trim(), this.newMobile.trim());
    this.newName = '';
    this.newMobile = '';
    this.customerQuery.set('');
    this.toast.success(`${c.name} added`);
    this.addCustomer(c.id);
  }

  // ---------- booking ----------
  /** Default to a table that is actually free for the slot we are proposing. */
  firstFreeTableId(): string {
    const usable = this.store.tables().filter((t) => !t.underMaintenance);
    const free = usable.find((t) => !this.store.hasConflict(t.id, this.date(), this.startTime(), this.endTime()));
    return (free ?? usable[0] ?? this.store.tables()[0])?.id ?? '';
  }

  hourlyRate = computed(() => this.store.tables().find((t) => t.id === this.tableId())?.hourlyRate ?? 0);
  autoPrice = computed(() => Math.round(this.hourlyRate() * this.duration()));
  tableName = computed(() => this.store.tables().find((t) => t.id === this.tableId())?.name ?? 'This table');

  tableOptions = computed(() =>
    this.store.tables().map((t) => {
      const clash = this.store.hasConflict(t.id, this.date(), this.startTime(), this.endTime(), this.flow.state().editBookingId ?? undefined);
      return {
        id: t.id,
        name: t.name,
        hourlyRate: t.hourlyRate,
        busy: !!clash || t.underMaintenance,
        busyLabel: clash ? `${formatTime12(clash.startTime)}–${formatTime12(clash.endTime)}` : 'maintenance',
      };
    }),
  );

  conflict = computed(() => {
    const clash = this.store.hasConflict(
      this.tableId(),
      this.date(),
      this.startTime(),
      this.endTime(),
      this.flow.state().editBookingId ?? undefined,
    );
    return clash ? `${formatTime12(clash.startTime)}–${formatTime12(clash.endTime)}` : '';
  });

  whenSummary = computed(() => {
    if (!this.tableId()) return 'Pick a table';
    if (this.conflict()) return `${this.tableName()} is busy ${this.conflict()}`;
    return `${this.tableName()} · ${relativeDayLabel(this.date())} · ${formatTime12(this.startTime())}–${formatTime12(this.endTime())} · ${formatCurrency(this.price())}`;
  });

  setStart(value: string): void {
    this.startTime.set(value);
    this.endTime.set(addMinutesToTime(value, this.duration() * 60));
  }

  setEnd(value: string): void {
    this.endTime.set(value);
    const mins = timeToMinutes(value) - timeToMinutes(this.startTime());
    this.duration.set(Math.max(0.5, Math.round((mins / 60) * 2) / 2));
  }

  setDuration(hours: number): void {
    this.duration.set(hours);
    this.endTime.set(addMinutesToTime(this.startTime(), hours * 60));
  }

  setPrice(value: number): void {
    this.price.set(Number(value) || 0);
    this.priceOverridden.set(Number(value) !== this.autoPrice());
  }

  resetPrice(): void {
    this.priceOverridden.set(false);
    this.price.set(this.autoPrice());
  }

  // ---------- split ----------
  showSplit = computed(() => this.mode() === 'booking' && this.customers().length > 1 && !this.isEdit());

  shares = computed(() =>
    allocateShares(this.price(), this.customerIds(), this.splitMode(), this.manualShares(), this.payerId() ?? undefined),
  );

  manualTotal = computed(() =>
    this.customerIds().reduce((sum, id) => sum + (Number(this.manualShares()[id]) || 0), 0),
  );

  splitValid = computed(() => this.splitMode() !== 'manual' || this.manualTotal() === this.price());

  splitSummary = computed(() => {
    if (this.splitMode() === 'single') {
      const payer = this.customers().find((c) => c.id === this.payerId());
      return `${payer?.name ?? 'One person'} pays the full ${formatCurrency(this.price())}`;
    }
    if (this.splitMode() === 'manual') {
      return this.splitValid()
        ? `Custom amounts · ${formatCurrency(this.price())} allocated`
        : `Amounts must add up to ${formatCurrency(this.price())}`;
    }
    const each = this.shares()[this.customerIds()[0]] ?? 0;
    return `Equally · about ${formatCurrency(each)} each`;
  });

  startManual(): void {
    // Seed the custom amounts from an equal split so the merchant only adjusts.
    this.splitMode.set('manual');
    this.manualShares.set(allocateShares(this.price(), this.customerIds(), 'equal'));
  }

  setManualShare(customerId: string, value: number): void {
    this.manualShares.update((m) => ({ ...m, [customerId]: Math.max(0, Number(value) || 0) }));
  }

  // ---------- items ----------
  productMatches = computed(() => {
    const q = this.productQuery().trim().toLowerCase();
    return this.store.products().filter((p) => !q || p.name.toLowerCase().includes(q));
  });

  qtyFor(productId: string): number {
    const customer = this.activeCustomer();
    return customer ? (this.carts()[customer]?.[productId] ?? 0) : 0;
  }

  setQty(productId: string, qty: number): void {
    const customer = this.activeCustomer();
    if (!customer) return;
    this.carts.update((carts) => ({
      ...carts,
      [customer]: { ...(carts[customer] ?? {}), [productId]: qty },
    }));
  }

  cartCountFor(customerId: string): number {
    return Object.values(this.carts()[customerId] ?? {}).reduce((s, q) => s + q, 0);
  }

  cartEntriesFor(customerId: string): { product: NonNullable<ReturnType<DataStoreService['productById']>>; qty: number }[] {
    return Object.entries(this.carts()[customerId] ?? {})
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => ({ product: this.store.productById(productId)!, qty }))
      .filter((e) => !!e.product);
  }

  cartCount = computed(() => this.customerIds().reduce((sum, id) => sum + this.cartCountFor(id), 0));

  cartTotalFor(customerId: string): number {
    return this.cartEntriesFor(customerId).reduce((s, e) => s + e.qty * e.product.sellingPrice, 0);
  }

  cartTotal = computed(() => this.customerIds().reduce((sum, id) => sum + this.cartTotalFor(id), 0));

  cartSummary = computed(() =>
    this.customers()
      .filter((c) => this.cartCountFor(c.id) > 0)
      .map((c) => `${c.name}: ${this.cartCountFor(c.id)} item(s)`)
      .join(' · '),
  );

  // ---------- payment ----------
  customerTotal(customerId: string): number {
    const tableShare = this.mode() === 'booking' ? (this.shares()[customerId] ?? 0) : 0;
    return tableShare + this.cartTotalFor(customerId);
  }

  setPayNow(customerId: string, value: number): void {
    const capped = Math.min(Math.max(0, Number(value) || 0), this.customerTotal(customerId));
    this.payNow.update((m) => ({ ...m, [customerId]: capped }));
  }

  paidNowTotal = computed(() =>
    this.customerIds().reduce((sum, id) => sum + (Number(this.payNow()[id]) || 0), 0),
  );

  collectAll(): void {
    const next: Record<string, number> = {};
    for (const id of this.customerIds()) next[id] = this.customerTotal(id);
    this.payNow.set(next);
  }

  clearPayments(): void {
    this.payNow.set({});
  }

  // ---------- totals / save ----------
  total = computed(() => (this.mode() === 'booking' ? this.price() : 0) + this.cartTotal());

  canSave = computed(() => {
    if (this.customerIds().length === 0) return false;
    if (this.mode() === 'booking') {
      return !!this.tableId() && this.duration() > 0 && !this.conflict() && this.splitValid();
    }
    return this.cartCount() > 0;
  });

  save(): void {
    const customerIds = this.customerIds();
    if (customerIds.length === 0) return;
    const editId = this.flow.state().editBookingId;

    if (editId) {
      this.store.updateBookingTime(editId, {
        date: this.date(),
        startTime: this.startTime(),
        endTime: this.endTime(),
        finalPrice: this.price(),
        priceOverridden: this.priceOverridden(),
      });
      if (this.tableId()) this.store.updateBookingTable(editId, this.tableId());
      this.toast.success('Booking updated');
      const bill = this.store.bookingById(editId)?.billId;
      this.flow.close();
      if (bill) this.flow.openDetail(bill);
      return;
    }

    let billByCustomer = new Map<string, string>();

    if (this.mode() === 'booking') {
      const booking = this.store.createBooking({
        customerIds,
        tableId: this.tableId(),
        date: this.date(),
        startTime: this.startTime(),
        endTime: this.endTime(),
        finalPrice: this.price(),
        priceOverridden: this.priceOverridden(),
        splitMode: customerIds.length > 1 ? this.splitMode() : 'equal',
        shares: this.manualShares(),
        payerId: this.payerId() ?? undefined,
      });
      billByCustomer = new Map(this.store.billsInGroup(booking.id).map((b) => [b.customerId, b.id]));

      for (const customerId of customerIds) {
        const billId = billByCustomer.get(customerId);
        if (!billId) continue;
        for (const entry of this.cartEntriesFor(customerId)) {
          this.store.addProductToBill(billId, entry.product, entry.qty);
        }
      }
    } else {
      const entries = customerIds
        .map((customerId) => ({ customerId, items: this.cartEntriesFor(customerId) }))
        .filter((e) => e.items.length > 0);
      const bills = this.store.createSaleGroup(entries);
      billByCustomer = new Map(bills.map((b) => [b.customerId, b.id]));
    }

    for (const customerId of customerIds) {
      const amount = Number(this.payNow()[customerId]) || 0;
      const billId = billByCustomer.get(customerId);
      if (amount > 0 && billId) this.store.addPayment(billId, amount);
    }

    const firstBill = billByCustomer.get(customerIds[0]) ?? [...billByCustomer.values()][0];
    this.toast.success(this.mode() === 'booking' ? 'Booking saved' : 'Sale saved');
    this.flow.close();
    this.router.navigate(['/operations']).then(() => {
      if (firstBill) this.flow.openDetail(firstBill);
    });
  }
}
