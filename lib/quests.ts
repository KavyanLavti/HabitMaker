import { useHabitStore, Habit } from '@/store/habitStore';
import { usePointStore } from '@/store/pointStore';
import { useSettingsStore } from '@/store/settingsStore';
import { calculateEarnedPoints, getConsecutivePerfectDays, isPerfectDay } from '@/lib/pointEngine';
import { addDaysKey, dateKey, todayKey } from '@/lib/dates';
import { nowDate } from '@/lib/clock';
import { SystemGuard } from '@/modules/system-guard';
import { playFx } from '@/store/fxStore';
import { rankFor } from '@/constants/theme';

export interface QuestResult {
  points: number;
  streak: number;
  bonuses: string[];
}

/**
 * Records a completion and awards points (streak multiplier, perfect-day and combo bonuses).
 * `durationMinutes` below the habit's target with `timerUsed` gives partial points.
 */
export async function completeQuest(
  habit: Habit,
  durationMinutes: number,
  timerUsed: boolean,
  /** Defaults to now. A past date (e.g. yesterday's unfinished timer) records there and skips day bonuses. */
  at: Date = nowDate()
): Promise<QuestResult> {
  const hs = useHabitStore.getState();
  const ps = usePointStore.getState();
  const { settings } = useSettingsStore.getState();
  const today = todayKey();
  const isToday = dateKey(at) === today;

  const before = hs.getStreakState(habit.id);
  const streakBefore = before.streak;
  const levelOf = (lifetime: number) => Math.floor(lifetime / settings.pointsPerLevel) + 1;
  const levelBefore = levelOf(ps.lifetimePoints);
  const fraction = timerUsed
    ? Math.min(durationMinutes / Math.max(1, habit.dailyDurationMinutes), 1)
    : 1;
  const result = calculateEarnedPoints(Math.ceil(habit.pointsPerCompletion * fraction), streakBefore + 1, settings);

  const activeIds = hs.habits.map((h) => h.id);
  const byDate: Record<string, string[]> = {};
  for (const c of hs.completions) (byDate[c.date] ??= []).push(c.habitId);
  const doneTodayBefore = byDate[today] ?? [];
  const wasPerfect = isPerfectDay(activeIds, doneTodayBefore);
  const days = Array.from({ length: 30 }, (_, i) => addDaysKey(today, -i));
  const perfectRunBefore = getConsecutivePerfectDays(activeIds, byDate, days);

  await hs.addCompletion({
    habitId: habit.id,
    completedAt: at.toISOString(),
    durationMinutes,
    timerUsed,
  });
  if (isToday) SystemGuard.markHandled(habit.id);

  await ps.addEntry({
    habitId: habit.id,
    type: 'earn',
    amount: result.total,
    reason: fraction < 1
      ? `Partial (${Math.round(fraction * 100)}%): ${habit.name}`
      : `Cleared: ${habit.name} (${streakBefore + 1}-day streak ×${result.streakMultiplier})`,
  }, at);

  const bonuses: string[] = [];
  const nowPerfect = isPerfectDay(activeIds, [...doneTodayBefore, habit.id]);
  if (isToday && nowPerfect && !wasPerfect) {
    await ps.addEntry({ habitId: null, type: 'combo', amount: settings.perfectDayBonus, reason: 'Perfect Day bonus' });
    bonuses.push(`PERFECT DAY +${settings.perfectDayBonus}`);
    const run = perfectRunBefore + 1;
    if (run === 3) {
      await ps.addEntry({ habitId: null, type: 'combo', amount: settings.onFireBonus, reason: 'On Fire! (3 perfect days)' });
      bonuses.push(`ON FIRE +${settings.onFireBonus}`);
    } else if (run === 7) {
      await ps.addEntry({ habitId: null, type: 'combo', amount: settings.unstoppableBonus, reason: 'Unstoppable! (7 perfect days)' });
      bonuses.push(`UNSTOPPABLE +${settings.unstoppableBonus}`);
    }
  }

  // Goal-length quests archive themselves when the goal is reached
  // (getCompletionCount reads live state, so it already includes the completion added above)
  if (habit.totalDays && hs.getCompletionCount(habit.id) >= habit.totalDays) {
    await hs.archiveHabit(habit.id);
    const bonus = habit.pointsPerCompletion * 2;
    await ps.addEntry({ habitId: null, type: 'combo', amount: bonus, reason: `Quest complete: ${habit.name}!` });
    bonuses.push(`QUEST COMPLETE +${bonus}`);
  }

  // Celebrations (only for live completions, not a backdated timer session)
  if (isToday) {
    const after = useHabitStore.getState().getStreakState(habit.id);
    playFx({
      kind: 'cleared',
      title: habit.name,
      points: result.total,
      streak: after.streak,
      bonuses,
      freezeEarned: after.freezes > before.freezes,
      avoid: habit.scheduleType === 'avoid',
    });
    const levelAfter = levelOf(usePointStore.getState().lifetimePoints);
    if (levelAfter > levelBefore) {
      playFx({ kind: 'levelup', level: levelAfter, rankFrom: rankFor(levelBefore).rank, rankTo: rankFor(levelAfter).rank });
    }
  }

  return { points: result.total, streak: streakBefore + 1, bonuses };
}

/** Avoid-habit check-in answered "I slipped": no credit today; the reminder is cleared. */
export function logSlip(habit: Habit) {
  SystemGuard.markHandled(habit.id);
  playFx({ kind: 'slip', name: habit.name, freezes: useHabitStore.getState().getStreakState(habit.id).freezes });
}
