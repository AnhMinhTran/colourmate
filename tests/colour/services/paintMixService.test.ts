import {
  mixPaints,
  munsellXYZDistance,
  findBestMix,
} from "@/src/colour/services/paintMixService";
import { describe, expect, it } from "vitest";

describe("mixPaints", () => {
  const blue = { r: 0, g: 0, b: 255 };
  const yellow = { r: 255, g: 255, b: 0 };
  const red = { r: 255, g: 0, b: 0 };
  const white = { r: 255, g: 255, b: 255 };

  it("produces a greenish result when mixing blue and yellow", () => {
    const result = mixPaints(blue, yellow, 0.5);

    expect(result.g).toBeGreaterThan(result.r);
    expect(result.g).toBeGreaterThan(result.b);
  });

  it("returns pure paint A when ratioA is 1", () => {
    const result = mixPaints(red, blue, 1);

    expect(result.r).toBe(red.r);
    expect(result.g).toBe(red.g);
    expect(result.b).toBe(red.b);
  });

  it("returns pure paint B when ratioA is 0", () => {
    const result = mixPaints(red, blue, 0);

    expect(result.r).toBe(blue.r);
    expect(result.g).toBe(blue.g);
    expect(result.b).toBe(blue.b);
  });

  it("produces valid RGB values with equal ratio", () => {
    const result = mixPaints(red, white, 0.5);

    expect(result.r).toBeGreaterThanOrEqual(0);
    expect(result.r).toBeLessThanOrEqual(255);
    expect(result.g).toBeGreaterThanOrEqual(0);
    expect(result.g).toBeLessThanOrEqual(255);
    expect(result.b).toBeGreaterThanOrEqual(0);
    expect(result.b).toBeLessThanOrEqual(255);
  });
});

describe("munsellXYZDistance", () => {
  it("returns 0 for identical points", () => {
    const point = { x: 1, y: 2, z: 3 };

    expect(munsellXYZDistance(point, point)).toBe(0);
  });

  it("returns positive distance for different points", () => {
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 1, y: 1, z: 1 };

    expect(munsellXYZDistance(a, b)).toBeGreaterThan(0);
  });

  it("computes correct Euclidean distance", () => {
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 3, y: 4, z: 0 };

    expect(munsellXYZDistance(a, b)).toBeCloseTo(5, 10);
  });
});

describe("findBestMix", () => {
  const identity = (rgb: { r: number; g: number; b: number }) => ({
    x: rgb.r,
    y: rgb.g,
    z: rgb.b,
  });

  it("returns null when fewer than 2 paints are provided", () => {
    const result = findBestMix(
      [{ id: "a", rgb: { r: 255, g: 0, b: 0 } }],
      { x: 128, y: 128, z: 0 },
      identity
    );

    expect(result).toBeNull();
  });

  it("returns a valid suggestion for a small paint set", () => {
    const paints = [
      { id: "red", rgb: { r: 255, g: 0, b: 0 } },
      { id: "blue", rgb: { r: 0, g: 0, b: 255 } },
      { id: "yellow", rgb: { r: 255, g: 255, b: 0 } },
    ];
    const goal = { x: 0, y: 180, z: 0 };

    const result = findBestMix(paints, goal, identity);

    expect(result).not.toBeNull();
    expect(result!.idA).toBeDefined();
    expect(result!.idB).toBeDefined();
    expect(result!.ratio).toBeGreaterThanOrEqual(0.25);
    expect(result!.ratio).toBeLessThanOrEqual(0.75);
    expect(result!.distance).toBeGreaterThanOrEqual(0);
  });

  it("selects the pair closest to the goal", () => {
    const paints = [
      { id: "red", rgb: { r: 255, g: 0, b: 0 } },
      { id: "white", rgb: { r: 255, g: 255, b: 255 } },
    ];
    const goal = { x: 255, y: 200, z: 200 };

    const result = findBestMix(paints, goal, identity);

    expect(result).not.toBeNull();
    expect(result!.idA).toBe("red");
    expect(result!.idB).toBe("white");
  });
});
