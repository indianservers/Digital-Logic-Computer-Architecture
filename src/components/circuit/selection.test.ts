import { describe, expect, it } from "vitest";
import { addNode, alignNodes, connect, emptyDoc, resizeNode, sizedBox, wiresDropped } from "./engine";
import { getComponent, nodeSize } from "./registry";

describe("selection editing", () => {
  it("resizes from the opposite corner and keeps a gate's proportions", () => {
    const doc = addNode(emptyDoc(), "and", 0, 0, "G");
    const node = doc.nodes[0];
    if (!node) throw new Error("missing");
    const next = resizeNode(node, "se", 200, 80);
    expect(next.width).toBeGreaterThan(node.width ?? 0);
    expect(next.x).toBeCloseTo(0, 0);
    expect(next.y).toBeCloseTo(0, 0);
  });

  it("keeps a gate's proportions when one side is typed", () => {
    const doc = addNode(emptyDoc(), "and", 0, 0, "G");
    const node = doc.nodes[0];
    if (!node) throw new Error("missing");
    const next = sizedBox(node, "width", 140);
    expect(next.width).toBe(140);
    expect(next.height).toBeGreaterThan(36);
    expect(next.height).toBeLessThan(140);
  });
  it("uses a custom size without shrinking below the symbol", () => {
    const spec = getComponent("and");
    if (!spec) throw new Error("missing");
    const sized = nodeSize(spec, { inputs: 2 }, { width: 140, height: 40 });
    expect(sized.width).toBe(140);
    expect(sized.height).toBeGreaterThan(40);
  });

  it("reports wires that a smaller input count would drop", () => {
    let doc = addNode(emptyDoc(), "and", 40, 40, "G", { inputs: 3 });
    const gate = doc.nodes[0];
    if (!gate) throw new Error("missing");
    doc = addNode(doc, "high", 0, 0, "H");
    const high = doc.nodes[1];
    if (!high) throw new Error("missing");
    doc = connect(doc, high.id, "Y", gate.id, "C").doc;
    expect(wiresDropped(doc, gate.id, { inputs: 2 }).map((wire) => wire.toPort)).toEqual(["C"]);
    expect(wiresDropped(doc, gate.id, { inputs: 3 })).toEqual([]);
  });

  it("aligns unlocked parts and leaves a locked part in place", () => {
    let doc = addNode(emptyDoc(), "and", 0, 0, "A");
    doc = addNode(doc, "or", 80, 40, "B");
    const [first, second] = doc.nodes;
    if (!first || !second) throw new Error("missing");
    doc = { ...doc, nodes: doc.nodes.map((node) => (node.id === second.id ? { ...node, locked: true } : node)) };
    const next = alignNodes(doc, [first.id, second.id], "left");
    const moved = next.nodes.find((node) => node.id === second.id);
    expect(moved?.x).toBe(80);
  });

  it("copies D on the falling edge when that property is set", () => {
    const dff = getComponent("dff");
    const held = dff?.evaluate({ inputs: { D: 1, CLK: 1, CLR: 0 }, state: [0, 0], params: { edge: 0 } }).outputs.Q;
    const copied = dff?.evaluate({ inputs: { D: 1, CLK: 0, CLR: 0 }, state: [0, 1], params: { edge: 0 } }).outputs.Q;
    expect(held).toBe(0);
    expect(copied).toBe(1);
  });
});
