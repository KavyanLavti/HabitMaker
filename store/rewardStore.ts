import { create } from 'zustand';
import { runQuery, runMutation } from '@/lib/db';

export interface Reward {
  id: string;
  name: string;
  pointCost: number;
  isSuperPrize: boolean;
  requiredCharacterLevel: number | null;
  claimed: boolean;
  claimedAt: string | null;
  isRegular: boolean;
  iconUri: string | null;
}

interface RewardStore {
  rewards: Reward[];
  loaded: boolean;
  loadRewards: () => Promise<void>;
  addReward: (r: Omit<Reward, 'id' | 'claimed' | 'claimedAt'>) => Promise<Reward>;
  claimReward: (id: string) => Promise<void>;
  deleteReward: (id: string) => Promise<void>;
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const useRewardStore = create<RewardStore>((set, get) => ({
  rewards: [],
  loaded: false,

  loadRewards: async () => {
    const rows = await runQuery<any>('SELECT * FROM rewards ORDER BY isSuperPrize DESC, pointCost ASC');
    const rewards: Reward[] = rows.map((r) => ({
      ...r,
      isSuperPrize: Boolean(r.isSuperPrize),
      claimed: Boolean(r.claimed),
      isRegular: Boolean(r.isRegular),
      iconUri: r.iconUri ?? null,
    }));
    set({ rewards, loaded: true });
  },

  addReward: async (data) => {
    const reward: Reward = { ...data, id: uuid(), claimed: false, claimedAt: null };
    await runMutation(
      `INSERT INTO rewards (id,name,pointCost,isSuperPrize,requiredCharacterLevel,claimed,claimedAt,isRegular,iconUri)
       VALUES (?,?,?,?,?,0,NULL,?,?)`,
      [
        reward.id, reward.name, reward.pointCost,
        reward.isSuperPrize ? 1 : 0,
        reward.requiredCharacterLevel,
        reward.isRegular ? 1 : 0,
        reward.iconUri,
      ]
    );
    set((s) => ({ rewards: [...s.rewards, reward] }));
    return reward;
  },

  claimReward: async (id) => {
    const claimedAt = new Date().toISOString();
    const reward = get().rewards.find((r) => r.id === id);
    if (!reward) return;

    if (reward.isRegular) {
      // Regular rewards: deduct points but stay available for future claims
      set((s) => ({
        rewards: s.rewards.map((r) => (r.id === id ? { ...r, claimedAt } : r)),
      }));
    } else {
      // One-time rewards: mark claimed and disappear
      await runMutation('UPDATE rewards SET claimed=1, claimedAt=? WHERE id=?', [claimedAt, id]);
      set((s) => ({
        rewards: s.rewards.map((r) => (r.id === id ? { ...r, claimed: true, claimedAt } : r)),
      }));
    }
  },

  deleteReward: async (id) => {
    await runMutation('DELETE FROM rewards WHERE id=?', [id]);
    set((s) => ({ rewards: s.rewards.filter((r) => r.id !== id) }));
  },
}));
