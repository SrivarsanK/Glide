export interface SnappedPoint {
  x: number;
  y: number;
}

export function snapToGrid(
  x: number,
  y: number,
  gridSize: number = 8
): SnappedPoint {
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize,
  };
}
