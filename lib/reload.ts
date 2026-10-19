import { useHabitStore } from '@/store/habitStore';
import { usePointStore } from '@/store/pointStore';
import { useRewardStore } from '@/store/rewardStore';
import { useGateStore } from '@/store/gateStore';

/** Re-reads every store from the active database. Gate load also applies day rollover (bank, pending rules). */
export async function reloadAll() {
  await useHabitStore.getState().loadAll();
  await Promise.all([
    usePointStore.getState().loadPoints(),
    useRewardStore.getState().loadRewards(),
    useGateStore.getState().load(),
  ]);
}
