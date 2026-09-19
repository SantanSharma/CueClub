export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type BookingStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
export type TableStatus = 'available' | 'occupied' | 'upcoming' | 'maintenance';
export type ProductCategory = 'Drinks' | 'Cigarettes' | 'Snacks' | 'Food' | 'Other';
export type StockMovementType = 'add' | 'remove' | 'adjust' | 'sale';
export type ExpenseCategory = 'Rent' | 'Utilities' | 'Salaries' | 'Maintenance' | 'Supplies' | 'Other';

export interface PoolTable {
  id: string;
  name: string;
  hourlyRate: number;
  underMaintenance: boolean;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  createdAt: string;
}

export interface Booking {
  id: string;
  customerId: string;
  tableId: string;
  date: string; // yyyy-MM-dd
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationHours: number;
  hourlyRateSnapshot: number;
  defaultPrice: number;
  finalPrice: number;
  priceOverridden: boolean;
  status: BookingStatus;
  billId: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  unit: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: StockMovementType;
  qty: number;
  note: string;
  date: string;
}

export interface BillLineItem {
  id: string;
  type: 'booking' | 'product';
  refId: string;
  name: string;
  qty: number;
  unitPrice: number;
  amount: number;
}

export interface Bill {
  id: string;
  customerId: string;
  bookingId: string | null;
  items: BillLineItem[];
  total: number;
  paidAmount: number;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  billId: string;
  amount: number;
  date: string;
  note: string;
}

export interface Expense {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  notes: string;
}

export interface AppConfig {
  shopName: string;
  openingTime: string;
  closingTime: string;
}

export interface AppData {
  tables: PoolTable[];
  customers: Customer[];
  bookings: Booking[];
  products: Product[];
  stockMovements: StockMovement[];
  bills: Bill[];
  payments: Payment[];
  expenses: Expense[];
  config: AppConfig;
}
