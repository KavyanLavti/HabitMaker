// HabitForge "System" theme — Solo Leveling inspired.
// Every screen pulls colours, fonts and spacing from here. Do not hardcode hex values in screens.

export const Colors = {
  background: '#04060C',
  surface: '#0A1020',
  surfaceHigh: '#111A2E',
  surfaceGlass: 'rgba(12, 22, 44, 0.88)',
  border: '#1B2B4A',
  borderBright: '#2E5C9A',

  // System blue: the glowing quest-window colour
  system: '#38B6FF',
  systemGlow: '#5CC8FF',
  systemDim: '#1A4F7A',

  // Shadow-monarch purple: levels, ranks, power
  shadow: '#9B5CFF',
  shadowDim: '#3B2370',

  // Ember: streaks and fire
  ember: '#FF6A2B',
  emberGlow: '#FF9A3C',

  frost: '#7FE3FF', // streak freezes
  gold: '#FFC93C',
  danger: '#FF3355',
  dangerDim: '#5A1222',
  success: '#2EE6A6',

  textPrimary: '#E8F2FF',
  textSecondary: '#A9BCD9',
  textMuted: '#62738F',
} as const;

export const Fonts = {
  display: 'Oxanium_700Bold',
  displaySemi: 'Oxanium_600SemiBold',
  body: 'Exo2_400Regular',
  bodyMedium: 'Exo2_500Medium',
  bodyBold: 'Exo2_700Bold',
} as const;

export const Space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const Radius = { sm: 4, md: 8, lg: 12 } as const;

/** Soft outer glow. Android renders elevation shadows in the given colour on API 28+. */
export function glow(color: string, strength: 'soft' | 'strong' = 'soft') {
  const strong = strength === 'strong';
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: strong ? 0.9 : 0.55,
    shadowRadius: strong ? 16 : 10,
    elevation: strong ? 12 : 6,
  };
}

// Hunter ranks by level, E → S, then National Level.
const RANKS = [
  { min: 60, rank: 'NL', title: 'National Level Hunter', color: Colors.gold },
  { min: 45, rank: 'S', title: 'S-Rank Hunter', color: Colors.gold },
  { min: 32, rank: 'A', title: 'A-Rank Hunter', color: Colors.ember },
  { min: 20, rank: 'B', title: 'B-Rank Hunter', color: Colors.shadow },
  { min: 10, rank: 'C', title: 'C-Rank Hunter', color: Colors.system },
  { min: 5, rank: 'D', title: 'D-Rank Hunter', color: Colors.success },
  { min: 1, rank: 'E', title: 'E-Rank Hunter', color: Colors.textSecondary },
];

export function rankFor(level: number) {
  return RANKS.find((r) => level >= r.min) ?? RANKS[RANKS.length - 1];
}

export const URGENCY = {
  1: { label: 'LOW', color: Colors.textMuted },
  2: { label: 'MED', color: Colors.system },
  3: { label: 'HIGH', color: Colors.ember },
  4: { label: 'MAX', color: Colors.danger },
} as const;
