// The app's single source of "now". Test mode shifts it to simulate other days; everything that cares
// about the current date or time (streaks, windows, bank rollover, timestamps) must read it from here.

let offsetMs = 0;

export function now(): number {
  return Date.now() + offsetMs;
}

export function nowDate(): Date {
  return new Date(now());
}

export function nowIso(): string {
  return nowDate().toISOString();
}

export function getClockOffset(): number {
  return offsetMs;
}

/** Only test mode should call this. */
export function setClockOffset(ms: number) {
  offsetMs = ms;
}
