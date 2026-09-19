import { Injectable, computed, inject, signal } from '@angular/core';
import { StorageService, uid } from './storage.service';
import { buildSeedData } from './seed';
import {
  AppConfig,
  AppData,
  Bill,
  BillLineItem,
  Booking,
  BookingStatus,
  Customer,
  Expense,
  Payment,
  PoolTable,
  Product,
  StockMovement,
  TableStatus,
} from '../models/models';

const DATA_KEY = 'data';

function nowIso(): string {
  return new Date().toISOString();
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function billStatusFor(total: number, paid: number): 'unpaid' | 'partial' | 'paid' {
  if (paid <= 0) return 'unpaid';
  if (paid >= total) return 'paid';
  return 'partial';
}

@Injectable({ providedIn: 'root' })
export class DataStoreService {
  private storage = inject(StorageService);
  private readonly data = signal<AppData>(this.load());

  readonly tables = computed(() => this.data().tables);
  readonly customers = computed(() => this.data().customers);
  readonly bookings = computed(() => this.data().bookings);
  readonly products = computed(() => this.data().products);
  readonly stockMovements = computed(() => this.data().stockMovements);
  readonly bills = computed(() => this.data().bills);
  readonly payments = computed(() => this.data().payments);
  readonly expenses = computed(() => this.data().expenses);
  readonly config = computed(() => this.data().config);

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
    if (existing && existing.tables && existing.config) return existing;
    const seeded = buildSeedData();
    this.storage.set(DATA_KEY, seeded);
    return seeded;
  }

  private commit(mutator: (d: AppData) => void): void {
    const draft = structuredClone(this.data());
    mutator(draft);
    this.data.set(draft);
    this.storage.set(DATA_KEY, draft);
  }

  resetDemoData(): void {
    const seeded = buildSeedData();
    this.data.set(seeded);
    this.storage.set(DATA_KEY, seeded);
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
    this.commit((d) => {
      d.tables.push({ id: uid(), name, hourlyRate, underMaintenance: false, createdAt: nowIso() });
    });
  }

  updateTable(id: string, patch: Partial<PoolTable>): void {
    this.commit((d) => {
      const t = d.tables.find((x) => x.id === id);
      if (t) Object.assign(t, patch);
    });
  }

  removeTable(id: string): void {
    this.commit((d) => {
      d.tables = d.tables.filter((t) => t.id !== id);
    });
  }

  // ---------- customers ----------
  addCustomer(name: string, mobile: string): Customer {
    const c: Customer = { id: uid(), name, mobile, createdAt: nowIso() };
    this.commit((d) => {
      d.customers.push(c);
    });
    return c;
  }

  updateCustomer(id: string, patch: Partial<Customer>): void {
    this.commit((d) => {
      const c = d.customers.find((x) => x.id === id);
      if (c) Object.assign(c, patch);
    });
  }

  customerBills(customerId: string): Bill[] {
    return this.bills()
      .filter((b) => b.customerId === customerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  customerBookings(customerId: string): Booking[] {
    return this.bookings()
      .filter((b) => b.customerId === customerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  customerTotalSpend(customerId: string): number {
    return this.customerBills(customerId).reduce((s, b) => s + b.paidAmount, 0);
  }

  customerOutstanding(customerId: string): number {
    return this.customerBills(customerId).reduce((s, b) => s + Math.max(0, b.total - b.paidAmount), 0);
  }

  // ---------- bookings ----------
  hasConflict(tableId: string, date: string, startTime: string, endTime: string, excludeBookingId?: string): Booking | undefined {
    const s = timeToMinutes(startTime);
    const e = timeToMinutes(endTime);
    return this.bookings().find((b) => {
      if (b.id === excludeBookingId) return false;
      if (b.tableId !== tableId || b.date !== date) return false;
      if (b.status === 'cancelled') return false;
      const bs = timeToMinutes(b.startTime);
      const be = timeToMinutes(b.endTime);
      return s < be && e > bs;
    });
  }

  createBooking(params: {
    customerId: string;
    tableId: string;
    date: string;
    startTime: string;
    endTime: string;
    finalPrice: number;
    priceOverridden: boolean;
  }): Booking {
    const table = this.tables().find((t) => t.id === params.tableId)!;
    const durationHours = (timeToMinutes(params.endTime) - timeToMinutes(params.startTime)) / 60;
    const defaultPrice = Math.round(table.hourlyRate * durationHours);
    const bookingId = uid();
    const billId = uid();
    const status: BookingStatus = params.date === this.today() && timeToMinutes(params.startTime) <= new Date().getHours() * 60 + new Date().getMinutes() ? 'ongoing' : 'upcoming';

    const booking: Booking = {
      id: bookingId,
      customerId: params.customerId,
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
      billId,
      createdAt: nowIso(),
    };

    const lineItem: BillLineItem = {
      id: uid(),
      type: 'booking',
      refId: bookingId,
      name: `${table.name} booking (${durationHours}h)`,
      qty: 1,
      unitPrice: params.finalPrice,
      amount: params.finalPrice,
    };

    const bill: Bill = {
      id: billId,
      customerId: params.customerId,
      bookingId,
      items: [lineItem],
      total: params.finalPrice,
      paidAmount: 0,
      status: 'unpaid',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    this.commit((d) => {
      d.bookings.push(booking);
      d.bills.push(bill);
    });
    return booking;
  }

  updateBookingStatus(bookingId: string, status: BookingStatus): void {
    this.commit((d) => {
      const b = d.bookings.find((x) => x.id === bookingId);
      if (b) b.status = status;
    });
  }

  updateBookingTime(bookingId: string, patch: { date?: string; startTime?: string; endTime?: string; finalPrice?: number; priceOverridden?: boolean }): void {
    this.commit((d) => {
      const b = d.bookings.find((x) => x.id === bookingId);
      if (!b) return;
      Object.assign(b, patch);
      if (patch.startTime || patch.endTime) {
        b.durationHours = (timeToMinutes(b.endTime) - timeToMinutes(b.startTime)) / 60;
        b.defaultPrice = Math.round(b.hourlyRateSnapshot * b.durationHours);
      }
      if (patch.finalPrice !== undefined) {
        const bill = d.bills.find((x) => x.id === b.billId);
        if (bill) {
          const item = bill.items.find((i) => i.type === 'booking' && i.refId === b.id);
          if (item) {
            item.unitPrice = patch.finalPrice;
            item.amount = patch.finalPrice;
          }
          bill.total = bill.items.reduce((s, i) => s + i.amount, 0);
          bill.status = billStatusFor(bill.total, bill.paidAmount);
          bill.updatedAt = nowIso();
        }
      }
    });
  }

  bookingById(id: string): Booking | undefined {
    return this.bookings().find((b) => b.id === id);
  }

  /** Move a booking to another table, keeping its bill line item in sync. */
  updateBookingTable(bookingId: string, tableId: string): void {
    this.commit((d) => {
      const booking = d.bookings.find((x) => x.id === bookingId);
      const table = d.tables.find((t) => t.id === tableId);
      if (!booking || !table || booking.tableId === tableId) return;
      booking.tableId = tableId;
      booking.hourlyRateSnapshot = table.hourlyRate;
      const bill = d.bills.find((x) => x.id === booking.billId);
      const item = bill?.items.find((i) => i.type === 'booking' && i.refId === bookingId);
      if (item) item.name = `${table.name} booking (${booking.durationHours}h)`;
    });
  }

  // ---------- bills / sales ----------
  billById(id: string): Bill | undefined {
    return this.bills().find((b) => b.id === id);
  }

  createWalkInBill(customerId: string): Bill {
    const bill: Bill = {
      id: uid(),
      customerId,
      bookingId: null,
      items: [],
      total: 0,
      paidAmount: 0,
      status: 'unpaid',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.commit((d) => {
      d.bills.push(bill);
    });
    return bill;
  }

  addProductToBill(billId: string, product: Product, qty: number): void {
    this.commit((d) => {
      const bill = d.bills.find((b) => b.id === billId);
      if (!bill) return;
      const existing = bill.items.find((i) => i.type === 'product' && i.refId === product.id);
      if (existing) {
        existing.qty += qty;
        existing.amount = existing.qty * existing.unitPrice;
      } else {
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
      bill.total = bill.items.reduce((s, i) => s + i.amount, 0);
      bill.status = billStatusFor(bill.total, bill.paidAmount);
      bill.updatedAt = nowIso();

      const p = d.products.find((x) => x.id === product.id);
      if (p) {
        p.stock -= qty;
        p.updatedAt = nowIso();
        d.stockMovements.push({ id: uid(), productId: p.id, type: 'sale', qty: -qty, note: 'Sold', date: nowIso() });
      }
    });
  }

  setBillItemQty(billId: string, itemId: string, qty: number): void {
    this.commit((d) => {
      const bill = d.bills.find((b) => b.id === billId);
      if (!bill) return;
      const item = bill.items.find((i) => i.id === itemId);
      if (!item || item.type !== 'product') return;
      const delta = qty - item.qty;
      const p = d.products.find((x) => x.id === item.refId);
      if (qty <= 0) {
        bill.items = bill.items.filter((i) => i.id !== itemId);
      } else {
        item.qty = qty;
        item.amount = qty * item.unitPrice;
      }
      if (p) {
        p.stock -= delta;
        p.updatedAt = nowIso();
        if (delta !== 0) {
          d.stockMovements.push({ id: uid(), productId: p.id, type: 'sale', qty: -delta, note: 'Quantity adjusted', date: nowIso() });
        }
      }
      bill.total = bill.items.reduce((s, i) => s + i.amount, 0);
      bill.status = billStatusFor(bill.total, bill.paidAmount);
      bill.updatedAt = nowIso();
    });
  }

  addPayment(billId: string, amount: number, note = ''): void {
    this.commit((d) => {
      const bill = d.bills.find((b) => b.id === billId);
      if (!bill) return;
      bill.paidAmount = Math.min(bill.total, bill.paidAmount + amount);
      bill.status = billStatusFor(bill.total, bill.paidAmount);
      bill.updatedAt = nowIso();
      d.payments.push({ id: uid(), billId, amount, date: nowIso(), note });
    });
  }

  markBillPaid(billId: string): void {
    this.commit((d) => {
      const bill = d.bills.find((b) => b.id === billId);
      if (!bill) return;
      const remaining = bill.total - bill.paidAmount;
      if (remaining > 0) {
        d.payments.push({ id: uid(), billId, amount: remaining, date: nowIso(), note: 'Marked as paid' });
      }
      bill.paidAmount = bill.total;
      bill.status = 'paid';
      bill.updatedAt = nowIso();
    });
  }

  billPayments(billId: string): Payment[] {
    return this.payments()
      .filter((p) => p.billId === billId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  // ---------- products / inventory ----------
  addProduct(input: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Product {
    const p: Product = { ...input, id: uid(), createdAt: nowIso(), updatedAt: nowIso() };
    this.commit((d) => {
      d.products.push(p);
      d.stockMovements.push({ id: uid(), productId: p.id, type: 'add', qty: p.stock, note: 'Opening stock', date: nowIso() });
    });
    return p;
  }

  updateProduct(id: string, patch: Partial<Product>): void {
    this.commit((d) => {
      const p = d.products.find((x) => x.id === id);
      if (p) {
        Object.assign(p, patch, { updatedAt: nowIso() });
      }
    });
  }

  adjustStock(id: string, delta: number, type: StockMovement['type'], note: string): void {
    this.commit((d) => {
      const p = d.products.find((x) => x.id === id);
      if (!p) return;
      p.stock += delta;
      p.updatedAt = nowIso();
      d.stockMovements.push({ id: uid(), productId: id, type, qty: delta, note, date: nowIso() });
    });
  }

  productMovements(productId: string): StockMovement[] {
    return this.stockMovements()
      .filter((m) => m.productId === productId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  productById(id: string): Product | undefined {
    return this.products().find((p) => p.id === id);
  }

  // ---------- expenses ----------
  addExpense(input: Omit<Expense, 'id'>): void {
    this.commit((d) => {
      d.expenses.push({ ...input, id: uid() });
    });
  }

  removeExpense(id: string): void {
    this.commit((d) => {
      d.expenses = d.expenses.filter((e) => e.id !== id);
    });
  }

  // ---------- config ----------
  updateConfig(patch: Partial<AppConfig>): void {
    this.commit((d) => {
      Object.assign(d.config, patch);
    });
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
