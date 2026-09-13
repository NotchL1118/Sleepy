import assert from "node:assert/strict";
import test from "node:test";
import { centeredView, fitView, pinchView, scaleView } from "./viewport.ts";

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`);
const diagramPoint = (view, point) => ({ x: (point.x - view.x) / view.scale, y: (point.y - view.y) / view.scale });

test("fitting wide, tall and huge diagrams keeps every edge inside the canvas", () => {
  for (const diagram of [{ width: 2400, height: 400 }, { width: 250, height: 6000 }, { width: 50000, height: 8000 }]) {
    const canvas = { width: 320, height: 600 };
    const view = fitView(canvas, diagram);
    assert.ok(view.x >= 19.999 && view.y >= 19.999);
    assert.ok(view.x + diagram.width * view.scale <= canvas.width - 19.999);
    assert.ok(view.y + diagram.height * view.scale <= canvas.height - 19.999);
    near(view.x * 2 + diagram.width * view.scale, canvas.width);
    near(view.y * 2 + diagram.height * view.scale, canvas.height);
  }
});

test("wheel zoom keeps the diagram point under the pointer across zoom directions", () => {
  const view = { x: -310, y: 124, scale: 0.6 };
  const pointer = { x: 750, y: 290 };
  for (const scale of [0.05, 1, 8]) {
    const before = diagramPoint(view, pointer);
    const after = diagramPoint(scaleView(view, scale, pointer), pointer);
    near(after.x, before.x);
    near(after.y, before.y);
  }
});

test("pinching scales and translates around the moving midpoint, including at the zoom limit", () => {
  const before = [{ x: 100, y: 150 }, { x: 200, y: 150 }];
  const after = [{ x: 120, y: 180 }, { x: 320, y: 180 }];
  for (const scale of [1, 7]) {
    const view = { x: -40, y: 20, scale };
    const next = pinchView(view, before, after, 0.1);
    assert.equal(next.scale, Math.min(scale * 2, 8));
    const original = diagramPoint(view, { x: 150, y: 150 });
    const moved = diagramPoint(next, { x: 220, y: 180 });
    near(original.x, moved.x);
    near(original.y, moved.y);
  }
});

test("100% centers the original SVG dimensions instead of stretching to article width", () => {
  assert.deepEqual(centeredView({ width: 1000, height: 700 }, { width: 1600, height: 400 }, 1), { x: -300, y: 150, scale: 1 });
});
