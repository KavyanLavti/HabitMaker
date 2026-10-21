import { useHabitStore } from '@/store/habitStore';
import { usePointStore } from '@/store/pointStore';
import { useRewardStore } from '@/store/rewardStore';
import { useGateStore } from '@/store/gateStore';
import { useGymStore } from '@/store/gymStore';
import { useScheduleStore } from '@/store/scheduleStore';
import { announceNewFreezes } from './freezeWatch';

/**
 * Re-reads every store from the active database. Gate load also applies day rollover (bank, pending rules);
 * schedule load refreshes calendar events and conflicts. Afterwards, any freeze spent overnight is announced.
 */
export async function reloadAll() {
  await useHabitStore.getState().loadAll();
  await Promise.all([
    usePointStore.getState().loadPoints(),
    useRewardStore.getState().loadRewards(),
    useGateStore.getState().load(),
    useGymStore.getState().loadGym(),
  ]);
  await useScheduleStore.getState().refresh();
  await announceNewFreezes();
}
