import { create } from 'zustand';
import { runQuery, runMutation } from '@/lib/db';

export interface LedgerEntry {
  id: string;
  habitId: string | null;
  type: 'earn' | 'bonus' | 'penalty' | 'reward_claim' | 'combo';
  amount: number;
  reason: string;
  createdAt: string;
}

interface PointStore {
  spendablePoints: number;
  lifetimePoints: number;
  ledger: LedgerEntry[];
  loaded: boolean;
  loadPoints: () => Promise<void>;
  addEntry: (entry: Omit<LedgerEntry, 'id' | 'createdAt'>) => Promise<void>;
  getLevel: (pointsPerLevel: number) => number;
  getLevelProgress: (pointsPerLevel: number) => number;
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const usePointStore = create<PointStore>((set, get) => ({
  spendablePoints: 0,
  lifetimePoints: 0,
  ledger: [],
  loaded: false,

  loadPoints: async () => {
    const ledger = await runQuery<LedgerEntry>(
      'SELECT * FROM point_ledger ORDER BY createdAt DESC'
    );
    const spendable = ledger.reduce((sum, e) => sum + e.amount, 0);
    const lifetime = ledger
      .filter((e) => e.amount > 0)
      .reduce((sum, e) => sum + e.amount, 0);
    set({ ledger, spendablePoints: Math.max(0, spendable), lifetimePoints: lifetime, loaded: true });
  },

  addEntry: async (data) => {
    const entry: LedgerEntry = {
      ...data,
      id: uuid(),
      createdAt: new Date().toISOString(),
    };
    await runMutation(
      `INSERT INTO point_ledger (id,habitId,type,amount,reason,createdAt)
       VALUES (?,?,?,?,?,?)`,
      [entry.id, entry.habitId, entry.type, entry.amount, entry.reason, entry.createdAt]
    );
    set((s) => {
      const newSpendable = Math.max(0, s.spendablePoints + entry.amount);
      const newLifetime = entry.amount > 0 ? s.lifetimePoints + entry.amount : s.lifetimePoints;
      return {
        ledger: [entry, ...s.ledger],
        spendablePoints: newSpendable,
        lifetimePoints: newLifetime,
      };
    });
  },

  getLevel: (pointsPerLevel) => Math.floor(get().lifetimePoints / pointsPerLevel) + 1,
  getLevelProgress: (pointsPerLevel) => (get().lifetimePoints % pointsPerLevel) / pointsPerLevel,
}));
