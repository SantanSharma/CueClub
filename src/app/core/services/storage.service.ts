import { Injectable } from '@angular/core';

const PREFIX = 'cueclub_';

@Injectable({ providedIn: 'root' })
export class StorageService {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* storage full or unavailable — ignore in MVP */
    }
  }

  clearAll(): void {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  }
}

export function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
