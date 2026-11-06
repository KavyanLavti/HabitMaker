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

/** 0 = Sunday … 6 = Saturday, for a "YYYY-MM-DD" key. */
export function weekdayOf(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** Monday of the calendar week containing `key` (weeks run Monday → Sunday). */
export function weekStartKey(key: string): string {
  return addDaysKey(key, -((weekdayOf(key) + 6) % 7));
}

// ── Active weekdays ─────────────────────────────────────────────────────────
// Stored as a bitmask: bit 0 = Sunday … bit 6 = Saturday. 127 = every day.
export const EVERY_DAY = 127;
/** Picker order: Monday first. Each entry is [JS weekday, label]. */
export const WEEK_ORDER: [number, string][] = [[1, 'M'], [2, 'T'], [3, 'W'], [4, 'T'], [5, 'F'], [6, 'S'], [0, 'S']];
const SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export function isActiveOn(mask: number | null | undefined, key: string): boolean {
  const m = mask == null ? EVERY_DAY : mask;
  return (m & (1 << weekdayOf(key))) !== 0;
}

/** "EVERY DAY", "WEEKDAYS", "WEEKENDS" or "MON · WED · FRI". */
export function describeDays(mask: number | null | undefined): string {
  const m = mask == null ? EVERY_DAY : mask;
  if ((m & EVERY_DAY) === EVERY_DAY) return 'EVERY DAY';
  if (m === 0b0111110) return 'WEEKDAYS';
  if (m === 0b1000001) return 'WEEKENDS';
  return WEEK_ORDER.filter(([d]) => m & (1 << d)).map(([d]) => SHORT[d]).join(' · ');
}
