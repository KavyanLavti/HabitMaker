// Local-calendar date helpers. Always use these instead of toISOString().slice(0, 10),
// which returns the UTC date and shifts anything done between 00:00 and 05:30 IST to the previous day.
// "Now" comes from lib/clock so test mode can simulate other days.
import { nowDate } from './clock';

export function dateKey(d: Date = nowDate()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local date key for an ISO timestamp. */
export function dateKeyOf(iso: string): string {
  return dateKey(new Date(iso));
}

export function todayKey(): string {
  return dateKey();
}

export function addDaysKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return dateKey(dt);
}

export function daysBetweenKeys(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/** "07:30" → 450. Returns null for malformed input. */
export function parseHHMM(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function formatHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Epoch ms for today (or `key`) at the given minutes-since-midnight, local time. */
export function atMinutes(minutes: number, key: string = todayKey()): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, 0, 0).getTime();
}

export function minutesNow(): number {
  const n = nowDate();
  return n.getHours() * 60 + n.getMinutes();
}

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** "2026-10-20" → { day: "TUESDAY", date: "20 OCT 2026" }. Manual formatting avoids relying on Intl in Hermes. */
export function describeKey(key: string): { day: string; date: string } {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return { day: DAYS[dt.getDay()], date: `${d} ${MONTHS[m - 1]} ${y}` };
}
