import { Injectable, computed, inject, signal } from '@angular/core';
import { DataStoreService } from './data-store.service';
import { uid } from './storage.service';

export interface PasskeyPrompt {
  title: string;
  message: string;
  confirmLabel: string;
  resolve: (ok: boolean) => void;
}

/**
 * Admin passkey and Safety Mode.
 *
 * The passkey is stored as SHA-256 of a per-install random salt plus the
 * passkey, never in plain text. This is a browser-only app, so anyone with the
 * device and dev tools can still clear storage — the passkey stops a colleague
 * from quietly editing or deleting records, it is not a defence against someone
 * who controls the machine.
 */
@Injectable({ providedIn: 'root' })
export class SecurityService {
  private store = inject(DataStoreService);

  /** Set while a passkey dialog is open, rendered once by the shell. */
  readonly prompt = signal<PasskeyPrompt | null>(null);

  readonly hasPasskey = computed(() => this.store.hasPasskey());
  readonly safetyMode = computed(() => this.store.config().safetyMode);

  async setPasskey(passkey: string): Promise<void> {
    const salt = uid();
    const hash = await hashPasskey(passkey, salt);
    this.store.updateSecurityConfig({ passkeyHash: hash, passkeySalt: salt }, 'Admin passkey set');
  }

  async verify(passkey: string): Promise<boolean> {
    const { passkeyHash, passkeySalt } = this.store.config();
    if (!passkeyHash || !passkeySalt) return true;
    return (await hashPasskey(passkey, passkeySalt)) === passkeyHash;
  }

  /** Changing or clearing the passkey requires the current one. */
  async changePasskey(currentPasskey: string, nextPasskey: string): Promise<boolean> {
    if (!(await this.verify(currentPasskey))) return false;
    await this.setPasskey(nextPasskey);
    return true;
  }

  async clearPasskey(currentPasskey: string): Promise<boolean> {
    if (!(await this.verify(currentPasskey))) return false;
    this.store.updateSecurityConfig(
      { passkeyHash: null, passkeySalt: null, safetyMode: false },
      'Admin passkey removed',
    );
    return true;
  }

  setSafetyMode(enabled: boolean): void {
    this.store.updateSecurityConfig(
      { safetyMode: enabled },
      enabled ? 'Safety Mode turned on' : 'Safety Mode turned off',
    );
  }

  /**
   * Always asks for the passkey when one exists — used for handing over and
   * taking control back.
   */
  requireAdmin(title: string, message: string, confirmLabel = 'Confirm'): Promise<boolean> {
    if (!this.hasPasskey()) return Promise.resolve(true);
    return this.ask(title, message, confirmLabel);
  }

  /**
   * Gate for edits and deletions. Only asks while Safety Mode is on, so the
   * calling screens never need to know the rules.
   */
  guard(actionLabel: string): Promise<boolean> {
    if (!this.safetyMode() || !this.hasPasskey()) return Promise.resolve(true);
    return this.ask('Admin passkey required', `Safety Mode is on. Enter the admin passkey to ${actionLabel}.`, 'Unlock');
  }

  private ask(title: string, message: string, confirmLabel: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.prompt.set({
        title,
        message,
        confirmLabel,
        resolve: (ok) => {
          this.prompt.set(null);
          resolve(ok);
        },
      });
    });
  }
}

async function hashPasskey(passkey: string, salt: string): Promise<string> {
  const input = `${salt}::${passkey}`;
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(input);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Non-secure contexts (plain http) have no SubtleCrypto. Weaker, but still
  // avoids storing the passkey itself.
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `fallback-${(hash >>> 0).toString(16)}`;
}
