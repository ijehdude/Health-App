import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Local-timezone YYYY-MM-DD string. */
export function dateStr(d: Date = new Date()): string {
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return dateStr(d);
}

/** Format a number for display: 1 decimal under 10, integers otherwise. */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return n < 10 && n > 0 ? (Math.round(n * 10) / 10).toString() : Math.round(n).toLocaleString();
}
