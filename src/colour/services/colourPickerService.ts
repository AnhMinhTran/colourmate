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
