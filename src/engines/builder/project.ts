import { PALETTE, GATE_PALETTE, connect, type CpuDesign, type ArchNode, type ArchWire, type NodeKind, type Width } from "./model";
import { parseTestSuite, type ContestConfig } from "./contest";
export interface ControlState { id: string; name: string; action: "fetch" | "decode" | "execute" | "memory" | "writeback"; next: string; signals: Record<string, 0 | 1 | "instruction">; guard?: { kind: "memory" | "zero" | "opcode"; equals: number; whenTrue: string; whenFalse: string }; }
export interface MemoryRegion { id: string; name: string; nodeId: string; start: number; length: number; permission: "rw" | "r"; kind: "ram" | "rom" | "stack" | "heap" | "io"; latency: number; }
export interface EngineeringConfig {
  schema: 2; id: string; description: string; mode: "single" | "multi"; unknown: "strict" | "zero";
  endianness: "little" | "big"; addressWidth: Width; control: ControlState[]; startState: string;
  state: string; cycle: number; pendingSignals?: Record<string, 0 | 1 | "instruction">; phaseAlu?: { a: number; b: number; y: number; z: 0 | 1; n: 0 | 1; c: 0 | 1; v: 0 | 1 }; instructionPc?: number;
  regions: MemoryRegion[]; files: { id: string; name: string; source: string }[]; activeFile: string;
  favorites: NodeKind[]; presets: { name: string; kind: NodeKind; width: Width; op?: ArchNode["op"]; inputWidth?: Width }[]; watches: { nodeId: string; port: string }[];
  contest?: ContestConfig;
  watchExpressions?: string[]; subcircuits?: {id:string;name:string;nodes:ArchNode[];wires:ArchWire[]}[];
  routing: "curved" | "orthogonal"; signalLabels: boolean; executionLimit: number;
  routeBends?: Record<string,number>;
}
export function defaultControl(): ControlState[] {
  return [
    { id: "fetch", name: "Fetch", action: "fetch", next: "decode", signals: {} },
    { id: "decode", name: "Decode", action: "decode", next: "execute", signals: {} },
    { id: "execute", name: "Execute", action: "execute", next: "memory", signals: { ALUSrc: "instruction" } },
    { id: "memory", name: "Memory", action: "memory", next: "writeback", signals: { MemRead: "instruction", MemWrite: "instruction" } },
    { id: "writeback", name: "Writeback", action: "writeback", next: "fetch", signals: { RegWrite: "instruction", MemToReg: "instruction" } },
  ];
}
export function engineeringOf(design: CpuDesign): EngineeringConfig {
  return design.engineering ?? {
    schema: 2, id: "cpu-local", description: "A browser-local, logic-level CPU project", mode: "single", unknown: "strict", endianness: "little", addressWidth: 16,
    control: defaultControl(), startState: "fetch", state: "fetch", cycle: 0,
    regions: design.nodes.filter(n => ["imem", "dmem", "umem"].includes(n.kind)).map((n, i) => ({ id: `region-${n.id}`, name: n.name, nodeId: n.id, start: i * 0x1000, length: n.mem.length, permission: n.kind === "imem" ? "r" : "rw", kind: n.kind === "imem" ? "rom" : "ram", latency: 1 })),
    files: [{ id: "main", name: "main.asm", source: design.program }], activeFile: "main", favorites: ["alu"], presets: [], watches: [], watchExpressions:["PC","R1","R3","MEM[20]"], subcircuits:[], routing: "curved", signalLabels: true, executionLimit: 10000,
  };
}
export function ensureProject(design: CpuDesign): CpuDesign { return { ...design, engineering: engineeringOf(design) }; }
export function canonicalJson(design: CpuDesign): string {
  function stable(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)]));
    return value;
  }
  return JSON.stringify(stable({ version: 2, kind: "logiclab-cpu", design: ensureProject(design) }), null, 2);
}
export function migrateProject(raw: unknown): CpuDesign {
  if (!raw || typeof raw !== "object") throw new Error("Expected a CPU project object.");
  const envelope = raw as { version?: number; kind?: string; design?: CpuDesign };
  if (envelope.kind && envelope.kind !== "logiclab-cpu") throw new Error("Unsupported project kind.");
  if (envelope.version && envelope.version !== 1 && envelope.version !== 2) throw new Error("Unsupported project schema version.");
  const d = envelope.design;
  if (!d || typeof d.name !== "string" || !Array.isArray(d.nodes) || !Array.isArray(d.wires) || !d.isa || !Array.isArray(d.isa.instructions) || typeof d.program !== "string") throw new Error("Invalid project: nodes, wires, ISA and source are required.");
  if (d.nodes.length > 2000 || d.wires.length > 10000) throw new Error("Project exceeds the supported graph size.");
  if(d.modelVersion!==undefined&&d.modelVersion!==2)throw new Error("Unsupported CPU simulation model version.");
  if(!Number.isSafeInteger(d.nextId)||d.nextId<1||d.program.length>1000000)throw new Error("Invalid next component identifier or excessive program source.");
  const ids = new Set<string>();
  const kinds=new Set([...PALETTE,...GATE_PALETTE].map(n=>n.kind).concat(["cache","core"]));
  for (const n of d.nodes) {
    if (!n || !kinds.has(n.kind) || typeof n.name !== "string" || typeof n.note !== "string" || !Number.isFinite(n.value) || typeof n.id !== "string" || ids.has(n.id) || ![1, 4, 8, 16, 32].includes(n.width) || !Number.isFinite(n.x) || !Number.isFinite(n.y) || !Array.isArray(n.mem) || !Array.isArray(n.values) || n.mem.length > 65536 || n.mem.some(v => !Number.isFinite(v))) throw new Error("Invalid component configuration or duplicate identifier.");
    ids.add(n.id);
  }
  if (d.wires.some(w => !ids.has(w.from) || !ids.has(w.to))) throw new Error("A connection references a missing component.");
  const wireIds=new Set<string>();for(const w of d.wires){if(typeof w.id!=="string"||!w.id||wireIds.has(w.id)||typeof w.fromPort!=="string"||typeof w.toPort!=="string")throw new Error("Invalid connection or duplicate wire identifier.");wireIds.add(w.id);}
  if (!Number.isInteger(d.isa.instrWidth) || d.isa.instrWidth < 4 || d.isa.instrWidth > 32 || !Number.isInteger(d.isa.regs) || d.isa.regs < 1 || d.isa.regs > 8) throw new Error("Invalid instruction width or register architecture.");
  for (const key of ["fieldsR", "fieldsI", "fieldsB", "fieldsJ"] as const) if (!Array.isArray(d.isa[key])) throw new Error("Missing instruction formats.");
  if(![1,4,8,16,32].includes(d.isa.dataWidth))throw new Error("Invalid ISA data width.");
  const operands=["rd","rs1","rs2","imm"];const operations=["ADD","SUB","AND","OR","XOR","NOT","SHL","SHR","CMP","INC","DEC"];
  for(const i of d.isa.instructions) if(!i || typeof i.mnemonic!=="string" || !/^[A-Za-z_]\w*$/.test(i.mnemonic) || !Number.isInteger(i.opcode) || !["R","I","B","J","N"].includes(i.format) || !Array.isArray(i.operands) || i.operands.some(o=>!operands.includes(o)) || !operations.includes(i.aluOp) || !["reg","imm"].includes(i.aluSrc) || !["none","load","store"].includes(i.mem) || !["inc","branchEq","branchNe","jump","halt"].includes(i.pc)) throw new Error("Invalid declarative instruction definition.");
  for(const key of ["fieldsR","fieldsI","fieldsB","fieldsJ"] as const) for(const f of d.isa[key]) if(!f || typeof f.name!=="string" || !Number.isInteger(f.lo) || !Number.isInteger(f.width) || f.width<1 || f.width>32 || !["opcode","rd","rs1","rs2","imm","funct","other"].includes(f.purpose) || (f.valueOffset!==undefined && (!Number.isInteger(f.valueOffset)||f.valueOffset<0||f.valueOffset>31))) throw new Error("Invalid instruction field definition.");
  if(d.engineering){const c=d.engineering;if(c.schema!==2 || !["single","multi"].includes(c.mode) || !["strict","zero"].includes(c.unknown) || !Array.isArray(c.control) || !Array.isArray(c.regions) || !Array.isArray(c.files) || !Array.isArray(c.favorites) || !Array.isArray(c.presets) || !Array.isArray(c.watches) || !Number.isInteger(c.executionLimit) || c.executionLimit<1 || c.executionLimit>1000000) throw new Error("Invalid engineering project configuration.");
    if(![1,4,8,16,32].includes(c.addressWidth)||!["big","little"].includes(c.endianness)||typeof c.startState!=="string"||typeof c.state!=="string")throw new Error("Invalid engineering addressing or control configuration.");
    if(c.presets.some(p=>!p||typeof p.name!=="string"||!PALETTE.some(n=>n.kind===p.kind)||![1,4,8,16,32].includes(p.width)||(p.op!==undefined&&!operations.includes(p.op))||(p.inputWidth!==undefined&&![1,4,8,16,32].includes(p.inputWidth))))throw new Error("Invalid component preset.");
    if(c.contest){if(typeof c.contest.participant!=="string"||typeof c.contest.team!=="string"||typeof c.contest.notes!=="string"||c.contest.notes.length>10000||!Number.isInteger(c.contest.seed)||c.contest.seed<0||c.contest.seed>0xffffffff||!Array.isArray(c.contest.tests))throw new Error("Invalid contestant metadata.");if(c.contest.tests.length)parseTestSuite(c.contest.tests);}
    for(const state of c.control) if(typeof state.id!=="string"||typeof state.name!=="string"||typeof state.next!=="string"||!["fetch","decode","execute","memory","writeback"].includes(state.action)||!state.signals||Object.entries(state.signals).some(([key,value])=>!["RegWrite","ALUSrc","MemRead","MemWrite","Branch","MemToReg"].includes(key)||![0,1,"instruction"].includes(value))) throw new Error("Invalid control state or declarative signals.");
    for(const state of c.control) if(state.guard && (!["memory","zero","opcode"].includes(state.guard.kind)||!Number.isInteger(state.guard.equals)||typeof state.guard.whenTrue!=="string"||typeof state.guard.whenFalse!=="string")) throw new Error("Invalid declarative transition guard.");
    if(c.watchExpressions && (!Array.isArray(c.watchExpressions)||c.watchExpressions.some(w=>typeof w!=="string"||w.length>100))) throw new Error("Invalid watch expressions.");
    if(c.subcircuits && (!Array.isArray(c.subcircuits)||c.subcircuits.some(sub=>!sub||typeof sub.id!=="string"||typeof sub.name!=="string"||!Array.isArray(sub.nodes)||!Array.isArray(sub.wires)||sub.nodes.length>2000||sub.nodes.some(n=>!n||typeof n.id!=="string"||typeof n.name!=="string"||!kinds.has(n.kind)||![1,4,8,16,32].includes(n.width)||!Number.isFinite(n.x)||!Number.isFinite(n.y)||!Array.isArray(n.mem)||!Array.isArray(n.values))))) throw new Error("Invalid reusable subcircuit definition.");
    if(c.files.some(f=>!f||typeof f.id!=="string"||typeof f.name!=="string"||typeof f.source!=="string"||f.source.length>1000000)) throw new Error("Invalid assembly source file.");
    if(c.regions.some(r=>!r||typeof r.id!=="string"||typeof r.name!=="string"||typeof r.nodeId!=="string"||!Number.isInteger(r.start)||!Number.isInteger(r.length)||r.length<1||!["r","rw"].includes(r.permission))) throw new Error("Invalid memory region.");
  }
  let migrated={...d};
  if(d.modelVersion!==2){for(const controller of d.nodes.filter(n=>n.kind==="cu"||n.kind==="decoder")){for(const [kind,port,target] of [["pc","q","pc"],["alu","z","zero"]] as const){const source=d.nodes.find(n=>n.kind===kind);if(source&&!migrated.wires.some(w=>w.to===controller.id&&w.toPort===target)){const result=connect(migrated,source.id,port,controller.id,target);if(result.error)throw new Error(`Legacy control migration failed: ${result.error}`);migrated=result.design;}}}migrated={...migrated,modelVersion:2,modelMigration:"Legacy implicit PC and ALU-zero references were converted into visible control-unit input wires."};}
  return ensureProject({ ...migrated, pan: d.pan ?? { x: 0, y: 0, k: 1 }, probes: d.probes ?? [], breakpoints: d.breakpoints ?? [], overlay: d.overlay ?? "both" });
}
export function memoryAddress(design: CpuDesign, address: number) {
  const region = engineeringOf(design).regions.find(r => address >= r.start && address < r.start + r.length);
  if (!region) throw new Error("Address is outside the memory map.");
  const node = design.nodes.find(n => n.id === region.nodeId);
  if (!node) throw new Error("Mapped memory component is missing.");
  return { region, node, offset: address - region.start };
}

export function saveSubcircuit(design:CpuDesign,ids:string[],name:string):CpuDesign {
  const config=engineeringOf(design);const selected=new Set(ids);const nodes=design.nodes.filter(n=>selected.has(n.id));const wires=design.wires.filter(w=>selected.has(w.from)&&selected.has(w.to));
  return {...design,engineering:{...config,subcircuits:[...(config.subcircuits??[]),{id:`sub-${Date.now()}`,name,nodes,wires}]}};
}
export function instantiateSubcircuit(design:CpuDesign,id:string):CpuDesign {
  const sub=engineeringOf(design).subcircuits?.find(s=>s.id===id);if(!sub||!sub.nodes.length)return design;
  let nextId=design.nextId;const mapping=new Map<string,string>();const group=`instance-${nextId}`;const left=Math.min(...sub.nodes.map(n=>n.x));const top=Math.min(...sub.nodes.map(n=>n.y));
  const nodes=sub.nodes.map(n=>{const newId=`n${nextId++}`;mapping.set(n.id,newId);return {...n,id:newId,name:`${sub.name}/${n.name}`,group,x:n.x-left+40,y:n.y-top+40,mem:n.mem.slice(),values:n.values.slice()};});
  const wires=sub.wires.flatMap(w=>{const from=mapping.get(w.from);const to=mapping.get(w.to);return from&&to?[{...w,id:`w${nextId++}`,from,to}]:[];});
  return {...design,nextId,nodes:[...design.nodes,...nodes],wires:[...design.wires,...wires]};
}
