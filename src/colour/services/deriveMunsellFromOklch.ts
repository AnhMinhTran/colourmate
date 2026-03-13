import { clamp } from "@texel/color";

export type OKLCHColour = {
  l: number; // 0..1
  c: number; // >= 0
  h: number; // degrees (may be NaN for neutrals depending on source)
};

export type MunsellLike = {
  hueDeg: number;  // 0..360
  value: number;   // 0..100
  chroma: number;  // 0..100
};

export type DeriveOptions = {
  /** Chroma scaling factor: OKLCH c at this value maps to chroma=100 */
  cMax?: number;

  /** Treat colors with very small chroma as neutral (hue unstable/meaningless) */
  neutralChromaThreshold?: number;

  /** Hue to use when color is neutral (defaults to 0) */
  neutralHueFallbackDeg?: number;
};

export function wrapDeg(deg: number): number {
  // Normalize to [0, 360]
  const x = deg % 360;
  return x < 0 ? x + 360 : x;
}

/**
 * Derives Munsell-like attributes (hue/value/chroma) from OKLCH.
 * Pure function, deterministic, UI-agnostic.
 */
export function deriveMunsellLikeFromOKLCH(
  oklch: OKLCHColour,
  options: DeriveOptions = {}
): MunsellLike {
  const {
    cMax = 0.35,
    neutralChromaThreshold = 0.002,
    neutralHueFallbackDeg = 0,
  } = options;

  // Value: L (0..1) → 0..100
  const value = clamp(oklch.l * 100, 0, 100);

  // Chroma: normalize C with a tunable max and clamp to 0..100
  // NOTE: OKLCH c isn't naturally bounded, so you choose cMax as a design constant.
  const chroma = clamp((Math.max(0, oklch.c) / cMax) * 100, 0, 100);

  // Hue: for near-neutrals, hue can be NaN or unstable. Provide a fallback.
  const isNeutral =
    !Number.isFinite(oklch.h) || Math.max(0, oklch.c) <= neutralChromaThreshold;

  const hueDeg = isNeutral ? neutralHueFallbackDeg : wrapDeg(oklch.h);

  return { hueDeg, value, chroma };
}
