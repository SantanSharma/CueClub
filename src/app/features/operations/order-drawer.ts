import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataStoreService } from '../../core/services/data-store.service';
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

type Section = 'customer' | 'what' | 'when' | 'items' | 'pay';
const DURATIONS = [0.5, 1, 1.5, 2, 3];

/**
 * The one creation flow: customer (with inline create) → booking or counter
 * sale → table & time → items → payment. Sections collapse to a summary once
 * answered so the whole job stays on one screen.
 */
@Component({
  selector: 'app-order-drawer',
  imports: [FormsModule, DrawerComponent, IconComponent, QuantityStepperComponent, TooltipDirective],
  template: `
    <app-drawer
      [title]="isEdit() ? 'Edit booking' : mode() === 'booking' ? 'New booking' : 'New counter sale'"
      [subtitle]="isEdit() ? 'Change table, time or price' : 'Everything for this customer in one place'"
      size="lg"
      (close)="flow.close()"
    >
      <div class="flex flex-col gap-3">
        <!-- 1 · Customer ------------------------------------------------ -->
        <section class="card overflow-hidden">
          <button type="button" class="flex w-full items-center gap-3 px-4 py-3.5 text-left" (click)="toggle('customer')">
            <span class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
              [class]="customer() ? 'bg-success-soft text-success' : 'bg-primary-soft text-primary'">
              @if (customer()) { <app-icon name="check" [size]="14" /> } @else { 1 }
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[13px] font-semibold text-ink">Customer</span>
              <span class="block truncate text-xs text-muted">
                {{ customer() ? customer()!.name + ' · ' + customer()!.mobile : 'Search an existing customer or add a new one' }}
              </span>
            </span>
            @if (!isEdit()) {
              <app-icon [name]="open() === 'customer' ? 'chevron-down' : 'chevron-right'" [size]="16" />
            }
          </button>

          @if (open() === 'customer' && !isEdit()) {
            <div class="animate-fade-up border-t border-line px-4 py-4">
              <div class="relative">
                <span class="absolute top-1/2 left-3 -translate-y-1/2 text-faint"><app-icon name="search" [size]="16" /></span>
                <input
                  class="input pl-9"
                  type="text"
                  placeholder="Search name or mobile number"
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
                      (click)="pickCustomer(c.id)"
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

              @if (!customerQuery().trim() && !matches().length) {
                <p class="mt-2 text-xs text-muted">Start typing — if they're new, you can create them without leaving this screen.</p>
              }
            </div>
          }
        </section>

        <!-- 2 · What ---------------------------------------------------- -->
        @if (!isEdit()) {
          <section class="card px-4 py-3.5">
            <div class="mb-2.5 flex items-center gap-2">
              <span class="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">2</span>
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

        <!-- 3 · Table & time -------------------------------------------- -->
        @if (mode() === 'booking') {
          <section class="card overflow-hidden">
            <button type="button" class="flex w-full items-center gap-3 px-4 py-3.5 text-left" (click)="toggle('when')">
              <span class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                [class]="tableId() && !conflict() ? 'bg-success-soft text-success' : 'bg-primary-soft text-primary'">
                @if (tableId() && !conflict()) { <app-icon name="check" [size]="14" /> } @else { {{ isEdit() ? 2 : 3 }} }
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-[13px] font-semibold text-ink">Table &amp; time</span>
                <span class="block truncate text-xs" [class]="conflict() ? 'text-danger' : 'text-muted'">
                  {{ whenSummary() }}
                </span>
              </span>
              <app-icon [name]="open() === 'when' ? 'chevron-down' : 'chevron-right'" [size]="16" />
            </button>

            @if (open() === 'when') {
              <div class="animate-fade-up flex flex-col gap-4 border-t border-line px-4 py-4">
                <!-- date -->
                <div>
                  <span class="field-label">Date</span>
                  <div class="flex flex-wrap items-center gap-2">
                    <button type="button" class="chip" [class.chip-active]="date() === todayStr()" (click)="date.set(todayStr())">Today</button>
                    <button type="button" class="chip" [class.chip-active]="date() === tomorrow" (click)="date.set(tomorrow)">Tomorrow</button>
                    <input class="input w-auto flex-1 py-2" type="date" [ngModel]="date()" (ngModelChange)="date.set($event)" />
                  </div>
                </div>

                <!-- table -->
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

                <!-- time -->
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

                <!-- price -->
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

        <!-- 4 · Items --------------------------------------------------- -->
        @if (!isEdit()) {
          <section class="card overflow-hidden">
            <button type="button" class="flex w-full items-center gap-3 px-4 py-3.5 text-left" (click)="toggle('items')">
              <span class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                [class]="cartCount() ? 'bg-success-soft text-success' : 'bg-surface-alt text-muted'">
                @if (cartCount()) { <app-icon name="check" [size]="14" /> } @else { {{ mode() === 'booking' ? 4 : 3 }} }
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
                        [value]="cart()[p.id] ?? 0"
                        [min]="0"
                        [max]="p.stock"
                        [disabled]="p.stock <= 0"
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

        <!-- 5 · Payment ------------------------------------------------- -->
        @if (!isEdit()) {
          <section class="card overflow-hidden">
            <button type="button" class="flex w-full items-center gap-3 px-4 py-3.5 text-left" (click)="toggle('pay')">
              <span class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                [class]="payNow > 0 ? 'bg-success-soft text-success' : 'bg-surface-alt text-muted'">
                @if (payNow > 0) { <app-icon name="check" [size]="14" /> } @else { {{ mode() === 'booking' ? 5 : 4 }} }
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-[13px] font-semibold text-ink">Payment <span class="font-normal text-muted">· optional</span></span>
                <span class="block truncate text-xs text-muted">
                  {{ payNow > 0 ? formatCurrency(payNow) + ' collected now' : 'Leave empty to keep the tab running' }}
                </span>
              </span>
              <app-icon [name]="open() === 'pay' ? 'chevron-down' : 'chevron-right'" [size]="16" />
            </button>

            @if (open() === 'pay') {
              <div class="animate-fade-up border-t border-line px-4 py-4">
                <div class="relative">
                  <span class="absolute top-1/2 left-3 -translate-y-1/2 text-sm font-semibold text-muted">₹</span>
                  <input class="input pl-7 font-semibold" type="number" inputmode="numeric" placeholder="0" [(ngModel)]="payNow" />
                </div>
                <div class="mt-2 flex flex-wrap gap-2">
                  <button type="button" class="chip" (click)="payNow = total()">Full {{ formatCurrency(total()) }}</button>
                  <button type="button" class="chip" (click)="payNow = Math.round(total() / 2)">Half</button>
                  <button type="button" class="chip" (click)="payNow = 0">Pay later</button>
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
  Math = Math;
  durations = DURATIONS;
  tomorrow = addDays(todayStr(), 1);

  mode = computed(() => this.flow.state().mode);
  isEdit = computed(() => !!this.flow.state().editBookingId);

  open = signal<Section>('customer');
  customerId = signal<string | null>(null);
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

  cart = signal<Record<string, number>>({});
  productQuery = signal('');
  payNow = 0;

  constructor() {
    const state = this.flow.state();
    const editing = state.editBookingId ? this.store.bookingById(state.editBookingId) : undefined;

    if (editing) {
      this.customerId.set(editing.customerId);
      this.tableId.set(editing.tableId);
      this.date.set(editing.date);
      this.startTime.set(editing.startTime);
      this.endTime.set(editing.endTime);
      this.duration.set(editing.durationHours);
      this.price.set(editing.finalPrice);
      this.priceOverridden.set(editing.priceOverridden);
      this.open.set('when');
    } else {
      if (state.customerId) {
        this.customerId.set(state.customerId);
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

  // ---------- customer ----------
  customer = computed(() => this.store.customers().find((c) => c.id === this.customerId()));

  matches = computed(() => {
    const q = this.customerQuery().trim().toLowerCase();
    if (!q) return [];
    return this.store
      .customers()
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
    return name
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  }

  pickCustomer(id: string): void {
    this.customerId.set(id);
    this.customerQuery.set('');
    this.open.set(this.mode() === 'booking' ? 'when' : 'items');
  }

  createCustomer(): void {
    const c = this.store.addCustomer(this.newName.trim(), this.newMobile.trim());
    this.newName = '';
    this.newMobile = '';
    this.customerQuery.set('');
    this.toast.success(`${c.name} added`);
    this.pickCustomer(c.id);
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

  // ---------- items ----------
  productMatches = computed(() => {
    const q = this.productQuery().trim().toLowerCase();
    return this.store.products().filter((p) => !q || p.name.toLowerCase().includes(q));
  });

  setQty(productId: string, qty: number): void {
    this.cart.update((c) => ({ ...c, [productId]: qty }));
  }

  cartEntries = computed(() =>
    Object.entries(this.cart())
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ product: this.store.productById(id)!, qty }))
      .filter((e) => !!e.product),
  );

  cartCount = computed(() => this.cartEntries().reduce((s, e) => s + e.qty, 0));
  cartTotal = computed(() => this.cartEntries().reduce((s, e) => s + e.qty * e.product.sellingPrice, 0));
  cartSummary = computed(() => this.cartEntries().map((e) => `${e.product.name} ×${e.qty}`).join(', '));

  // ---------- totals / save ----------
  total = computed(() => (this.mode() === 'booking' ? this.price() : 0) + this.cartTotal());

  canSave = computed(() => {
    if (!this.customerId()) return false;
    if (this.mode() === 'booking') return !!this.tableId() && this.duration() > 0 && !this.conflict();
    return this.cartCount() > 0;
  });

  toggle(section: Section): void {
    this.open.set(this.open() === section ? ('' as Section) : section);
  }

  setMode(mode: 'booking' | 'sale'): void {
    this.flow.state.update((s) => ({ ...s, mode }));
    this.open.set(mode === 'booking' ? 'when' : 'items');
  }

  save(): void {
    const customerId = this.customerId();
    if (!customerId) return;
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

    let billId: string;
    if (this.mode() === 'booking') {
      const booking = this.store.createBooking({
        customerId,
        tableId: this.tableId(),
        date: this.date(),
        startTime: this.startTime(),
        endTime: this.endTime(),
        finalPrice: this.price(),
        priceOverridden: this.priceOverridden(),
      });
      billId = booking.billId;
    } else {
      billId = this.store.createWalkInBill(customerId).id;
    }

    for (const entry of this.cartEntries()) {
      this.store.addProductToBill(billId, entry.product, entry.qty);
    }
    if (this.payNow > 0) {
      this.store.addPayment(billId, Math.min(this.payNow, this.total()));
    }

    this.toast.success(this.mode() === 'booking' ? 'Booking saved' : 'Sale saved');
    this.flow.close();
    this.router.navigate(['/operations']).then(() => this.flow.openDetail(billId));
  }
}
