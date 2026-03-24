import { describe, expect, it } from 'vitest';

import {
  clamp,
  computeContainTransform,
  getCenteredCursorPosition,
  getClampedCursorPosition,
  getCursorCenterPosition,
  mapFramePointToSourcePixel,
  rgbToHex,
} from '@/src/colour/services/colourPickerService';

// ── clamp ─────────────────────────────────────────────────────────────────────
describe('clamp', () => {
  it('returns the value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to min when below range', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
  });

  it('clamps to max when above range', () => {
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('handles value equal to min', () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it('handles value equal to max', () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

// ── rgbToHex ──────────────────────────────────────────────────────────────────
describe('rgbToHex', () => {
  it('converts black to #000000', () => {
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
  });

  it('converts white to #FFFFFF', () => {
    expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe('#FFFFFF');
  });

  it('converts red to #FF0000', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#FF0000');
  });

  it('zero-pads single-digit hex components', () => {
    expect(rgbToHex({ r: 1, g: 2, b: 3 })).toBe('#010203');
  });

  it('outputs uppercase letters', () => {
    expect(rgbToHex({ r: 171, g: 205, b: 239 })).toBe('#ABCDEF');
  });
});

// ── computeContainTransform ───────────────────────────────────────────────────
describe('computeContainTransform', () => {
  it('fills the container when aspect ratios match', () => {
    const result = computeContainTransform(
      { width: 400, height: 300 },
      { width: 400, height: 300 },
    );
    expect(result.scale).toEqual([1, 1]);
    expect(result.offset).toEqual([0, 0]);
  });

  it('letterboxes a wider image inside a taller container', () => {
    // Container 300×300, image 300×150 (2:1) — fills width, gaps on top/bottom
    const result = computeContainTransform(
      { width: 300, height: 300 },
      { width: 300, height: 150 },
    );
    expect(result.scale[0]).toBeCloseTo(1);      // full width
    expect(result.scale[1]).toBeCloseTo(0.5);    // half height
    expect(result.offset[0]).toBeCloseTo(0);     // no horizontal gap
    expect(result.offset[1]).toBeCloseTo(0.25);  // 25% gap top and bottom
  });

  it('pillarboxes a taller image inside a wider container', () => {
    // Container 300×300, image 150×300 (1:2) — fills height, gaps on left/right
    const result = computeContainTransform(
      { width: 300, height: 300 },
      { width: 150, height: 300 },
    );
    expect(result.scale[0]).toBeCloseTo(0.5);    // half width
    expect(result.scale[1]).toBeCloseTo(1);      // full height
    expect(result.offset[0]).toBeCloseTo(0.25);  // 25% gap left and right
    expect(result.offset[1]).toBeCloseTo(0);     // no vertical gap
  });

  it('scales down an image larger than its container', () => {
    const result = computeContainTransform(
      { width: 100, height: 100 },
      { width: 200, height: 200 },
    );
    expect(result.scale).toEqual([1, 1]);
    expect(result.offset).toEqual([0, 0]);
  });

  it('scale values sum to at most 1 on each axis', () => {
    const result = computeContainTransform(
      { width: 400, height: 300 },
      { width: 200, height: 100 },
    );
    expect(result.scale[0] + result.offset[0] * 2).toBeCloseTo(1);
    expect(result.scale[1] + result.offset[1] * 2).toBeCloseTo(1);
  });
});

// ── getCenteredCursorPosition ─────────────────────────────────────────────────
describe('getCenteredCursorPosition', () => {
  it('places the cursor at the centre of the bounds', () => {
    const pos = getCenteredCursorPosition({ width: 200, height: 100 }, 20);
    expect(pos.x).toBe(90);
    expect(pos.y).toBe(40);
  });

  it('returns (0, 0) when cursor is larger than bounds', () => {
    const pos = getCenteredCursorPosition({ width: 10, height: 10 }, 50);
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
  });
});

// ── getClampedCursorPosition ──────────────────────────────────────────────────
describe('getClampedCursorPosition', () => {
  it('leaves position unchanged when within bounds', () => {
    const pos = getClampedCursorPosition({ width: 200, height: 200 }, 20, { x: 50, y: 50 });
    expect(pos).toEqual({ x: 50, y: 50 });
  });

  it('clamps to the left/top edge', () => {
    const pos = getClampedCursorPosition({ width: 200, height: 200 }, 20, { x: -10, y: -10 });
    expect(pos).toEqual({ x: 0, y: 0 });
  });

  it('clamps to the right/bottom edge', () => {
    const pos = getClampedCursorPosition({ width: 200, height: 200 }, 20, { x: 300, y: 300 });
    expect(pos).toEqual({ x: 180, y: 180 });
  });
});

// ── getCursorCenterPosition ───────────────────────────────────────────────────
describe('getCursorCenterPosition', () => {
  it('offsets position by half the cursor size', () => {
    const centre = getCursorCenterPosition({ x: 10, y: 20 }, 24);
    expect(centre).toEqual({ x: 22, y: 32 });
  });
});

// ── mapFramePointToSourcePixel ────────────────────────────────────────────────
describe('mapFramePointToSourcePixel', () => {
  it('maps the frame centre to the source centre at scale 1', () => {
    const pixel = mapFramePointToSourcePixel(
      { width: 100, height: 100 },
      { width: 200, height: 200 },
      { x: 50, y: 50 },
      1,
    );
    expect(pixel.x).toBe(100);
    expect(pixel.y).toBe(100);
  });

  it('maps the top-left corner to source (0, 0)', () => {
    const pixel = mapFramePointToSourcePixel(
      { width: 100, height: 100 },
      { width: 200, height: 200 },
      { x: 0, y: 0 },
      1,
    );
    expect(pixel.x).toBe(0);
    expect(pixel.y).toBe(0);
  });

  it('maps the bottom-right corner to the last source pixel', () => {
    const pixel = mapFramePointToSourcePixel(
      { width: 100, height: 100 },
      { width: 200, height: 200 },
      { x: 100, y: 100 },
      1,
    );
    expect(pixel.x).toBe(199);
    expect(pixel.y).toBe(199);
  });

  it('treats scale < 1 as scale 1', () => {
    const atOne = mapFramePointToSourcePixel(
      { width: 100, height: 100 },
      { width: 100, height: 100 },
      { x: 75, y: 75 },
      1,
    );
    const atHalf = mapFramePointToSourcePixel(
      { width: 100, height: 100 },
      { width: 100, height: 100 },
      { x: 75, y: 75 },
      0.5,
    );
    expect(atHalf).toEqual(atOne);
  });
});
