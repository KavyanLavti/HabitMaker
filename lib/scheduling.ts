// Pure scheduling rules: where each habit sits on a given day, what it clashes with, and smart
// alternative times. Times are minutes after local midnight. No React/storage imports (unit tested).

export interface Busy {
  start: number;
  end: number;
  title: string;
}

export interface Slot {
  start: number;
  end: number;
}

export interface SchedHabit {
  id: string;
  name: string;
  scheduleType: 'fixed' | 'window' | 'anytime' | 'avoid';
  scheduledTime: string | null;
  windowEnd: string | null;
  dailyDurationMinutes: number;
}

export interface Conflict {
  habitId: string;
  date: string;
  slot: Slot;
  clashes: Busy[];
}

export interface Suggestion {
  start: number;
  reason: string;
}

const DAY_START = 6 * 60; // earliest suggestion 06:00
const DAY_END = 23 * 60 + 30; // nothing may end after 23:30
const STEP = 15;
const BUFFER = 10; // keep 10 minutes clear around other events

export function hhmm(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function fmt(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

const duration = (h: SchedHabit) => Math.max(5, h.dailyDurationMinutes || 30);

export function overlaps(a: Slot, b: Slot, buffer = 0): boolean {
  return a.start < b.end + buffer && b.start < a.end + buffer;
}

export function clashesWith(slot: Slot, busy: Busy[]): Busy[] {
  return busy.filter((b) => overlaps(slot, b));
}

function isFree(slot: Slot, busy: Busy[], buffer = BUFFER) {
  return !busy.some((b) => overlaps(slot, b, buffer));
}

/**
 * Where a habit goes on a day. Fixed: its time (or that day's override). Window: the override, else the
 * first free slot inside the window, else the window start. Any-time and avoid habits have no slot.
 */
export function plannedSlot(h: SchedHabit, busy: Busy[], override?: string | null): Slot | null {
  if (h.scheduleType !== 'fixed' && h.scheduleType !== 'window') return null;
  const d = duration(h);
  const o = hhmm(override);
  if (o != null) return { start: o, end: o + d };
  const start = hhmm(h.scheduledTime);
  if (start == null) return null;
  if (h.scheduleType === 'fixed') return { start, end: start + d };

  const end = hhmm(h.windowEnd) ?? start + d;
  for (let t = start; t + d <= end; t += STEP) {
    const s = { start: t, end: t + d };
    if (isFree(s, busy, 0)) return s;
  }
  return { start, end: start + d };
}

/** Every day where a habit's planned slot overlaps something in your calendar. */
export function findConflicts(
  habits: SchedHabit[],
  dates: string[],
  busyByDate: Record<string, Busy[]>,
  overrides: Record<string, Record<string, string | null>>
): Conflict[] {
  const out: Conflict[] = [];
  for (const date of dates) {
    const busy = busyByDate[date] ?? [];
    if (!busy.length) continue;
    for (const h of habits) {
      const slot = plannedSlot(h, busy, overrides[h.id]?.[date]);
      if (!slot) continue;
      const clashes = clashesWith(slot, busy);
      if (clashes.length) out.push({ habitId: h.id, date, slot, clashes });
    }
  }
  return out;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/**
 * Ranks free times for a habit on one day. Offline "smart rules":
 *  - must be free (with a 10-minute buffer around other events)
 *  - closer to the habit's usual time scores higher
 *  - near the time you've actually been doing it (from history) scores higher
 *  - window habits strongly prefer staying inside their window
 *  - late nights and very early mornings are discouraged
 */
export function suggestSlots(
  h: SchedHabit,
  busy: Busy[],
  /** Start times (minutes) of past completions of this habit. */
  history: number[],
  count = 3
): Suggestion[] {
  const d = duration(h);
  const usual = hhmm(h.scheduledTime) ?? 18 * 60;
  const habitual = median(history);
  const winStart = h.scheduleType === 'window' ? hhmm(h.scheduledTime) : null;
  const winEnd = h.scheduleType === 'window' ? hhmm(h.windowEnd) : null;

  const scored: { start: number; score: number; reason: string }[] = [];
  for (let t = DAY_START; t + d <= DAY_END; t += STEP) {
    const slot = { start: t, end: t + d };
    if (!isFree(slot, busy)) continue;
    // Distance from the planned time matters, but is capped so a far-away slot that matches your real
    // routine (history) can still win
    let score = 100 - Math.min(Math.abs(t - usual), 180) / 6;
    const reasons: string[] = [];
    if (Math.abs(t - usual) <= 60) reasons.push(`close to your usual ${fmt(usual)}`);
    if (habitual != null && Math.abs(t - habitual) <= 90) {
      score += 35 - Math.abs(t - habitual) / 3;
      reasons.push('when you usually actually do it');
    }
    if (winStart != null && winEnd != null) {
      if (t >= winStart && t + d <= winEnd) {
        score += 30;
        reasons.push('inside its window');
      } else {
        score -= 40;
      }
    }
    if (t >= 22 * 60) score -= 25;
    if (t < 6 * 60 + 30) score -= 15;
    scored.push({ start: t, score, reason: ['Free', ...reasons].join(' · ') });
  }

  // Best first, keep picks at least 45 minutes apart, and make the last pick a different part of the day
  // (3h+ from the others) when one is free, so there's always a real alternative
  scored.sort((a, b) => b.score - a.score);
  const picks: Suggestion[] = [];
  const add = (gap: number) => {
    const s = scored.find((c) => picks.every((p) => Math.abs(p.start - c.start) >= gap));
    if (s) picks.push({ start: s.start, reason: s.reason });
    return !!s;
  };
  while (picks.length < count - 1 && add(45)) {}
  if (picks.length < count && !add(180)) add(45);
  return picks;
}
