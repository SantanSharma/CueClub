import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DataStoreService } from '../../core/services/data-store.service';
import { IconComponent } from '../../shared/ui/icon/icon';
import { ModalComponent } from '../../shared/ui/modal/modal';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { TooltipDirective } from '../../shared/ui/tooltip/tooltip.directive';
import { formatCurrency } from '../../shared/util/format';

type Tab = 'tables' | 'pricing' | 'general';

@Component({
  selector: 'app-settings-page',
  imports: [FormsModule, RouterLink, IconComponent, ModalComponent, TooltipDirective],
  template: `
    <div class="flex flex-col gap-5">
      <header>
        <h1 class="text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">Settings</h1>
        <p class="mt-0.5 text-[13px] text-muted sm:text-sm">Set these up once — daily work happens in Operations.</p>
      </header>

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
        @case ('tables') {
          <section class="flex max-w-3xl flex-col gap-2.5">
            @for (t of store.tables(); track t.id) {
              <!-- Phones: 2-column grid (name + delete, then rate + maintenance).
                   sm and up keeps the original single-row layout. -->
              <div
                class="card grid grid-cols-[1fr_auto] items-end gap-x-3 gap-y-3 p-3.5 sm:flex sm:flex-row sm:items-center sm:gap-3 sm:p-5"
              >
                <div class="min-w-0 sm:flex-1">
                  <label class="field-label">Table name</label>
                  <input class="input" type="text" [ngModel]="t.name" (ngModelChange)="store.updateTable(t.id, { name: $event })" />
                </div>
                <button
                  type="button"
                  class="btn btn-ghost btn-icon text-faint hover:text-danger sm:order-last"
                  (click)="confirmRemove.set(t.id)"
                  aria-label="Remove table"
                >
                  <app-icon name="trash" [size]="16" />
                </button>
                <div class="min-w-0 sm:w-40">
                  <label class="field-label">Rate / hour</label>
                  <div class="relative">
                    <span class="absolute top-1/2 left-3 -translate-y-1/2 text-sm font-semibold text-muted">₹</span>
                    <input
                      class="input pl-7"
                      type="number"
                      inputmode="numeric"
                      [ngModel]="t.hourlyRate"
                      (ngModelChange)="store.updateTable(t.id, { hourlyRate: +$event })"
                    />
                  </div>
                </div>
                <div class="flex items-center gap-2 pb-2.5 sm:flex-col sm:items-start sm:pb-0">
                  <label class="flex cursor-pointer items-center gap-2 text-[13px] font-medium whitespace-nowrap text-ink-soft"
                    [appTooltip]="'A table under maintenance cannot be booked and shows as unavailable in Operations'">
                    <input
                      type="checkbox"
                      class="h-4 w-4 accent-[var(--color-primary)]"
                      [ngModel]="t.underMaintenance"
                      (ngModelChange)="store.updateTable(t.id, { underMaintenance: $event })"
                    />
                    Maintenance
                  </label>
                </div>
              </div>
            }
            <button type="button" class="btn btn-secondary w-fit" (click)="showAddTable.set(true)">
              <app-icon name="plus" [size]="16" /> Add table
            </button>
          </section>
        }

        @case ('pricing') {
          <section class="flex max-w-3xl flex-col gap-3">
            <p class="text-[13px] text-muted">
              Quick price edits. For stock levels and history open
              <a routerLink="/inventory" class="font-semibold text-primary hover:underline">Inventory</a>.
            </p>
            <div class="card overflow-hidden">
              @for (p of store.products(); track p.id) {
                <!-- Phones: name on its own line, prices side by side beneath.
                     sm:contents dissolves the grid wrapper so sm+ keeps the original row. -->
                <div class="flex flex-col gap-2 border-b border-line-soft px-4 py-3 last:border-0 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                  <div class="min-w-0 sm:flex-1">
                    <p class="truncate text-[14px] font-semibold text-ink">{{ p.name }}</p>
                    <p class="text-xs text-muted">{{ p.category }} · margin {{ formatCurrency(p.sellingPrice - p.costPrice) }}</p>
                  </div>
                  <div class="grid grid-cols-2 gap-2 sm:contents">
                    <div class="sm:w-24">
                      <label class="field-label">Cost</label>
                      <input class="input px-2 py-1.5 text-center" type="number" inputmode="numeric" [ngModel]="p.costPrice" (ngModelChange)="store.updateProduct(p.id, { costPrice: +$event })" />
                    </div>
                    <div class="sm:w-24">
                      <label class="field-label">Sells at</label>
                      <input class="input px-2 py-1.5 text-center font-semibold" type="number" inputmode="numeric" [ngModel]="p.sellingPrice" (ngModelChange)="store.updateProduct(p.id, { sellingPrice: +$event })" />
                    </div>
                  </div>
                </div>
              }
            </div>
          </section>
        }

        @case ('general') {
          <section class="flex max-w-lg flex-col gap-3">
            <div class="card card-pad flex flex-col gap-4">
              <div>
                <label class="field-label">Shop name</label>
                <input class="input" type="text" [ngModel]="store.config().shopName" (ngModelChange)="store.updateConfig({ shopName: $event })" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="field-label">Opens</label>
                  <input class="input" type="time" [ngModel]="store.config().openingTime" (ngModelChange)="store.updateConfig({ openingTime: $event })" />
                </div>
                <div>
                  <label class="field-label">Closes</label>
                  <input class="input" type="time" [ngModel]="store.config().closingTime" (ngModelChange)="store.updateConfig({ closingTime: $event })" />
                </div>
              </div>
              <p class="flex items-center gap-1.5 text-xs text-muted">
                <app-icon name="check" [size]="13" /> Changes save automatically to this device.
              </p>
            </div>

            <div class="card card-pad">
              <h3 class="text-[14px] font-bold text-ink">Demo data</h3>
              <p class="mt-1 mb-3 text-[13px] leading-relaxed text-muted">
                Replaces everything — bookings, customers, bills and stock — with the sample data this app ships with.
              </p>
              <button type="button" class="btn btn-danger btn-sm" (click)="confirmReset.set(true)">Reset demo data</button>
            </div>
          </section>
        }
      }
    </div>

    @if (showAddTable()) {
      <app-modal title="Add table" (close)="showAddTable.set(false)">
        <div>
          <label class="field-label">Table name</label>
          <input class="input" type="text" placeholder="e.g. Table 4" [(ngModel)]="newTableName" />
        </div>
        <div>
          <label class="field-label">Rate per hour</label>
          <input class="input" type="number" inputmode="numeric" [(ngModel)]="newTableRate" />
        </div>
        <div modal-footer>
          <button type="button" class="btn btn-ghost" (click)="showAddTable.set(false)">Cancel</button>
          <button type="button" class="btn btn-primary" [disabled]="!newTableName.trim()" (click)="addTable()">Add table</button>
        </div>
      </app-modal>
    }

    @if (confirmRemove()) {
      <app-modal title="Remove this table?" (close)="confirmRemove.set(null)">
        <p class="text-[13px] leading-relaxed text-ink-soft">
          Past bookings on this table stay in your records — only the table itself is removed from Operations and new bookings.
        </p>
        <div modal-footer>
          <button type="button" class="btn btn-ghost" (click)="confirmRemove.set(null)">Keep it</button>
          <button type="button" class="btn btn-danger" (click)="removeTable()">Remove table</button>
        </div>
      </app-modal>
    }

    @if (confirmReset()) {
      <app-modal title="Reset everything?" (close)="confirmReset.set(false)">
        <p class="text-[13px] leading-relaxed text-ink-soft">
          All current bookings, customers, bills and stock on this device will be replaced with sample data. This cannot be undone.
        </p>
        <div modal-footer>
          <button type="button" class="btn btn-ghost" (click)="confirmReset.set(false)">Cancel</button>
          <button type="button" class="btn btn-danger" (click)="resetDemo()">Yes, reset</button>
        </div>
      </app-modal>
    }
  `,
  host: { class: 'block animate-fade-up' },
})
export class SettingsPage {
  store = inject(DataStoreService);
  private toast = inject(ToastService);
  formatCurrency = formatCurrency;

  tabs: { id: Tab; label: string }[] = [
    { id: 'tables', label: 'Pool tables' },
    { id: 'pricing', label: 'Product pricing' },
    { id: 'general', label: 'Shop details' },
  ];
  tab = signal<Tab>('tables');

  showAddTable = signal(false);
  confirmRemove = signal<string | null>(null);
  confirmReset = signal(false);
  newTableName = '';
  newTableRate = 200;

  addTable(): void {
    this.store.addTable(this.newTableName.trim(), Number(this.newTableRate) || 0);
    this.toast.success('Table added');
    this.newTableName = '';
    this.newTableRate = 200;
    this.showAddTable.set(false);
  }

  removeTable(): void {
    const id = this.confirmRemove();
    if (!id) return;
    this.store.removeTable(id);
    this.confirmRemove.set(null);
    this.toast.success('Table removed');
  }

  resetDemo(): void {
    this.store.resetDemoData();
    this.confirmReset.set(false);
    this.toast.success('Demo data reset');
  }
}
