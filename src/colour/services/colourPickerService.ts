export interface CursorPosition {
  x: number;
  y: number;
}

export interface ImageBounds {
  width: number;
  height: number;
}

export interface SourcePixel {
  x: number;
  y: number;
}

export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

export function getCenteredCursorPosition(
  bounds: ImageBounds,
  cursorSize: number
): CursorPosition {
  'worklet';
  return {
    x: Math.max(0, bounds.width / 2 - cursorSize / 2),
    y: Math.max(0, bounds.height / 2 - cursorSize / 2),
  };
}

export function getClampedCursorPosition(
  bounds: ImageBounds,
  cursorSize: number,
  position: CursorPosition
): CursorPosition {
  'worklet';
  const maxX = Math.max(0, bounds.width - cursorSize);
  const maxY = Math.max(0, bounds.height - cursorSize);

  return {
    x: clamp(position.x, 0, maxX),
    y: clamp(position.y, 0, maxY),
  };
}

export function getCursorCenterPosition(
  position: CursorPosition,
  cursorSize: number
): CursorPosition {
  return {
    x: position.x + cursorSize / 2,
    y: position.y + cursorSize / 2,
  };
}

export interface ContainTransform {
  offset: [number, number];
  scale: [number, number];
}

export function computeContainTransform(
  container: ImageBounds,
  image: ImageBounds,
): ContainTransform {
  const fitScale = Math.min(container.width / image.width, container.height / image.height);
  const scaledW = image.width * fitScale;
  const scaledH = image.height * fitScale;
  return {
    offset: [
      (container.width - scaledW) / 2 / container.width,
      (container.height - scaledH) / 2 / container.height,
    ],
    scale: [scaledW / container.width, scaledH / container.height],
  };
}

/**
 * Euclidean distance in Munsell XYZ space — perceptually meaningful since
 * the coordinate is derived from the perceptually-uniform Munsell model.
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

export function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export function mapFramePointToSourcePixel(
  frameBounds: ImageBounds,
  sourceBounds: ImageBounds,
  point: CursorPosition,
  scale: number
): SourcePixel {
  const safeScale = Math.max(scale, 1);
  const centeredX = (point.x - frameBounds.width / 2) / safeScale + frameBounds.width / 2;
  const centeredY = (point.y - frameBounds.height / 2) / safeScale + frameBounds.height / 2;

  const normalizedX = clamp(centeredX / frameBounds.width, 0, 1);
  const normalizedY = clamp(centeredY / frameBounds.height, 0, 1);

  return {
    x: Math.round(normalizedX * Math.max(0, sourceBounds.width - 1)),
    y: Math.round(normalizedY * Math.max(0, sourceBounds.height - 1)),
  };
}
