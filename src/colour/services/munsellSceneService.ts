import { ColourPoint } from "../models/colourPoint";
import { Vec3 } from "./munsellToXYZ";
import { SRGB } from "./colourConversion";

export interface ScenePoint {
  id: string;
  name: string;
  brand: string;
  position: Vec3;
  color: SRGB;
}

/**
 * Maps an array of ColourPoints to ScenePoint data for 3D rendering.
 * Extracts the pre-computed XYZ coordinate and RGB values from each ColourPoint.
 * @param colours - Array of ColourPoint domain objects
 * @returns Array of ScenePoint objects ready for 3D scene construction
 */
export function buildScenePoints(colours: ColourPoint[]): ScenePoint[] {
  return colours.map((c) => ({
    id: c.id,
    name: c.name,
    brand: c.brand,
    position: c.coordinate,
    color: c.rgb,
  }));
}

/**
 * Filters ColourPoints by a set of selected brand names.
 * When the brands set is empty, all colours are returned (no filter applied).
 * @param colours - Array of ColourPoint domain objects to filter
 * @param brands - Set of brand names to include; empty set means show all
 * @returns Filtered array of ColourPoints matching the selected brands
 */
export function filterByBrands(
  colours: ColourPoint[],
  brands: Set<string>
): ColourPoint[] {
  if (brands.size === 0) return colours;
  return colours.filter((c) => brands.has(c.brand));
}

/**
 * Converts spherical coordinates (theta, phi, radius) to Cartesian (x, y, z).
 * Uses the convention: theta = azimuth (horizontal), phi = elevation (vertical).
 * @param theta - Azimuth angle in radians (horizontal rotation around Y axis)
 * @param phi - Elevation angle in radians (vertical angle from the XZ plane)
 * @param radius - Distance from the origin
 * @returns Cartesian {x, y, z} position
 */
export function sphericalToCartesian(
  theta: number,
  phi: number,
  radius: number
): Vec3 {
  const x = radius * Math.cos(phi) * Math.sin(theta);
  const y = radius * Math.sin(phi);
  const z = radius * Math.cos(phi) * Math.cos(theta);
  return { x, y, z };
}

/**
 * Converts screen-space tap coordinates to Normalized Device Coordinates (NDC)
 * for use with Three.js raycasting. NDC range is [-1, 1] on both axes.
 * @param screenX - X position in screen pixels
 * @param screenY - Y position in screen pixels
 * @param width - Total viewport width in pixels
 * @param height - Total viewport height in pixels
 * @returns Normalized device coordinates {x, y} in [-1, 1] range
 */
export function screenToNDC(
  screenX: number,
  screenY: number,
  width: number,
  height: number
): { x: number; y: number } {
  return {
    x: (screenX / width) * 2 - 1,
    y: -(screenY / height) * 2 + 1,
  };
}
