// Pure rules for the leisure-app gate. No React / storage imports so this can be unit tested.

export const PACK_MINUTES = 5;
export const BANK_CAP_MINUTES = 30;

export interface GateApp {
  pkg: string;
  label: string;
}

export interface GateRules {
  enabled: boolean;
  /** Free minutes per leisure app per day. */
  baseMinutes: number;
  /** Points for one 5-minute pack. */
  pointsPerPack: number;
  apps: GateApp[];
}

export const defaultGateRules: GateRules = {
  enabled: true,
  baseMinutes: 15,
  pointsPerPack: 20,
  apps: [],
};

/**
 * Earned minutes (bought or drawn from the bank) that went unused on a day, summed over apps.
 * Usage eats the free base allowance first, then earned minutes.
 */
export function unusedEarnedMinutes(
  grantedByPkg: Record<string, number>,
  usedMsByPkg: Record<string, number>,
  baseMinutes: number
): number {
  let total = 0;
  for (const [pkg, granted] of Object.entries(grantedByPkg)) {
    const usedMin = (usedMsByPkg[pkg] ?? 0) / 60000;
    const usedFromEarned = Math.max(0, usedMin - baseMinutes);
    total += Math.max(0, granted - usedFromEarned);
  }
  return Math.floor(total);
}

/** Unused earned minutes roll into the bank, which holds at most BANK_CAP_MINUTES. The rest expire. */
export function rollBank(bank: number, unused: number): number {
  return Math.min(BANK_CAP_MINUTES, bank + Math.max(0, unused));
}

/**
 * Splits a rules change into what applies now and what waits until tomorrow.
 * Tightening (more apps, less free time, pricier packs, turning the gate on) is immediate.
 * Loosening is delayed a day, so the gate can't be opened on impulse from Settings.
 */
export function splitRulesChange(active: GateRules, next: GateRules): { now: GateRules; pending: GateRules | null } {
  const nextPkgs = new Set(next.apps.map((a) => a.pkg));
  const now: GateRules = {
    enabled: active.enabled || next.enabled,
    baseMinutes: Math.min(active.baseMinutes, next.baseMinutes),
    pointsPerPack: Math.max(active.pointsPerPack, next.pointsPerPack),
    apps: [...active.apps, ...next.apps.filter((a) => !active.apps.some((b) => b.pkg === a.pkg))],
  };
  const same =
    now.enabled === next.enabled &&
    now.baseMinutes === next.baseMinutes &&
    now.pointsPerPack === next.pointsPerPack &&
    now.apps.length === next.apps.length &&
    now.apps.every((a) => nextPkgs.has(a.pkg));
  return { now, pending: same ? null : next };
}
