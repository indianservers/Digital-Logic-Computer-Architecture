import { describe, expect, it } from "vitest";
import { CIRCUIT_EXAMPLES } from "./examples";
import { addNode, attachProbe, connect, deleteWires, deserialize, emptyDoc, exampleDff, exampleHalfAdder, insertOnWire, serialize, signalOf, simulate, starterAbPlusC, starterAndOr, truthTable } from "./engine";
import { freeInputs, hitPort, nearestWire, snapPoint } from "./interact";

function bit(doc: ReturnType<typeof starterAndOr>, label: string, port: string) {
  const node = doc.nodes.find((item) => item.label === label);
  const result = simulate(doc);
  return node ? signalOf(result, node.id, port) : "missing";
}

describe("circuit engine", () => {
  it("evaluates AND, OR, NOT, NAND, NOR, XOR, and XNOR", () => {
    const cases: Array<[string, Array<0 | 1>, 0 | 1]> = [
      ["and", [1, 1], 1],
      ["and", [1, 0], 0],
      ["or", [0, 1], 1],
      ["or", [0, 0], 0],
      ["nand", [1, 1], 0],
      ["nor", [0, 0], 1],
      ["xor", [1, 0], 1],
      ["xor", [1, 1], 0],
      ["xnor", [1, 1], 1],
    ];
    for (const [type, values, expected] of cases) {
      let doc = emptyDoc();
      doc = addNode(doc, "input", 0, 0, "A", { value: values[0] ?? 0 });
      doc = addNode(doc, "input", 0, 40, "B", { value: values[1] ?? 0 });
      doc = addNode(doc, type, 80, 10, "G");
      const [a, b, gate] = doc.nodes;
      if (!a || !b || !gate) throw new Error("missing");
      doc = connect(doc, a.id, "Y", gate.id, "A").doc;
      doc = connect(doc, b.id, "Y", gate.id, "B").doc;
      expect(signalOf(simulate(doc), gate.id, "Y")).toBe(expected);
    }
    let notDoc = emptyDoc();
    notDoc = addNode(notDoc, "input", 0, 0, "A", { value: 0 });
    notDoc = addNode(notDoc, "not", 80, 0, "N");
    const [a, gate] = notDoc.nodes;
    if (!a || !gate) throw new Error("missing");
    notDoc = connect(notDoc, a.id, "Y", gate.id, "A").doc;
    expect(signalOf(simulate(notDoc), gate.id, "Y")).toBe(1);
  });

  it("follows the AND acceptance toggle", () => {
    let doc = emptyDoc();
    doc = addNode(doc, "input", 0, 0, "A", { value: 1 });
    doc = addNode(doc, "input", 0, 40, "B", { value: 1 });
    doc = addNode(doc, "and", 80, 10, "G");
    doc = addNode(doc, "output", 180, 10, "Y");
    const [a, b, gate, y] = doc.nodes;
    if (!a || !b || !gate || !y) throw new Error("missing");
    doc = connect(doc, a.id, "Y", gate.id, "A").doc;
    doc = connect(doc, b.id, "Y", gate.id, "B").doc;
    doc = connect(doc, gate.id, "Y", y.id, "A").doc;
    expect(signalOf(simulate(doc), y.id, "A")).toBe(1);
    doc = { ...doc, nodes: doc.nodes.map((node) => (node.id === b.id ? { ...node, params: { value: 0 } } : node)) };
    expect(signalOf(simulate(doc), y.id, "A")).toBe(0);
    const trace = simulate(doc);
    expect(trace.frames.some((frame) => frame.nodeId === gate.id)).toBe(true);
    expect(trace.frames.some((frame) => frame.nodeId === y.id)).toBe(true);
  });

  it("fans out and cascades with delay", () => {
    let doc = emptyDoc();
    doc = addNode(doc, "input", 0, 0, "A", { value: 1 });
    doc = addNode(doc, "not", 80, 0, "N1");
    doc = addNode(doc, "not", 80, 70, "N2");
    const [a, n1, n2] = doc.nodes;
    if (!a || !n1 || !n2) throw new Error("missing");
    doc = connect(doc, a.id, "Y", n1.id, "A").doc;
    doc = connect(doc, a.id, "Y", n2.id, "A").doc;
    const fanned = simulate(doc);
    expect(signalOf(fanned, n1.id, "Y")).toBe(0);
    expect(signalOf(fanned, n2.id, "Y")).toBe(0);

    let chain = emptyDoc();
    chain = addNode(chain, "input", 0, 0, "A", { value: 1 });
    chain = addNode(chain, "input", 0, 40, "B", { value: 1 });
    chain = addNode(chain, "and", 90, 10, "G");
    chain = addNode(chain, "not", 200, 10, "N");
    const [ia, ib, and, not] = chain.nodes;
    if (!ia || !ib || !and || !not) throw new Error("missing");
    chain = connect(chain, ia.id, "Y", and.id, "A").doc;
    chain = connect(chain, ib.id, "Y", and.id, "B").doc;
    chain = connect(chain, and.id, "Y", not.id, "A").doc;
    const cascaded = simulate(chain);
    expect(signalOf(cascaded, not.id, "Y")).toBe(0);
    const andTime = cascaded.frames.find((frame) => frame.nodeId === and.id)?.time ?? 0;
    const notTime = cascaded.frames.find((frame) => frame.nodeId === not.id)?.time ?? 0;
    expect(notTime).toBeGreaterThan(andTime);
  });

  it("propagates unknown values and rejects a second driver", () => {
    let doc = emptyDoc();
    doc = addNode(doc, "and", 0, 0, "G");
    const gate = doc.nodes[0];
    if (!gate) throw new Error("missing");
    expect(signalOf(simulate(doc), gate.id, "Y")).toBe("X");
    doc = addNode(doc, "input", 0, 40, "A", { value: 0 });
    const input = doc.nodes[1];
    if (!input) throw new Error("missing");
    doc = connect(doc, input.id, "Y", gate.id, "A").doc;
    expect(signalOf(simulate(doc), gate.id, "Y")).toBe(0);
    const bad = connect(doc, input.id, "Y", gate.id, "A");
    expect(bad.error).toMatch(/driver/i);
    const reversed = connect(doc, gate.id, "A", input.id, "Y");
    expect(reversed.error).toMatch(/output pin/i);
  });

  it("warns when a NOT gate feeds itself", () => {
    let doc = emptyDoc();
    doc = addNode(doc, "not", 0, 0, "N");
    const gate = doc.nodes[0];
    if (!gate) throw new Error("missing");
    doc = connect(doc, gate.id, "Y", gate.id, "A").doc;
    expect(simulate(doc).warning).toMatch(/stable/i);
  });

  it("builds the starter, half adder, and D flip-flop from the graph", () => {
    expect(bit(starterAndOr(), "Y", "A")).toBe(0);
    const table = truthTable(exampleHalfAdder());
    expect(table.tooBig).toBe(false);
    expect(table.rows.map((row) => row.outputs.join(""))).toEqual(["00", "10", "10", "01"]);
    let dff = exampleDff();
    let sim = simulate(dff);
    dff = { ...dff, nodes: dff.nodes.map((node) => ({ ...node, state: sim.state[node.id] ?? node.state })) };
    expect(signalOf(sim, dff.nodes.find((node) => node.label === "Q")?.id ?? "", "A")).toBe(0);
    dff = {
      ...dff,
      nodes: dff.nodes.map((node) => (node.type === "clock" ? { ...node, params: { level: 1 } } : node)),
    };
    sim = simulate(dff);
    expect(signalOf(sim, dff.nodes.find((node) => node.label === "Q")?.id ?? "", "A")).toBe(1);
    dff = {
      ...dff,
      nodes: dff.nodes.map((node) => ({ ...node, state: sim.state[node.id] ?? node.state, params: node.label === "D" ? { value: 0 } : node.params })),
    };
    sim = simulate(dff);
    expect(signalOf(sim, dff.nodes.find((node) => node.label === "Q")?.id ?? "", "A")).toBe(1);
  });

  it("ships fifty categorized examples that all simulate", () => {
    expect(CIRCUIT_EXAMPLES.length).toBeGreaterThanOrEqual(50);
    expect(new Set(CIRCUIT_EXAMPLES.map((example) => example.category)).size).toBeGreaterThanOrEqual(6);
    const sources = new Set(["input", "const", "button", "clock"]);
    for (const example of CIRCUIT_EXAMPLES) {
      const doc = example.build();
      expect(doc.nodes.length).toBeGreaterThan(1);
      expect(doc.wires.length).toBeGreaterThan(0);
      for (const node of doc.nodes) {
        if (sources.has(node.type)) continue;
        expect(doc.wires.some((wire) => wire.to === node.id), `${example.id} leaves ${node.label} undriven`).toBe(true);
      }
      expect(() => simulate(doc)).not.toThrow();
    }
    const on = CIRCUIT_EXAMPLES.find((example) => example.id === "led-on")?.build();
    const off = CIRCUIT_EXAMPLES.find((example) => example.id === "led-off")?.build();
    expect(on && signalOf(simulate(on), on.nodes.find((node) => node.type === "led")?.id ?? "", "A")).toBe(1);
    expect(off && signalOf(simulate(off), off.nodes.find((node) => node.type === "led")?.id ?? "", "A")).toBe(0);
  });

  it("builds the combinational starter Y = AB + C", () => {
    const doc = starterAbPlusC();
    const y = doc.nodes.find((node) => node.label === "Y");
    expect(y && signalOf(simulate(doc), y.id, "A")).toBe(0);
    const table = truthTable(doc);
    expect(table.rows.map((row) => row.outputs[0])).toEqual([0, 1, 0, 1, 0, 1, 1, 1]);
  });

  it("round-trips a circuit through JSON", () => {
    const doc = starterAndOr();
    const restored = deserialize(serialize(doc));
    expect(restored?.wires.length).toBe(doc.wires.length);
    expect(restored && signalOf(simulate(restored), restored.nodes.find((node) => node.label === "Y")?.id ?? "", "A")).toBe(0);
    expect(deserialize("{")).toBeNull();
  });

  it("inserts a NOT into a wire and taps the same net with a probe", () => {
    let doc = emptyDoc();
    doc = addNode(doc, "input", 0, 0, "A", { value: 0 });
    doc = addNode(doc, "led", 200, 0, "L");
    const source = doc.nodes[0];
    const led = doc.nodes[1];
    if (!source || !led) throw new Error("missing");
    doc = connect(doc, source.id, "Y", led.id, "A").doc;
    const wire = doc.wires[0];
    if (!wire) throw new Error("missing wire");
    expect(insertOnWire(doc, wire.id, "and", 80, 0).error).toBeTruthy();
    const inserted = insertOnWire(doc, wire.id, "not", 80, 0);
    expect(inserted.error).toBeUndefined();
    expect(inserted.doc.wires).toHaveLength(2);
    expect(deleteWires(doc, [wire.id]).wires).toHaveLength(0);
    expect(signalOf(simulate(inserted.doc), led.id, "A")).toBe(1);
    const probed = attachProbe(doc, wire.id, 90, 40);
    expect(probed.doc.wires.some((item) => item.id === wire.id)).toBe(true);
    const probe = probed.doc.nodes.find((node) => node.type === "probe");
    expect(probe && signalOf(simulate(probed.doc), probe.id, "A")).toBe(0);
    expect(freeInputs(doc, led)).toHaveLength(0);
    expect(hitPort(doc, 72, 24, "out", 28)?.port.id).toBe("Y");
    expect(nearestWire(doc, 100, 0)?.id).toBe(wire.id);
    expect(snapPoint(20, 18, "off", [])).toEqual({ x: 20, y: 18 });
    expect(snapPoint(20, 18, "normal", [])).toEqual({ x: 16, y: 16 });
  });
});
