import { portPosition, routeWire } from "./engine";
import { getComponent, nodeFrame } from "./registry";
import type { CircuitDoc, CircuitNode, CircuitWire, PortSpec } from "./types";

export type SnapStrength = "off" | "light" | "normal" | "strong";

const INSERTABLE = new Set(["not", "buf", "delay"]);

export function canInsert(type: string): boolean {
  return INSERTABLE.has(type);
}

export function snapPoint(x: number, y: number, strength: SnapStrength, others: CircuitNode[]): { x: number; y: number } {
  if (strength === "off") return { x, y };
  const grid = strength === "strong" ? 8 : strength === "light" ? 32 : 16;
  let sx = Math.round(x / grid) * grid;
  let sy = Math.round(y / grid) * grid;
  const reach = strength === "strong" ? 18 : 12;
  for (const node of others) {
    if (Math.abs(node.x - sx) <= reach) sx = node.x;
    if (Math.abs(node.y - sy) <= reach) sy = node.y;
  }
  return { x: sx, y: sy };
}

export function hitPort(doc: CircuitDoc, x: number, y: number, dir: "in" | "out", radius = 28, skip?: (nodeId: string, portId: string) => boolean) {
  let best: { node: CircuitNode; port: PortSpec; distance: number } | null = null;
  for (const node of doc.nodes) {
    const spec = getComponent(node.type);
    if (!spec) continue;
    for (const port of spec.ports(node.params).filter((item) => item.dir === dir)) {
      if (skip?.(node.id, port.id)) continue;
      const point = portPosition(node, port.id, dir);
      const distance = Math.hypot(point.x - x, point.y - y);
      if (distance <= radius && (!best || distance < best.distance)) best = { node, port, distance };
    }
  }
  return best;
}

export function hitNode(doc: CircuitDoc, x: number, y: number): CircuitNode | null {
  let best: CircuitNode | null = null;
  let area = Number.POSITIVE_INFINITY;
  for (const node of doc.nodes) {
    const spec = getComponent(node.type);
    if (!spec) continue;
    const frame = nodeFrame(node);
    const inside = x >= frame.x - 8 && x <= frame.x + frame.width + 8 && y >= frame.y - 8 && y <= frame.y + frame.height + 8;
    if (!inside) continue;
    const next = frame.width * frame.height;
    if (next < area) {
      area = next;
      best = node;
    }
  }
  return best;
}

export function freeInputs(doc: CircuitDoc, node: CircuitNode): PortSpec[] {
  const spec = getComponent(node.type);
  if (!spec) return [];
  const taken = new Set(doc.wires.filter((wire) => wire.to === node.id).map((wire) => wire.toPort));
  return spec.ports(node.params).filter((port) => port.dir === "in" && !taken.has(port.id));
}

export function nearestWire(doc: CircuitDoc, x: number, y: number, max = 28): CircuitWire | null {
  let best: { wire: CircuitWire; distance: number } | null = null;
  for (const wire of doc.wires) {
    const from = doc.nodes.find((node) => node.id === wire.from);
    const to = doc.nodes.find((node) => node.id === wire.to);
    if (!from || !to) continue;
    const start = portPosition(from, wire.fromPort, "out");
    const end = portPosition(to, wire.toPort, "in");
    const distance = distanceToRoute(start.x, start.y, end.x, end.y, x, y);
    if (distance <= max && (!best || distance < best.distance)) best = { wire, distance };
  }
  return best?.wire ?? null;
}

function distanceToRoute(x1: number, y1: number, x2: number, y2: number, px: number, py: number): number {
  const mid = x1 + Math.max(18, (x2 - x1) / 2);
  return Math.min(
    segmentDistance(px, py, x1, y1, mid, y1),
    segmentDistance(px, py, mid, y1, mid, y2),
    segmentDistance(px, py, mid, y2, x2, y2),
  );
}

function segmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / length));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function routeOf(x1: number, y1: number, x2: number, y2: number): string {
  return routeWire(x1, y1, x2, y2);
}

/** Screen pixels of movement before a press becomes a drag. */
export const DRAG_THRESHOLD = 4;

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const tag = "tagName" in target ? String((target as { tagName: string }).tagName).toUpperCase() : "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  const elementCtor = typeof Element === "undefined" ? null : Element;
  if (elementCtor && target instanceof elementCtor) return target.closest("[contenteditable='true']") !== null;
  return false;
}

export function pointerTravel(fromX: number, fromY: number, toX: number, toY: number): number {
  return Math.hypot(toX - fromX, toY - fromY);
}

/** Zoom so the world point under the pointer stays under the pointer. */
export function zoomAround(
  view: { x: number; y: number; zoom: number },
  pointerX: number,
  pointerY: number,
  factor: number,
): { x: number; y: number; zoom: number } {
  const zoom = Math.min(4, Math.max(0.1, view.zoom * factor));
  const worldX = (pointerX - view.x) / view.zoom;
  const worldY = (pointerY - view.y) / view.zoom;
  return { zoom, x: pointerX - worldX * zoom, y: pointerY - worldY * zoom };
}

export type WorkspaceCursor = "default" | "grab" | "grabbing" | "crosshair" | "pointer" | "not-allowed";

export function workspaceCursor(input: {
  space: boolean;
  gesture: "idle" | "move" | "wire" | "pan" | "box" | "place";
  hover: "none" | "node" | "port" | "wire";
  wireValid: boolean;
}): WorkspaceCursor {
  if (input.gesture === "pan") return "grabbing";
  if (input.gesture === "move") return "grabbing";
  if (input.gesture === "wire") return input.wireValid ? "crosshair" : "not-allowed";
  if (input.gesture === "box" || input.gesture === "place") return "crosshair";
  if (input.space) return "grab";
  if (input.hover === "port") return "crosshair";
  if (input.hover === "wire") return "pointer";
  if (input.hover === "node") return "grab";
  return "default";
}

/** Left-to-right selects parts fully inside. Right-to-left selects parts the box touches. */
export function marqueeHits(frame: { x: number; y: number; width: number; height: number }, x1: number, y1: number, x2: number, y2: number): boolean {
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const top = Math.min(y1, y2);
  const bottom = Math.max(y1, y2);
  const crosses = frame.x < right && frame.x + frame.width > left && frame.y < bottom && frame.y + frame.height > top;
  if (x2 < x1) return crosses;
  return frame.x >= left && frame.y >= top && frame.x + frame.width <= right && frame.y + frame.height <= bottom;
}
