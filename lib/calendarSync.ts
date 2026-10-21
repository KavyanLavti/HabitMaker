// Talks to the phone's calendars (which Android syncs with your Google account). Reads busy times from your
// calendars and writes habit events into the calendar you picked for HabitForge, so they show up in Google
// Calendar. Events are written per day for the next SYNC_DAYS days (not as one repeating event), so moving a
// single day is just an update of that day's event.
import * as Calendar from 'expo-calendar/legacy';
import { runQuery, runMutation } from './db';
import { addDaysKey, atMinutes, todayKey } from './dates';
import { Busy, SchedHabit, Slot } from './scheduling';

export const SYNC_DAYS = 14;
const EVENT_NOTE = 'Created by HabitForge. Reschedule it in the app — edits made here are overwritten.';

export interface CalendarInfo {
  id: string;
  title: string;
  color: string;
  account: string;
  writable: boolean;
  isGoogle: boolean;
}

export async function hasCalendarPermission(): Promise<boolean> {
  try {
    return (await Calendar.getCalendarPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export async function requestCalendarPermission(): Promise<boolean> {
  return (await Calendar.requestCalendarPermissionsAsync()).granted;
}

export async function listCalendars(): Promise<CalendarInfo[]> {
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return cals
    .map((c) => ({
      id: c.id,
      title: c.title || c.name || 'Untitled',
      color: c.color,
      account: c.source?.name ?? c.ownerAccount ?? '',
      writable: !!c.allowsModifications,
      isGoogle: c.source?.type === 'com.google',
    }))
    .sort((a, b) => a.account.localeCompare(b.account) || a.title.localeCompare(b.title));
}

/** Holidays/birthdays/contacts calendars are noise for conflicts; ignore them unless the user opts in. */
export function isNoiseCalendar(c: CalendarInfo) {
  return /holiday|birthday|contacts|week numbers/i.test(c.title);
}

/** Busy blocks per day (minutes after midnight), clipped to each day. All-day and "free" events are skipped. */
export async function fetchBusy(calendarIds: string[], from: string, days: number): Promise<Record<string, Busy[]>> {
  const out: Record<string, Busy[]> = {};
  if (!calendarIds.length) return out;
  const start = new Date(atMinutes(0, from));
  const end = new Date(atMinutes(0, addDaysKey(from, days)));
  const events = await Calendar.getEventsAsync(calendarIds, start, end);
  for (const e of events) {
    if (e.allDay) continue;
    if (e.availability === Calendar.Availability.FREE) continue;
    if (e.status === Calendar.EventStatus.CANCELED) continue;
    const s = new Date(e.startDate).getTime();
    const f = new Date(e.endDate).getTime();
    for (let i = 0; i < days; i++) {
      const date = addDaysKey(from, i);
      const d0 = atMinutes(0, date);
      const d1 = atMinutes(0, addDaysKey(date, 1));
      if (f <= d0 || s >= d1) continue;
      (out[date] ??= []).push({
        start: Math.max(0, Math.round((s - d0) / 60000)),
        end: Math.min(24 * 60, Math.round((f - d0) / 60000)),
        title: e.title || 'Busy',
      });
    }
  }
  for (const d of Object.keys(out)) out[d].sort((a, b) => a.start - b.start);
  return out;
}

interface EventRow {
  habitId: string;
  date: string;
  eventId: string;
  startMs: number;
  endMs: number;
}

/**
 * Makes the HabitForge calendar match the plan: creates, moves or deletes one event per habit per day
 * from today on. `slots[habitId][date]` is where the habit goes (null/missing = no event).
 */
export async function writeHabitEvents(
  calendarId: string,
  habits: SchedHabit[],
  slots: Record<string, Record<string, Slot | null>>
): Promise<{ created: number; updated: number; deleted: number }> {
  const today = todayKey();
  const rows = await runQuery<EventRow>('SELECT * FROM calendar_events WHERE date >= ?', [today]);
  const existing = new Map(rows.map((r) => [`${r.habitId}|${r.date}`, r]));
  const timeZone = guessTimeZone();
  const stats = { created: 0, updated: 0, deleted: 0 };
  const wanted = new Set<string>();

  for (const h of habits) {
    for (const [date, slot] of Object.entries(slots[h.id] ?? {})) {
      if (!slot) continue;
      const key = `${h.id}|${date}`;
      wanted.add(key);
      const startMs = atMinutes(slot.start, date);
      const endMs = atMinutes(slot.end, date);
      const prev = existing.get(key);
      if (prev && prev.startMs === startMs && prev.endMs === endMs) continue;

      const details = {
        title: `⚔ ${h.name}`,
        notes: EVENT_NOTE,
        startDate: new Date(startMs),
        endDate: new Date(endMs),
        alarms: [], // no reminders: HabitForge sends its own alerts
        availability: Calendar.Availability.BUSY,
        timeZone,
      };
      let eventId = prev?.eventId;
      if (eventId) {
        try {
          await Calendar.updateEventAsync(eventId, details);
          stats.updated++;
        } catch {
          eventId = undefined; // deleted in the calendar app; recreate it
        }
      }
      if (!eventId) {
        eventId = await Calendar.createEventAsync(calendarId, details);
        stats.created++;
      }
      await runMutation(
        'INSERT OR REPLACE INTO calendar_events (habitId,date,eventId,startMs,endMs) VALUES (?,?,?,?,?)',
        [h.id, date, eventId, startMs, endMs]
      );
    }
  }

  for (const [key, r] of existing) {
    if (wanted.has(key)) continue;
    try { await Calendar.deleteEventAsync(r.eventId); } catch {}
    await runMutation('DELETE FROM calendar_events WHERE habitId=? AND date=?', [r.habitId, r.date]);
    stats.deleted++;
  }
  return stats;
}

/** Removes every upcoming HabitForge event, e.g. when switching to another calendar or disconnecting. */
export async function removeAllHabitEvents() {
  const rows = await runQuery<EventRow>('SELECT * FROM calendar_events WHERE date >= ?', [todayKey()]);
  for (const r of rows) {
    try { await Calendar.deleteEventAsync(r.eventId); } catch {}
  }
  await runMutation('DELETE FROM calendar_events WHERE date >= ?', [todayKey()]);
}

function guessTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined; // the calendar provider falls back to the device time zone
  }
}
