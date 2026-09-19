import { uid } from './storage.service';
import {
  AppData,
  Bill,
  BillLineItem,
  Booking,
  Customer,
  Expense,
  Payment,
  PoolTable,
  Product,
  StockMovement,
} from '../models/models';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function timeStr(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60000);
}

export function buildSeedData(): AppData {
  const now = new Date();
  const today = dateStr(now);
  const nowIso = now.toISOString();

  const tables: PoolTable[] = [
    { id: uid(), name: 'Table 1', hourlyRate: 200, underMaintenance: false, createdAt: nowIso },
    { id: uid(), name: 'Table 2', hourlyRate: 200, underMaintenance: false, createdAt: nowIso },
    { id: uid(), name: 'Table 3', hourlyRate: 250, underMaintenance: false, createdAt: nowIso },
  ];

  const customers: Customer[] = [
    { id: uid(), name: 'Priya Sharma', mobile: '9876543210', createdAt: nowIso },
    { id: uid(), name: 'Rahul Verma', mobile: '9812345678', createdAt: nowIso },
    { id: uid(), name: 'Amit Khanna', mobile: '9900112233', createdAt: nowIso },
    { id: uid(), name: 'Sneha Rao', mobile: '9765432109', createdAt: nowIso },
    { id: uid(), name: 'John Fernandes', mobile: '9654321098', createdAt: nowIso },
  ];

  const products: Product[] = [
    { id: uid(), name: 'Cold Drink', category: 'Drinks', costPrice: 20, sellingPrice: 40, stock: 42, minStock: 15, unit: 'bottle', createdAt: nowIso, updatedAt: nowIso },
    { id: uid(), name: 'Mineral Water', category: 'Drinks', costPrice: 10, sellingPrice: 20, stock: 60, minStock: 20, unit: 'bottle', createdAt: nowIso, updatedAt: nowIso },
    { id: uid(), name: 'Cigarettes (pack)', category: 'Cigarettes', costPrice: 15, sellingPrice: 20, stock: 8, minStock: 10, unit: 'pack', createdAt: nowIso, updatedAt: nowIso },
    { id: uid(), name: 'Chips', category: 'Snacks', costPrice: 15, sellingPrice: 30, stock: 25, minStock: 10, unit: 'packet', createdAt: nowIso, updatedAt: nowIso },
    { id: uid(), name: 'Namkeen', category: 'Snacks', costPrice: 20, sellingPrice: 50, stock: 3, minStock: 8, unit: 'packet', createdAt: nowIso, updatedAt: nowIso },
    { id: uid(), name: 'Sandwich', category: 'Food', costPrice: 35, sellingPrice: 70, stock: 0, minStock: 5, unit: 'piece', createdAt: nowIso, updatedAt: nowIso },
    { id: uid(), name: 'Tea', category: 'Food', costPrice: 8, sellingPrice: 20, stock: 40, minStock: 10, unit: 'cup', createdAt: nowIso, updatedAt: nowIso },
    { id: uid(), name: 'Energy Drink', category: 'Drinks', costPrice: 45, sellingPrice: 80, stock: 18, minStock: 10, unit: 'can', createdAt: nowIso, updatedAt: nowIso },
  ];

  const stockMovements: StockMovement[] = products.map((p) => ({
    id: uid(),
    productId: p.id,
    type: 'add',
    qty: p.stock,
    note: 'Opening stock',
    date: nowIso,
  }));

  const bookings: Booking[] = [];
  const bills: Bill[] = [];
  const payments: Payment[] = [];

  function makeBooking(
    table: PoolTable,
    customer: Customer,
    startOffsetMin: number,
    durationHours: number,
    status: Booking['status'],
    extraItems: { product: Product; qty: number }[],
    paidRatio: number,
  ) {
    const start = addMinutes(now, startOffsetMin);
    const end = addMinutes(start, durationHours * 60);
    const price = table.hourlyRate * durationHours;
    const bookingId = uid();
    const billId = uid();

    const items: BillLineItem[] = [
      {
        id: uid(),
        type: 'booking',
        refId: bookingId,
        name: `${table.name} booking (${durationHours}h)`,
        qty: 1,
        unitPrice: price,
        amount: price,
      },
    ];
    for (const ei of extraItems) {
      const amount = ei.product.sellingPrice * ei.qty;
      items.push({
        id: uid(),
        type: 'product',
        refId: ei.product.id,
        name: ei.product.name,
        qty: ei.qty,
        unitPrice: ei.product.sellingPrice,
        amount,
      });
    }
    const total = items.reduce((s, i) => s + i.amount, 0);
    const paidAmount = Math.round(total * paidRatio);
    const billStatus = paidAmount <= 0 ? 'unpaid' : paidAmount >= total ? 'paid' : 'partial';

    bookings.push({
      id: bookingId,
      customerId: customer.id,
      tableId: table.id,
      date: dateStr(start),
      startTime: timeStr(start),
      endTime: timeStr(end),
      durationHours,
      hourlyRateSnapshot: table.hourlyRate,
      defaultPrice: price,
      finalPrice: price,
      priceOverridden: false,
      status,
      billId,
      createdAt: start.toISOString(),
    });

    bills.push({
      id: billId,
      customerId: customer.id,
      bookingId,
      items,
      total,
      paidAmount,
      status: billStatus,
      createdAt: start.toISOString(),
      updatedAt: nowIso,
    });

    if (paidAmount > 0) {
      payments.push({ id: uid(), billId, amount: paidAmount, date: nowIso, note: '' });
    }
  }

  // Table 1: ongoing booking, started 40 min ago, runs 2h, partially paid, with drinks
  makeBooking(tables[0], customers[0], -40, 2, 'ongoing', [
    { product: products[0], qty: 2 },
    { product: products[2], qty: 1 },
  ], 0.5);

  // Table 3: upcoming booking in 90 minutes
  makeBooking(tables[2], customers[1], 90, 1.5, 'upcoming', [], 0);

  // Table 2 stays available — a completed booking earlier today, fully paid
  makeBooking(tables[1], customers[2], -240, 1, 'completed', [
    { product: products[3], qty: 1 },
  ], 1);

  // A cancelled booking earlier today on table 2
  makeBooking(tables[1], customers[3], -300, 1, 'cancelled', [], 0);

  // Walk-in product-only sale (no booking) — unpaid
  {
    const billId = uid();
    const items: BillLineItem[] = [
      { id: uid(), type: 'product', refId: products[1].id, name: products[1].name, qty: 3, unitPrice: products[1].sellingPrice, amount: products[1].sellingPrice * 3 },
      { id: uid(), type: 'product', refId: products[6].id, name: products[6].name, qty: 2, unitPrice: products[6].sellingPrice, amount: products[6].sellingPrice * 2 },
    ];
    const total = items.reduce((s, i) => s + i.amount, 0);
    bills.push({
      id: billId,
      customerId: customers[4].id,
      bookingId: null,
      items,
      total,
      paidAmount: 0,
      status: 'unpaid',
      createdAt: addMinutes(now, -20).toISOString(),
      updatedAt: nowIso,
    });
  }

  const expenses: Expense[] = [
    { id: uid(), name: 'Electricity Bill', category: 'Utilities', amount: 3200, date: today, notes: '' },
    { id: uid(), name: 'Cleaning Supplies', category: 'Supplies', amount: 450, date: today, notes: 'Table cloth + cleaner' },
  ];

  return {
    tables,
    customers,
    bookings,
    products,
    stockMovements,
    bills,
    payments,
    expenses,
    config: { shopName: 'Cue & Cushion Club', openingTime: '11:00', closingTime: '23:30' },
  };
}
