import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductCategory } from '../../core/models/models';
import { DataStoreService } from '../../core/services/data-store.service';
import { BadgeComponent } from '../../shared/ui/badge/badge';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { IconComponent } from '../../shared/ui/icon/icon';
import { ModalComponent } from '../../shared/ui/modal/modal';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { TooltipDirective } from '../../shared/ui/tooltip/tooltip.directive';
import { formatCurrency, stockStatus } from '../../shared/util/format';

const CATEGORIES: ProductCategory[] = ['Drinks', 'Cigarettes', 'Snacks', 'Food', 'Other'];

@Component({
  selector: 'app-inventory-list-page',
  imports: [FormsModule, IconComponent, BadgeComponent, ModalComponent, EmptyStateComponent, TooltipDirective],
  template: `
    <div class="flex flex-col gap-5">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">Inventory</h1>
          <p class="mt-0.5 text-[13px] text-muted sm:text-sm">
            {{ store.products().length }} items · stock updates automatically as you sell
          </p>
        </div>
        <button type="button" class="btn btn-primary" (click)="showAdd.set(true)">
          <app-icon name="plus" [size]="16" /> Add item
        </button>
      </header>

      @if (alerts().length) {
        <div class="flex animate-fade-up items-start gap-3 rounded-[var(--radius-card)] border border-warn/30 bg-warn-soft/60 px-4 py-3">
          <span class="mt-0.5 text-warn"><app-icon name="alert" [size]="17" /></span>
          <div class="min-w-0 flex-1">
            <p class="text-[13px] font-semibold text-ink">{{ alerts().length }} item(s) need restocking</p>
            <p class="truncate text-[12px] text-ink-soft">{{ alertNames() }}</p>
          </div>
        </div>
      }

      <div class="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div class="relative flex-1">
          <span class="absolute top-1/2 left-3 -translate-y-1/2 text-faint"><app-icon name="search" [size]="16" /></span>
          <input class="input pl-9" type="text" placeholder="Search items" [ngModel]="search()" (ngModelChange)="search.set($event)" />
        </div>
        <div class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <button type="button" class="chip shrink-0" [class.chip-active]="category() === ''" (click)="category.set('')">All</button>
          @for (c of categories; track c) {
            <button type="button" class="chip shrink-0" [class.chip-active]="category() === c" (click)="category.set(c)">{{ c }}</button>
          }
        </div>
      </div>

      @if (rows().length) {
        <!-- Desktop -->
        <div class="card hidden overflow-hidden lg:block">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-line bg-canvas text-left">
                <th class="px-4 py-2.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Item</th>
                <th class="px-4 py-2.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Category</th>
                <th class="px-4 py-2.5 text-right text-[11px] font-semibold tracking-wide text-muted uppercase">Cost</th>
                <th class="px-4 py-2.5 text-right text-[11px] font-semibold tracking-wide text-muted uppercase">Sells at</th>
                <th class="px-4 py-2.5 text-right text-[11px] font-semibold tracking-wide text-muted uppercase">Margin</th>
                <th class="px-4 py-2.5 text-right text-[11px] font-semibold tracking-wide text-muted uppercase">Stock</th>
                <th class="px-4 py-2.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Status</th>
                <th class="w-10"></th>
              </tr>
            </thead>
            <tbody class="stagger">
              @for (r of rows(); track r.id) {
                <tr class="row-hover cursor-pointer border-b border-line-soft last:border-0" (click)="open(r.id)">
                  <td class="px-4 py-3 font-semibold text-ink">{{ r.name }}</td>
                  <td class="px-4 py-3 text-ink-soft">{{ r.category }}</td>
                  <td class="px-4 py-3 text-right tabular-nums">{{ formatCurrency(r.costPrice) }}</td>
                  <td class="px-4 py-3 text-right font-semibold tabular-nums">{{ formatCurrency(r.sellingPrice) }}</td>
                  <td class="px-4 py-3 text-right font-medium text-success tabular-nums">{{ formatCurrency(r.sellingPrice - r.costPrice) }}</td>
                  <td class="px-4 py-3 text-right tabular-nums">{{ r.stock }} {{ r.unit }}</td>
                  <td class="px-4 py-3"><app-badge [status]="r.status" /></td>
                  <td class="pr-3 text-faint"><app-icon name="chevron-right" [size]="16" /></td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Mobile -->
        <div class="stagger flex flex-col gap-2.5 lg:hidden">
          @for (r of rows(); track r.id) {
            <button type="button" class="card card-pad text-left transition active:scale-[0.99]" (click)="open(r.id)">
              <div class="flex items-start gap-3">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-[15px] font-bold text-ink">{{ r.name }}</p>
                  <p class="text-xs text-muted">{{ r.category }} · {{ formatCurrency(r.costPrice) }} cost</p>
                </div>
                <div class="text-right">
                  <p class="text-[15px] font-extrabold text-ink tabular-nums">{{ formatCurrency(r.sellingPrice) }}</p>
                  <p class="text-xs text-muted tabular-nums">{{ r.stock }} {{ r.unit }} left</p>
                </div>
              </div>
              <div class="mt-2"><app-badge [status]="r.status" /></div>
            </button>
          }
        </div>
      } @else {
        <div class="card">
          <app-empty-state icon="box" title="No items match" description="Add drinks, cigarettes, snacks or food to sell them against any bill.">
            <button type="button" class="btn btn-primary" (click)="showAdd.set(true)"><app-icon name="plus" [size]="16" /> Add item</button>
          </app-empty-state>
        </div>
      }
    </div>

    @if (showAdd()) {
      <app-modal title="Add inventory item" size="md" (close)="showAdd.set(false)">
        <div>
          <label class="field-label">Item name</label>
          <input class="input" type="text" placeholder="e.g. Cold Drink" [(ngModel)]="form.name" />
        </div>
        <div>
          <label class="field-label">Category</label>
          <select class="input" [(ngModel)]="form.category">
            @for (c of categories; track c) { <option [value]="c">{{ c }}</option> }
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="field-label">Cost price</label>
            <input class="input" type="number" inputmode="numeric" [(ngModel)]="form.costPrice" />
          </div>
          <div>
            <label class="field-label">Selling price</label>
            <input class="input" type="number" inputmode="numeric" [(ngModel)]="form.sellingPrice" />
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="field-label">Stock</label>
            <input class="input" type="number" inputmode="numeric" [(ngModel)]="form.stock" />
          </div>
          <div>
            <label class="field-label">
              Min
              <span class="text-faint" [appTooltip]="'You get a low-stock warning once stock drops to this number'">
                <app-icon name="help" [size]="11" />
              </span>
            </label>
            <input class="input" type="number" inputmode="numeric" [(ngModel)]="form.minStock" />
          </div>
          <div>
            <label class="field-label">Unit</label>
            <input class="input" type="text" placeholder="bottle" [(ngModel)]="form.unit" />
          </div>
        </div>
        <div modal-footer>
          <button type="button" class="btn btn-ghost" (click)="showAdd.set(false)">Cancel</button>
          <button type="button" class="btn btn-primary" [disabled]="!form.name.trim()" (click)="save()">Save item</button>
        </div>
      </app-modal>
    }
  `,
  host: { class: 'block animate-fade-up' },
})
export class InventoryListPage {
  store = inject(DataStoreService);
  private router = inject(Router);
  private toast = inject(ToastService);
  formatCurrency = formatCurrency;
  categories = CATEGORIES;

  search = signal('');
  category = signal<string>('');
  showAdd = signal(false);
  form = { name: '', category: 'Drinks' as ProductCategory, costPrice: 0, sellingPrice: 0, stock: 0, minStock: 5, unit: 'piece' };

  rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.store
      .products()
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .filter((p) => !this.category() || p.category === this.category())
      .map((p) => ({ ...p, status: stockStatus(p.stock, p.minStock) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  alerts = computed(() => [...this.store.outOfStockProducts(), ...this.store.lowStockProducts()]);
  alertNames = computed(() => this.alerts().map((p) => `${p.name} (${p.stock})`).join(', '));

  open(id: string): void {
    this.router.navigate(['/inventory', id]);
  }

  save(): void {
    const p = this.store.addProduct({
      name: this.form.name.trim(),
      category: this.form.category,
      costPrice: Number(this.form.costPrice) || 0,
      sellingPrice: Number(this.form.sellingPrice) || 0,
      stock: Number(this.form.stock) || 0,
      minStock: Number(this.form.minStock) || 0,
      unit: this.form.unit.trim() || 'piece',
    });
    this.form = { name: '', category: 'Drinks', costPrice: 0, sellingPrice: 0, stock: 0, minStock: 5, unit: 'piece' };
    this.showAdd.set(false);
    this.toast.success('Item added');
    this.router.navigate(['/inventory', p.id]);
  }
}
