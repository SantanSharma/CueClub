import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataStoreService } from '../../core/services/data-store.service';
import { OrderFlowService } from '../../core/services/order-flow.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { IconComponent } from '../../shared/ui/icon/icon';
import { ModalComponent } from '../../shared/ui/modal/modal';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { TooltipDirective } from '../../shared/ui/tooltip/tooltip.directive';
import { formatCurrency } from '../../shared/util/format';

@Component({
  selector: 'app-customers-list-page',
  imports: [FormsModule, IconComponent, ModalComponent, EmptyStateComponent, TooltipDirective],
  template: `
    <div class="flex flex-col gap-5">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">Customers</h1>
          <p class="mt-0.5 text-[13px] text-muted sm:text-sm">
            {{ store.customers().length }} on file · {{ formatCurrency(totalOutstanding()) }} outstanding
          </p>
        </div>
        <button
          type="button"
          class="btn btn-secondary"
          (click)="showAdd.set(true)"
          [appTooltip]="'Register a regular ahead of time. During a booking you can also add a customer inline.'"
        >
          <app-icon name="user-plus" [size]="16" /> Add customer
        </button>
      </header>

      <div class="relative">
        <span class="absolute top-1/2 left-3 -translate-y-1/2 text-faint"><app-icon name="search" [size]="16" /></span>
        <input class="input max-w-md pl-9" type="text" placeholder="Search name or mobile" [ngModel]="search()" (ngModelChange)="search.set($event)" />
      </div>

      @if (rows().length) {
        <!-- Desktop -->
        <div class="card hidden overflow-hidden lg:block">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-line bg-canvas text-left">
                <th class="px-4 py-2.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Customer</th>
                <th class="px-4 py-2.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Mobile</th>
                <th class="px-4 py-2.5 text-right text-[11px] font-semibold tracking-wide text-muted uppercase">Visits</th>
                <th class="px-4 py-2.5 text-right text-[11px] font-semibold tracking-wide text-muted uppercase">Spent</th>
                <th class="px-4 py-2.5 text-right text-[11px] font-semibold tracking-wide text-muted uppercase">Outstanding</th>
                <th class="w-36"></th>
              </tr>
            </thead>
            <tbody class="stagger">
              @for (r of rows(); track r.id) {
                <tr class="row-hover cursor-pointer border-b border-line-soft last:border-0" (click)="open(r.id)">
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2.5">
                      <span class="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-darker">
                        {{ r.initials }}
                      </span>
                      <span class="font-semibold text-ink">{{ r.name }}</span>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-ink-soft">{{ r.mobile }}</td>
                  <td class="px-4 py-3 text-right tabular-nums">{{ r.visits }}</td>
                  <td class="px-4 py-3 text-right font-semibold tabular-nums">{{ formatCurrency(r.spent) }}</td>
                  <td class="px-4 py-3 text-right font-semibold tabular-nums" [class]="r.due > 0 ? 'text-danger' : 'text-muted'">
                    {{ formatCurrency(r.due) }}
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button type="button" class="btn btn-secondary btn-sm" (click)="book($event, r.id)">
                      <app-icon name="plus" [size]="13" /> Booking
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Mobile -->
        <div class="stagger flex flex-col gap-2.5 lg:hidden">
          @for (r of rows(); track r.id) {
            <button type="button" class="card card-pad text-left transition active:scale-[0.99]" (click)="open(r.id)">
              <div class="flex items-center gap-3">
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[13px] font-bold text-primary-darker">
                  {{ r.initials }}
                </span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-[15px] font-bold text-ink">{{ r.name }}</p>
                  <p class="text-xs text-muted">{{ r.mobile }} · {{ r.visits }} visit(s)</p>
                </div>
                <div class="text-right">
                  <p class="text-[14px] font-extrabold text-ink tabular-nums">{{ formatCurrency(r.spent) }}</p>
                  @if (r.due > 0) {
                    <p class="text-xs font-semibold text-danger tabular-nums">{{ formatCurrency(r.due) }} due</p>
                  }
                </div>
              </div>
            </button>
          }
        </div>
      } @else {
        <div class="card">
          <app-empty-state
            icon="users"
            title="No customers yet"
            description="Customers are created automatically the first time you book for them — or add one here."
          >
            <button type="button" class="btn btn-primary" (click)="showAdd.set(true)">
              <app-icon name="user-plus" [size]="16" /> Add customer
            </button>
          </app-empty-state>
        </div>
      }
    </div>

    @if (showAdd()) {
      <app-modal title="Add customer" (close)="showAdd.set(false)">
        <div>
          <label class="field-label">Full name</label>
          <input class="input" type="text" placeholder="e.g. Priya Sharma" [(ngModel)]="newName" />
        </div>
        <div>
          <label class="field-label">Mobile number</label>
          <input class="input" type="tel" inputmode="numeric" placeholder="10-digit mobile" [(ngModel)]="newMobile" />
        </div>
        <div modal-footer>
          <button type="button" class="btn btn-ghost" (click)="showAdd.set(false)">Cancel</button>
          <button type="button" class="btn btn-primary" [disabled]="!newName.trim() || !newMobile.trim()" (click)="addCustomer()">
            Save customer
          </button>
        </div>
      </app-modal>
    }
  `,
  host: { class: 'block animate-fade-up' },
})
export class CustomersListPage {
  store = inject(DataStoreService);
  flow = inject(OrderFlowService);
  private router = inject(Router);
  private toast = inject(ToastService);
  formatCurrency = formatCurrency;

  search = signal('');
  showAdd = signal(false);
  newName = '';
  newMobile = '';

  rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.store
      .customers()
      .map((c) => ({
        id: c.id,
        name: c.name,
        mobile: c.mobile,
        initials: c.name.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase(),
        visits: this.store.customerBills(c.id).length,
        spent: this.store.customerTotalSpend(c.id),
        due: this.store.customerOutstanding(c.id),
      }))
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.mobile.includes(q))
      .sort((a, b) => b.due - a.due || a.name.localeCompare(b.name));
  });

  totalOutstanding = computed(() => this.rows().reduce((s, r) => s + r.due, 0));

  open(id: string): void {
    this.router.navigate(['/customers', id]);
  }

  book(ev: Event, id: string): void {
    ev.stopPropagation();
    this.flow.startBooking(id);
  }

  addCustomer(): void {
    const c = this.store.addCustomer(this.newName.trim(), this.newMobile.trim());
    this.newName = '';
    this.newMobile = '';
    this.showAdd.set(false);
    this.toast.success('Customer added');
    this.router.navigate(['/customers', c.id]);
  }
}
