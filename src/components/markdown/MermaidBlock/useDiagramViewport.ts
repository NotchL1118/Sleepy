"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionValue, useMotionValueEvent } from "motion/react";
import { centeredView, fitView, MAX_SCALE, pinchView, scaleView, type DiagramView, type Point } from "./viewport";

export function useDiagramViewport(svg: string | undefined) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const controls = useRef<{ fit: () => void; actual: () => void; zoomBy: (factor: number) => void } | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const [zoom, setZoom] = useState(1);
  useMotionValueEvent(scale, "change", setZoom);

  useEffect(() => {
    const viewport = viewportRef.current;
    const graph = graphRef.current;
    const image = graph?.querySelector("svg");
    if (!svg || !viewport || !graph || !image) return;
    const bounds = image.viewBox.baseVal;
    const diagram = {
      width: bounds.width || image.width.baseVal.value,
      height: bounds.height || image.height.baseVal.value,
    };
    if (!(diagram.width > 0 && diagram.height > 0)) return;
    graph.style.width = `${diagram.width}px`;
    graph.style.height = `${diagram.height}px`;

    const points = new Map<number, Point>();
    let fitting = true;
    let canvas = { width: viewport.clientWidth, height: viewport.clientHeight };
    const currentView = () => ({ x: x.get(), y: y.get(), scale: scale.get() });
    const paint = (view: DiagramView) => { x.set(view.x); y.set(view.y); scale.set(view.scale); };
    // Huge diagrams must still be able to reach their fitted scale below 10%.
    const minimumScale = () => Math.min(0.1, fitView(canvas, diagram).scale);
    const fit = () => { fitting = true; paint(fitView(canvas, diagram)); };
    const zoomAt = (next: number, point = { x: canvas.width / 2, y: canvas.height / 2 }) => {
      fitting = false;
      paint(scaleView(currentView(), Math.max(minimumScale(), Math.min(MAX_SCALE, next)), point));
    };
    const actual = () => { fitting = false; paint(centeredView(canvas, diagram, 1)); };
    controls.current = { fit, actual, zoomBy: (factor) => zoomAt(scale.get() * factor) };
    const resize = new ResizeObserver(() => {
      const next = { width: viewport.clientWidth, height: viewport.clientHeight };
      const previous = canvas;
      canvas = next;
      if (fitting) fit();
      else paint({ ...currentView(), x: x.get() + (next.width - previous.width) / 2, y: y.get() + (next.height - previous.height) / 2 });
    });
    resize.observe(viewport);
    fit();
    graph.style.visibility = "visible";

    const localPoint = (event: MouseEvent) => {
      const rect = viewport.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.height : 1);
      zoomAt(scale.get() * Math.exp(-delta * 0.0025), localPoint(event));
    };
    const down = (event: PointerEvent) => {
      if ((event.pointerType === "mouse" && event.button !== 0) || points.size >= 2) return;
      viewport.setPointerCapture(event.pointerId);
      points.set(event.pointerId, localPoint(event));
      viewport.dataset.dragging = "true";
      viewport.focus({ preventScroll: true });
    };
    const move = (event: PointerEvent) => {
      const previous = points.get(event.pointerId);
      if (!previous) return;
      const before = [...points.values()];
      const point = localPoint(event);
      points.set(event.pointerId, point);
      fitting = false;
      if (points.size === 1) paint({ ...currentView(), x: x.get() + point.x - previous.x, y: y.get() + point.y - previous.y });
      else {
        const after = [...points.values()];
        paint(pinchView(currentView(), [before[0], before[1]], [after[0], after[1]], minimumScale()));
      }
    };
    const release = (event: PointerEvent) => {
      points.delete(event.pointerId);
      if (!points.size) delete viewport.dataset.dragging;
    };
    const clearPointers = () => {
      for (const id of points.keys()) if (viewport.hasPointerCapture(id)) viewport.releasePointerCapture(id);
      points.clear();
      delete viewport.dataset.dragging;
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      switch (event.key) {
        case "+": case "=": zoomAt(scale.get() * 1.25); break;
        case "-": zoomAt(scale.get() / 1.25); break;
        case "0": fit(); break;
        case "1": actual(); break;
        case "ArrowLeft": fitting = false; x.set(x.get() + 60); break;
        case "ArrowRight": fitting = false; x.set(x.get() - 60); break;
        case "ArrowUp": fitting = false; y.set(y.get() + 60); break;
        case "ArrowDown": fitting = false; y.set(y.get() - 60); break;
        default: return;
      }
      event.preventDefault();
    };
    const dialog = viewport.closest("dialog");
    viewport.addEventListener("wheel", wheel, { passive: false });
    viewport.addEventListener("pointerdown", down);
    viewport.addEventListener("pointermove", move);
    viewport.addEventListener("pointerup", release);
    viewport.addEventListener("pointercancel", release);
    viewport.addEventListener("lostpointercapture", release);
    dialog?.addEventListener("keydown", keydown);
    window.addEventListener("blur", clearPointers);
    return () => {
      controls.current = null;
      resize.disconnect();
      clearPointers();
      graph.style.visibility = "hidden";
      viewport.removeEventListener("wheel", wheel);
      viewport.removeEventListener("pointerdown", down);
      viewport.removeEventListener("pointermove", move);
      viewport.removeEventListener("pointerup", release);
      viewport.removeEventListener("pointercancel", release);
      viewport.removeEventListener("lostpointercapture", release);
      dialog?.removeEventListener("keydown", keydown);
      window.removeEventListener("blur", clearPointers);
    };
  }, [svg, x, y, scale]);

  return {
    viewportRef, graphRef, x, y, scale, zoom,
    fit: () => controls.current?.fit(),
    actual: () => controls.current?.actual(),
    zoomBy: (factor: number) => controls.current?.zoomBy(factor),
  };
}
