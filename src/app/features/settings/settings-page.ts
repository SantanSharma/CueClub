import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HandoverSession } from '../../core/models/models';
import { DataStoreService } from '../../core/services/data-store.service';
import { SecurityService } from '../../core/services/security.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { IconComponent } from '../../shared/ui/icon/icon';
import { ModalComponent } from '../../shared/ui/modal/modal';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { TooltipDirective } from '../../shared/ui/tooltip/tooltip.directive';
import { formatCurrency } from '../../shared/util/format';

type Tab = 'tables' | 'pricing' | 'shop' | 'access' | 'data';

@Component({
  selector: 'app-settings-page',
  imports: [FormsModule, DatePipe, RouterLink, IconComponent, ModalComponent, EmptyStateComponent, TooltipDirective],
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

        @case ('shop') {
          <section class="card card-pad flex max-w-lg flex-col gap-4">
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
          </section>
        }

        @case ('access') {
          <section class="flex max-w-2xl flex-col gap-3">
            <!-- Current mode -->
            <div class="card card-pad">
              <div class="flex flex-wrap items-center gap-2">
                <span class="pill" [class]="store.isHandover() ? 'bg-warn-soft text-warn' : 'bg-success-soft text-success'">
                  <span class="h-1.5 w-1.5 rounded-full" [class]="store.isHandover() ? 'bg-warn' : 'bg-success'"></span>
                  {{ store.isHandover() ? 'Handover mode' : 'Admin mode' }}
                </span>
                <span
                  class="text-faint"
                  [appTooltip]="'In Handover mode the shop runs normally, but every action is recorded against the person you handed over to.'"
                >
                  <app-icon name="help" [size]="14" />
                </span>
              </div>

              @if (store.activeHandover(); as session) {
                <p class="mt-2.5 text-[14px] text-ink">
                  <strong>{{ session.personName }}</strong> is running the shop since
                  {{ session.startedAt | date: 'MMM d, h:mm a' }}.
                </p>
                @if (session.note) {
                  <p class="text-[13px] text-muted">{{ session.note }}</p>
                }
                <p class="mt-1 text-[13px] text-muted">{{ store.auditForSession(session.id).length }} action(s) recorded so far.</p>
                <button type="button" class="btn btn-primary btn-sm mt-3" (click)="takeBack()">
                  <app-icon name="check-circle" [size]="15" /> Take back control
                </button>
              } @else {
                <p class="mt-2.5 text-[13px] leading-relaxed text-muted">
                  Hand the shop to someone else for a shift. They can book, sell and collect as normal — everything they do is
                  recorded so you can review it when you take control back.
                </p>
                <button type="button" class="btn btn-secondary btn-sm mt-3" (click)="openHandover()">
                  <app-icon name="users" [size]="15" /> Hand over the shop
                </button>
              }
            </div>

            <!-- Handover history -->
            <div class="card overflow-hidden">
              <div class="border-b border-line px-4 py-3">
                <h3 class="text-[13px] font-semibold text-ink">Handover history</h3>
              </div>
              @if (sessions().length) {
                @for (s of sessions(); track s.id) {
                  <button
                    type="button"
                    class="row-hover flex w-full items-center gap-3 border-b border-line-soft px-4 py-3 text-left last:border-0"
                    (click)="reviewSession.set(s)"
                  >
                    <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-alt text-muted">
                      <app-icon name="users" [size]="15" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-[14px] font-medium text-ink">{{ s.personName }}</span>
                      <span class="block text-xs text-muted">
                        {{ s.startedAt | date: 'MMM d, h:mm a' }} —
                        {{ s.endedAt ? (s.endedAt | date: 'h:mm a') : 'ongoing' }}
                      </span>
                    </span>
                    <span class="pill bg-surface-alt text-muted">{{ store.auditForSession(s.id).length }} actions</span>
                    <app-icon name="chevron-right" [size]="15" />
                  </button>
                }
              } @else {
                <app-empty-state icon="users" title="No handovers yet" description="Hand the shop over and the history shows up here." />
              }
            </div>

            <!-- Admin passkey -->
            <div class="card card-pad">
              <h3 class="text-[14px] font-bold text-ink">Admin passkey</h3>
              <p class="mt-1 text-[13px] leading-relaxed text-muted">
                Required to hand over the shop and to take control back. Only you can change it.
              </p>

              @if (security.hasPasskey()) {
                <div class="mt-3 flex flex-wrap gap-2">
                  <span class="pill bg-success-soft text-success"><app-icon name="check" [size]="12" /> Passkey set</span>
                  <button type="button" class="btn btn-secondary btn-sm" (click)="openPasskey('change')">Change passkey</button>
                  <button type="button" class="btn btn-ghost btn-sm" (click)="openPasskey('remove')">Remove</button>
                </div>
              } @else {
                <button type="button" class="btn btn-secondary btn-sm mt-3" (click)="openPasskey('create')">Create passkey</button>
              }

              <div class="mt-4 border-t border-line pt-4">
                <label class="flex cursor-pointer items-start gap-2.5" [class.opacity-50]="!security.hasPasskey()">
                  <input
                    type="checkbox"
                    class="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
                    [disabled]="!security.hasPasskey()"
                    [ngModel]="security.safetyMode()"
                    (ngModelChange)="toggleSafety($event)"
                  />
                  <span>
                    <span class="block text-[14px] font-semibold text-ink">Safety Mode</span>
                    <span class="block text-[13px] text-muted">
                      Ask for the admin passkey before editing or deleting anything — bookings, bills, customers and stock.
                      @if (!security.hasPasskey()) { <span class="text-warn">Create a passkey first.</span> }
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </section>
        }

        @case ('data') {
          <section class="flex max-w-lg flex-col gap-3">
            <div class="card card-pad">
              <h3 class="text-[14px] font-bold text-ink">Start fresh</h3>
              <p class="mt-1 mb-3 text-[13px] leading-relaxed text-muted">
                Clears every booking, sale, customer and stock item so you can begin with your own data. Your passkey and
                Safety Mode setting are kept.
              </p>
              <button type="button" class="btn btn-danger btn-sm" (click)="confirmClear.set(true)">
                <app-icon name="trash" [size]="15" /> Reset to an empty app
              </button>
            </div>

            <div class="card card-pad">
              <h3 class="text-[14px] font-bold text-ink">Sample data</h3>
              <p class="mt-1 mb-3 text-[13px] leading-relaxed text-muted">
                Replaces everything with the demo tables, customers, bookings and stock this app ships with — handy for trying
                things out.
              </p>
              <button type="button" class="btn btn-secondary btn-sm" (click)="confirmReset.set(true)">
                <app-icon name="layers" [size]="15" /> Restore sample data
              </button>
            </div>

            <div class="card card-pad">
              <h3 class="text-[14px] font-bold text-ink">Recent activity</h3>
              <p class="mt-1 text-[13px] text-muted">The last actions recorded in this app, newest first.</p>
              <div class="mt-3 flex flex-col gap-1.5">
                @for (entry of store.recentAudit(12); track entry.id) {
                  <div class="flex items-start gap-2 border-b border-line-soft pb-1.5 text-[13px] last:border-0">
                    <span class="min-w-0 flex-1 truncate text-ink">{{ entry.summary }}</span>
                    <span class="shrink-0 text-xs text-muted">{{ entry.actor }} · {{ entry.at | date: 'MMM d, h:mm a' }}</span>
                  </div>
                } @empty {
                  <p class="text-[13px] text-muted">Nothing recorded yet.</p>
                }
              </div>
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
          Past bookings on this table stay in your records — the table is only hidden from Operations and new bookings.
        </p>
        <div modal-footer>
          <button type="button" class="btn btn-ghost" (click)="confirmRemove.set(null)">Keep it</button>
          <button type="button" class="btn btn-danger" (click)="removeTable()">Remove table</button>
        </div>
      </app-modal>
    }

    @if (confirmReset()) {
      <app-modal title="Restore sample data?" (close)="confirmReset.set(false)">
        <p class="text-[13px] leading-relaxed text-ink-soft">
          All current bookings, customers, bills and stock on this device will be replaced with the demo dataset. This cannot
          be undone.
        </p>
        <div modal-footer>
          <button type="button" class="btn btn-ghost" (click)="confirmReset.set(false)">Cancel</button>
          <button type="button" class="btn btn-danger" (click)="resetDemo()">Yes, restore</button>
        </div>
      </app-modal>
    }

    @if (confirmClear()) {
      <app-modal title="Reset to an empty app?" (close)="confirmClear.set(false)">
        <p class="text-[13px] leading-relaxed text-ink-soft">
          This removes <strong>everything</strong> — tables, customers, bookings, bills, stock and history — leaving a clean
          app to set up from scratch. This cannot be undone.
        </p>
        <div>
          <label class="field-label">Type ERASE to confirm</label>
          <input class="input" type="text" placeholder="ERASE" [(ngModel)]="eraseConfirmation" />
        </div>
        <div modal-footer>
          <button type="button" class="btn btn-ghost" (click)="confirmClear.set(false)">Cancel</button>
          <button type="button" class="btn btn-danger" [disabled]="eraseConfirmation.trim().toUpperCase() !== 'ERASE'" (click)="clearAll()">
            Erase everything
          </button>
        </div>
      </app-modal>
    }

    @if (showHandover()) {
      <app-modal title="Hand over the shop" (close)="showHandover.set(false)">
        <p class="text-[13px] leading-relaxed text-ink-soft">
          Who is taking over? Everything they do will be recorded against their name until you take control back.
        </p>
        <div>
          <label class="field-label">Person's name</label>
          <input class="input" type="text" placeholder="e.g. Ravi (evening shift)" [(ngModel)]="handoverName" />
        </div>
        <div>
          <label class="field-label">Note <span class="text-faint normal-case">· optional</span></label>
          <input class="input" type="text" placeholder="e.g. Covering till 11pm" [(ngModel)]="handoverNote" />
        </div>
        <div modal-footer>
          <button type="button" class="btn btn-ghost" (click)="showHandover.set(false)">Cancel</button>
          <button type="button" class="btn btn-primary" [disabled]="!handoverName.trim()" (click)="startHandover()">
            Hand over
          </button>
        </div>
      </app-modal>
    }

    @if (passkeyMode(); as mode) {
      <app-modal
        [title]="mode === 'create' ? 'Create admin passkey' : mode === 'change' ? 'Change admin passkey' : 'Remove admin passkey'"
        (close)="closePasskey()"
      >
        @if (mode !== 'create') {
          <div>
            <label class="field-label">Current passkey</label>
            <input class="input" type="password" autocomplete="current-password" [(ngModel)]="currentPasskey" />
          </div>
        }
        @if (mode !== 'remove') {
          <div>
            <label class="field-label">{{ mode === 'create' ? 'Passkey' : 'New passkey' }}</label>
            <input class="input" type="password" autocomplete="new-password" placeholder="At least 4 characters" [(ngModel)]="newPasskey" />
          </div>
        }
        @if (passkeyError()) {
          <p class="flex items-center gap-1.5 text-xs font-medium text-danger">
            <app-icon name="alert" [size]="13" /> {{ passkeyError() }}
          </p>
        }
        <p class="text-xs leading-relaxed text-muted">
          Stored as a one-way hash on this device. It keeps others out of admin actions, but anyone with access to the device
          itself can still clear the app's data.
        </p>
        <div modal-footer>
          <button type="button" class="btn btn-ghost" (click)="closePasskey()">Cancel</button>
          <button type="button" class="btn btn-primary" (click)="savePasskey()">
            {{ mode === 'remove' ? 'Remove passkey' : 'Save passkey' }}
          </button>
        </div>
      </app-modal>
    }

    @if (reviewSession(); as session) {
      <app-modal [title]="'Shift · ' + session.personName" size="md" (close)="reviewSession.set(null)">
        <p class="text-[13px] text-muted">
          {{ session.startedAt | date: 'MMM d, h:mm a' }} — {{ session.endedAt ? (session.endedAt | date: 'MMM d, h:mm a') : 'ongoing' }}
        </p>
        <div class="flex max-h-80 flex-col gap-2 overflow-y-auto">
          @for (entry of store.auditForSession(session.id); track entry.id) {
            <div class="flex items-start gap-2.5 border-b border-line-soft pb-2 last:border-0">
              <span class="pill mt-0.5 shrink-0 bg-surface-alt text-muted">{{ entry.action }}</span>
              <span class="min-w-0 flex-1">
                <span class="block text-[13px] text-ink">{{ entry.summary }}</span>
                <span class="block text-xs text-muted">{{ entry.at | date: 'MMM d, h:mm a' }}</span>
              </span>
            </div>
          } @empty {
            <app-empty-state icon="layers" title="No actions recorded" description="Nothing was changed during this shift." />
          }
        </div>
        <div modal-footer>
          <button type="button" class="btn btn-secondary" (click)="reviewSession.set(null)">Close</button>
        </div>
      </app-modal>
    }
  `,
  host: { class: 'block animate-fade-up' },
})
export class SettingsPage {
  store = inject(DataStoreService);
  security = inject(SecurityService);
  private toast = inject(ToastService);
  formatCurrency = formatCurrency;

  tabs: { id: Tab; label: string }[] = [
    { id: 'tables', label: 'Pool tables' },
    { id: 'pricing', label: 'Product pricing' },
    { id: 'shop', label: 'Shop details' },
    { id: 'access', label: 'Access & handover' },
    { id: 'data', label: 'Data' },
  ];
  tab = signal<Tab>('tables');

  showAddTable = signal(false);
  confirmRemove = signal<string | null>(null);
  confirmReset = signal(false);
  confirmClear = signal(false);
  newTableName = '';
  newTableRate = 200;
  eraseConfirmation = '';

  showHandover = signal(false);
  handoverName = '';
  handoverNote = '';
  reviewSession = signal<HandoverSession | null>(null);

  passkeyMode = signal<'create' | 'change' | 'remove' | null>(null);
  currentPasskey = '';
  newPasskey = '';
  passkeyError = signal('');

  sessions = computed(() => [...this.store.handovers()].sort((a, b) => b.startedAt.localeCompare(a.startedAt)));

  // ---------- tables ----------
  addTable(): void {
    this.store.addTable(this.newTableName.trim(), Number(this.newTableRate) || 0);
    this.toast.success('Table added');
    this.newTableName = '';
    this.newTableRate = 200;
    this.showAddTable.set(false);
  }

  async removeTable(): Promise<void> {
    const id = this.confirmRemove();
    if (!id) return;
    this.confirmRemove.set(null);
    if (!(await this.security.guard('remove this table'))) return;
    this.store.removeTable(id);
    this.toast.success('Table removed');
  }

  // ---------- data ----------
  async resetDemo(): Promise<void> {
    this.confirmReset.set(false);
    if (!(await this.security.requireAdmin('Admin passkey required', 'Restoring the sample data replaces everything in this app.', 'Restore'))) return;
    this.store.resetDemoData();
    this.toast.success('Sample data restored');
  }

  async clearAll(): Promise<void> {
    this.confirmClear.set(false);
    this.eraseConfirmation = '';
    if (!(await this.security.requireAdmin('Admin passkey required', 'Erasing all data cannot be undone.', 'Erase'))) return;
    this.store.clearAllData();
    this.toast.success('App reset — start by adding your tables');
    this.tab.set('tables');
  }

  // ---------- handover ----------
  openHandover(): void {
    this.handoverName = '';
    this.handoverNote = '';
    this.showHandover.set(true);
  }

  async startHandover(): Promise<void> {
    const name = this.handoverName.trim();
    if (!name) return;
    this.showHandover.set(false);
    const ok = await this.security.requireAdmin(
      'Confirm handover',
      `Enter the admin passkey to hand the shop over to ${name}.`,
      'Hand over',
    );
    if (!ok) return;
    this.store.startHandover(name, this.handoverNote);
    this.toast.success(`Handed over to ${name}`);
  }

  async takeBack(): Promise<void> {
    const session = this.store.activeHandover();
    const ok = await this.security.requireAdmin(
      'Take back control',
      'Enter the admin passkey to return the app to Admin mode.',
      'Take control',
    );
    if (!ok) return;
    this.store.endHandover();
    this.toast.success('You are back in Admin mode');
    if (session) this.reviewSession.set({ ...session, endedAt: new Date().toISOString() });
  }

  // ---------- passkey ----------
  openPasskey(mode: 'create' | 'change' | 'remove'): void {
    this.currentPasskey = '';
    this.newPasskey = '';
    this.passkeyError.set('');
    this.passkeyMode.set(mode);
  }

  closePasskey(): void {
    this.passkeyMode.set(null);
    this.currentPasskey = '';
    this.newPasskey = '';
    this.passkeyError.set('');
  }

  async savePasskey(): Promise<void> {
    const mode = this.passkeyMode();
    if (!mode) return;

    if (mode === 'remove') {
      const ok = await this.security.clearPasskey(this.currentPasskey);
      if (!ok) {
        this.passkeyError.set('That passkey is not correct.');
        return;
      }
      this.closePasskey();
      this.toast.success('Passkey removed');
      return;
    }

    if (this.newPasskey.trim().length < 4) {
      this.passkeyError.set('Use at least 4 characters.');
      return;
    }

    if (mode === 'create') {
      await this.security.setPasskey(this.newPasskey.trim());
    } else {
      const ok = await this.security.changePasskey(this.currentPasskey, this.newPasskey.trim());
      if (!ok) {
        this.passkeyError.set('That passkey is not correct.');
        return;
      }
    }
    this.closePasskey();
    this.toast.success('Passkey saved');
  }

  async toggleSafety(enabled: boolean): Promise<void> {
    // Turning protection off is itself an admin action.
    if (!enabled && !(await this.security.requireAdmin('Turn off Safety Mode', 'Enter the admin passkey to stop asking for it before edits and deletions.', 'Turn off'))) {
      return;
    }
    this.security.setSafetyMode(enabled);
    this.toast.success(enabled ? 'Safety Mode on' : 'Safety Mode off');
  }
}
