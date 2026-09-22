import { portOf, portsOf, type ArchNode, type CpuDesign } from "./model";
import { validateIsa } from "./isa";

export interface Issue {
  level: "error" | "warning";
  message: string;
  nodeId?: string;
  wireId?: string;
}

const COMBO: Set<ArchNode["kind"]> = new Set(["alu", "mux", "shifter", "cmp", "inc", "sext", "buf", "split", "join", "decoder", "cu", "and", "or", "not", "nand", "xor", "bus"]);

function nodeNamed(design: CpuDesign, kind: ArchNode["kind"]): ArchNode | undefined {
  return design.nodes.find((node) => node.kind === kind);
}

export function combinationalLoops(design: CpuDesign): string[][] {
  const edges = new Map<string, string[]>();
  for (const node of design.nodes) {
    if (!COMBO.has(node.kind)) continue;
    edges.set(node.id, []);
  }
  for (const wire of design.wires) {
    const src = design.nodes.find((node) => node.id === wire.from);
    const dst = design.nodes.find((node) => node.id === wire.to);
    if (!src || !dst || !COMBO.has(src.kind) || !COMBO.has(dst.kind)) continue;
    edges.get(src.id)?.push(dst.id);
  }
  const color = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  function visit(id: string) {
    color.set(id, 1);
    stack.push(id);
    for (const next of edges.get(id) ?? []) {
      const mark = color.get(next) ?? 0;
      if (mark === 0) visit(next);
      else if (mark === 1) {
        const start = stack.indexOf(next);
        cycles.push(stack.slice(start).concat(next));
      }
    }
    stack.pop();
    color.set(id, 2);
  }
  for (const id of edges.keys()) if ((color.get(id) ?? 0) === 0) visit(id);
  return cycles;
}

export function validateDesign(design: CpuDesign): Issue[] {
  const issues: Issue[] = [];
  issues.push(...validateIsa(design.isa).map((item) => ({ level: item.level, message: item.message })));
  const drivers = new Map<string, string[]>();
  for (const wire of design.wires) {
    const key = `${wire.to}:${wire.toPort}`;
    const list = drivers.get(key) ?? [];
    list.push(wire.id);
    drivers.set(key, list);
    const src = design.nodes.find((node) => node.id === wire.from);
    const dst = design.nodes.find((node) => node.id === wire.to);
    if (!src || !dst) {
      issues.push({ level: "error", message: "Wire refers to a missing component.", wireId: wire.id });
      continue;
    }
    const out = portOf(src, wire.fromPort);
    const inn = portOf(dst, wire.toPort);
    if (out && inn && out.width !== inn.width) {
      issues.push({ level: "error", message: `Width mismatch: ${out.width}-bit output cannot directly drive a ${inn.width}-bit input.`, wireId: wire.id, nodeId: dst.id });
    }
    if (out?.dir === "out" && inn?.dir === "out") {
      issues.push({ level: "error", message: `Output ${src.name}.${out.name} is connected to output ${dst.name}.${inn.name}.`, wireId: wire.id });
    }
  }
  for (const [key, list] of drivers) {
    if (list.length < 2) continue;
    const [to, port] = key.split(":");
    const node = design.nodes.find((item) => item.id === to);
    issues.push({ level: "error", message: `Bus ${node?.name ?? to} input ${port} has two active drivers.`, nodeId: to, wireId: list[0] });
  }
  for (const node of design.nodes) {
    const ins = portsOf(node).filter((port) => port.dir === "in");
    for (const port of ins) {
      const driven = design.wires.some((wire) => wire.to === node.id && wire.toPort === port.id);
      if (driven) continue;
      if (port.role === "clock" && (node.kind === "pc" || node.kind === "regfile" || node.kind === "acc" || node.kind === "ir" || node.kind === "dff")) {
        issues.push({ level: "error", message: `${node.name} has no clock connection.`, nodeId: node.id });
      } else if (port.id === "d" && (node.kind === "pc" || node.kind === "acc" || node.kind === "gpr" || node.kind === "ir")) {
        issues.push({ level: "error", message: `${node.name} data input is not connected.`, nodeId: node.id });
      } else if (port.role === "control" && port.id === "we" && (node.kind === "regfile" || node.kind === "acc" || node.kind === "dmem")) {
        issues.push({ level: "warning", message: `${node.name} write-enable is floating. It will stay 0 unless the control unit drives it.`, nodeId: node.id });
      } else if (port.id === "s" && node.kind === "mux") {
        issues.push({ level: "error", message: `MUX ${node.name} has no select control. The output is ambiguous.`, nodeId: node.id });
      }
    }
    if ((node.kind === "regfile" || node.kind === "acc" || node.kind === "gpr") && !design.wires.some((wire) => wire.to === node.id && wire.toPort === "d")) {
      issues.push({ level: "warning", message: `Register ${node.name} is never written by any instruction path.`, nodeId: node.id });
    }
  }
  const pc = nodeNamed(design, "pc");
  const imem = nodeNamed(design, "imem") ?? nodeNamed(design, "umem");
  const dmem = nodeNamed(design, "dmem") ?? nodeNamed(design, "umem");
  const rf = nodeNamed(design, "regfile") ?? nodeNamed(design, "acc");
  const alu = nodeNamed(design, "alu");
  const clock = nodeNamed(design, "clock");
  if (!pc) issues.push({ level: "error", message: "PC has no valid update path. Place a PC component." });
  else if (!design.wires.some((wire) => wire.to === pc.id && wire.toPort === "d")) {
    issues.push({ level: "error", message: "PC has no valid update path.", nodeId: pc.id });
  }
  if (!imem) issues.push({ level: "error", message: "Instruction memory is inaccessible. Place instruction memory and connect PC." });
  else if (pc && !design.wires.some((wire) => wire.from === pc.id && wire.to === imem.id)) {
    issues.push({ level: "error", message: "Instruction memory is inaccessible from PC.", nodeId: imem.id });
  }
  if (!dmem) issues.push({ level: "warning", message: "Data memory is inaccessible. Load/store instructions will not observe RAM." });
  if (!rf) issues.push({ level: "error", message: "No register file or accumulator is present." });
  if (!alu) issues.push({ level: "warning", message: "No ALU is present. Arithmetic instructions have nowhere to compute." });
  if (!clock) issues.push({ level: "error", message: "Missing clock. Sequential state will never update." });
  for (const cycle of combinationalLoops(design)) {
    const names = cycle.map((id) => design.nodes.find((node) => node.id === id)?.name ?? id);
    issues.push({ level: "error", message: `Combinational loop detected: ${names.join(" → ")}` , nodeId: cycle[0] });
  }
  return issues;
}

export function summarizeIssues(issues: Issue[]): { errors: number; warnings: number } {
  return {
    errors: issues.filter((item) => item.level === "error").length,
    warnings: issues.filter((item) => item.level === "warning").length,
  };
}
