import { describe, expect, it } from "vitest";
import { addNode, emptyDoc, portPosition } from "./engine";
import { CIRCUIT_EXAMPLES } from "./examples";
import { MORE_EXAMPLES } from "./examples-more";
import { componentTruth, getComponent, hexDigit, listComponents, matchesComponent } from "./registry";

describe("component library", () => {
  it("derives gate truth from the simulator", () => {
    const table = componentTruth("and");
    expect(table?.inputs).toEqual(["A", "B"]);
    expect(table?.rows.map((row) => row.output[0])).toEqual([0, 0, 0, 1]);
    expect(componentTruth("not")?.rows.map((row) => row.output[0])).toEqual([1, 0]);
    const adder = componentTruth("fa");
    const full = adder?.rows.find((row) => row.input.every((bit) => bit === 1));
    expect(full?.output).toEqual([1, 1]);
  });

  it("keeps unknown values in AND, OR, and tri-state logic", () => {
    const and = getComponent("and");
    const or = getComponent("or");
    const tri = getComponent("tri");
    expect(and?.evaluate({ inputs: { A: 0, B: "X" }, state: [], params: { inputs: 2 } }).outputs.Y).toBe(0);
    expect(and?.evaluate({ inputs: { A: 1, B: "X" }, state: [], params: { inputs: 2 } }).outputs.Y).toBe("X");
    expect(or?.evaluate({ inputs: { A: 1, B: "X" }, state: [], params: { inputs: 2 } }).outputs.Y).toBe(1);
    expect(tri?.evaluate({ inputs: { A: 1, EN: 0 }, state: [], params: { active: 1 } }).outputs.Y).toBe("Z");
    expect(tri?.evaluate({ inputs: { A: 1, EN: 1 }, state: [], params: { active: 1 } }).outputs.Y).toBe(1);
    expect(tri?.evaluate({ inputs: { A: 1, EN: 1 }, state: [], params: { active: 0 } }).outputs.Y).toBe("Z");
    expect(getComponent("high")?.evaluate({ inputs: {}, state: [], params: {} }).outputs.Y).toBe(1);
    expect(getComponent("low")?.evaluate({ inputs: {}, state: [], params: {} }).outputs.Y).toBe(0);
  });

  it("searches aliases and hides retired constants", () => {
    const dff = getComponent("dff");
    const mux = getComponent("mux2");
    expect(dff && matchesComponent(dff, "flip flop")).toBe(true);
    expect(dff && matchesComponent(dff, "dff")).toBe(true);
    expect(getComponent("jkff") && matchesComponent(getComponent("jkff")!, "jkff")).toBe(true);
    expect(mux && matchesComponent(mux, "mux")).toBe(true);
    const listed = listComponents().map((spec) => spec.type);
    expect(listed).toContain("high");
    expect(listed).toContain("tri");
    expect(listed).not.toContain("const");
  });

  it("echoes display pins and refuses to decode a 7-segment", () => {
    const hex = getComponent("hex");
    const seg = getComponent("seg7");
    const relay = getComponent("relay");
    const bar = getComponent("bar");
    expect(hexDigit({ D3: 1, D2: 0, D1: 1, D0: 0 })).toBe("A");
    expect(hexDigit({ D3: 1, D2: "X", D1: 0, D0: 0 })).toBe("X");
    expect(hex?.ports({}).map((port) => port.id)).toEqual(["D3", "D2", "D1", "D0"]);
    expect(hex?.evaluate({ inputs: { D3: 1, D2: 0, D1: 1, D0: 0 }, state: [], params: {} }).outputs.D3).toBe(1);
    expect(seg?.ports({ dp: 1 }).map((port) => port.id)).toEqual(["a", "b", "c", "d", "e", "f", "g", "dp"]);
    expect(seg?.evaluate({ inputs: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 0, dp: 0 }, state: [], params: { dp: 1 } }).outputs.g).toBe(0);
    expect(seg?.ports({}).some((port) => port.dir === "out")).toBe(false);
    expect(relay?.ports({}).map((port) => port.id)).toEqual(["A"]);
    expect(bar?.ports({ lamps: 8 })).toHaveLength(8);
    expect(bar?.ports({ lamps: 4 })).toHaveLength(4);
    expect(listComponents(["outputs"]).map((spec) => spec.type)).toEqual(expect.arrayContaining(["bulb", "buzzer", "bicolor", "rgb", "bar", "hex", "seg7", "traffic", "lights", "motor", "relay"]));
  });

  it("adds 100 example circuits that connect", () => {
    expect(MORE_EXAMPLES.length).toBeGreaterThanOrEqual(100);
    const ids = CIRCUIT_EXAMPLES.map((example) => example.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const example of MORE_EXAMPLES) {
      const doc = example.build();
      expect(doc.nodes.length).toBeGreaterThan(1);
      expect(doc.wires.length).toBeGreaterThan(0);
    }
  });

  it("moves a port when the component rotates", () => {
    const doc = addNode(emptyDoc(), "and", 0, 0, "G");
    const node = doc.nodes[0];
    if (!node) throw new Error("missing");
    const before = portPosition(node, "Y", "out");
    const after = portPosition({ ...node, rotation: 1 }, "Y", "out");
    expect(after).not.toEqual(before);
    expect(after.x).toBeCloseTo((before.x + node.x) / 2);
  });
});
