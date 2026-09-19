export function formatCurrency(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}₹${Math.abs(rounded).toLocaleString('en-IN')}`;
}

export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatTime12(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
}

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function addMinutesToTime(time: string, mins: number): string {
  const total = timeToMinutes(time) + mins;
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

/** Next clean half-hour slot — the sensible default start time for a walk-in. */
export function roundToNext30(d: Date = new Date()): string {
  const bumpToNextHour = d.getMinutes() >= 30;
  const h = (d.getHours() + (bumpToNextHour ? 1 : 0)) % 24;
  const m = bumpToNextHour ? 0 : 30;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function relativeDayLabel(dateStr: string): string {
  const today = todayStr();
  if (dateStr === today) return 'Today';
  if (dateStr === addDays(today, 1)) return 'Tomorrow';
  if (dateStr === addDays(today, -1)) return 'Yesterday';
  return formatDate(dateStr);
}

export function stockStatus(stock: number, minStock: number): 'in-stock' | 'low-stock' | 'out-of-stock' {
  if (stock <= 0) return 'out-of-stock';
  if (stock <= minStock) return 'low-stock';
  return 'in-stock';
}
