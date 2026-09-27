import { Injectable, computed, inject, signal } from '@angular/core';
import { formatTime12 } from '../../shared/util/format';
import { StorageService, uid } from './storage.service';
import { buildEmptyData, buildSeedData, defaultConfig } from './seed';
import {
  ADMIN_ACTOR,
  AppConfig,
  AppData,
  AuditAction,
  AuditEntry,
  Bill,
  BillLineItem,
  Booking,
  BookingStatus,
  Customer,
  DeletableCollection,
  DeletionBatch,
  DeletionEntry,
  Expense,
  HandoverSession,
  Payment,
  PoolTable,
  Product,
  SCHEMA_VERSION,
  SoftDeletable,
  SplitMode,
  StockMovement,
  TableStatus,
} from '../models/models';

const DATA_KEY = 'data';
const AUDIT_LIMIT = 500;

function nowIso(): string {
  return new Date().toISOString();
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** Minutes-into-the-day for a session stamp, but only if it lands on `date`. */
function sessionMinutesOn(iso: string | null, date: string): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  const onDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (onDate !== date) return null;
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * How long a booking really ties up its table.
 *
 * The booked window is only the plan. Once play actually happens the session
 * decides: a session that finished early frees the table there and then, and a
 * session that started early occupies it from then. A session still running
 * holds the table for its booked window — a later booking is still allowed to
 * exist, it simply starts late when the table frees up.
 */
function occupancyWindow(b: Booking): { start: number; end: number } {
  const bookedStart = timeToMinutes(b.startTime);
  const bookedEnd = timeToMinutes(b.endTime);
  const startedAt = sessionMinutesOn(b.sessionStartedAt, b.date);
  const endedAt = sessionMinutesOn(b.sessionEndedAt, b.date);

  const start = startedAt !== null ? Math.min(bookedStart, startedAt) : bookedStart;
  const end = endedAt !== null ? Math.max(start, endedAt) : bookedEnd;
  return { start, end };
}

function billStatusFor(total: number, paid: number): 'unpaid' | 'partial' | 'paid' {
  if (total <= 0) return 'paid';
  if (paid <= 0) return 'unpaid';
  if (paid >= total) return 'paid';
  return 'partial';
}

const isActive = <T extends SoftDeletable>(row: T): boolean => row.isDel === 0;

/** What the store writes to the audit trail for one mutation. */
interface AuditInput {
  action: AuditAction;
  entity: string;
  entityId: string;
  summary: string;
}

/**
 * Splits an amount across customers so the parts always add back up to the
 * total — the remainder from uneven division lands on the first payer.
 */
export function allocateShares(
  total: number,
  customerIds: string[],
  mode: SplitMode,
  manual: Record<string, number> = {},
  payerId?: string,
): Record<string, number> {
  const shares: Record<string, number> = {};
  if (customerIds.length === 0) return shares;

  if (mode === 'single') {
    const payer = payerId && customerIds.includes(payerId) ? payerId : customerIds[0];
    for (const id of customerIds) shares[id] = id === payer ? total : 0;
    return shares;
  }

  if (mode === 'manual') {
    let assigned = 0;
    for (const id of customerIds) {
      const value = Math.max(0, Math.round(manual[id] ?? 0));
      shares[id] = value;
      assigned += value;
    }
    // Keep the books balanced even if the caller passed rounded values.
    const drift = total - assigned;
    if (drift !== 0) shares[customerIds[0]] = Math.max(0, shares[customerIds[0]] + drift);
    return shares;
  }

  const base = Math.floor(total / customerIds.length);
  for (const id of customerIds) shares[id] = base;
  shares[customerIds[0]] += total - base * customerIds.length;
  return shares;
}

@Injectable({ providedIn: 'root' })
export class DataStoreService {
  private storage = inject(StorageService);
  private readonly data = signal<AppData>(this.load());

  // Soft-deleted rows are filtered once, here, so every screen and report
  // inherits the behaviour without repeating the check.
  readonly tables = computed(() => this.data().tables.filter(isActive));
  readonly customers = computed(() => this.data().customers.filter(isActive));
  readonly bookings = computed(() => this.data().bookings.filter(isActive));
  readonly products = computed(() => this.data().products.filter(isActive));
  readonly stockMovements = computed(() => this.data().stockMovements.filter(isActive));
  readonly bills = computed(() => this.data().bills.filter(isActive));
  readonly payments = computed(() => this.data().payments.filter(isActive));
  readonly expenses = computed(() => this.data().expenses.filter(isActive));
  readonly config = computed(() => this.data().config);
  readonly handovers = computed(() => this.data().handovers);
  readonly auditLog = computed(() => this.data().auditLog);

  readonly isHandover = computed(() => this.config().mode === 'handover');
  readonly activeHandover = computed(() => {
    const id = this.config().activeHandoverId;
    return id ? this.handovers().find((h) => h.id === id) : undefined;
  });
  readonly currentActor = computed(() => this.activeHandover()?.personName ?? ADMIN_ACTOR);
  readonly hasPasskey = computed(() => !!this.config().passkeyHash);

  readonly today = computed(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  readonly todaysBookings = computed(() =>
    this.bookings()
      .filter((b) => b.date === this.today())
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)),
  );

  readonly todaysBills = computed(() => {
    const t = this.today();
    return this.bills().filter((b) => b.createdAt.slice(0, 10) === t);
  });

  readonly todaysExpenses = computed(() => this.expenses().filter((e) => e.date === this.today()));

  readonly todaysRevenue = computed(() => this.todaysBills().reduce((s, b) => s + b.total, 0));
  readonly todaysPoolRevenue = computed(() =>
    this.todaysBills().reduce(
      (s, b) => s + b.items.filter((i) => i.type === 'booking').reduce((x, i) => x + i.amount, 0),
      0,
    ),
  );
  readonly todaysProductRevenue = computed(() =>
    this.todaysBills().reduce(
      (s, b) => s + b.items.filter((i) => i.type === 'product').reduce((x, i) => x + i.amount, 0),
      0,
    ),
  );
  readonly todaysExpenseTotal = computed(() => this.todaysExpenses().reduce((s, e) => s + e.amount, 0));

  readonly outstandingTotal = computed(() =>
    this.bills().reduce((s, b) => s + Math.max(0, b.total - b.paidAmount), 0),
  );

  readonly activeBookingsCount = computed(
    () => this.todaysBookings().filter((b) => b.status === 'ongoing').length,
  );

  readonly availableTablesCount = computed(
    () => this.tables().filter((t) => this.tableStatus(t.id) === 'available').length,
  );

  readonly lowStockProducts = computed(() =>
    this.products().filter((p) => p.stock > 0 && p.stock <= p.minStock),
  );
  readonly outOfStockProducts = computed(() => this.products().filter((p) => p.stock <= 0));

  // ---------- persistence ----------
  private load(): AppData {
    const existing = this.storage.get<AppData>(DATA_KEY);
    if (existing && existing.tables && existing.config) {
      const migrated = migrate(existing);
      this.storage.set(DATA_KEY, migrated);
      return migrated;
    }
    const seeded = buildSeedData();
    this.storage.set(DATA_KEY, seeded);
    return seeded;
  }

  private commit(mutator: (d: AppData) => void, audit?: AuditInput | null): void {
    const draft = structuredClone(this.data());
    mutator(draft);

    if (audit) {
      draft.auditLog ??= [];
      const session = draft.config.activeHandoverId;
      const actor = session ? (draft.handovers.find((h) => h.id === session)?.personName ?? ADMIN_ACTOR) : ADMIN_ACTOR;
      draft.auditLog.push({
        id: uid(),
        at: nowIso(),
        actor,
        actorRole: draft.config.mode,
        sessionId: session,
        ...audit,
      });
      if (draft.auditLog.length > AUDIT_LIMIT) {
        draft.auditLog = draft.auditLog.slice(-AUDIT_LIMIT);
      }
    }

    this.data.set(draft);
    this.storage.set(DATA_KEY, draft);
  }

  private replaceAll(next: AppData): void {
    this.data.set(next);
    this.storage.set(DATA_KEY, next);
  }

  /** Restore the bundled demo dataset. */
  resetDemoData(): void {
    this.replaceAll(buildSeedData());
  }

  /** Wipe everything and start from an empty shop. */
  clearAllData(): void {
    const empty = buildEmptyData();
    empty.config = { ...empty.config, ...this.securityConfigSlice() };
    this.replaceAll(empty);
  }

  /** Security settings survive a data reset — the admin keeps their passkey. */
  private securityConfigSlice(): Partial<AppConfig> {
    const c = this.config();
    return { passkeyHash: c.passkeyHash, passkeySalt: c.passkeySalt, safetyMode: c.safetyMode };
  }

  private markDeleted<T extends SoftDeletable & { id: string }>(list: T[], id: string): T | undefined {
    const row = list.find((x) => x.id === id);
    if (row) row.isDel = 1;
    return row;
  }

  // ---------- deletion batches ----------
  readonly deletions = computed(() => [...this.data().deletions].sort((a, b) => b.at.localeCompare(a.at)));
  readonly restorableDeletions = computed(() => this.deletions().filter((b) => !b.restoredAt));

  /**
   * Flips the given rows to deleted and files a receipt so the action can be
   * undone later. Only rows that are currently active are recorded, so undo
   * never resurrects something a previous delete had already taken out.
   */
  private deleteBatch(
    d: AppData,
    kind: DeletionBatch['kind'],
    label: string,
    picks: { collection: DeletableCollection; ids: string[] }[],
    stockRestored: { productId: string; qty: number }[] = [],
  ): DeletionBatch {
    const entries: DeletionEntry[] = [];
    d.deletions ??= [];

    for (const pick of picks) {
      const list = d[pick.collection] as unknown as (SoftDeletable & { id: string })[];
      for (const id of pick.ids) {
        const row = list.find((x) => x.id === id);
        if (!row || row.isDel === 1) continue;
        row.isDel = 1;
        entries.push({ collection: pick.collection, id });
      }
    }

    // Items that were never really consumed go back on the shelf.
    for (const { productId, qty } of stockRestored) {
      const product = d.products.find((p) => p.id === productId);
      if (!product || qty <= 0) continue;
      product.stock += qty;
      product.updatedAt = nowIso();
      d.stockMovements.push({
        id: uid(),
        productId,
        type: 'adjust',
        qty,
        note: 'Returned — booking removed',
        date: nowIso(),
        isDel: 0,
      });
    }

    const counts = new Map<DeletableCollection, number>();
    for (const e of entries) counts.set(e.collection, (counts.get(e.collection) ?? 0) + 1);
    const summary =
      [...counts.entries()].map(([c, n]) => `${n} ${n === 1 ? c.replace(/s$/, '') : c}`).join(' · ') || 'nothing';

    const batch: DeletionBatch = {
      id: uid(),
      at: nowIso(),
      actor: d.config.activeHandoverId
        ? (d.handovers.find((h) => h.id === d.config.activeHandoverId)?.personName ?? ADMIN_ACTOR)
        : ADMIN_ACTOR,
      kind,
      label,
      summary,
      entries,
      stockRestored,
      restoredAt: null,
    };
    d.deletions.push(batch);
    if (d.deletions.length > 50) d.deletions = d.deletions.slice(-50);
    return batch;
  }

  /** Puts back exactly what one delete action took out. */
  restoreDeletion(batchId: string): void {
    const batch = this.deletions().find((b) => b.id === batchId);
    this.commit(
      (d) => {
        const target = d.deletions.find((b) => b.id === batchId);
        if (!target || target.restoredAt) return;

        for (const entry of target.entries) {
          const list = d[entry.collection] as unknown as (SoftDeletable & { id: string })[];
          const row = list.find((x) => x.id === entry.id);
          if (row) row.isDel = 0;
        }

        // Someone taken off a booking goes back onto it, not just their bill.
        if (target.detachedFrom) {
          const booking = d.bookings.find((b) => b.id === target.detachedFrom!.bookingId);
          if (booking && !booking.customerIds.includes(target.detachedFrom.customerId)) {
            booking.customerIds.push(target.detachedFrom.customerId);
          }
        }

        // Stock handed back on delete is taken out again.
        for (const { productId, qty } of target.stockRestored) {
          const product = d.products.find((p) => p.id === productId);
          if (!product || qty <= 0) continue;
          product.stock -= qty;
          product.updatedAt = nowIso();
          d.stockMovements.push({
            id: uid(),
            productId,
            type: 'adjust',
            qty: -qty,
            note: 'Taken again — booking restored',
            date: nowIso(),
            isDel: 0,
          });
        }

        target.restoredAt = nowIso();
      },
      { action: 'update', entity: 'deletion', entityId: batchId, summary: `Restored ${batch?.label ?? 'deleted record'}` },
    );
  }

  /**
   * A restored booking may land on a slot someone has taken in the meantime —
   * worth warning about, but not worth blocking the restore over.
   */
  restoreClash(batch: DeletionBatch): string | null {
    if (batch.kind !== 'booking' || batch.restoredAt) return null;
    const entry = batch.entries.find((e) => e.collection === 'bookings');
    const booking = entry ? this.data().bookings.find((b) => b.id === entry.id) : undefined;
    if (!booking) return null;
    const clash = this.hasConflict(booking.tableId, booking.date, booking.startTime, booking.endTime, booking.id);
    if (!clash) return null;
    const { start, end } = this.occupancyLabel(clash);
    return `${this.tables().find((t) => t.id === booking.tableId)?.name ?? 'That table'} is now in use ${start}–${end}`;
  }

  // ---------- tables ----------
  tableStatus(tableId: string): TableStatus {
    const table = this.tables().find((t) => t.id === tableId);
    if (!table) return 'available';
    if (table.underMaintenance) return 'maintenance';
    const todays = this.todaysBookings().filter((b) => b.tableId === tableId);
    if (todays.some((b) => b.status === 'ongoing')) return 'occupied';
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const upcoming = todays.find(
      (b) => b.status === 'upcoming' && timeToMinutes(b.startTime) - nowMin <= 180 && timeToMinutes(b.startTime) - nowMin > -30,
    );
    if (upcoming) return 'upcoming';
    return 'available';
  }

  currentBookingForTable(tableId: string): Booking | undefined {
    return this.todaysBookings().find((b) => b.tableId === tableId && b.status === 'ongoing');
  }

  nextBookingForTable(tableId: string): Booking | undefined {
    return this.todaysBookings().find((b) => b.tableId === tableId && b.status === 'upcoming');
  }

  addTable(name: string, hourlyRate: number): void {
    const id = uid();
    this.commit(
      (d) => {
        d.tables.push({ id, name, hourlyRate, underMaintenance: false, createdAt: nowIso(), isDel: 0 });
      },
      { action: 'create', entity: 'table', entityId: id, summary: `Added ${name}` },
    );
  }

  updateTable(id: string, patch: Partial<PoolTable>): void {
    this.commit(
      (d) => {
        const t = d.tables.find((x) => x.id === id);
        if (t) Object.assign(t, patch);
      },
      { action: 'update', entity: 'table', entityId: id, summary: `Updated ${this.tables().find((t) => t.id === id)?.name ?? 'table'}` },
    );
  }

  removeTable(id: string): DeletionBatch | undefined {
    const name = this.tables().find((t) => t.id === id)?.name ?? 'table';
    let batch: DeletionBatch | undefined;
    this.commit(
      (d) => {
        batch = this.deleteBatch(d, 'table', name, [{ collection: 'tables', ids: [id] }]);
      },
      { action: 'delete', entity: 'table', entityId: id, summary: `Removed ${name}` },
    );
    return batch;
  }

  // ---------- customers ----------
  addCustomer(name: string, mobile: string): Customer {
    const c: Customer = { id: uid(), name, mobile, createdAt: nowIso(), isDel: 0 };
    this.commit(
      (d) => {
        d.customers.push(c);
      },
      { action: 'create', entity: 'customer', entityId: c.id, summary: `Added customer ${name}` },
    );
    return c;
  }

  updateCustomer(id: string, patch: Partial<Customer>): void {
    const name = this.customers().find((c) => c.id === id)?.name ?? 'customer';
    this.commit(
      (d) => {
        const c = d.customers.find((x) => x.id === id);
        if (c) Object.assign(c, patch);
      },
      { action: 'update', entity: 'customer', entityId: id, summary: `Updated ${name}` },
    );
  }

  removeCustomer(id: string): DeletionBatch | undefined {
    const name = this.customers().find((c) => c.id === id)?.name ?? 'customer';
    let batch: DeletionBatch | undefined;
    this.commit(
      (d) => {
        batch = this.deleteBatch(d, 'customer', name, [{ collection: 'customers', ids: [id] }]);
      },
      { action: 'delete', entity: 'customer', entityId: id, summary: `Removed ${name}` },
    );
    return batch;
  }

  customerBills(customerId: string): Bill[] {
    return this.bills()
      .filter((b) => b.customerId === customerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  customerBookings(customerId: string): Booking[] {
    return this.bookings()
      .filter((b) => b.customerIds.includes(customerId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  customerTotalSpend(customerId: string): number {
    return this.customerBills(customerId).reduce((s, b) => s + b.paidAmount, 0);
  }

  customerOutstanding(customerId: string): number {
    return this.customerBills(customerId).reduce((s, b) => s + Math.max(0, b.total - b.paidAmount), 0);
  }

  // ---------- bookings ----------
  /**
   * Clashes are judged on real occupancy, not the booked window — see
   * occupancyWindow. A booking whose session already ended no longer blocks
   * the rest of its slot.
   */
  hasConflict(tableId: string, date: string, startTime: string, endTime: string, excludeBookingId?: string): Booking | undefined {
    const s = timeToMinutes(startTime);
    const e = timeToMinutes(endTime);
    return this.bookings().find((b) => {
      if (b.id === excludeBookingId) return false;
      if (b.tableId !== tableId || b.date !== date) return false;
      if (b.status === 'cancelled') return false;
      const { start, end } = occupancyWindow(b);
      return s < end && e > start;
    });
  }

  /** The window a clashing booking actually holds, for showing in the UI. */
  occupancyLabel(b: Booking): { start: string; end: string } {
    const { start, end } = occupancyWindow(b);
    const asTime = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    return { start: asTime(start), end: asTime(end) };
  }

  /**
   * Creates the booking plus one bill per customer. A single-customer booking
   * is just the one-participant case of the same code path.
   */
  createBooking(params: {
    customerIds: string[];
    tableId: string;
    date: string;
    startTime: string;
    endTime: string;
    finalPrice: number;
    priceOverridden: boolean;
    splitMode?: SplitMode;
    /** customerId -> amount, used when splitMode is 'manual'. */
    shares?: Record<string, number>;
    /** Sole payer when splitMode is 'single'. */
    payerId?: string;
  }): Booking {
    const table = this.tables().find((t) => t.id === params.tableId)!;
    const durationHours = (timeToMinutes(params.endTime) - timeToMinutes(params.startTime)) / 60;
    const defaultPrice = Math.round(table.hourlyRate * durationHours);
    const bookingId = uid();
    const customerIds = params.customerIds.filter(Boolean);
    const splitMode: SplitMode = params.splitMode ?? 'equal';
    // A new booking is always just booked — it only becomes "ongoing" when the
    // operator actually starts the session, which is what stamps the time.
    const status: BookingStatus = 'upcoming';

    const shares = allocateShares(params.finalPrice, customerIds, splitMode, params.shares, params.payerId);
    const bills: Bill[] = customerIds.map((customerId) => {
      const amount = shares[customerId] ?? 0;
      const items: BillLineItem[] =
        amount > 0
          ? [
              {
                id: uid(),
                type: 'booking',
                refId: bookingId,
                name: `${table.name} booking (${durationHours}h)`,
                qty: 1,
                unitPrice: amount,
                amount,
              },
            ]
          : [];
      return {
        id: uid(),
        customerId,
        bookingId,
        groupId: bookingId,
        items,
        total: amount,
        paidAmount: 0,
        status: billStatusFor(amount, 0),
        createdAt: nowIso(),
        updatedAt: nowIso(),
        isDel: 0,
      };
    });

    const booking: Booking = {
      id: bookingId,
      customerId: customerIds[0],
      customerIds,
      tableId: params.tableId,
      date: params.date,
      startTime: params.startTime,
      endTime: params.endTime,
      durationHours,
      hourlyRateSnapshot: table.hourlyRate,
      defaultPrice,
      finalPrice: params.finalPrice,
      priceOverridden: params.priceOverridden,
      status,
      billId: bills[0].id,
      splitMode,
      sessionStartedAt: null,
      sessionEndedAt: null,
      createdAt: nowIso(),
      isDel: 0,
    };

    const names = customerIds
      .map((id) => this.customers().find((c) => c.id === id)?.name ?? 'customer')
      .join(', ');

    this.commit(
      (d) => {
        d.bookings.push(booking);
        d.bills.push(...bills);
      },
      {
        action: 'create',
        entity: 'booking',
        entityId: bookingId,
        summary: `Booked ${table.name} for ${names}`,
      },
    );
    return booking;
  }

  /**
   * Starts play on a booking. The session clock is stamped here, separately
   * from the booked window, so "booked 6–8, played 6:12–7:48" is recorded.
   */
  startSession(bookingId: string): void {
    const customer = this.customers().find((c) => c.id === this.bookingById(bookingId)?.customerId)?.name ?? 'customer';
    this.commit(
      (d) => {
        const b = d.bookings.find((x) => x.id === bookingId);
        if (!b || b.status === 'cancelled') return;
        b.status = 'ongoing';
        b.sessionStartedAt = b.sessionStartedAt ?? nowIso();
        b.sessionEndedAt = null;
      },
      { action: 'update', entity: 'booking', entityId: bookingId, summary: `Session started for ${customer}` },
    );
  }

  /** Ends play and frees the table. The bill stays open until it is settled. */
  endSession(bookingId: string): void {
    const customer = this.customers().find((c) => c.id === this.bookingById(bookingId)?.customerId)?.name ?? 'customer';
    this.commit(
      (d) => {
        const b = d.bookings.find((x) => x.id === bookingId);
        if (!b || b.status === 'cancelled') return;
        b.status = 'completed';
        b.sessionStartedAt = b.sessionStartedAt ?? nowIso();
        b.sessionEndedAt = nowIso();
      },
      { action: 'update', entity: 'booking', entityId: bookingId, summary: `Session ended for ${customer}` },
    );
  }

  /**
   * Lets the operator correct the session clock by hand — someone forgets to
   * press Start, or ends a session late. Status follows the stamps so the
   * floor view never disagrees with the times shown on it.
   */
  updateSessionTimes(bookingId: string, startedAt: string | null, endedAt: string | null): void {
    this.commit(
      (d) => {
        const b = d.bookings.find((x) => x.id === bookingId);
        if (!b || b.status === 'cancelled') return;
        b.sessionStartedAt = startedAt;
        b.sessionEndedAt = startedAt ? endedAt : null;
        if (!startedAt) b.status = 'upcoming';
        else b.status = b.sessionEndedAt ? 'completed' : 'ongoing';
      },
      { action: 'update', entity: 'booking', entityId: bookingId, summary: 'Session times adjusted' },
    );
  }

  /**
   * Puts another person on an existing booking. They start with no table
   * share — the operator decides how to split it, so nobody else's bill (or
   * what they have already paid) moves without being asked.
   */
  addBookingCustomer(bookingId: string, customerId: string): void {
    const name = this.customers().find((c) => c.id === customerId)?.name ?? 'customer';
    this.commit(
      (d) => {
        const booking = d.bookings.find((b) => b.id === bookingId);
        if (!booking || booking.customerIds.includes(customerId)) return;
        booking.customerIds.push(customerId);
        d.bills.push({
          id: uid(),
          customerId,
          bookingId,
          groupId: bookingId,
          items: [],
          total: 0,
          paidAmount: 0,
          status: billStatusFor(0, 0),
          createdAt: nowIso(),
          updatedAt: nowIso(),
          isDel: 0,
        });
      },
      { action: 'update', entity: 'booking', entityId: bookingId, summary: `Added ${name} to the booking` },
    );
  }

  /**
   * Takes someone off a booking along with their bill, items and payments, as
   * one undoable action. Restoring puts them back on the booking too.
   */
  removeBookingCustomer(bookingId: string, customerId: string): DeletionBatch | undefined {
    const booking = this.bookingById(bookingId);
    if (!booking || booking.customerIds.length <= 1) return undefined;

    const name = this.customers().find((c) => c.id === customerId)?.name ?? 'customer';
    const bills = this.bills().filter((b) => b.bookingId === bookingId && b.customerId === customerId);
    const payments = bills.flatMap((b) => this.billPayments(b.id));

    const stock = new Map<string, number>();
    for (const bill of bills) {
      for (const item of bill.items) {
        if (item.type !== 'product') continue;
        stock.set(item.refId, (stock.get(item.refId) ?? 0) + item.qty);
      }
    }

    let batch: DeletionBatch | undefined;
    this.commit(
      (d) => {
        batch = this.deleteBatch(
          d,
          'booking',
          `${name} · removed from booking`,
          [
            { collection: 'bills', ids: bills.map((b) => b.id) },
            { collection: 'payments', ids: payments.map((p) => p.id) },
          ],
          [...stock.entries()].map(([productId, qty]) => ({ productId, qty })),
        );
        batch.detachedFrom = { bookingId, customerId };

        const target = d.bookings.find((b) => b.id === bookingId);
        if (!target) return;
        target.customerIds = target.customerIds.filter((id) => id !== customerId);
        if (target.customerId === customerId) target.customerId = target.customerIds[0];
        if (bills.some((b) => b.id === target.billId)) {
          const remaining = d.bills.find((b) => b.bookingId === bookingId && b.isDel === 0);
          if (remaining) target.billId = remaining.id;
        }
      },
      { action: 'delete', entity: 'booking', entityId: bookingId, summary: `Removed ${name} from the booking` },
    );
    return batch;
  }

  /**
   * Writes an explicit table-charge split onto the participants' bills, used
   * when the operator changes who is on a booking or how it is shared.
   */
  applyBookingShares(bookingId: string, shares: Record<string, number>): void {
    this.commit(
      (d) => {
        const booking = d.bookings.find((b) => b.id === bookingId);
        if (!booking) return;
        const table = d.tables.find((t) => t.id === booking.tableId);

        for (const bill of d.bills.filter((b) => b.bookingId === bookingId && b.isDel === 0)) {
          const amount = Math.max(0, Math.round(shares[bill.customerId] ?? 0));
          const line = bill.items.find((i) => i.type === 'booking');
          if (line) {
            line.unitPrice = amount;
            line.amount = amount;
            if (amount === 0) bill.items = bill.items.filter((i) => i.type !== 'booking');
          } else if (amount > 0) {
            bill.items.unshift({
              id: uid(),
              type: 'booking',
              refId: booking.id,
              name: `${table?.name ?? 'Table'} booking (${booking.durationHours}h)`,
              qty: 1,
              unitPrice: amount,
              amount,
            });
          }
          bill.total = bill.items.reduce((s, i) => s + i.amount, 0);
          bill.status = billStatusFor(bill.total, bill.paidAmount);
          bill.updatedAt = nowIso();
        }
      },
      { action: 'update', entity: 'booking', entityId: bookingId, summary: 'Table charge re-split' },
    );
  }

  updateBookingStatus(bookingId: string, status: BookingStatus): void {
    this.commit(
      (d) => {
        const b = d.bookings.find((x) => x.id === bookingId);
        if (b) b.status = status;
      },
      { action: 'update', entity: 'booking', entityId: bookingId, summary: `Booking marked ${status}` },
    );
  }

  updateBookingTime(
    bookingId: string,
    patch: { date?: string; startTime?: string; endTime?: string; finalPrice?: number; priceOverridden?: boolean },
  ): void {
    this.commit(
      (d) => {
        const b = d.bookings.find((x) => x.id === bookingId);
        if (!b) return;
        Object.assign(b, patch);
        if (patch.startTime || patch.endTime) {
          b.durationHours = (timeToMinutes(b.endTime) - timeToMinutes(b.startTime)) / 60;
          b.defaultPrice = Math.round(b.hourlyRateSnapshot * b.durationHours);
        }
        if (patch.finalPrice !== undefined) {
          reallocateBookingCharge(d, b, patch.finalPrice);
        }
      },
      { action: 'update', entity: 'booking', entityId: bookingId, summary: 'Booking details changed' },
    );
  }

  bookingById(id: string): Booking | undefined {
    return this.bookings().find((b) => b.id === id);
  }

  /** What a booking takes with it — shown in the confirm dialog. */
  bookingDeletionPreview(bookingId: string): { bills: number; payments: number; items: number; collected: number } {
    const bills = this.bills().filter((b) => b.bookingId === bookingId);
    const payments = bills.flatMap((b) => this.billPayments(b.id));
    return {
      bills: bills.length,
      payments: payments.length,
      items: bills.reduce((n, b) => n + b.items.filter((i) => i.type === 'product').reduce((q, i) => q + i.qty, 0), 0),
      collected: bills.reduce((s, b) => s + b.paidAmount, 0),
    };
  }

  /**
   * Removes a booking with everything hanging off it — bills, their counter-sale
   * items and the payments taken against them — as one undoable action. Works
   * whether the booking is upcoming, running or finished.
   */
  removeBooking(bookingId: string): DeletionBatch | undefined {
    const booking = this.bookingById(bookingId);
    if (!booking) return undefined;

    const bills = this.bills().filter((b) => b.bookingId === bookingId);
    const payments = bills.flatMap((b) => this.billPayments(b.id));
    const table = this.tables().find((t) => t.id === booking.tableId)?.name ?? 'Table';
    const customer = this.customers().find((c) => c.id === booking.customerId)?.name ?? 'Customer';

    // Drinks and snacks on a removed booking were never really sold.
    const stock = new Map<string, number>();
    for (const bill of bills) {
      for (const item of bill.items) {
        if (item.type !== 'product') continue;
        stock.set(item.refId, (stock.get(item.refId) ?? 0) + item.qty);
      }
    }

    let batch: DeletionBatch | undefined;
    this.commit(
      (d) => {
        batch = this.deleteBatch(
          d,
          'booking',
          `${customer} · ${table} · ${formatTime12(booking.startTime)}`,
          [
            { collection: 'bookings', ids: [bookingId] },
            { collection: 'bills', ids: bills.map((b) => b.id) },
            { collection: 'payments', ids: payments.map((p) => p.id) },
          ],
          [...stock.entries()].map(([productId, qty]) => ({ productId, qty })),
        );
      },
      { action: 'delete', entity: 'booking', entityId: bookingId, summary: `Removed booking for ${customer} on ${table}` },
    );
    return batch;
  }

  /** A counter sale and its payments, removed as one undoable action. */
  removeSaleGroup(groupId: string): DeletionBatch | undefined {
    const bills = this.billsInGroup(groupId).filter((b) => !b.bookingId);
    if (bills.length === 0) return undefined;
    const payments = bills.flatMap((b) => this.billPayments(b.id));
    const customer = this.customers().find((c) => c.id === bills[0].customerId)?.name ?? 'Customer';

    const stock = new Map<string, number>();
    for (const bill of bills) {
      for (const item of bill.items) {
        if (item.type !== 'product') continue;
        stock.set(item.refId, (stock.get(item.refId) ?? 0) + item.qty);
      }
    }

    let batch: DeletionBatch | undefined;
    this.commit(
      (d) => {
        batch = this.deleteBatch(
          d,
          'sale',
          `${customer} · counter sale`,
          [
            { collection: 'bills', ids: bills.map((b) => b.id) },
            { collection: 'payments', ids: payments.map((p) => p.id) },
          ],
          [...stock.entries()].map(([productId, qty]) => ({ productId, qty })),
        );
      },
      { action: 'delete', entity: 'sale', entityId: groupId, summary: `Removed counter sale for ${customer}` },
    );
    return batch;
  }

  /** Move a booking to another table, keeping its bill line items in sync. */
  updateBookingTable(bookingId: string, tableId: string): void {
    this.commit(
      (d) => {
        const booking = d.bookings.find((x) => x.id === bookingId);
        const table = d.tables.find((t) => t.id === tableId);
        if (!booking || !table || booking.tableId === tableId) return;
        booking.tableId = tableId;
        booking.hourlyRateSnapshot = table.hourlyRate;
        for (const bill of d.bills.filter((b) => b.bookingId === bookingId)) {
          const item = bill.items.find((i) => i.type === 'booking' && i.refId === bookingId);
          if (item) item.name = `${table.name} booking (${booking.durationHours}h)`;
        }
      },
      { action: 'update', entity: 'booking', entityId: bookingId, summary: 'Booking moved to another table' },
    );
  }

  // ---------- bills / sales ----------
  billById(id: string): Bill | undefined {
    return this.bills().find((b) => b.id === id);
  }

  /** Every bill raised in the same transaction — one per customer on a split. */
  billsInGroup(groupId: string): Bill[] {
    return this.bills()
      .filter((b) => b.groupId === groupId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /**
   * A counter sale with a line-up per customer. Each customer gets their own
   * bill so payments, partial settlement and status stay independent.
   */
  createSaleGroup(entries: { customerId: string; items: { product: Product; qty: number }[] }[]): Bill[] {
    const groupId = uid();
    const created: Bill[] = [];

    this.commit(
      (d) => {
        for (const entry of entries) {
          const bill: Bill = {
            id: uid(),
            customerId: entry.customerId,
            bookingId: null,
            groupId,
            items: [],
            total: 0,
            paidAmount: 0,
            status: 'unpaid',
            createdAt: nowIso(),
            updatedAt: nowIso(),
            isDel: 0,
          };
          for (const line of entry.items) {
            if (line.qty <= 0) continue;
            upsertProductLine(bill, line.product, line.qty);
            applyStockSale(d, line.product.id, line.qty, 'Sold');
          }
          bill.total = bill.items.reduce((s, i) => s + i.amount, 0);
          bill.status = billStatusFor(bill.total, 0);
          d.bills.push(bill);
          created.push(bill);
        }
      },
      {
        action: 'create',
        entity: 'sale',
        entityId: groupId,
        summary: `Counter sale for ${entries.length} customer(s)`,
      },
    );
    return created;
  }

  addProductToBill(billId: string, product: Product, qty: number): void {
    this.commit(
      (d) => {
        const bill = d.bills.find((b) => b.id === billId);
        if (!bill) return;
        upsertProductLine(bill, product, qty);
        bill.total = bill.items.reduce((s, i) => s + i.amount, 0);
        bill.status = billStatusFor(bill.total, bill.paidAmount);
        bill.updatedAt = nowIso();
        applyStockSale(d, product.id, qty, 'Sold');
      },
      { action: 'update', entity: 'bill', entityId: billId, summary: `Added ${qty} × ${product.name}` },
    );
  }

  setBillItemQty(billId: string, itemId: string, qty: number): void {
    this.commit(
      (d) => {
        const bill = d.bills.find((b) => b.id === billId);
        if (!bill) return;
        const item = bill.items.find((i) => i.id === itemId);
        if (!item || item.type !== 'product') return;
        const delta = qty - item.qty;
        if (qty <= 0) {
          bill.items = bill.items.filter((i) => i.id !== itemId);
        } else {
          item.qty = qty;
          item.amount = qty * item.unitPrice;
        }
        if (delta !== 0) applyStockSale(d, item.refId, delta, 'Quantity adjusted');
        bill.total = bill.items.reduce((s, i) => s + i.amount, 0);
        bill.status = billStatusFor(bill.total, bill.paidAmount);
        bill.updatedAt = nowIso();
      },
      { action: 'update', entity: 'bill', entityId: billId, summary: 'Bill quantity changed' },
    );
  }

  addPayment(billId: string, amount: number, note = ''): void {
    const customer = this.customers().find((c) => c.id === this.billById(billId)?.customerId)?.name ?? 'customer';
    this.commit(
      (d) => {
        const bill = d.bills.find((b) => b.id === billId);
        if (!bill) return;
        bill.paidAmount = Math.min(bill.total, bill.paidAmount + amount);
        bill.status = billStatusFor(bill.total, bill.paidAmount);
        bill.updatedAt = nowIso();
        d.payments.push({
          id: uid(),
          billId,
          amount,
          date: nowIso(),
          note,
          actor: d.config.activeHandoverId
            ? (d.handovers.find((h) => h.id === d.config.activeHandoverId)?.personName ?? ADMIN_ACTOR)
            : ADMIN_ACTOR,
          isDel: 0,
        });
      },
      { action: 'payment', entity: 'bill', entityId: billId, summary: `Collected ₹${Math.round(amount)} from ${customer}` },
    );
  }

  markBillPaid(billId: string): void {
    const bill = this.billById(billId);
    const remaining = bill ? bill.total - bill.paidAmount : 0;
    if (remaining > 0) {
      this.addPayment(billId, remaining, 'Marked as paid');
      return;
    }
    this.commit(
      (d) => {
        const target = d.bills.find((b) => b.id === billId);
        if (!target) return;
        target.paidAmount = target.total;
        target.status = 'paid';
        target.updatedAt = nowIso();
      },
      { action: 'payment', entity: 'bill', entityId: billId, summary: 'Bill settled' },
    );
  }

  removeBill(billId: string): void {
    this.commit(
      (d) => {
        this.markDeleted(d.bills, billId);
      },
      { action: 'delete', entity: 'bill', entityId: billId, summary: 'Bill removed' },
    );
  }

  billPayments(billId: string): Payment[] {
    return this.payments()
      .filter((p) => p.billId === billId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  // ---------- products / inventory ----------
  addProduct(input: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'isDel'>): Product {
    const p: Product = { ...input, id: uid(), createdAt: nowIso(), updatedAt: nowIso(), isDel: 0 };
    this.commit(
      (d) => {
        d.products.push(p);
        d.stockMovements.push({
          id: uid(),
          productId: p.id,
          type: 'add',
          qty: p.stock,
          note: 'Opening stock',
          date: nowIso(),
          isDel: 0,
        });
      },
      { action: 'create', entity: 'product', entityId: p.id, summary: `Added item ${p.name}` },
    );
    return p;
  }

  updateProduct(id: string, patch: Partial<Product>): void {
    const name = this.productById(id)?.name ?? 'item';
    this.commit(
      (d) => {
        const p = d.products.find((x) => x.id === id);
        if (p) Object.assign(p, patch, { updatedAt: nowIso() });
      },
      { action: 'update', entity: 'product', entityId: id, summary: `Updated ${name}` },
    );
  }

  removeProduct(id: string): DeletionBatch | undefined {
    const name = this.productById(id)?.name ?? 'item';
    let batch: DeletionBatch | undefined;
    this.commit(
      (d) => {
        batch = this.deleteBatch(d, 'product', name, [{ collection: 'products', ids: [id] }]);
      },
      { action: 'delete', entity: 'product', entityId: id, summary: `Removed ${name}` },
    );
    return batch;
  }

  adjustStock(id: string, delta: number, type: StockMovement['type'], note: string): void {
    const name = this.productById(id)?.name ?? 'item';
    this.commit(
      (d) => {
        const p = d.products.find((x) => x.id === id);
        if (!p) return;
        p.stock += delta;
        p.updatedAt = nowIso();
        d.stockMovements.push({ id: uid(), productId: id, type, qty: delta, note, date: nowIso(), isDel: 0 });
      },
      { action: 'update', entity: 'product', entityId: id, summary: `${delta > 0 ? '+' : ''}${delta} stock on ${name}` },
    );
  }

  productMovements(productId: string): StockMovement[] {
    return this.stockMovements()
      .filter((m) => m.productId === productId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  productById(id: string): Product | undefined {
    return this.products().find((p) => p.id === id);
  }

  movementsInRange(fromDate: string, toDate: string): StockMovement[] {
    return this.stockMovements()
      .filter((m) => {
        const d = m.date.slice(0, 10);
        return d >= fromDate && d <= toDate;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  // ---------- expenses ----------
  addExpense(input: Omit<Expense, 'id' | 'isDel'>): void {
    const id = uid();
    this.commit(
      (d) => {
        d.expenses.push({ ...input, id, isDel: 0 });
      },
      { action: 'create', entity: 'expense', entityId: id, summary: `Recorded expense ${input.name}` },
    );
  }

  removeExpense(id: string): DeletionBatch | undefined {
    const name = this.expenses().find((e) => e.id === id)?.name ?? 'expense';
    let batch: DeletionBatch | undefined;
    this.commit(
      (d) => {
        batch = this.deleteBatch(d, 'expense', name, [{ collection: 'expenses', ids: [id] }]);
      },
      { action: 'delete', entity: 'expense', entityId: id, summary: `Removed expense ${name}` },
    );
    return batch;
  }

  // ---------- config ----------
  updateConfig(patch: Partial<AppConfig>): void {
    this.commit((d) => {
      Object.assign(d.config, patch);
    });
  }

  /** Config changes worth recording — security toggles, passkey changes. */
  updateSecurityConfig(patch: Partial<AppConfig>, summary: string): void {
    this.commit(
      (d) => {
        Object.assign(d.config, patch);
      },
      { action: 'security', entity: 'config', entityId: 'config', summary },
    );
  }

  // ---------- handover ----------
  startHandover(personName: string, note: string): HandoverSession {
    const session: HandoverSession = {
      id: uid(),
      personName: personName.trim(),
      note: note.trim(),
      startedAt: nowIso(),
      endedAt: null,
    };
    this.commit(
      (d) => {
        d.handovers.push(session);
        d.config.mode = 'handover';
        d.config.activeHandoverId = session.id;
      },
      { action: 'security', entity: 'handover', entityId: session.id, summary: `Handed over to ${session.personName}` },
    );
    return session;
  }

  endHandover(): void {
    const session = this.activeHandover();
    this.commit(
      (d) => {
        const target = d.handovers.find((h) => h.id === d.config.activeHandoverId);
        if (target) target.endedAt = nowIso();
        d.config.mode = 'admin';
        d.config.activeHandoverId = null;
      },
      {
        action: 'security',
        entity: 'handover',
        entityId: session?.id ?? 'handover',
        summary: `Admin took back control from ${session?.personName ?? 'operator'}`,
      },
    );
  }

  auditForSession(sessionId: string): AuditEntry[] {
    return this.auditLog()
      .filter((e) => e.sessionId === sessionId)
      .sort((a, b) => b.at.localeCompare(a.at));
  }

  recentAudit(limit = 50): AuditEntry[] {
    return [...this.auditLog()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  }

  // ---------- reports ----------
  billsInRange(fromDate: string, toDate: string): Bill[] {
    return this.bills().filter((b) => {
      const d = b.createdAt.slice(0, 10);
      return d >= fromDate && d <= toDate;
    });
  }

  expensesInRange(fromDate: string, toDate: string): Expense[] {
    return this.expenses().filter((e) => e.date >= fromDate && e.date <= toDate);
  }

  productSalesInRange(fromDate: string, toDate: string): { product: Product; qty: number; revenue: number; cost: number }[] {
    const bills = this.billsInRange(fromDate, toDate);
    const map = new Map<string, { qty: number; revenue: number }>();
    for (const b of bills) {
      for (const i of b.items) {
        if (i.type !== 'product') continue;
        const cur = map.get(i.refId) ?? { qty: 0, revenue: 0 };
        cur.qty += i.qty;
        cur.revenue += i.amount;
        map.set(i.refId, cur);
      }
    }
    const result: { product: Product; qty: number; revenue: number; cost: number }[] = [];
    for (const [productId, agg] of map.entries()) {
      const product = this.productById(productId);
      if (!product) continue;
      result.push({ product, qty: agg.qty, revenue: agg.revenue, cost: product.costPrice * agg.qty });
    }
    return result.sort((a, b) => b.revenue - a.revenue);
  }
}

// ---------------------------------------------------------------------------
// Shared mutation helpers — kept outside the class so the same logic backs both
// single-bill edits and bulk creation.
// ---------------------------------------------------------------------------

function upsertProductLine(bill: Bill, product: Product, qty: number): void {
  const existing = bill.items.find((i) => i.type === 'product' && i.refId === product.id);
  if (existing) {
    existing.qty += qty;
    existing.amount = existing.qty * existing.unitPrice;
    return;
  }
  bill.items.push({
    id: uid(),
    type: 'product',
    refId: product.id,
    name: product.name,
    qty,
    unitPrice: product.sellingPrice,
    amount: qty * product.sellingPrice,
  });
}

function applyStockSale(d: AppData, productId: string, qty: number, note: string): void {
  const p = d.products.find((x) => x.id === productId);
  if (!p || qty === 0) return;
  p.stock -= qty;
  p.updatedAt = nowIso();
  d.stockMovements.push({ id: uid(), productId, type: 'sale', qty: -qty, note, date: nowIso(), isDel: 0 });
}

/**
 * Spreads a changed table charge back over the participants, keeping whatever
 * proportions they already had (and falling back to an even split).
 */
function reallocateBookingCharge(d: AppData, booking: Booking, newTotal: number): void {
  const bills = d.bills.filter((b) => b.bookingId === booking.id && b.isDel === 0);
  if (bills.length === 0) return;

  const currentShares = bills.map((b) => b.items.find((i) => i.type === 'booking')?.amount ?? 0);
  const currentTotal = currentShares.reduce((s, v) => s + v, 0);

  const shares =
    currentTotal > 0
      ? currentShares.map((v) => Math.round((v / currentTotal) * newTotal))
      : bills.map(() => Math.floor(newTotal / bills.length));

  const drift = newTotal - shares.reduce((s, v) => s + v, 0);
  shares[0] += drift;

  bills.forEach((bill, index) => {
    const amount = Math.max(0, shares[index]);
    const item = bill.items.find((i) => i.type === 'booking');
    if (item) {
      item.unitPrice = amount;
      item.amount = amount;
      if (amount === 0) bill.items = bill.items.filter((i) => i.type !== 'booking');
    } else if (amount > 0) {
      const table = d.tables.find((t) => t.id === booking.tableId);
      bill.items.unshift({
        id: uid(),
        type: 'booking',
        refId: booking.id,
        name: `${table?.name ?? 'Table'} booking (${booking.durationHours}h)`,
        qty: 1,
        unitPrice: amount,
        amount,
      });
    }
    bill.total = bill.items.reduce((s, i) => s + i.amount, 0);
    bill.status = billStatusFor(bill.total, bill.paidAmount);
    bill.updatedAt = nowIso();
  });
}

/**
 * Brings saved data up to the current shape. Runs on every load so existing
 * installs keep their bookings, bills and stock.
 *
 * Every step is idempotent and runs unconditionally rather than being skipped
 * when the stored version already matches. A build that stamps a new version
 * before it writes a newly added collection would otherwise leave that
 * collection missing forever, and the next write to it would throw.
 */
function migrate(raw: AppData): AppData {
  const d = structuredClone(raw);
  const withFlag = <T extends object>(row: T): T & SoftDeletable => ({
    ...(row as T & SoftDeletable),
    isDel: (row as Partial<SoftDeletable>).isDel ?? 0,
  });

  d.tables = (d.tables ?? []).map(withFlag);
  d.customers = (d.customers ?? []).map(withFlag);
  d.products = (d.products ?? []).map(withFlag);
  d.stockMovements = (d.stockMovements ?? []).map(withFlag);
  d.expenses = (d.expenses ?? []).map(withFlag);

  d.bookings = (d.bookings ?? []).map((b) => ({
    ...withFlag(b),
    customerIds: b.customerIds?.length ? b.customerIds : [b.customerId],
    splitMode: b.splitMode ?? 'equal',
    // Older bookings have no session times. An already-running or finished
    // booking is assumed to have started when it was booked to start.
    sessionStartedAt:
      b.sessionStartedAt ?? (b.status === 'ongoing' || b.status === 'completed' ? b.createdAt : null),
    sessionEndedAt: b.sessionEndedAt ?? null,
  }));

  d.bills = (d.bills ?? []).map((b) => ({
    ...withFlag(b),
    groupId: b.groupId ?? b.bookingId ?? b.id,
  }));

  d.payments = (d.payments ?? []).map((p) => ({ ...withFlag(p), actor: p.actor ?? ADMIN_ACTOR }));

  d.handovers = d.handovers ?? [];
  d.auditLog = d.auditLog ?? [];
  d.deletions = d.deletions ?? [];
  d.config = { ...defaultConfig(d.config?.shopName), ...d.config };
  d.schemaVersion = SCHEMA_VERSION;
  return d;
}
