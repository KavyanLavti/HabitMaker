import { create } from 'zustand';
import { runQuery, runMutation, getMeta, setMeta, newId } from '@/lib/db';
import { todayKey, addDaysKey } from '@/lib/dates';
import {
  GateRules, defaultGateRules, PACK_MINUTES, rollBank, splitRulesChange, unusedEarnedMinutes,
} from '@/lib/gate';
import { SystemGuard } from '@/modules/system-guard';
import { usePointStore } from '@/store/pointStore';

type Source = 'points' | 'bank';

interface GateStore {
  loaded: boolean;
  rules: GateRules;
  /** A loosening change waiting for `pendingFrom`. */
  pending: GateRules | null;
  pendingFrom: string | null;
  bank: number;
  /** Earned minutes granted today, by package. */
  todayGrants: Record<string, number>;
  /** Milliseconds used today, by package (read from the native tracker). */
  usage: Record<string, number>;

  load: () => Promise<void>;
  refreshUsage: () => void;
  saveRules: (next: GateRules) => Promise<'now' | 'tomorrow'>;
  buyPack: (pkg: string, source: Source) => Promise<string | null>;
}

const K = {
  rules: 'gate_rules',
  pending: 'gate_pending',
  pendingFrom: 'gate_pending_from',
  bank: 'gate_bank',
  bankThrough: 'gate_bank_through', // last day already rolled into the bank
};

async function grantsFor(date: string): Promise<Record<string, number>> {
  const rows = await runQuery<{ packageName: string; minutes: number }>(
    'SELECT packageName, SUM(minutes) AS minutes FROM screen_time_grants WHERE date=? GROUP BY packageName',
    [date]
  );
  return Object.fromEntries(rows.map((r) => [r.packageName, r.minutes]));
}

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export const useGateStore = create<GateStore>((set, get) => {
  /** Pushes today's allowance to the native gate. Called after every change. */
  function syncNative() {
    const { rules, todayGrants } = get();
    SystemGuard.setGateConfig({
      date: todayKey(),
      enabled: rules.enabled,
      baseMinutes: rules.baseMinutes,
      apps: rules.apps.map((a) => ({ pkg: a.pkg, label: a.label, extraMinutes: todayGrants[a.pkg] ?? 0 })),
    });
  }

  return {
    loaded: false,
    rules: defaultGateRules,
    pending: null,
    pendingFrom: null,
    bank: 0,
    todayGrants: {},
    usage: {},

    load: async () => {
      const today = todayKey();
      let rules = parse<GateRules>(await getMeta(K.rules), defaultGateRules);
      let pending = parse<GateRules | null>(await getMeta(K.pending), null);
      let pendingFrom = await getMeta(K.pendingFrom);

      // Apply a delayed rules change once its day arrives
      if (pending && pendingFrom && pendingFrom <= today) {
        rules = pending;
        pending = null;
        pendingFrom = null;
        await setMeta(K.rules, JSON.stringify(rules));
        await setMeta(K.pending, 'null');
        await setMeta(K.pendingFrom, '');
      }

      // Roll every finished day's unused earned minutes into the bank
      let bank = Number(await getMeta(K.bank)) || 0;
      const yesterday = addDaysKey(today, -1);
      let through = await getMeta(K.bankThrough);
      if (!through) through = yesterday; // first run: nothing to roll
      // The native tracker keeps 14 days, so never look back further than that
      if (through < addDaysKey(today, -14)) through = addDaysKey(today, -14);
      for (let d = addDaysKey(through, 1); d <= yesterday; d = addDaysKey(d, 1)) {
        const unused = unusedEarnedMinutes(await grantsFor(d), SystemGuard.getUsage(d), rules.baseMinutes);
        bank = rollBank(bank, unused);
      }
      await setMeta(K.bank, String(bank));
      await setMeta(K.bankThrough, yesterday);

      set({
        loaded: true,
        rules,
        pending,
        pendingFrom: pendingFrom || null,
        bank,
        todayGrants: await grantsFor(today),
        usage: SystemGuard.getUsage(today),
      });
      syncNative();
    },

    refreshUsage: () => set({ usage: SystemGuard.getUsage(todayKey()) }),

    saveRules: async (next) => {
      const { now, pending } = splitRulesChange(get().rules, next);
      const from = pending ? addDaysKey(todayKey(), 1) : null;
      await setMeta(K.rules, JSON.stringify(now));
      await setMeta(K.pending, JSON.stringify(pending));
      await setMeta(K.pendingFrom, from ?? '');
      set({ rules: now, pending, pendingFrom: from });
      syncNative();
      return pending ? 'tomorrow' : 'now';
    },

    buyPack: async (pkg, source) => {
      const { rules, bank } = get();
      const app = rules.apps.find((a) => a.pkg === pkg);
      if (!app) return 'That app is not on your leisure list.';
      let minutes = PACK_MINUTES;

      if (source === 'points') {
        const points = usePointStore.getState();
        if (points.spendablePoints < rules.pointsPerPack) {
          return `You need ${rules.pointsPerPack} points. Clear more quests first.`;
        }
        await points.addEntry({
          habitId: null,
          type: 'screen_time',
          amount: -rules.pointsPerPack,
          reason: `Gate: +${PACK_MINUTES} min ${app.label}`,
        });
      } else {
        if (bank <= 0) return 'Your bank is empty.';
        minutes = Math.min(PACK_MINUTES, bank);
        await setMeta(K.bank, String(bank - minutes));
        set({ bank: bank - minutes });
      }

      const today = todayKey();
      await runMutation(
        'INSERT INTO screen_time_grants (id,date,packageName,minutes,source,createdAt) VALUES (?,?,?,?,?,?)',
        [newId(), today, pkg, minutes, source, new Date().toISOString()]
      );
      set({ todayGrants: await grantsFor(today) });
      syncNative();
      return null;
    },
  };
});
