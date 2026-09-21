import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExpenseCategory } from '../../core/models/models';
import { DataStoreService } from '../../core/services/data-store.service';
import { SecurityService } from '../../core/services/security.service';
import { BadgeComponent } from '../../shared/ui/badge/badge';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { IconComponent } from '../../shared/ui/icon/icon';
import { ModalComponent } from '../../shared/ui/modal/modal';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { TooltipDirective } from '../../shared/ui/tooltip/tooltip.directive';
import { downloadCsv } from '../../shared/util/csv-export';
import { addDays, formatCurrency, formatDate, todayStr } from '../../shared/util/format';

type Preset = 'today' | 'week' | 'month' | 'custom';
type Tab = 'revenue' | 'products' | 'payments' | 'expenses';

const EXPENSE_CATEGORIES: ExpenseCategory[] = ['Rent', 'Utilities', 'Salaries', 'Maintenance', 'Supplies', 'Other'];

/** Reporting and history. Everything here is review, not daily operation. */
@Component({
  selector: 'app-analytics-page',
  imports: [FormsModule, IconComponent, BadgeComponent, ModalComponent, EmptyStateComponent, TooltipDirective],
  template: `
    <div class="flex flex-col gap-5">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">Analytics</h1>
          <p class="mt-0.5 text-[13px] text-muted sm:text-sm">{{ formatDate(from()) }} — {{ formatDate(to()) }}</p>
        </div>
        <button type="button" class="btn btn-secondary" (click)="showExport.set(true)"
          [appTooltip]="'Download this period as a CSV file that opens in Excel'">
          <app-icon name="download" [size]="16" /> Export
        </button>
      </header>

      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="chip" [class.chip-active]="preset() === 'today'" (click)="setPreset('today')">Today</button>
        <button type="button" class="chip" [class.chip-active]="preset() === 'week'" (click)="setPreset('week')">7 days</button>
        <button type="button" class="chip" [class.chip-active]="preset() === 'month'" (click)="setPreset('month')">30 days</button>
        <button type="button" class="chip" [class.chip-active]="preset() === 'custom'" (click)="preset.set('custom')">
          <app-icon name="calendar" [size]="14" /> Custom
        </button>
        @if (preset() === 'custom') {
          <div class="flex animate-fade-up items-center gap-2">
            <input class="input w-auto py-2" type="date" [ngModel]="from()" (ngModelChange)="from.set($event)" />
            <span class="text-xs text-muted">to</span>
            <input class="input w-auto py-2" type="date" [ngModel]="to()" (ngModelChange)="to.set($event)" />
          </div>
        }
      </div>

      <!-- Headline numbers -->
      <div class="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <div class="card card-pad">
          <p class="text-[11px] font-medium tracking-wide text-muted uppercase">Revenue</p>
          <p class="mt-1 text-2xl font-extrabold text-ink tabular-nums">{{ formatCurrency(totals().revenue) }}</p>
          <p class="mt-1 text-xs text-muted">{{ bills().length }} bill(s)</p>
        </div>
        <div class="card card-pad">
          <p class="text-[11px] font-medium tracking-wide text-muted uppercase">Expenses</p>
          <p class="mt-1 text-2xl font-extrabold text-ink tabular-nums">{{ formatCurrency(totals().expenses) }}</p>
          <p class="mt-1 text-xs text-muted">{{ expenses().length }} entries</p>
        </div>
        <div class="card card-pad">
          <p class="flex items-center gap-1 text-[11px] font-medium tracking-wide text-muted uppercase">
            Net
            <span class="text-faint" [appTooltip]="'Revenue minus recorded expenses for this period'"><app-icon name="help" [size]="11" /></span>
          </p>
          <p class="mt-1 text-2xl font-extrabold tabular-nums" [class]="totals().revenue - totals().expenses >= 0 ? 'text-success' : 'text-danger'">
            {{ formatCurrency(totals().revenue - totals().expenses) }}
          </p>
        </div>
        <div class="card card-pad">
          <p class="text-[11px] font-medium tracking-wide text-muted uppercase">Outstanding</p>
          <p class="mt-1 text-2xl font-extrabold tabular-nums" [class]="totals().outstanding > 0 ? 'text-danger' : 'text-ink'">
            {{ formatCurrency(totals().outstanding) }}
          </p>
          <p class="mt-1 text-xs text-muted">Unpaid + part paid</p>
        </div>
      </div>

      <!-- Charts -->
      <div class="grid gap-3 lg:grid-cols-2">
        <section class="card card-pad">
          <h2 class="text-[13px] font-bold tracking-wide text-muted uppercase">Where the money came from</h2>
          <div class="mt-4 flex h-3 overflow-hidden rounded-full bg-surface-alt">
            <div class="bg-primary transition-all duration-500" [style.width.%]="poolPct()"></div>
            <div class="bg-info transition-all duration-500" [style.width.%]="100 - poolPct()"></div>
          </div>
          <div class="mt-4 grid grid-cols-2 gap-3">
            <div class="rounded-xl bg-canvas px-3.5 py-3">
              <p class="flex items-center gap-2 text-[12px] font-medium text-muted">
                <span class="h-2.5 w-2.5 rounded-full bg-primary"></span> Table time
              </p>
              <p class="mt-1 text-lg font-extrabold text-ink tabular-nums">{{ formatCurrency(totals().pool) }}</p>
              <p class="text-[11px] text-muted">{{ poolPct() }}% of revenue</p>
            </div>
            <div class="rounded-xl bg-canvas px-3.5 py-3">
              <p class="flex items-center gap-2 text-[12px] font-medium text-muted">
                <span class="h-2.5 w-2.5 rounded-full bg-info"></span> Products
              </p>
              <p class="mt-1 text-lg font-extrabold text-ink tabular-nums">{{ formatCurrency(totals().product) }}</p>
              <p class="text-[11px] text-muted">{{ 100 - poolPct() }}% of revenue</p>
            </div>
          </div>
        </section>

        <section class="card card-pad">
          <h2 class="text-[13px] font-bold tracking-wide text-muted uppercase">Daily takings</h2>
          <div class="mt-4 flex h-28 items-end gap-1.5">
            @for (d of trend(); track d.date) {
              <div class="flex h-full flex-1 flex-col items-center justify-end gap-1.5" [appTooltip]="d.tip">
                <div
                  class="w-full rounded-t-md bg-gradient-to-t from-primary to-primary/70 transition-all duration-500 hover:from-primary-dark"
                  [style.height.%]="d.pct"
                ></div>
                <span class="text-[10px] font-medium text-muted">{{ d.label }}</span>
              </div>
            }
          </div>
        </section>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 overflow-x-auto border-b border-line no-scrollbar">
        @for (t of tabs; track t.id) {
          <button
            type="button"
            class="shrink-0 border-b-2 px-3.5 py-2.5 text-[13px] font-semibold transition"
            [class]="tab() === t.id ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'"
            (click)="tab.set(t.id)"
          >
            {{ t.label }}
          </button>
        }
      </div>

      @switch (tab()) {
        @case ('revenue') {
          <div class="card overflow-x-auto">
            <table class="w-full min-w-[420px] text-sm">
              <thead>
                <tr class="border-b border-line bg-canvas text-left">
                  <th class="px-4 py-2.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Date</th>
                  <th class="px-4 py-2.5 text-right text-[11px] font-semibold tracking-wide text-muted uppercase">Table time</th>
                  <th class="px-4 py-2.5 text-right text-[11px] font-semibold tracking-wide text-muted uppercase">Products</th>
                  <th class="px-4 py-2.5 text-right text-[11px] font-semibold tracking-wide text-muted uppercase">Total</th>
                </tr>
              </thead>
              <tbody>
                @for (r of revenueByDate(); track r.date) {
                  <tr class="border-b border-line-soft last:border-0">
                    <td class="px-4 py-3">{{ formatDate(r.date) }}</td>
                    <td class="px-4 py-3 text-right tabular-nums">{{ formatCurrency(r.pool) }}</td>
                    <td class="px-4 py-3 text-right tabular-nums">{{ formatCurrency(r.product) }}</td>
                    <td class="px-4 py-3 text-right font-bold tabular-nums">{{ formatCurrency(r.total) }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="4"><app-empty-state icon="chart" title="No revenue in this period" /></td></tr>
                }
              </tbody>
            </table>
          </div>
        }
        @case ('products') {
          <div class="card overflow-x-auto">
            <table class="w-full min-w-[520px] text-sm">
              <thead>
                <tr class="border-b border-line bg-canvas text-left">
                  <th class="px-4 py-2.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Product</th>
                  <th class="px-4 py-2.5 text-right text-[11px] font-semibold tracking-wide text-muted uppercase">Sold</th>
                  <th class="px-4 py-2.5 text-right text-[11px] font-semibold tracking-wide text-muted uppercase">Revenue</th>
                  <th class="px-4 py-2.5 text-right text-[11px] font-semibold tracking-wide text-muted uppercase">Cost</th>
                  <th class="px-4 py-2.5 text-right text-[11px] font-semibold tracking-wide text-muted uppercase">Profit</th>
                </tr>
              </thead>
              <tbody>
                @for (r of productSales(); track r.product.id) {
                  <tr class="border-b border-line-soft last:border-0">
                    <td class="px-4 py-3 font-medium text-ink">{{ r.product.name }}</td>
                    <td class="px-4 py-3 text-right tabular-nums">{{ r.qty }}</td>
                    <td class="px-4 py-3 text-right tabular-nums">{{ formatCurrency(r.revenue) }}</td>
                    <td class="px-4 py-3 text-right text-muted tabular-nums">{{ formatCurrency(r.cost) }}</td>
                    <td class="px-4 py-3 text-right font-bold text-success tabular-nums">{{ formatCurrency(r.revenue - r.cost) }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="5"><app-empty-state icon="box" title="No product sales in this period" /></td></tr>
                }
              </tbody>
            </table>
          </div>
        }
        @case ('payments') {
          <div class="card overflow-x-auto">
            <table class="w-full min-w-[520px] text-sm">
              <thead>
                <tr class="border-b border-line bg-canvas text-left">
                  <th class="px-4 py-2.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Customer</th>
                  <th class="px-4 py-2.5 text-right text-[11px] font-semibold tracking-wide text-muted uppercase">Bill</th>
                  <th class="px-4 py-2.5 text-right text-[11px] font-semibold tracking-wide text-muted uppercase">Paid</th>
                  <th class="px-4 py-2.5 text-right text-[11px] font-semibold tracking-wide text-muted uppercase">Due</th>
                  <th class="px-4 py-2.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                @for (r of paymentRows(); track r.id) {
                  <tr class="border-b border-line-soft last:border-0">
                    <td class="px-4 py-3 font-medium text-ink">{{ r.name }}</td>
                    <td class="px-4 py-3 text-right tabular-nums">{{ formatCurrency(r.total) }}</td>
                    <td class="px-4 py-3 text-right tabular-nums">{{ formatCurrency(r.paid) }}</td>
                    <td class="px-4 py-3 text-right font-semibold tabular-nums" [class]="r.due > 0 ? 'text-danger' : 'text-muted'">
                      {{ formatCurrency(r.due) }}
                    </td>
                    <td class="px-4 py-3"><app-badge [status]="r.status" /></td>
                  </tr>
                } @empty {
                  <tr><td colspan="5"><app-empty-state icon="wallet" title="No bills in this period" /></td></tr>
                }
              </tbody>
            </table>
          </div>
        }
        @case ('expenses') {
          <div class="flex flex-col gap-3">
            <button type="button" class="btn btn-primary w-fit" (click)="showExpense.set(true)">
              <app-icon name="plus" [size]="16" /> Record expense
            </button>
            @if (expenses().length) {
              <div class="card overflow-hidden">
                @for (e of expenses(); track e.id) {
                  <div class="flex items-center gap-3 border-b border-line-soft px-4 py-3 last:border-0">
                    <div class="min-w-0 flex-1">
                      <p class="text-[14px] font-medium text-ink">{{ e.name }}</p>
                      <p class="truncate text-xs text-muted">{{ e.category }} · {{ formatDate(e.date) }}{{ e.notes ? ' · ' + e.notes : '' }}</p>
                    </div>
                    <span class="text-[14px] font-bold tabular-nums">{{ formatCurrency(e.amount) }}</span>
                    <button type="button" class="btn btn-ghost btn-icon text-faint hover:text-danger" (click)="removeExpense(e.id)" aria-label="Delete expense">
                      <app-icon name="trash" [size]="15" />
                    </button>
                  </div>
                }
              </div>
            } @else {
              <div class="card"><app-empty-state icon="receipt" title="No expenses recorded" description="Track rent, salaries, utilities and supplies to see true profit." /></div>
            }
          </div>
        }
      }
    </div>

    @if (showExpense()) {
      <app-modal title="Record expense" (close)="showExpense.set(false)">
        <div>
          <label class="field-label">What was it for?</label>
          <input class="input" type="text" placeholder="e.g. Electricity bill" [(ngModel)]="expForm.name" />
        </div>
        <div>
          <label class="field-label">Category</label>
          <select class="input" [(ngModel)]="expForm.category">
            @for (c of expenseCategories; track c) { <option [value]="c">{{ c }}</option> }
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="field-label">Amount</label>
            <input class="input" type="number" inputmode="numeric" [(ngModel)]="expForm.amount" />
          </div>
          <div>
            <label class="field-label">Date</label>
            <input class="input" type="date" [(ngModel)]="expForm.date" />
          </div>
        </div>
        <div>
          <label class="field-label">Notes</label>
          <input class="input" type="text" placeholder="Optional" [(ngModel)]="expForm.notes" />
        </div>
        <div modal-footer>
          <button type="button" class="btn btn-ghost" (click)="showExpense.set(false)">Cancel</button>
          <button type="button" class="btn btn-primary" [disabled]="!expForm.name.trim() || expForm.amount <= 0" (click)="saveExpense()">Save</button>
        </div>
      </app-modal>
    }

    @if (showExport()) {
      <app-modal title="Export report" (close)="showExport.set(false)">
        <p class="text-[13px] leading-relaxed text-ink-soft">
          Downloads every booking, counter sale, payment and expense between
          <strong>{{ formatDate(from()) }}</strong> and <strong>{{ formatDate(to()) }}</strong> as a CSV file — it opens directly in Excel.
        </p>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="chip" [class.chip-active]="preset() === 'today'" (click)="setPreset('today')">Today</button>
          <button type="button" class="chip" [class.chip-active]="preset() === 'week'" (click)="setPreset('week')">7 days</button>
          <button type="button" class="chip" [class.chip-active]="preset() === 'month'" (click)="setPreset('month')">30 days</button>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="field-label">From</label>
            <input class="input" type="date" [ngModel]="from()" (ngModelChange)="from.set($event); preset.set('custom')" />
          </div>
          <div>
            <label class="field-label">To</label>
            <input class="input" type="date" [ngModel]="to()" (ngModelChange)="to.set($event); preset.set('custom')" />
          </div>
        </div>
        <div modal-footer>
          <button type="button" class="btn btn-ghost" (click)="showExport.set(false)">Cancel</button>
          <button type="button" class="btn btn-primary" (click)="exportCsv()"><app-icon name="download" [size]="15" /> Download CSV</button>
        </div>
      </app-modal>
    }
  `,
  host: { class: 'block animate-fade-up' },
})
export class AnalyticsPage {
  store = inject(DataStoreService);
  private security = inject(SecurityService);
  private toast = inject(ToastService);
  formatCurrency = formatCurrency;
  formatDate = formatDate;
  expenseCategories = EXPENSE_CATEGORIES;

  tabs: { id: Tab; label: string }[] = [
    { id: 'revenue', label: 'Revenue' },
    { id: 'products', label: 'Products' },
    { id: 'payments', label: 'Payments' },
    { id: 'expenses', label: 'Expenses' },
  ];
  tab = signal<Tab>('revenue');

  preset = signal<Preset>('week');
  from = signal(addDays(todayStr(), -6));
  to = signal(todayStr());

  showExpense = signal(false);
  showExport = signal(false);
  expForm = { name: '', category: 'Other' as ExpenseCategory, amount: 0, date: todayStr(), notes: '' };

  setPreset(p: Preset): void {
    this.preset.set(p);
    const today = todayStr();
    if (p === 'today') {
      this.from.set(today);
      this.to.set(today);
    } else if (p === 'week') {
      this.from.set(addDays(today, -6));
      this.to.set(today);
    } else if (p === 'month') {
      this.from.set(addDays(today, -29));
      this.to.set(today);
    }
  }

  bills = computed(() => this.store.billsInRange(this.from(), this.to()));
  expenses = computed(() => this.store.expensesInRange(this.from(), this.to()));

  totals = computed(() => {
    const bills = this.bills();
    const pool = bills.reduce((s, b) => s + b.items.filter((i) => i.type === 'booking').reduce((x, i) => x + i.amount, 0), 0);
    const product = bills.reduce((s, b) => s + b.items.filter((i) => i.type === 'product').reduce((x, i) => x + i.amount, 0), 0);
    const expenses = this.expenses().reduce((s, e) => s + e.amount, 0);
    const outstanding = bills.reduce((s, b) => s + Math.max(0, b.total - b.paidAmount), 0);
    return { revenue: pool + product, pool, product, expenses, outstanding };
  });

  poolPct = computed(() => {
    const { pool, product } = this.totals();
    const total = pool + product;
    return total > 0 ? Math.round((pool / total) * 100) : 50;
  });

  revenueByDate = computed(() => {
    const map = new Map<string, { pool: number; product: number }>();
    for (const b of this.bills()) {
      const d = b.createdAt.slice(0, 10);
      const cur = map.get(d) ?? { pool: 0, product: 0 };
      cur.pool += b.items.filter((i) => i.type === 'booking').reduce((x, i) => x + i.amount, 0);
      cur.product += b.items.filter((i) => i.type === 'product').reduce((x, i) => x + i.amount, 0);
      map.set(d, cur);
    }
    return [...map.entries()]
      .map(([date, v]) => ({ date, pool: v.pool, product: v.product, total: v.pool + v.product }))
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  trend = computed(() => {
    const days: { date: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = addDays(todayStr(), -i);
      const total = this.store.bills().filter((b) => b.createdAt.slice(0, 10) === date).reduce((s, b) => s + b.total, 0);
      days.push({ date, total });
    }
    const max = Math.max(...days.map((d) => d.total), 1);
    return days.map((d) => ({
      date: d.date,
      pct: Math.max(4, Math.round((d.total / max) * 100)),
      label: new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 2),
      tip: `${formatDate(d.date)} · ${formatCurrency(d.total)}`,
    }));
  });

  productSales = computed(() => this.store.productSalesInRange(this.from(), this.to()));

  paymentRows = computed(() =>
    this.bills().map((b) => ({
      id: b.id,
      name: this.store.customers().find((c) => c.id === b.customerId)?.name ?? 'Unknown',
      total: b.total,
      paid: b.paidAmount,
      due: b.total - b.paidAmount,
      status: b.status,
    })),
  );

  saveExpense(): void {
    this.store.addExpense({
      name: this.expForm.name.trim(),
      category: this.expForm.category,
      amount: Number(this.expForm.amount) || 0,
      date: this.expForm.date,
      notes: this.expForm.notes.trim(),
    });
    this.toast.success('Expense recorded');
    this.showExpense.set(false);
    this.expForm = { name: '', category: 'Other', amount: 0, date: todayStr(), notes: '' };
  }

  async removeExpense(id: string): Promise<void> {
    if (!(await this.security.guard('remove this expense'))) return;
    this.store.removeExpense(id);
    this.toast.success('Expense removed');
  }

  exportCsv(): void {
    const rows: Record<string, unknown>[] = [];
    for (const b of this.bills()) {
      const customer = this.store.customers().find((c) => c.id === b.customerId);
      const booking = b.bookingId ? this.store.bookingById(b.bookingId) : undefined;
      const table = booking ? this.store.tables().find((t) => t.id === booking.tableId) : undefined;
      rows.push({
        'Record Type': booking ? 'Booking' : 'Counter Sale',
        Date: b.createdAt.slice(0, 10),
        Customer: customer?.name ?? '',
        Mobile: customer?.mobile ?? '',
        Table: table?.name ?? '',
        'Start Time': booking?.startTime ?? '',
        'End Time': booking?.endTime ?? '',
        'Booking Amount': b.items.filter((i) => i.type === 'booking').reduce((s, i) => s + i.amount, 0) || '',
        Products: b.items.filter((i) => i.type === 'product').map((i) => `${i.name} x${i.qty}`).join('; '),
        'Total Bill': b.total,
        Paid: b.paidAmount,
        Remaining: b.total - b.paidAmount,
        'Payment Status': b.status,
        'Expense Category': '',
        'Expense Amount': '',
        Notes: '',
      });
    }
    for (const e of this.expenses()) {
      rows.push({
        'Record Type': 'Expense',
        Date: e.date,
        Customer: '',
        Mobile: '',
        Table: '',
        'Start Time': '',
        'End Time': '',
        'Booking Amount': '',
        Products: '',
        'Total Bill': '',
        Paid: '',
        Remaining: '',
        'Payment Status': '',
        'Expense Category': e.category,
        'Expense Amount': e.amount,
        Notes: e.notes,
      });
    }
    downloadCsv(`cueclub-report_${this.from()}_to_${this.to()}.csv`, rows);
    this.toast.success('Report downloaded');
    this.showExport.set(false);
  }
}
