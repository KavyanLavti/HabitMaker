import { runQuery, getDb } from './db';

export interface AppBackup {
  version: 2;
  exportedAt: string;
  habits: any[];
  completions: any[];
  pointLedger: any[];
  rewards: any[];
  settings?: any; // Zustand-persisted settings blob passed in by the caller
}

export async function buildBackupJson(settingsBlob?: any): Promise<string> {
  const [habits, completions, ledger, rewards] = await Promise.all([
    runQuery('SELECT * FROM habits ORDER BY createdAt ASC'),
    runQuery('SELECT * FROM habit_completions ORDER BY completedAt ASC'),
    runQuery('SELECT * FROM point_ledger ORDER BY createdAt ASC'),
    runQuery('SELECT * FROM rewards ORDER BY id ASC'),
  ]);

  const backup: AppBackup = {
    version: 2,
    exportedAt: new Date().toISOString(),
    habits,
    completions,
    pointLedger: ledger,
    rewards,
    settings: settingsBlob,
  };

  return JSON.stringify(backup, null, 2);
}

export async function restoreFromBackup(jsonString: string): Promise<void> {
  const backup: AppBackup = JSON.parse(jsonString);
  if (!backup.habits || !backup.completions || !backup.pointLedger) {
    throw new Error('Invalid backup file — missing required fields.');
  }

  const db = await getDb();

  // Wipe existing data (completions before habits due to FK)
  await db.execAsync(`
    DELETE FROM point_ledger;
    DELETE FROM habit_completions;
    DELETE FROM rewards;
    DELETE FROM habits;
  `);

  for (const h of backup.habits) {
    await db.runAsync(
      `INSERT OR IGNORE INTO habits
         (id,name,urgencyLevel,pointsPerCompletion,dailyDurationMinutes,
          scheduledTime,totalDays,isDaily,createdAt,archivedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [h.id, h.name, h.urgencyLevel, h.pointsPerCompletion,
       h.dailyDurationMinutes, h.scheduledTime ?? null, h.totalDays ?? null,
       h.isDaily, h.createdAt, h.archivedAt ?? null]
    );
  }

  for (const c of backup.completions) {
    await db.runAsync(
      `INSERT OR IGNORE INTO habit_completions
         (id,habitId,completedAt,durationMinutes,timerUsed)
       VALUES (?,?,?,?,?)`,
      [c.id, c.habitId, c.completedAt, c.durationMinutes, c.timerUsed ?? 0]
    );
  }

  for (const l of backup.pointLedger) {
    await db.runAsync(
      `INSERT OR IGNORE INTO point_ledger
         (id,habitId,type,amount,reason,createdAt)
       VALUES (?,?,?,?,?,?)`,
      [l.id, l.habitId ?? null, l.type, l.amount, l.reason, l.createdAt]
    );
  }

  for (const r of backup.rewards) {
    await db.runAsync(
      `INSERT OR IGNORE INTO rewards
         (id,name,pointCost,isSuperPrize,requiredCharacterLevel,claimed,claimedAt,isRegular,iconUri)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [r.id, r.name, r.pointCost, r.isSuperPrize ?? 0,
       r.requiredCharacterLevel ?? null, r.claimed ?? 0,
       r.claimedAt ?? null, r.isRegular ?? 0, r.iconUri ?? null]
    );
  }
}
