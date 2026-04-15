import mixbox from 'mixbox';
import { RGB } from '../ui/types';

/**
 * Computes the Euclidean distance between two points in Munsell XYZ space.
 * @param a - First XYZ coordinate
 * @param b - Second XYZ coordinate
 * @returns Euclidean distance between the two points
 */
export function munsellXYZDistance(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Mixes two paints using mixbox pigment-based mixing, which produces
 * more realistic results than linear RGB blending (e.g. blue + yellow = green).
 * @param a - First paint RGB (each channel 0–255)
 * @param b - Second paint RGB (each channel 0–255)
 * @param ratioA - Proportion of paint A (0.0 to 1.0); ratioA=1 returns pure A
 * @returns Mixed RGB colour
 */
export function mixPaints(a: RGB, b: RGB, ratioA: number): RGB {
  const t = 1 - ratioA;
  const [r, g, b_] = mixbox.lerp([a.r, a.g, a.b], [b.r, b.g, b.b], t);
  return { r: r, g: g, b: b_ };
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
