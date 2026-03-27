import { describe, expect, it, vi } from "vitest";

vi.mock("expo-crypto", () => ({
  randomUUID: vi.fn(() => "test-uuid-1234"),
}));

import { ColourPoint } from "@/src/colour/models/colourPoint";
import {
  buildScenePoints,
  filterByBrands,
  screenToNDC,
  sphericalToCartesian,
} from "@/src/colour/services/munsellSceneService";

function makeColour(overrides: {
  id?: string;
  name?: string;
  brand?: string;
  r?: number;
  g?: number;
  b?: number;
  x?: number;
  y?: number;
  z?: number;
} = {}): ColourPoint {
  return ColourPoint.fromDatabase({
    id: overrides.id ?? "id-1",
    name: overrides.name ?? "Red",
    brand: overrides.brand ?? "Citadel",
    rgb: { r: overrides.r ?? 255, g: overrides.g ?? 0, b: overrides.b ?? 0 },
    oklch: { l: 0.6, c: 0.25, h: 29 },
    coordinate: { x: overrides.x ?? 0.5, y: overrides.y ?? 0.3, z: overrides.z ?? 0.1 },
    tag: ["base"],
  });
}

describe("buildScenePoints", () => {
  it("maps ColourPoints to ScenePoint format", () => {
    const colours = [
      makeColour({ id: "a", name: "Red", brand: "Citadel", r: 200, g: 50, b: 30, x: 1, y: 2, z: 3 }),
      makeColour({ id: "b", name: "Blue", brand: "Vallejo", r: 0, g: 0, b: 255, x: -1, y: 0.5, z: 0 }),
    ];

    const result = buildScenePoints(colours);

    expect(result).toHaveLength(2);

    expect(result[0]).toEqual({
      id: "a",
      name: "Red",
      brand: "Citadel",
      position: { x: 1, y: 2, z: 3 },
      color: { r: 200, g: 50, b: 30 },
    });

    expect(result[1]).toEqual({
      id: "b",
      name: "Blue",
      brand: "Vallejo",
      position: { x: -1, y: 0.5, z: 0 },
      color: { r: 0, g: 0, b: 255 },
    });
  });

  it("returns empty array for empty input", () => {
    expect(buildScenePoints([])).toEqual([]);
  });
});

describe("filterByBrands", () => {
  const colours = [
    makeColour({ id: "1", brand: "Citadel" }),
    makeColour({ id: "2", brand: "Vallejo" }),
    makeColour({ id: "3", brand: "Citadel" }),
    makeColour({ id: "4", brand: "AK" }),
  ];

  it("returns all colours when brands set is empty", () => {
    const result = filterByBrands(colours, new Set());
    expect(result).toHaveLength(4);
  });

  it("filters to a single brand", () => {
    const result = filterByBrands(colours, new Set(["Citadel"]));
    expect(result).toHaveLength(2);
    expect(result.every((c) => c.brand === "Citadel")).toBe(true);
  });

  it("filters to multiple brands", () => {
    const result = filterByBrands(colours, new Set(["Citadel", "AK"]));
    expect(result).toHaveLength(3);
    expect(result.map((c) => c.brand).sort()).toEqual(["AK", "Citadel", "Citadel"]);
  });

  it("returns empty array when no brands match", () => {
    const result = filterByBrands(colours, new Set(["Unknown"]));
    expect(result).toHaveLength(0);
  });
});

describe("sphericalToCartesian", () => {
  it("returns position on +z axis when theta=0, phi=0", () => {
    const { x, y, z } = sphericalToCartesian(0, 0, 5);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(5, 6);
  });

  it("returns position on +x axis when theta=pi/2, phi=0", () => {
    const { x, y, z } = sphericalToCartesian(Math.PI / 2, 0, 3);
    expect(x).toBeCloseTo(3, 6);
    expect(y).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(0, 5);
  });

  it("returns position on +y axis when phi=pi/2", () => {
    const { x, y, z } = sphericalToCartesian(0, Math.PI / 2, 4);
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBeCloseTo(4, 6);
    expect(z).toBeCloseTo(0, 5);
  });

  it("respects radius scaling", () => {
    const a = sphericalToCartesian(1, 0.5, 1);
    const b = sphericalToCartesian(1, 0.5, 3);
    expect(b.x).toBeCloseTo(a.x * 3, 5);
    expect(b.y).toBeCloseTo(a.y * 3, 5);
    expect(b.z).toBeCloseTo(a.z * 3, 5);
  });

  it("returns position on -z axis when theta=pi, phi=0", () => {
    const { x, y, z } = sphericalToCartesian(Math.PI, 0, 2);
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(-2, 5);
  });
});

describe("screenToNDC", () => {
  it("converts top-left corner to (-1, 1)", () => {
    const { x, y } = screenToNDC(0, 0, 800, 600);
    expect(x).toBeCloseTo(-1, 6);
    expect(y).toBeCloseTo(1, 6);
  });

  it("converts bottom-right corner to (1, -1)", () => {
    const { x, y } = screenToNDC(800, 600, 800, 600);
    expect(x).toBeCloseTo(1, 6);
    expect(y).toBeCloseTo(-1, 6);
  });

  it("converts center of screen to (0, 0)", () => {
    const { x, y } = screenToNDC(400, 300, 800, 600);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(0, 6);
  });

  it("converts quarter point correctly", () => {
    const { x, y } = screenToNDC(200, 150, 800, 600);
    expect(x).toBeCloseTo(-0.5, 6);
    expect(y).toBeCloseTo(0.5, 6);
  });
});
