// tests/colour/services/colourConversion.test.ts
import { convertSRGBToOKLCH } from "@/src/colour/services/colourConversion";
import { describe, expect, it } from "vitest";

describe("convertSRGBToOKLCH", () => {
  it("converts red to OKLCH", () => {
    const result = convertSRGBToOKLCH({ r: 255, g: 0, b: 0 });

    expect(result.l).toBeGreaterThan(0);
    expect(result.c).toBeGreaterThan(0);
    expect(result.h).toBeGreaterThanOrEqual(0);
    expect(result.h).toBeLessThanOrEqual(360);
  });

  it("produces near-zero chroma for gray", () => {
    const result = convertSRGBToOKLCH({ r: 128, g: 128, b: 128 });

    expect(result.c).toBeLessThan(0.01);
  });
});
