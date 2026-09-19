import { Injectable, signal } from '@angular/core';

export type OrderMode = 'booking' | 'sale';

export interface OrderFlowState {
  open: boolean;
  mode: OrderMode;
  /** Pre-selected customer, e.g. when starting from a customer profile. */
  customerId: string | null;
  /** Set when editing an existing booking instead of creating one. */
  editBookingId: string | null;
}

/**
 * The single entry point for creating or editing operational records.
 *
 * Every "+ New" affordance in the app (sidebar, mobile FAB, empty states,
 * customer profile) opens this one flow, so a merchant never has to work out
 * *where* a booking, sale, or customer is supposed to be created.
 */
@Injectable({ providedIn: 'root' })
export class OrderFlowService {
  readonly state = signal<OrderFlowState>({
    open: false,
    mode: 'booking',
    customerId: null,
    editBookingId: null,
  });

  /** Bill currently shown in the detail drawer, if any. */
  readonly openBillId = signal<string | null>(null);

  startBooking(customerId: string | null = null): void {
    this.state.set({ open: true, mode: 'booking', customerId, editBookingId: null });
  }

  startSale(customerId: string | null = null): void {
    this.state.set({ open: true, mode: 'sale', customerId, editBookingId: null });
  }

  editBooking(bookingId: string, customerId: string): void {
    this.state.set({ open: true, mode: 'booking', customerId, editBookingId: bookingId });
  }

  close(): void {
    this.state.update((s) => ({ ...s, open: false, editBookingId: null, customerId: null }));
  }

  openDetail(billId: string): void {
    this.openBillId.set(billId);
  }

  closeDetail(): void {
    this.openBillId.set(null);
  }
}
