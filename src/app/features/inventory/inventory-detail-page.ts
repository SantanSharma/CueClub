import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProductCategory, StockMovementType } from '../../core/models/models';
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
  selector: 'app-inventory-detail-page',
  imports: [FormsModule, DatePipe, RouterLink, IconComponent, BadgeComponent, ModalComponent, EmptyStateComponent, TooltipDirective],
  template: `
    @if (product(); as p) {
      <div class="flex flex-col gap-5">
        <a routerLink="/inventory" class="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-muted transition hover:text-ink">
          <app-icon name="arrow-left" [size]="15" /> All inventory
        </a>

        <header class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2.5">
              <h1 class="text-2xl font-extrabold tracking-tight text-ink">{{ p.name }}</h1>
              <app-badge [status]="stockStatus(p.stock, p.minStock)" />
            </div>
            <p class="mt-0.5 text-[13px] text-muted">{{ p.category }} · updated {{ p.updatedAt | date: 'MMM d, h:mm a' }}</p>
          </div>
          @if (!editMode()) {
            <button type="button" class="btn btn-secondary" (click)="startEdit()"><app-icon name="edit" [size]="15" /> Edit details</button>
          }
        </header>

        @if (!editMode()) {
          <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
            <div class="card px-3.5 py-3">
              <p class="text-[11px] font-medium tracking-wide text-muted uppercase">In stock</p>
              <p class="mt-0.5 text-xl font-extrabold text-ink tabular-nums">{{ p.stock }} <span class="text-sm font-semibold text-muted">{{ p.unit }}</span></p>
            </div>
            <div class="card px-3.5 py-3">
              <p class="text-[11px] font-medium tracking-wide text-muted uppercase">Sells at</p>
              <p class="mt-0.5 text-xl font-extrabold text-ink tabular-nums">{{ formatCurrency(p.sellingPrice) }}</p>
            </div>
            <div class="card px-3.5 py-3">
              <p class="text-[11px] font-medium tracking-wide text-muted uppercase">Margin</p>
              <p class="mt-0.5 text-xl font-extrabold text-success tabular-nums">{{ formatCurrency(p.sellingPrice - p.costPrice) }}</p>
            </div>
            <div class="card px-3.5 py-3">
              <p class="flex items-center gap-1 text-[11px] font-medium tracking-wide text-muted uppercase">
                Stock value
                <span class="text-faint" [appTooltip]="'What this stock cost you — stock on hand × cost price'"><app-icon name="help" [size]="11" /></span>
              </p>
              <p class="mt-0.5 text-xl font-extrabold text-ink tabular-nums">{{ formatCurrency(p.stock * p.costPrice) }}</p>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <button type="button" class="btn btn-primary" (click)="openAdjust('add')"><app-icon name="plus" [size]="15" /> Add stock</button>
            <button type="button" class="btn btn-secondary" (click)="openAdjust('remove')"><app-icon name="minus" [size]="15" /> Remove stock</button>
            <button type="button" class="btn btn-ghost" (click)="openAdjust('adjust')"
              [appTooltip]="'Correct a counting mistake — enter a positive or negative number'">
              <app-icon name="edit" [size]="15" /> Correct count
            </button>
          </div>
        } @else {
          <div class="card card-pad flex flex-col gap-4">
            <div>
              <label class="field-label">Item name</label>
              <input class="input" type="text" [(ngModel)]="form.name" />
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <div>
                <label class="field-label">Category</label>
                <select class="input" [(ngModel)]="form.category">
                  @for (c of categories; track c) { <option [value]="c">{{ c }}</option> }
                </select>
              </div>
              <div>
                <label class="field-label">Unit</label>
                <input class="input" type="text" [(ngModel)]="form.unit" />
              </div>
            </div>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="field-label">Cost</label>
                <input class="input" type="number" inputmode="numeric" [(ngModel)]="form.costPrice" />
              </div>
              <div>
                <label class="field-label">Selling</label>
                <input class="input" type="number" inputmode="numeric" [(ngModel)]="form.sellingPrice" />
              </div>
              <div>
                <label class="field-label">Min stock</label>
                <input class="input" type="number" inputmode="numeric" [(ngModel)]="form.minStock" />
              </div>
            </div>
            <div class="flex justify-end gap-2 border-t border-line pt-4">
              <button type="button" class="btn btn-ghost" (click)="editMode.set(false)">Cancel</button>
              <button type="button" class="btn btn-primary" (click)="saveEdit(p.id)">Save changes</button>
            </div>
          </div>
        }

        <section class="flex flex-col gap-2.5">
          <h2 class="text-[13px] font-bold tracking-wide text-muted uppercase">Stock history</h2>
          @if (history().length) {
            <div class="card overflow-hidden">
              @for (m of history(); track m.id) {
                <div class="flex items-center gap-3 border-b border-line-soft px-4 py-3 last:border-0">
                  <span
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    [class]="m.qty < 0 ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'"
                  >
                    <app-icon [name]="m.qty < 0 ? 'minus' : 'plus'" [size]="15" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="text-[14px] font-medium text-ink capitalize">{{ m.type }}</p>
                    <p class="truncate text-xs text-muted">{{ m.note }} · {{ m.date | date: 'MMM d, h:mm a' }}</p>
                  </div>
                  <span class="text-[14px] font-bold tabular-nums" [class]="m.qty < 0 ? 'text-danger' : 'text-success'">
                    {{ m.qty > 0 ? '+' : '' }}{{ m.qty }}
                  </span>
                </div>
              }
            </div>
          } @else {
            <div class="card"><app-empty-state icon="layers" title="No movements yet" /></div>
          }
        </section>
      </div>

      @if (adjustMode()) {
        <app-modal [title]="adjustTitle()" (close)="adjustMode.set(null)">
          <div>
            <label class="field-label">{{ adjustMode() === 'adjust' ? 'Correction (+/-)' : 'Quantity' }}</label>
            <input class="input" type="number" inputmode="numeric" [attr.min]="adjustMode() === 'adjust' ? null : 1" [(ngModel)]="adjustQty" />
          </div>
          <div>
            <label class="field-label">Note</label>
            <input class="input" type="text" placeholder="Reason (optional)" [(ngModel)]="adjustNote" />
          </div>
          <div modal-footer>
            <button type="button" class="btn btn-ghost" (click)="adjustMode.set(null)">Cancel</button>
            <button
              type="button"
              class="btn btn-primary"
              [disabled]="adjustMode() === 'adjust' ? adjustQty === 0 : adjustQty <= 0"
              (click)="confirmAdjust(p.id)"
            >
              Confirm
            </button>
          </div>
        </app-modal>
      }
    } @else {
      <div class="card">
        <app-empty-state icon="box" title="Item not found">
          <a routerLink="/inventory" class="btn btn-secondary">Back to inventory</a>
        </app-empty-state>
      </div>
    }
  `,
  host: { class: 'block animate-fade-up' },
})
export class InventoryDetailPage {
  store = inject(DataStoreService);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  formatCurrency = formatCurrency;
  stockStatus = stockStatus;
  categories = CATEGORIES;

  id = this.route.snapshot.paramMap.get('id') ?? '';
  product = computed(() => this.store.productById(this.id));
  history = computed(() => this.store.productMovements(this.id));

  editMode = signal(false);
  form = { name: '', category: 'Drinks' as ProductCategory, costPrice: 0, sellingPrice: 0, minStock: 0, unit: 'piece' };

  adjustMode = signal<StockMovementType | null>(null);
  adjustQty = 1;
  adjustNote = '';

  adjustTitle = computed(() => {
    const mode = this.adjustMode();
    return mode === 'add' ? 'Add stock' : mode === 'remove' ? 'Remove stock' : 'Correct count';
  });

  startEdit(): void {
    const p = this.product();
    if (!p) return;
    this.form = { name: p.name, category: p.category, costPrice: p.costPrice, sellingPrice: p.sellingPrice, minStock: p.minStock, unit: p.unit };
    this.editMode.set(true);
  }

  saveEdit(id: string): void {
    this.store.updateProduct(id, {
      name: this.form.name.trim(),
      category: this.form.category,
      costPrice: Number(this.form.costPrice) || 0,
      sellingPrice: Number(this.form.sellingPrice) || 0,
      minStock: Number(this.form.minStock) || 0,
      unit: this.form.unit.trim() || 'piece',
    });
    this.editMode.set(false);
    this.toast.success('Item updated');
  }

  openAdjust(mode: StockMovementType): void {
    this.adjustQty = 1;
    this.adjustNote = '';
    this.adjustMode.set(mode);
  }

  confirmAdjust(id: string): void {
    const mode = this.adjustMode();
    if (!mode) return;
    const qty = Number(this.adjustQty) || 0;
    const delta = mode === 'remove' ? -Math.abs(qty) : mode === 'add' ? Math.abs(qty) : qty;
    const fallback = mode === 'add' ? 'Stock added' : mode === 'remove' ? 'Stock removed' : 'Manual correction';
    this.store.adjustStock(id, delta, mode, this.adjustNote.trim() || fallback);
    this.toast.success('Stock updated');
    this.adjustMode.set(null);
  }
}
