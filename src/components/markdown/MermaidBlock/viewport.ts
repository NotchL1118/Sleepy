export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type DiagramView = Point & { scale: number };

export const MAX_SCALE = 8;

export function centeredView(canvas: Size, diagram: Size, scale: number): DiagramView {
  return {
    x: (canvas.width - diagram.width * scale) / 2,
    y: (canvas.height - diagram.height * scale) / 2,
    scale,
  };
}

export function fitView(canvas: Size, diagram: Size): DiagramView {
  const scale = Math.min(
    MAX_SCALE,
    Math.max(1, canvas.width - 40) / diagram.width,
    Math.max(1, canvas.height - 40) / diagram.height,
  );
  return centeredView(canvas, diagram, scale);
}

// Keep the same diagram point under the pointer (or moving pinch midpoint).
export function scaleView(view: DiagramView, scale: number, from: Point, to = from): DiagramView {
  return {
    x: to.x - (from.x - view.x) * scale / view.scale,
    y: to.y - (from.y - view.y) * scale / view.scale,
    scale,
  };
}

export function pinchView(view: DiagramView, before: readonly [Point, Point], after: readonly [Point, Point], minScale: number): DiagramView {
  const midpoint = ([a, b]: readonly [Point, Point]) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const distance = ([a, b]: readonly [Point, Point]) => Math.hypot(a.x - b.x, a.y - b.y);
  const scale = Math.max(minScale, Math.min(MAX_SCALE, view.scale * distance(after) / Math.max(1, distance(before))));
  return scaleView(view, scale, midpoint(before), midpoint(after));
}
