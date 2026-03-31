import { ColourPoint } from '../models/colourPoint';
import { SRGB, convertSRGBToOKLCH } from './colourConversion';
import { deriveMunsellLikeFromOKLCH } from './deriveMunsellFromOklch';
import { Vec3, munsellLikeToXYZ } from './munsellToXYZ';

// Max possible distance in XYZ space: x∈[-1,1], y∈[0,1], z∈[-1,1] → √(4+1+4) = 3
const MAX_DIST = 3;

export type ColourFilter = {
  search: string;
  brands: Set<string>;
  inInventoryOnly: boolean;
};

export const EMPTY_FILTER: ColourFilter = {
  search: '',
  brands: new Set(),
  inInventoryOnly: false,
};

export function isFilterActive(f: ColourFilter): boolean {
  return f.brands.size > 0 || f.inInventoryOnly;
}

export type ColourMatch = {
  colour: ColourPoint;
  similarity: number; // 0–100
};

export function filterColours(
  colours: ColourPoint[],
  filter: ColourFilter,
  inventoryIds: Set<string>
): ColourPoint[] {
  const q = filter.search.trim().toLowerCase();
  return colours.filter((c) => {
    if (
      q &&
      !c.name.toLowerCase().includes(q) &&
      !c.brand.toLowerCase().includes(q) &&
      !c.tag.some((t) => t.toLowerCase().includes(q))
    )
      return false;
    if (filter.brands.size > 0 && !filter.brands.has(c.brand)) return false;
    if (filter.inInventoryOnly && !inventoryIds.has(c.id)) return false;
    return true;
  });
}

function rgbToCoordinate(rgb: SRGB): Vec3 {
  return munsellLikeToXYZ(deriveMunsellLikeFromOKLCH(convertSRGBToOKLCH(rgb)));
}

function xyzDistance(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function findNearestColours(
  goalRgb: SRGB,
  candidates: ColourPoint[],
  topN = 5
): ColourMatch[] {
  const coord = rgbToCoordinate(goalRgb);
  return candidates
    .map((c) => ({
      colour: c,
      similarity: Math.max(0, (1 - xyzDistance(coord, c.coordinate) / MAX_DIST)) * 100,
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topN);
}
