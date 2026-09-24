import { describe, expect, it } from "vitest";
import { isTypingTarget, marqueeHits, pointerTravel, workspaceCursor, zoomAround, DRAG_THRESHOLD } from "./interact";

describe("workspace interaction", () => {
  it("zooms around the pointer instead of the canvas origin", () => {
    const next = zoomAround({ x: 20, y: 10, zoom: 1 }, 120, 80, 2);
    expect(next.zoom).toBe(2);
    expect((120 - next.x) / next.zoom).toBeCloseTo(100);
    expect((80 - next.y) / next.zoom).toBeCloseTo(70);
  });

  it("treats a few pixels as a click and a longer move as a drag", () => {
    expect(pointerTravel(0, 0, 2, 2)).toBeLessThan(DRAG_THRESHOLD);
    expect(pointerTravel(0, 0, 8, 0)).toBeGreaterThan(DRAG_THRESHOLD);
  });

  it("uses window selection left-to-right and crossing selection right-to-left", () => {
    const frame = { x: 10, y: 10, width: 40, height: 20 };
    expect(marqueeHits(frame, 0, 0, 20, 40)).toBe(false);
    expect(marqueeHits(frame, 20, 40, 0, 0)).toBe(true);
    expect(marqueeHits(frame, 0, 0, 80, 50)).toBe(true);
  });

  it("picks one cursor from the active gesture", () => {
    expect(workspaceCursor({ space: false, gesture: "idle", hover: "node", wireValid: true })).toBe("grab");
    expect(workspaceCursor({ space: false, gesture: "move", hover: "node", wireValid: true })).toBe("grabbing");
    expect(workspaceCursor({ space: true, gesture: "idle", hover: "none", wireValid: true })).toBe("grab");
    expect(workspaceCursor({ space: false, gesture: "wire", hover: "none", wireValid: false })).toBe("not-allowed");
    expect(workspaceCursor({ space: false, gesture: "idle", hover: "port", wireValid: true })).toBe("crosshair");
  });

  it("ignores circuit shortcuts while a field is focused", () => {
    expect(isTypingTarget({ tagName: "INPUT" } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: "DIV" } as unknown as EventTarget)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
