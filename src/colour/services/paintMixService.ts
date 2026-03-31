import { RGB } from '../ui/types';

export function munsellXYZDistance(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function linearizeChannel(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function delinearizeChannel(v: number): number {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(c * 255)));
}

/**
 * Mixes two paints using geometric mean in linear light space.
 * Approximates Kubelka-Munk subtractive mixing from RGB values alone.
 * @param a - First paint RGB
 * @param b - Second paint RGB
 * @param ratioA - Proportion of paint A (0.0 to 1.0)
 */
export function mixPaints(a: RGB, b: RGB, ratioA: number): RGB {
  const mix = (ca: number, cb: number): number => {
    const la = Math.max(linearizeChannel(ca), 1e-6);
    const lb = Math.max(linearizeChannel(cb), 1e-6);
    return delinearizeChannel(Math.pow(la, ratioA) * Math.pow(lb, 1 - ratioA));
  };
  return { r: mix(a.r, b.r), g: mix(a.g, b.g), b: mix(a.b, b.b) };
}

export interface MixSuggestion {
  idA: string;
  idB: string;
  ratio: number;
  distance: number;
}

/**
 * Brute-force search across all pairs of paints at 3 ratio steps to find
 * the combination whose mix result is perceptually closest to the goal XYZ.
 * @param paints - Available paints with precomputed XYZ coordinates
 * @param goalCoordinate - Target colour's Munsell XYZ coordinate
 * @param xyzOf - Callback to compute XYZ for a given mixed RGB
 */
export function findBestMix(
  paints: Array<{ id: string; rgb: RGB }>,
  goalCoordinate: { x: number; y: number; z: number },
  xyzOf: (rgb: RGB) => { x: number; y: number; z: number }
): MixSuggestion | null {
  if (paints.length < 2) return null;
  const ratios = [0.25, 0.5, 0.75];
  let best: MixSuggestion | null = null;
  for (let i = 0; i < paints.length; i++) {
    for (let j = i + 1; j < paints.length; j++) {
      for (const ratio of ratios) {
        const mixed = mixPaints(paints[i].rgb, paints[j].rgb, ratio);
        const d = munsellXYZDistance(xyzOf(mixed), goalCoordinate);
        if (!best || d < best.distance) {
          best = { idA: paints[i].id, idB: paints[j].id, ratio, distance: d };
        }
      }
    }
  }
  return best;
}
