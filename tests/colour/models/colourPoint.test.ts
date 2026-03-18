import { ColourPoint } from "@/src/colour/models/colourPoint";
import { SRGB } from "@/src/colour/services/colourConversion";
import { describe, expect, it, vi } from "vitest";

vi.mock("expo-crypto", () => ({
  randomUUID: vi.fn(() => "test-uuid-1234"),
}));

const validProps = {
  name: "Calgar Blue",
  brand: "Citadel",
  rgb: { r: 69, g: 107, b: 152 } as SRGB,
  tag: ["Base"],
};

describe("ColourPoint.create", () => {
  it("creates a ColourPoint with valid props", () => {
    const point = ColourPoint.create(validProps);

    expect(point.id).toBe("test-uuid-1234");
    expect(point.name).toBe("Calgar Blue");
    expect(point.brand).toBe("Citadel");
    expect(point.rgb).toEqual({ r: 69, g: 107, b: 152 });
  });

  it("trims whitespace from string fields", () => {
    const point = ColourPoint.create({ ...validProps, name: "  Calgar Blue  " });
    expect(point.name).toBe("Calgar Blue");
  });

  it("throws if name is empty", () => {
    expect(() => ColourPoint.create({ ...validProps, name: "" })).toThrow(
      "Name cannot be empty"
    );
  });

  it("throws if name is only whitespace", () => {
    expect(() => ColourPoint.create({ ...validProps, name: "   " })).toThrow(
      "Name cannot be empty"
    );
  });

  it("throws if brand is empty", () => {
    expect(() => ColourPoint.create({ ...validProps, brand: "" })).toThrow(
      "Brand cannot be empty"
    );
  });

  it("calculates derived color values for new colors", () => {
    const point = ColourPoint.create(validProps);

    expect(point.coordinate).toBeDefined();
    expect(point.coordinate.x).toBeTypeOf("number");
    expect(point.coordinate.y).toBeTypeOf("number");
    expect(point.coordinate.z).toBeTypeOf("number");
  });
});
