/**
 * Warhammer / miniature-game inspired dark theme.
 *
 * Design language: deep charcoal backgrounds, aged-gold accents,
 * warm parchment text, metallic borders.  Colour swatches pop
 * against the dark surfaces the same way paint pots sit on a
 * hobby desk.
 */

import { Platform } from 'react-native';

/* ------------------------------------------------------------------ */
/*  Palette tokens                                                     */
/* ------------------------------------------------------------------ */

/** Near-black charcoal base */
export const BG_PRIMARY = '#121214';
/** Slightly lighter card / surface colour */
export const BG_CARD = '#1E1E22';
/** Subtle card border */
export const BORDER_DEFAULT = '#2A2A30';
/** Elevated surface (modals, sheets) */
export const BG_ELEVATED = '#252528';

/** Aged-gold accent — headers, active states, icons */
export const ACCENT_GOLD = '#C8A84E';
/** Darker gold for pressed / subtle usage */
export const ACCENT_GOLD_DARK = '#8B6914';
/** Muted crimson secondary accent */
export const ACCENT_CRIMSON = '#8B3A3A';
/** Deep purple for mix / creative actions */
export const ACCENT_PURPLE = '#4A2D6B';

/** Warm parchment primary text */
export const TEXT_PRIMARY = '#E8E0D0';
/** Weathered stone secondary text */
export const TEXT_SECONDARY = '#8A8478';
/** Muted label / placeholder text */
export const TEXT_MUTED = '#5A5650';

/** Active / selected background tint (dark amber glow) */
export const BG_ACTIVE = '#2A2518';
/** Info / banner background */
export const BG_INFO = '#1E1B15';
/** Info border */
export const BORDER_INFO = '#C8A84E';

/** Tab bar background */
export const TAB_BAR_BG = '#0D0D0F';

/** Danger / destructive (muted warm red) */
export const DANGER = '#C45C5C';

/** Swatch border — prevents dark paints bleeding into dark cards */
export const SWATCH_BORDER = '#3A3A40';

/* ------------------------------------------------------------------ */
/*  Legacy Colors map (kept for any component that still references it)*/
/* ------------------------------------------------------------------ */

export const Colors = {
  light: {
    text: TEXT_PRIMARY,
    background: BG_PRIMARY,
    tint: ACCENT_GOLD,
    icon: TEXT_SECONDARY,
    tabIconDefault: TEXT_MUTED,
    tabIconSelected: ACCENT_GOLD,
  },
  dark: {
    text: TEXT_PRIMARY,
    background: BG_PRIMARY,
    tint: ACCENT_GOLD,
    icon: TEXT_SECONDARY,
    tabIconDefault: TEXT_MUTED,
    tabIconSelected: ACCENT_GOLD,
  },
};

/* ------------------------------------------------------------------ */
/*  Fonts                                                              */
/* ------------------------------------------------------------------ */

export const Fonts = Platform.select({
  ios: {
    sans: 'Inter',
    serif: 'Cinzel',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'Inter',
    serif: 'Cinzel',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Cinzel, Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
});
