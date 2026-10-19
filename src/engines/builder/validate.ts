import { portOf, portsOf, type ArchNode, type CpuDesign } from "./model";
import { validateIsa } from "./isa";
import { flattenCircuit } from "./construction";

export interface Issue {
  level: "error" | "warning";
  message: string;
  nodeId?: string;
  wireId?: string;
}

function nodeNamed(design: CpuDesign, kind: ArchNode["kind"]): ArchNode | undefined {
  return design.nodes.find((node) => node.kind === kind);
}

export function combinationalLoops(design: CpuDesign): string[][] {
  const edges = new Map<string, string[]>();
  const vertices=new Map<string,string>();
  const key=(id:string,port:string)=>JSON.stringify([id,port]);
  const inputs=(node:ArchNode,output:string):string[]=>{
    if(node.behavior){const formula=node.behavior.outputs[output]??"";return portsOf(node).filter(p=>p.dir==="in"&&new RegExp(`\\b${p.id}\\b`).test(formula)).map(p=>p.id);}
    if(["pc","acc","gpr","ir","mar","mdr","sp","flags","dff","counter","clock","const","cache","core"].includes(node.kind))return [];
    if(node.kind==="regfile")return [output==="a"?"ra":"rb"];
    if(["imem","umem"].includes(node.kind))return ["addr"];
    if(node.kind==="dmem")return ["addr","re"];
    if(node.kind==="cu"||node.kind==="decoder")return output==="one"?[]:output==="pcnext"?["ir","pc","zero"]:["ir"];
    return portsOf(node).filter(p=>p.dir==="in").map(p=>p.id);
  };
  for (const node of design.nodes) {
    for(const port of portsOf(node).filter(p=>p.dir==="out")){const id=key(node.id,port.id);vertices.set(id,node.id);edges.set(id,[]);}
  }
  for (const wire of design.wires) {
    const src = design.nodes.find((node) => node.id === wire.from);
    const dst = design.nodes.find((node) => node.id === wire.to);
    if (!src || !dst) continue;
    for(const port of portsOf(dst).filter(p=>p.dir==="out"&&inputs(dst,p.id).includes(wire.toPort)))edges.get(key(src.id,wire.fromPort))?.push(key(dst.id,port.id));
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
        cycles.push(stack.slice(start).concat(next).map(vertex=>vertices.get(vertex)!));
      }
    }
    stack.pop();
    color.set(id, 2);
  }
  for (const id of edges.keys()) if ((color.get(id) ?? 0) === 0) visit(id);
  return cycles;
}

export function validateDesign(design: CpuDesign): Issue[] {
  if(design.nodes.some(n=>n.circuit)||design.engineering?.construction?.nets?.length){try{return validateDesign(flattenCircuit(design).design);}catch(e){return [{level:"error",message:String(e)}];}}
  const issues: Issue[] = [];
  if(design.engineering?.construction?.execution!=="circuit")issues.push(...validateIsa(design.isa).map((item) => ({ level: item.level, message: item.message })));
  const drivers = new Map<string, string[]>();
  const nodeIds=new Set<string>();const wireIds=new Set<string>();
  for(const node of design.nodes){if(nodeIds.has(node.id))issues.push({level:"error",message:`Duplicate component identifier ${node.id}.`,nodeId:node.id});nodeIds.add(node.id);}
  for (const wire of design.wires) {
    if(wireIds.has(wire.id))issues.push({level:"error",message:`Duplicate wire identifier ${wire.id}.`,wireId:wire.id});wireIds.add(wire.id);
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
    if(!out||!inn||out.dir!=="out"||inn.dir!=="in")issues.push({level:"error",message:"Connection must use an existing output and an existing input.",wireId:wire.id});
    if(out&&inn&&out.role!==inn.role)issues.push({level:"warning",message:`Signal role differs: ${out.role} drives ${inn.role}. Verify this conversion is intentional.`,wireId:wire.id});
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
      if (port.role === "clock" && ["pc","regfile","acc","ir","dff","gpr","mar","mdr","sp","counter","flags","dmem","umem"].includes(node.kind)) {
        issues.push({ level: "error", message: `${node.name} has no clock connection.`, nodeId: node.id });
      } else if (port.id === "d" && (node.kind === "pc" || node.kind === "acc" || node.kind === "gpr" || node.kind === "ir")) {
        issues.push({ level: "error", message: `${node.name} data input is not connected.`, nodeId: node.id });
      } else if (port.role === "control" && port.id === "we" && (node.kind === "regfile" || node.kind === "acc" || node.kind === "dmem")) {
        issues.push({ level: "warning", message: `${node.name} write-enable is floating (Z). Strict execution faults if this input is required; connect a defined control signal.`, nodeId: node.id });
      } else if (port.id === "s" && node.kind === "mux") {
        issues.push({ level: "error", message: `MUX ${node.name} has no select control. The output is ambiguous.`, nodeId: node.id });
      }
    }
    if ((node.kind === "regfile" || node.kind === "acc" || node.kind === "gpr") && !design.wires.some((wire) => wire.to === node.id && wire.toPort === "d")) {
      issues.push({ level: "warning", message: `Register ${node.name} is never written by any instruction path.`, nodeId: node.id });
    }
  }
  if(design.engineering?.construction?.execution==="circuit"){
    for(const cycle of combinationalLoops(design))issues.push({level:"error",message:`Combinational loop: ${cycle.join(" → ")}`,nodeId:cycle[0]});return issues;
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
