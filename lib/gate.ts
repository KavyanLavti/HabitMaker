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
 * Minutes left over on a day, summed over the gated apps: each app's free allowance plus anything
 * bought or drawn from the bank for it, minus what was actually used. An app never opened gives its
 * whole allowance. Going over on one app never eats another app's leftovers.
 */
export function unusedMinutes(
  appPkgs: string[],
  grantedByPkg: Record<string, number>,
  usedMsByPkg: Record<string, number>,
  baseMinutes: number
): number {
  const pkgs = new Set([...appPkgs, ...Object.keys(grantedByPkg)]);
  let total = 0;
  for (const pkg of pkgs) {
    const allowance = (appPkgs.includes(pkg) ? baseMinutes : 0) + (grantedByPkg[pkg] ?? 0);
    const usedMin = (usedMsByPkg[pkg] ?? 0) / 60000;
    total += Math.max(0, allowance - usedMin);
  }
  return Math.floor(total);
}

/** Unused minutes (free + earned) roll into the bank, which holds at most BANK_CAP_MINUTES. The rest expire. */
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
