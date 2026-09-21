export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type BookingStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
export type TableStatus = 'available' | 'occupied' | 'upcoming' | 'maintenance';
export type ProductCategory = 'Drinks' | 'Cigarettes' | 'Snacks' | 'Food' | 'Other';
export type StockMovementType = 'add' | 'remove' | 'adjust' | 'sale';
export type ExpenseCategory = 'Rent' | 'Utilities' | 'Salaries' | 'Maintenance' | 'Supplies' | 'Other';

/** 0 = active, 1 = soft deleted. Records are never physically removed. */
export type DeletedFlag = 0 | 1;

export interface SoftDeletable {
  isDel: DeletedFlag;
}

/** How a table charge is shared when a booking has more than one customer. */
export type SplitMode = 'equal' | 'single' | 'manual';

export interface PoolTable extends SoftDeletable {
  id: string;
  name: string;
  hourlyRate: number;
  underMaintenance: boolean;
  createdAt: string;
}

export interface Customer extends SoftDeletable {
  id: string;
  name: string;
  mobile: string;
  createdAt: string;
}

export interface Booking extends SoftDeletable {
  id: string;
  /** Primary customer. Kept for backward compatibility — always customerIds[0]. */
  customerId: string;
  /** Everyone sharing this table. Single-customer bookings hold one id. */
  customerIds: string[];
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
  /** Primary customer's bill. Split bookings have more, linked by groupId. */
  billId: string;
  splitMode: SplitMode;
  createdAt: string;
}

export interface Product extends SoftDeletable {
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

export interface StockMovement extends SoftDeletable {
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

export interface Bill extends SoftDeletable {
  id: string;
  customerId: string;
  bookingId: string | null;
  /**
   * Ties together the bills created in one transaction so a split booking or
   * counter sale reads as a single order while each customer keeps their own
   * total, payments and status.
   */
  groupId: string;
  items: BillLineItem[];
  total: number;
  paidAmount: number;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Payment extends SoftDeletable {
  id: string;
  billId: string;
  amount: number;
  date: string;
  note: string;
  /** Who took the money — set from the active operator. */
  actor: string;
}

export interface Expense extends SoftDeletable {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  notes: string;
}

// ---------------------------------------------------------------------------
// Operating mode, audit trail and security
// ---------------------------------------------------------------------------

export type OperatingMode = 'admin' | 'handover';

export interface HandoverSession {
  id: string;
  personName: string;
  note: string;
  startedAt: string;
  endedAt: string | null;
}

export type AuditAction = 'create' | 'update' | 'delete' | 'payment' | 'security';

export interface AuditEntry {
  id: string;
  at: string;
  action: AuditAction;
  /** Entity kind touched, e.g. 'booking', 'bill', 'product'. */
  entity: string;
  entityId: string;
  summary: string;
  actor: string;
  actorRole: OperatingMode;
  /** Set when the action happened during a handover. */
  sessionId: string | null;
}

export interface AppConfig {
  shopName: string;
  openingTime: string;
  closingTime: string;
  mode: OperatingMode;
  activeHandoverId: string | null;
  /**
   * SHA-256 of salt + passkey. A browser-only app cannot keep a real secret —
   * this stops casual snooping of stored data, not a determined attacker with
   * access to the device.
   */
  passkeyHash: string | null;
  passkeySalt: string | null;
  /** When on, editing and deleting require the admin passkey. */
  safetyMode: boolean;
}

export interface AppData {
  schemaVersion: number;
  tables: PoolTable[];
  customers: Customer[];
  bookings: Booking[];
  products: Product[];
  stockMovements: StockMovement[];
  bills: Bill[];
  payments: Payment[];
  expenses: Expense[];
  handovers: HandoverSession[];
  auditLog: AuditEntry[];
  config: AppConfig;
}

export const SCHEMA_VERSION = 2;

export const ADMIN_ACTOR = 'Admin';
