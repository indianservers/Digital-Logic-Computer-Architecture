import { portsOf, type CpuDesign } from "./model";
import { validateDesign } from "./validate";
import { assemble } from "./isa";
import { engineeringOf } from "./project";
import { flattenCircuit, validateBehavior } from "./construction";
export interface Finding { id: string; level: "error" | "warning" | "info"; category: string; message: string; fix: string; nodeId?: string; wireId?: string; route: string; }
export function engineeringFindings(design: CpuDesign): Finding[] {
  const config = engineeringOf(design);
  const ruleHash=(s:string)=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(16);};const counts=new Map<string,number>();
  const rows: Finding[] = validateDesign(design).map(i => {const key=ruleHash(`${i.nodeId??""}|${i.wireId??""}|${i.message}`);const occurrence=(counts.get(key)??0)+1;counts.set(key,occurrence);return { ...i, id:`GRAPH-${key}-${occurrence}`, category:i.nodeId || i.wireId ? "Connections" : "ISA", fix:i.nodeId || i.wireId ? "Inspect the affected component and reconnect compatible typed ports." : "Open the instruction definition and correct the conflicting encoding.", route:i.nodeId || i.wireId ? "wires" : "isa" };});
  const add = (id: string, level: Finding["level"], category: string, message: string, fix: string, route: string, nodeId?: string) => rows.push({ id, level, category, message, fix, route, nodeId });
  if(config.construction?.execution==="circuit"){
    try{const graph=flattenCircuit(design).design;for(const n of graph.nodes){try{validateBehavior(n);}catch(e){add(`BLOCK-${n.id}`,"error","Components",`${n.name}: ${String(e)}`,"Open the custom block editor and correct its ports or expressions.","builder",n.id.split("/")[0]);}
      if(["cache","core"].includes(n.kind)&&!n.behavior)add(`MODEL-${n.id}`,"error","Model Scope",`${n.name} has no circuit implementation.`,"Replace it with a custom block or gate-level module.","builder",n.id);
      for(const p of portsOf(n).filter(p=>p.dir==="in"))if(!graph.wires.some(w=>w.to===n.id&&w.toPort===p.id))add(`FLOAT-${n.id}-${p.id}`,"warning","Connections",`${n.name}.${p.name} is disconnected (Z).`,"Wire a compatible source or defined constant; active unknown inputs stop circuit clocks.","builder",n.id.split("/")[0]);
    }}catch(e){add("CIRCUIT","error","Components",String(e),"Inspect module definitions and interface connections.","builder");}return rows;
  }
  for (const n of design.nodes) {
    if(["split","join"].includes(n.kind)&&n.width===1)add(`WIDTH-${n.id}`,"error","Components",`${n.name}: a one-bit word cannot be divided into two nonempty equal fields.`,"Choose width 4, 8, 16 or 32.","library",n.id);
    if(n.kind==="sext"&&(!n.inputWidth||![1,4,8,16,32].includes(n.inputWidth)||n.inputWidth>n.width))add(`EXT-${n.id}`,"error","Components",`${n.name}: sign-extension input width must be explicit, supported and no larger than the output.`,"Set the narrow input width.","library",n.id);
    if(n.kind==="regfile"&&n.width!==design.isa.dataWidth)add(`REG-WIDTH-${n.id}`,"error","Components",`${n.name}: width differs from the ISA data width.`,"Match the ISA and register-file widths.","library",n.id);
    if(["imem","dmem","umem"].includes(n.kind)&&!config.regions.some(r=>r.nodeId===n.id))add(`UNMAPPED-${n.id}`,"warning","Memory",`${n.name} has no console address mapping. CPU accesses remain local word offsets.`,"Add a region in Memory System.","memory",n.id);
    if(["cache","core"].includes(n.kind))add(`MODEL-${n.id}`,"error","Model Scope",`${n.name}: sandbox-only block has no CPU datapath execution implementation.`,"Remove this block from the CPU; use the separate architecture sandbox.","builder",n.id);
    if (!Number.isSafeInteger(n.value) || n.mem.some(v=>!Number.isSafeInteger(v)) || n.values.some(v=>!Number.isSafeInteger(v)) || ![1,4,8,16,32].includes(n.width)) add(`COMP-${n.id}`,"error","Components",`${n.name}: invalid width or non-integer storage value.`,"Choose a supported bit width and integer values.","library",n.id);
    if (n.kind === "regfile" && n.values.length !== design.isa.regs) add(`REG-${n.id}`,"error","Components",`${n.name}: register count does not match ISA.`,"Resize the register architecture to match the ISA register count.","library",n.id);
    for (const p of portsOf(n).filter(p => p.dir === "in")) {
      const drivers = design.wires.filter(w => w.to === n.id && w.toPort === p.id);
      if(!drivers.length&&["cu","decoder"].includes(n.kind))add(`CONTROL-PIN-${n.id}-${p.id}`,"error","Connections",`${n.name}.${p.name} is undriven; control requires explicit PC, IR and zero-flag wiring.`,"Connect the corresponding datapath output.","wires",n.id);
      if (!drivers.length && (["alu","mux","bus","split","join","sext"].includes(n.kind) || n.kind === "regfile" && ["ra","rb","rd","d","we"].includes(p.id))) add(`PIN-${n.id}-${p.id}`,"error","Connections",`${n.name}.${p.name} is undriven.`,"Connect one output with matching width and role.","wires",n.id);
    }
  }
  for (const w of design.wires) { const src = design.nodes.find(n => n.id === w.from); const dst = design.nodes.find(n => n.id === w.to); const a = src && portsOf(src).find(p => p.id === w.fromPort); const b = dst && portsOf(dst).find(p => p.id === w.toPort); if (!a || !b || a.dir !== "out" || b.dir !== "in") add(`PORT-${w.id}`,"error","Connections","Connection uses a missing port or invalid direction.","Reconnect an output to an input.","wires",w.to); }
  for (const r of config.regions) {
    if(r.latency!==1||r.kind==="io")add(`SCOPE-${r.id}`,"warning","Model Scope",`${r.name}: latency and I/O roles are console metadata; CPU stalls and device side effects are not simulated.`,"Use one-cycle RAM/ROM for contest execution.","memory",r.nodeId);
    const n = design.nodes.find(n => n.id === r.nodeId);
    if (!n || !["imem","dmem","umem"].includes(n.kind) || !Number.isInteger(r.start) || !Number.isInteger(r.length) || r.start < 0 || r.length < 1 || r.length > (n?.mem.length ?? 0) || r.start+r.length > 2 ** config.addressWidth || !Number.isInteger(r.latency) || r.latency < 1 || config.regions.filter(v=>v.id===r.id).length>1 || config.regions.filter(v=>v.nodeId===r.nodeId).length>1) add(`MEM-${r.id}`,"error","Memory",`${r.name}: invalid or duplicate address mapping, size or latency.`,"Choose one uniquely named region per memory component, a valid length and supported latency.","memory",r.nodeId);
    for (const other of config.regions) if (r.id < other.id && r.start < other.start+other.length && other.start < r.start+r.length) add(`OVERLAP-${r.id}-${other.id}`,"error","Memory",`${r.name} overlaps ${other.name}.`,"Assign non-overlapping word address ranges.","memory",r.nodeId);
  }
  if (config.mode === "multi") {
    const states = config.control; const ids = new Set(states.map(s => s.id));
    if (!ids.has(config.startState)) add("FSM-START","error","Control","The reset state does not exist.","Select an existing start state.","control");
    if (ids.size !== states.length) add("FSM-DUPLICATE","error","Control","Control state IDs are duplicated.","Use unique state IDs.","control");
    const reached=new Set<string>();const stack=[config.startState];while(stack.length){const id=stack.pop()!;if(reached.has(id))continue;reached.add(id);const s=states.find(s=>s.id===id);if(s)stack.push(...(s.guard?[s.guard.whenTrue,s.guard.whenFalse]:[s.next]));}
    for(const s of states){for(const target of s.guard?[s.guard.whenTrue,s.guard.whenFalse]:[s.next])if(!ids.has(target))add(`FSM-NEXT-${s.id}-${target}`,"error","Control",`${s.name}: missing next state ${target}.`,"Connect to an existing state.","control");if(!reached.has(s.id))add(`FSM-REACH-${s.id}`,"warning","Control",`${s.name} is unreachable from reset.`,"Connect it from a reachable state.","control");if(s.signals.MemRead===1&&s.signals.MemWrite===1)add(`FSM-CONFLICT-${s.id}`,"error","Control",`${s.name} enables both memory read and write.`,"Choose one memory operation.","control");}
    if (!states.some(s => s.action === "writeback" && reached.has(s.id))) add("FSM-DEADLOCK","error","Control","No reachable writeback state commits instructions.","Add a reachable writeback state.","control");
  }
  const assembled = assemble(design.isa,design.program);
  if (!assembled.ok) assembled.errors.forEach(e => add(`ASM-${e.line}`,"error","Assembly",`Line ${e.line}: ${e.message}`,"Edit the assembly source or matching ISA definition.","editor"));
  else { const memory = design.nodes.find(n => n.kind === "imem" || n.kind === "umem"); if (memory && assembled.words.length > memory.mem.length) add("ASM-CAPACITY","error","Assembly","The program exceeds instruction memory capacity.","Increase memory capacity or shorten the program.","memory",memory.id); }
  return rows;
}
