import { create } from 'zustand';
import { runQuery, runMutation, newId as uuid } from '@/lib/db';
import { nowDate } from '@/lib/clock';
import { dateKey, dateKeyOf } from '@/lib/dates';

export interface LedgerEntry {
  id: string;
  habitId: string | null;
  type: 'earn' | 'bonus' | 'penalty' | 'reward_claim' | 'combo' | 'screen_time';
  amount: number;
  reason: string;
  createdAt: string;
  /** Local calendar day the points belong to, "YYYY-MM-DD". */
  date: string;
}

interface PointStore {
  spendablePoints: number;
  lifetimePoints: number;
  ledger: LedgerEntry[];
  loaded: boolean;
  loadPoints: () => Promise<void>;
  /** `at` backdates the entry, e.g. for a timer session finished on a previous day. */
  addEntry: (entry: Omit<LedgerEntry, 'id' | 'createdAt' | 'date'>, at?: Date) => Promise<void>;
  getLevel: (pointsPerLevel: number) => number;
  getLevelProgress: (pointsPerLevel: number) => number;
}

export const usePointStore = create<PointStore>((set, get) => ({
  spendablePoints: 0,
  lifetimePoints: 0,
  ledger: [],
  loaded: false,

  loadPoints: async () => {
    const ledger = (await runQuery<LedgerEntry>('SELECT * FROM point_ledger ORDER BY createdAt DESC'))
      .map((e) => ({ ...e, date: e.date ?? dateKeyOf(e.createdAt) }));
    const spendable = ledger.reduce((sum, e) => sum + e.amount, 0);
    const lifetime = ledger.filter((e) => e.amount > 0).reduce((sum, e) => sum + e.amount, 0);
    set({ ledger, spendablePoints: Math.max(0, spendable), lifetimePoints: lifetime, loaded: true });
  },

  addEntry: async (data, at = nowDate()) => {
    const entry: LedgerEntry = { ...data, id: uuid(), createdAt: at.toISOString(), date: dateKey(at) };
    await runMutation(
      `INSERT INTO point_ledger (id,habitId,type,amount,reason,createdAt,date) VALUES (?,?,?,?,?,?,?)`,
      [entry.id, entry.habitId, entry.type, entry.amount, entry.reason, entry.createdAt, entry.date]
    );
    set((s) => ({
      ledger: [entry, ...s.ledger],
      spendablePoints: Math.max(0, s.spendablePoints + entry.amount),
      lifetimePoints: entry.amount > 0 ? s.lifetimePoints + entry.amount : s.lifetimePoints,
    }));
  },

  getLevel: (pointsPerLevel) => Math.floor(get().lifetimePoints / pointsPerLevel) + 1,
  getLevelProgress: (pointsPerLevel) => (get().lifetimePoints % pointsPerLevel) / pointsPerLevel,
}));
