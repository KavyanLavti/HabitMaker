import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;
let _dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  if (!_dbPromise) {
    _dbPromise = SQLite.openDatabaseAsync('habitforge.db').then(async (db) => {
      await initSchema(db);
      _db = db;
      return db;
    });
  }
  return _dbPromise;
}

async function initSchema(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      urgencyLevel INTEGER NOT NULL DEFAULT 1,
      pointsPerCompletion REAL NOT NULL DEFAULT 10,
      dailyDurationMinutes INTEGER NOT NULL DEFAULT 30,
      scheduledTime TEXT,
      totalDays INTEGER,
      isDaily INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      archivedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS habit_completions (
      id TEXT PRIMARY KEY,
      habitId TEXT NOT NULL,
      completedAt TEXT NOT NULL,
      durationMinutes REAL NOT NULL DEFAULT 0,
      timerUsed INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (habitId) REFERENCES habits(id)
    );

    CREATE TABLE IF NOT EXISTS point_ledger (
      id TEXT PRIMARY KEY,
      habitId TEXT,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rewards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pointCost REAL NOT NULL,
      isSuperPrize INTEGER NOT NULL DEFAULT 0,
      requiredCharacterLevel INTEGER,
      claimed INTEGER NOT NULL DEFAULT 0,
      claimedAt TEXT,
      isRegular INTEGER NOT NULL DEFAULT 0,
      iconUri TEXT
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Migrate older DBs that may be missing columns
  try { await db.execAsync('ALTER TABLE rewards ADD COLUMN isRegular INTEGER NOT NULL DEFAULT 0'); } catch {}
  try { await db.execAsync('ALTER TABLE rewards ADD COLUMN iconUri TEXT'); } catch {}

  // Seed default data on first launch
  const seeded = await db.getFirstAsync<{ value: string }>("SELECT value FROM app_meta WHERE key='seeded'");
  if (!seeded) {
    await seedData(db);
    await db.runAsync("INSERT INTO app_meta (key,value) VALUES ('seeded','1')");
  }
}

function newId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function seedData(db: SQLite.SQLiteDatabase) {
  const now = new Date().toISOString();
  const habits = [
    { id: newId(), name: 'Morning Workout', urgencyLevel: 3, pointsPerCompletion: 30, dailyDurationMinutes: 30, scheduledTime: '07:00', totalDays: 30, isDaily: 1 },
    { id: newId(), name: 'Read a Book', urgencyLevel: 2, pointsPerCompletion: 20, dailyDurationMinutes: 20, scheduledTime: '21:00', totalDays: null, isDaily: 1 },
    { id: newId(), name: 'Meditation', urgencyLevel: 2, pointsPerCompletion: 15, dailyDurationMinutes: 10, scheduledTime: '08:00', totalDays: null, isDaily: 1 },
    { id: newId(), name: 'Cold Shower', urgencyLevel: 4, pointsPerCompletion: 25, dailyDurationMinutes: 5, scheduledTime: null, totalDays: 21, isDaily: 1 },
    { id: newId(), name: 'Learn Something New', urgencyLevel: 1, pointsPerCompletion: 10, dailyDurationMinutes: 15, scheduledTime: null, totalDays: null, isDaily: 1 },
  ];
  for (const h of habits) {
    await db.runAsync(
      `INSERT OR IGNORE INTO habits (id,name,urgencyLevel,pointsPerCompletion,dailyDurationMinutes,scheduledTime,totalDays,isDaily,createdAt,archivedAt)
       VALUES (?,?,?,?,?,?,?,?,?,NULL)`,
      [h.id, h.name, h.urgencyLevel, h.pointsPerCompletion, h.dailyDurationMinutes, h.scheduledTime, h.totalDays, h.isDaily, now]
    );
  }

  const rewards = [
    { id: newId(), name: 'Netflix Night', pointCost: 100, isSuperPrize: 0, isRegular: 1, requiredLevel: null },
    { id: newId(), name: 'Takeout Meal', pointCost: 150, isSuperPrize: 0, isRegular: 1, requiredLevel: null },
    { id: newId(), name: 'New Game / App', pointCost: 300, isSuperPrize: 0, isRegular: 0, requiredLevel: 3 },
    { id: newId(), name: 'Weekend Trip', pointCost: 1000, isSuperPrize: 1, isRegular: 0, requiredLevel: 5 },
    { id: newId(), name: 'New Sneakers', pointCost: 500, isSuperPrize: 1, isRegular: 0, requiredLevel: null },
    { id: newId(), name: 'Concert Ticket', pointCost: 750, isSuperPrize: 1, isRegular: 0, requiredLevel: 4 },
  ];
  for (const r of rewards) {
    await db.runAsync(
      `INSERT OR IGNORE INTO rewards (id,name,pointCost,isSuperPrize,requiredCharacterLevel,claimed,claimedAt,isRegular,iconUri)
       VALUES (?,?,?,?,?,0,NULL,?,NULL)`,
      [r.id, r.name, r.pointCost, r.isSuperPrize, r.requiredLevel, r.isRegular]
    );
  }
}

export async function runQuery<T = unknown>(
  sql: string,
  params: (string | number | null)[] = []
): Promise<T[]> {
  const db = await getDb();
  return db.getAllAsync<T>(sql, params);
}

export async function runMutation(
  sql: string,
  params: (string | number | null)[] = []
): Promise<SQLite.SQLiteRunResult> {
  const db = await getDb();
  return db.runAsync(sql, params);
}
