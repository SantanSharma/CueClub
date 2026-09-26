import { Injectable, signal } from '@angular/core';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  message: string;
  kind: 'success' | 'error' | 'info';
  /** Optional one-tap follow-up, e.g. Undo on a delete. */
  action?: ToastAction;
}

let nextId = 1;

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);

  show(message: string, kind: Toast['kind'] = 'success', action?: ToastAction): void {
    const toast: Toast = { id: nextId++, message, kind, action };
    this.toasts.update((list) => [...list, toast]);
    // An actionable toast sticks around long enough to actually be used.
    setTimeout(() => this.dismiss(toast.id), action ? 7000 : 3200);
  }

  success(message: string, action?: ToastAction): void {
    this.show(message, 'success', action);
  }

  error(message: string): void {
    this.show(message, 'error');
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  /** Runs a toast action and clears the toast that offered it. */
  runAction(toast: Toast): void {
    toast.action?.run();
    this.dismiss(toast.id);
  }
}
