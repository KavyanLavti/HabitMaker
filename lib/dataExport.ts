import { runQuery, getDb } from './db';

export interface AppBackup {
  version: 2 | 3;
  exportedAt: string;
  habits: any[];
  completions: any[];
  pointLedger: any[];
  rewards: any[];
  /** v3+: gate rules, bank and other app_meta keys */
  meta?: { key: string; value: string }[];
  /** v3+ */
  screenTimeGrants?: any[];
  settings?: any; // Zustand-persisted settings blob passed in by the caller
}

export async function buildBackup(settingsBlob?: any): Promise<AppBackup> {
  const [habits, completions, ledger, rewards, meta, grants] = await Promise.all([
    runQuery('SELECT * FROM habits ORDER BY createdAt ASC'),
    runQuery('SELECT * FROM habit_completions ORDER BY completedAt ASC'),
    runQuery('SELECT * FROM point_ledger ORDER BY createdAt ASC'),
    runQuery('SELECT * FROM rewards ORDER BY id ASC'),
    runQuery<{ key: string; value: string }>('SELECT * FROM app_meta ORDER BY key ASC'),
    runQuery('SELECT * FROM screen_time_grants ORDER BY createdAt ASC'),
  ]);
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    habits,
    completions,
    pointLedger: ledger,
    rewards,
    meta,
    screenTimeGrants: grants,
    settings: settingsBlob,
  };
}

export async function buildBackupJson(settingsBlob?: any): Promise<string> {
  return JSON.stringify(await buildBackup(settingsBlob), null, 2);
}

export async function restoreFromBackup(jsonString: string): Promise<AppBackup> {
  const backup: AppBackup = JSON.parse(jsonString);
  if (!backup.habits || !backup.completions || !backup.pointLedger) {
    throw new Error('Invalid backup file — missing required fields.');
  }

  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM point_ledger;
      DELETE FROM habit_completions;
      DELETE FROM rewards;
      DELETE FROM habits;
      DELETE FROM screen_time_grants;
    `);

    for (const h of backup.habits) {
      await db.runAsync(
        `INSERT OR IGNORE INTO habits
           (id,name,urgencyLevel,pointsPerCompletion,dailyDurationMinutes,
            scheduledTime,totalDays,isDaily,createdAt,archivedAt,scheduleType,windowEnd,deletedAt)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [h.id, h.name, h.urgencyLevel, h.pointsPerCompletion,
         h.dailyDurationMinutes, h.scheduledTime ?? null, h.totalDays ?? null,
         h.isDaily ? 1 : 0, h.createdAt, h.archivedAt ?? null,
         h.scheduleType ?? (h.scheduledTime ? 'fixed' : 'anytime'), h.windowEnd ?? null, h.deletedAt ?? null]
      );
    }

    for (const c of backup.completions) {
      await db.runAsync(
        `INSERT OR IGNORE INTO habit_completions (id,habitId,completedAt,durationMinutes,timerUsed) VALUES (?,?,?,?,?)`,
        [c.id, c.habitId, c.completedAt, c.durationMinutes, c.timerUsed ? 1 : 0]
      );
    }

    for (const l of backup.pointLedger) {
      await db.runAsync(
        `INSERT OR IGNORE INTO point_ledger (id,habitId,type,amount,reason,createdAt) VALUES (?,?,?,?,?,?)`,
        [l.id, l.habitId ?? null, l.type, l.amount, l.reason, l.createdAt]
      );
    }

    for (const r of backup.rewards ?? []) {
      await db.runAsync(
        `INSERT OR IGNORE INTO rewards
           (id,name,pointCost,isSuperPrize,requiredCharacterLevel,claimed,claimedAt,isRegular,iconUri)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [r.id, r.name, r.pointCost, r.isSuperPrize ? 1 : 0,
         r.requiredCharacterLevel ?? null, r.claimed ? 1 : 0,
         r.claimedAt ?? null, r.isRegular ? 1 : 0, r.iconUri ?? null]
      );
    }

    for (const g of backup.screenTimeGrants ?? []) {
      await db.runAsync(
        `INSERT OR IGNORE INTO screen_time_grants (id,date,packageName,minutes,source,createdAt) VALUES (?,?,?,?,?,?)`,
        [g.id, g.date, g.packageName, g.minutes, g.source, g.createdAt]
      );
    }

    // Restore gate rules / bank, but keep this device's own bookkeeping (seeded flag, last-backup info)
    for (const m of backup.meta ?? []) {
      if (m.key === 'seeded' || m.key.startsWith('backup_')) continue;
      await db.runAsync('INSERT OR REPLACE INTO app_meta (key,value) VALUES (?,?)', [m.key, m.value]);
    }
  });

  return backup;
}
