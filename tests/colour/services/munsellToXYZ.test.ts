import { munsellLikeToXYZ } from "@/src/colour/services/munsellToXYZ";
import { describe, expect, it } from "vitest";

function hypot2(x: number, z: number): number {
  return Math.sqrt(x * x + z * z);
}

describe("munsellLikeToXYZ", () => {
  it("maps value 0..100 into y 0..height", () => {
    const p0 = munsellLikeToXYZ({ hueDeg: 0, value: 0, chroma: 0 }, { height: 2 });
    const p100 = munsellLikeToXYZ({ hueDeg: 0, value: 100, chroma: 0 }, { height: 2 });

    expect(p0.y).toBeCloseTo(0, 6);
    expect(p100.y).toBeCloseTo(2, 6);
  });

  it("maps chroma 0 to the center axis (x=z=0)", () => {
    const p = munsellLikeToXYZ({ hueDeg: 123, value: 50, chroma: 0 });

    expect(p.x).toBeCloseTo(0, 6);
    expect(p.z).toBeCloseTo(0, 6);
  });

  it("maps chroma 100 to radius (distance from center equals radius)", () => {
    const radius = 3;
    const p = munsellLikeToXYZ({ hueDeg: 50, value: 50, chroma: 100 }, { radius });

    expect(hypot2(p.x, p.z)).toBeCloseTo(radius, 6);
  });

  it("sets angle based on hue: hue 0° should lie on +x axis (z≈0, x>0)", () => {
    const p = munsellLikeToXYZ({ hueDeg: 0, value: 50, chroma: 100 }, { radius: 1 });

    expect(p.z).toBeCloseTo(0, 6);
    expect(p.x).toBeGreaterThan(0);
  });

  it("sets angle based on hue: hue 90° should lie on +z axis (x≈0, z>0)", () => {
    const p = munsellLikeToXYZ({ hueDeg: 90, value: 50, chroma: 100 }, { radius: 1 });

    expect(p.x).toBeCloseTo(0, 6);
    expect(p.z).toBeGreaterThan(0);
  });

  it("wraps hue so 360° behaves like 0°", () => {
    const a = munsellLikeToXYZ({ hueDeg: 0, value: 50, chroma: 100 }, { radius: 2 });
    const b = munsellLikeToXYZ({ hueDeg: 360, value: 50, chroma: 100 }, { radius: 2 });

    expect(a.x).toBeCloseTo(b.x, 6);
    expect(a.z).toBeCloseTo(b.z, 6);
    expect(a.y).toBeCloseTo(b.y, 6);
  });

  it("wraps negative hue correctly: -90° behaves like 270°", () => {
    const a = munsellLikeToXYZ({ hueDeg: -90, value: 50, chroma: 100 }, { radius: 2 });
    const b = munsellLikeToXYZ({ hueDeg: 270, value: 50, chroma: 100 }, { radius: 2 });

    expect(a.x).toBeCloseTo(b.x, 6);
    expect(a.z).toBeCloseTo(b.z, 6);
    expect(a.y).toBeCloseTo(b.y, 6);
  });

  it("applies hueOffsetDeg correctly", () => {
    const base = munsellLikeToXYZ({ hueDeg: 0, value: 50, chroma: 100 }, { radius: 1 });
    const shifted = munsellLikeToXYZ(
      { hueDeg: 0, value: 50, chroma: 100 },
      { radius: 1, hueOffsetDeg: 90 }
    );

    // base should be +x axis; shifted should be +z axis
    expect(base.z).toBeCloseTo(0, 6);
    expect(base.x).toBeGreaterThan(0);

    expect(shifted.x).toBeCloseTo(0, 6);
    expect(shifted.z).toBeGreaterThan(0);
  });
});
