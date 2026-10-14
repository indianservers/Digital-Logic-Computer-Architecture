import type { CpuDesign, IsaInstruction } from "./model";
import { fieldsOf } from "./model";
import { assemble, decodeWord, immediateWidth, signedImmediate } from "./isa";
import { engineeringOf, migrateProject } from "./project";
import { engineeringFindings } from "./engineeringValidation";
import { resetCpu, stepMicroCycle, type ExecTrace } from "./sim";

export const CONTEST_ENGINE = "aimer-cpu-contest-2";
export const MAX_SUBMISSION_BYTES=64*1024*1024;
export interface ContestTest { id:string; name:string; source:string; maxCycles:number; reference:boolean; registers:Record<string,number>; memory:Record<string,number>; haltPc?:number; }
export interface ContestConfig { participant:string; team:string; notes:string; seed:number; tests:ContestTest[]; }
export interface ContestResult { id:string; name:string; status:"pass"|"fail"|"blocked"|"cancelled"; reason:string; cycles:number; instructions:number; cpi:number|null; registers:number[]; memory:number[]; pc:number; coverage:string[]; assertions:{target:string;expected:number;actual:number|undefined;pass:boolean}[]; trace:ExecTrace[]; listing:{address:number;word:number;text:string}[]; }
export interface ContestReport { engine:string; designHash:string; suiteHash:string; architecture:{name:string;dataWidth:number;instructionWidth:number;mnemonics:string[]}; findings:ReturnType<typeof engineeringFindings>; results:ContestResult[]; passed:number; total:number; score:number; }
export interface Submission { kind:"aimer-cpu-submission"; version:1; engine:string; participant:string; team:string; notes:string; design:CpuDesign; tests:ContestTest[]; report:ContestReport; manifest:{designHash:string;suiteHash:string;reportHash:string}; }
export function stableStringify(value:unknown):string { const stable=(v:unknown):unknown=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.entries(v).filter(([,x])=>x!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>[k,stable(x)])):v;return JSON.stringify(stable(value)); }
export async function sha256(value:unknown):Promise<string> {const bytes=new TextEncoder().encode(stableStringify(value));const digest=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,"0")).join("");}
// Includes all execution inputs and edited source, but excludes viewport and private contestant metadata.
export function executionIdentity(d:CpuDesign) {const c=engineeringOf(d);return {isa:d.isa,program:d.program,nodes:d.nodes.map(({x:_x,y:_y,locked:_locked,group:_group,note:_note,...n})=>n),wires:d.wires,config:{mode:c.mode,unknown:c.unknown,control:c.control,startState:c.startState,regions:c.regions,addressWidth:c.addressWidth}};}
export function defaultContest():ContestConfig{return {participant:"",team:"",notes:"",seed:2026,tests:[]};}
export function parseTestSuite(raw:unknown):ContestTest[] {
 const tests=Array.isArray(raw)?raw:raw&&typeof raw==="object"?(raw as {tests?:unknown}).tests:undefined;
 if(!Array.isArray(tests)||!tests.length||tests.length>64)throw new Error("A suite must contain 1–64 tests.");const ids=new Set<string>();
 return tests.map(t=>{if(!t||typeof t.id!=="string"||!t.id.trim()||t.id.length>100||ids.has(t.id)||typeof t.name!=="string"||t.name.length>200||typeof t.source!=="string"||t.source.length>32000||!Number.isInteger(t.maxCycles)||t.maxCycles<1||t.maxCycles>2000||typeof t.reference!=="boolean")throw new Error("Invalid test ID, source, reference switch or cycle limit (1–2000).");ids.add(t.id);
 const assertions=(v:unknown,max:number)=>{if(!v||typeof v!=="object"||Array.isArray(v))throw new Error("Assertions must be address-to-value objects.");const entries=Object.entries(v);if(entries.length>65536||entries.some(([k,n])=>!/^\d+$/.test(k)||Number(k)>max||!Number.isSafeInteger(n)||Number(n)<0||Number(n)>0xffffffff))throw new Error("Invalid assertion address or unsigned 32-bit value.");return Object.fromEntries(entries) as Record<string,number>;};
 if(t.haltPc!==undefined&&(!Number.isSafeInteger(t.haltPc)||t.haltPc<0||t.haltPc>0xffffffff))throw new Error("Invalid expected halt PC.");
 return {id:t.id,name:t.name,source:t.source,maxCycles:t.maxCycles,reference:t.reference,registers:assertions(t.registers,7),memory:assertions(t.memory,65535),...(t.haltPc===undefined?{}:{haltPc:t.haltPc})};});
}
export function newTest(index:number):ContestTest{return {id:`test-${index}`,name:`Challenge ${index}`,source:"",maxCycles:200,reference:true,registers:{},memory:{}};}
export function seededSuite(design:CpuDesign,seed:number):ContestTest[] {
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new Error("Seed must be an unsigned 32-bit integer.");
 if(!design.nodes.some(n=>n.kind==="regfile")||design.isa.regs<4)throw new Error("Generated challenges require a register-file CPU with at least four registers. Use explicit assertions for an accumulator CPU.");
 const find=(predicate:(i:IsaInstruction)=>boolean)=>design.isa.instructions.find(predicate);
 const halt=find(i=>i.pc==="halt"&&!i.regWrite&&i.mem==="none");
 const li=find(i=>i.regWrite&&i.mem==="none"&&i.pc==="inc"&&i.aluOp==="ADD"&&i.aluSrc==="imm"&&i.operandA==="zero"&&i.operands.join(",")==="rd,imm");
 const add=find(i=>i.regWrite&&i.mem==="none"&&i.pc==="inc"&&i.aluOp==="ADD"&&i.aluSrc==="reg"&&(i.operandA===undefined||i.operandA==="rs1")&&i.operands.join(",")==="rd,rs1,rs2");
 if(!li||!add||!halt)throw new Error("Generated challenges require immediate-load, register ADD, and HALT semantics. Custom mnemonic names are supported.");
 let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};
 const signed=fieldsOf(design.isa,li.format).some(f=>f.purpose==="imm"&&f.signed);const max=Math.min(31,2**(immediateWidth(design.isa,li)-(signed?1:0))-1,2**design.isa.dataWidth-1);if(max<1)throw new Error("Immediate field cannot represent positive operands.");
 const results:ContestTest[]=[];
 for(let index=0;index<8;index++){const a=random()%(max+1),b=random()%(max+1);results.push({...newTest(index+1),id:`seed-${seed}-${index}`,name:`Seed ${seed} · arithmetic ${index+1}`,source:`${li.mnemonic} R1, ${a}\n${li.mnemonic} R2, ${b}\n${add.mnemonic} R3, R1, R2\n${halt.mnemonic}`,registers:{"3":Number(BigInt.asUintN(design.isa.dataWidth,BigInt(a+b)))},haltPc:3});}
 const binary=find(i=>i.regWrite&&i.mem==="none"&&i.pc==="inc"&&i.aluOp==="SUB"&&i.aluSrc==="reg"&&(i.operandA===undefined||i.operandA==="rs1")&&i.operands.join(",")==="rd,rs1,rs2");
 if(binary)results.push({...newTest(9),id:"underflow",name:"Unsigned subtraction wrap",source:`${li.mnemonic} R1, 0\n${li.mnemonic} R2, 1\n${binary.mnemonic} R3, R1, R2\n${halt.mnemonic}`,registers:{"3":2**design.isa.dataWidth-1},haltPc:3});
 const store=find(i=>i.mem==="store"&&i.pc==="inc"&&i.operandA==="zero"&&i.operands.join(",")==="rd,imm");const load=find(i=>i.mem==="load"&&i.regWrite&&i.memToReg&&i.pc==="inc"&&i.operandA==="zero"&&i.operands.join(",")==="rd,imm");const dm=design.nodes.find(n=>n.kind==="dmem");
 if(store&&load&&dm&&dm.mem.length>20&&2**design.isa.dataWidth>20)results.push({...newTest(10),id:"memory-roundtrip",name:"Store/load round trip",source:`${li.mnemonic} R1, 7\n${store.mnemonic} R1, 20\n${load.mnemonic} R3, 20\n${halt.mnemonic}`,registers:{"3":7},memory:{"20":7},haltPc:3});
 const branch=find(i=>i.pc==="branchEq"&&i.mem==="none"&&!i.regWrite&&i.aluOp==="SUB"&&i.aluSrc==="reg"&&i.operands.join(",")==="rs1,rs2,imm");
 if(branch)for(const taken of [true,false])results.push({...newTest(results.length+1),id:`branch-${taken?"taken":"untaken"}`,name:`Conditional branch · ${taken?"taken":"untaken"}`,source:`${li.mnemonic} R1, 1\n${li.mnemonic} R2, ${taken?1:0}\n${branch.mnemonic} R1, R2, done\n${li.mnemonic} R3, 1\ndone: ${halt.mnemonic}`,registers:{"3":taken?0:1},haltPc:4});
 const jump=find(i=>i.pc==="jump"&&!i.regWrite&&i.mem==="none"&&i.operands.join(",")==="imm");
 if(jump)results.push({...newTest(results.length+1),id:"jump",name:"Absolute jump skips an instruction",source:`${jump.mnemonic} done\n${li.mnemonic} R3, 1\ndone: ${halt.mnemonic}`,registers:{"3":0},haltPc:2});
 const memory=design.nodes.find(n=>n.kind==="imem"||n.kind==="umem");const encodable=results.filter(t=>{const assembled=assemble(design.isa,t.source);return assembled.ok&&assembled.words.length<=(memory?.mem.length??0);});if(!encodable.length)throw new Error("This encoding or instruction memory cannot fit any generated challenge. Create explicit test programs.");return encodable;
}

// Independent integer semantics: deliberately does not call aluNum/evaluateGraph/stepInstruction.
export function referenceAlu(a:number,b:number,op:string,width:number):number {const x=BigInt(a),y=BigInt(b);const value=op==="ADD"?x+y:op==="SUB"?x-y:op==="AND"?x&y:op==="OR"?x|y:op==="XOR"?x^y:op==="NOT"?~x:op==="SHL"?x<<1n:op==="SHR"?x>>1n:op==="INC"?x+1n:op==="DEC"?x-1n:op==="CMP"?BigInt(a>b?1:0):undefined;if(value===undefined)throw new Error("Unknown reference ALU operation.");return Number(BigInt.asUintN(width,value));}
export function referenceFlags(a:number,b:number,op:string,width:number):ExecTrace["flags"] {const y=referenceAlu(a,b,op,width);const sign=2**(width-1);const signed=(v:number)=>v>=sign?v-2**width:v;let c=0,v=0;const subtract=op==="SUB"||op==="DEC",arithmetic=["ADD","SUB","INC","DEC"].includes(op);if(arithmetic){const other=op==="INC"||op==="DEC"?1:b;const integer=subtract?BigInt(a)-BigInt(other):BigInt(a)+BigInt(other);c=subtract?Number(integer>=0n):Number(integer>=2n**BigInt(width));const sum=subtract?signed(a)-signed(other):signed(a)+signed(other);v=Number(sum < -sign || sum>=sign);}else if(op==="SHL")c=Number(a>=sign);else if(op==="SHR")c=a%2;if(op==="CMP")return {z:Number(a===b) as 0|1,n:Number(signed(a)<signed(b)) as 0|1,c:Number(a<b) as 0|1,v:0};return {z:Number(y===0) as 0|1,n:Number(y>=sign) as 0|1,c:c as 0|1,v:v as 0|1};}
interface ReferenceState {pc:number;registers:number[];memory:number[];halt:boolean;flags:ExecTrace["flags"];}
function referenceStep(design:CpuDesign,words:number[],state:ReferenceState):ReferenceState {
 if(state.pc<0||state.pc>=words.length)throw new Error("Reference PC outside assembled program.");const decoded=decodeWord(design.isa,words[state.pc]!);const i=decoded.instr;if(!i)throw new Error("Reference unknown opcode.");const f=decoded.fields;
 const register=(r:number)=>{if(r<0||r>=state.registers.length)throw new Error("Reference register outside architecture.");return state.registers[r]!;};
 const bits=immediateWidth(design.isa,i);const imm=f.imm??0;const signed=fieldsOf(design.isa,i.format).some(v=>v.purpose==="imm"&&v.signed);const immediate=signed?signedImmediate(imm,bits):imm;
 const aMode=i.operandA??(i.mem!=="none"||i.mnemonic==="LOADI"?"zero":i.operands.includes("rs1")?"rs1":"rd");const a=aMode==="zero"?0:register(aMode==="rd"?f.rd??0:i.operands.includes("rs1")?f.rs1??0:f.rd??0);const b=i.aluSrc==="imm"?Number(BigInt.asUintN(design.isa.dataWidth,BigInt(immediate))):register(f.rs2??0);
 const result=referenceAlu(a,b,i.aluOp,design.isa.dataWidth);const memory=state.memory.slice();const registers=state.registers.slice();let value=result;
 if(i.mem!=="none"){if(result<0||result>=memory.length)throw new Error("Reference memory address outside capacity.");if(i.mem==="store")memory[result]=register(f.rd??0);else if(i.memToReg)value=memory[result]!;}
 if(i.regWrite){const rd=f.rd??0;register(rd);registers[rd]=value;}
 const next=i.pc==="halt"?state.pc:i.pc==="jump"?imm:(i.pc==="branchEq"&&result===0||i.pc==="branchNe"&&result!==0)?state.pc+signedImmediate(imm,bits):state.pc+1;
 return {pc:Number(BigInt.asUintN(design.nodes.find(n=>n.kind==="pc")!.width,BigInt(next))),registers,memory,halt:i.pc==="halt",flags:referenceFlags(a,b,i.aluOp,design.isa.dataWidth)};
}
export function contestEligibility(design:CpuDesign) {
 if(design.nodes.length>128||design.wires.length>512)return [{id:"CONTEST-SIZE",level:"error" as const,category:"Contest",message:"Contest runner supports up to 128 components and 512 wires to keep bounded runs responsive.",fix:"Reduce the graph before running contest tests.",route:"contest"}];
 const findings=engineeringFindings(design);const c=engineeringOf(design);const extra=(id:string,message:string)=>findings.push({id,level:"error",category:"Contest",message,fix:"Use the supported strict logic-level CPU model for contest evidence.",route:"contest"});
 if(c.unknown!=="strict")extra("CONTEST-UNKNOWN","Contest results require strict unknown-signal handling.");
 if(design.nodes.some(n=>["cache","core"].includes(n.kind)))extra("CONTEST-MODEL","Cache/core sandbox blocks are not executable CPU implementations in this studio.");
 if(c.regions.some(r=>r.latency!==1||r.kind==="io"))extra("CONTEST-MEMORY","Variable-latency stalls and peripheral side effects are not implemented; use one-cycle RAM/ROM regions.");
 if(["pc","ir","alu","clock"].some(kind=>design.nodes.filter(n=>n.kind===kind).length!==1)||design.nodes.filter(n=>["regfile","acc"].includes(n.kind)).length!==1||design.nodes.filter(n=>["imem","umem"].includes(n.kind)).length!==1||design.nodes.filter(n=>["dmem","umem"].includes(n.kind)).length>1)extra("CONTEST-AMBIGUOUS","Contest execution requires one PC, IR, ALU, clock, register architecture and instruction memory, and at most one data memory.");
 return findings;
}
export async function runContestTest(original:CpuDesign,test:ContestTest,options:{cancelled?:()=>boolean;yield?:()=>Promise<void>}={}):Promise<ContestResult> {
 const base:ContestResult={id:test.id,name:test.name,status:"blocked",reason:"",cycles:0,instructions:0,cpi:null,registers:[],memory:[],pc:0,coverage:[],assertions:[],trace:[],listing:[]};
 const errors=contestEligibility(original).filter(f=>f.level==="error");if(errors.length)return {...base,reason:errors.map(f=>f.message).join(" ")};
 const max=2**original.isa.dataWidth-1;const memoryCapacity=original.nodes.find(n=>n.kind==="dmem"||n.kind==="umem")?.mem.length??0;const registers=original.nodes.some(n=>n.kind==="acc")?1:original.isa.regs;
 if(Object.entries(test.registers).some(([key,value])=>Number(key)>=registers||value>max)||Object.entries(test.memory).some(([key,value])=>Number(key)>=memoryCapacity||value>max))return {...base,reason:"Assertions exceed this CPU's register count, memory capacity or data width."};
 const built=assemble(original.isa,test.source);if(!built.ok)return {...base,reason:built.errors.map(e=>`Line ${e.line}: ${e.message}`).join(" ")};if(!built.listing.length)return {...base,reason:"The test program is empty."};base.listing=built.listing.map(({address,word,text})=>({address,word,text}));
 const im=original.nodes.find(n=>["imem","umem"].includes(n.kind))!;if(built.words.length>im.mem.length)return {...base,reason:"Test exceeds instruction memory capacity."};
 let d=resetCpu({...structuredClone(original),program:test.source});const initialRf=d.nodes.find(n=>n.kind==="regfile");if(test.reference&&(!initialRf||d.nodes.some(n=>n.kind==="umem")||d.nodes.some(n=>n.kind==="dmem"&&n.width!==d.isa.dataWidth)))return {...base,reason:"Independent comparison requires a register-file CPU with separate instruction/data memories and matching data-memory/datapath widths. Use explicit assertions for accumulator, unified-memory or mixed-width memory tests."};
 if(!test.reference&&!Object.keys(test.registers).length&&!Object.keys(test.memory).length&&test.haltPc===undefined)return {...base,reason:"Add at least one explicit assertion or enable the independent reference."};
 let ref:ReferenceState={pc:0,registers:initialRf?.values.slice()??[],memory:(d.nodes.find(n=>n.kind==="dmem"||n.kind==="umem")?.mem??[]).slice(),halt:false,flags:{z:0,n:0,c:0,v:0}};let stopped=false;let failure="";let cancelled=false;const covered=new Set<string>();
 for(let cycle=1;cycle<=test.maxCycles;cycle++){
  if(options.cancelled?.()){cancelled=true;failure="Run cancelled.";break;}
  const before=d;const r=stepMicroCycle(d,cycle);d=r.design;base.trace.push(r.trace);base.cycles=cycle;
  if(r.trace.mnemonic==="FAULT"){failure=r.trace.reason;break;}
  const committed=engineeringOf(before).mode==="single"||engineeringOf(before).control.find(s=>s.id===engineeringOf(before).state)?.action==="writeback";
  if(committed){base.instructions++;covered.add(r.trace.mnemonic);if(test.reference){try{ref=referenceStep(original,built.words,ref);const actualRegisters=d.nodes.find(n=>n.kind==="regfile")!.values;const actualMemory=d.nodes.find(n=>n.kind==="dmem"||n.kind==="umem")?.mem??[];const actualPc=d.nodes.find(n=>n.kind==="pc")!.value;
   const diff=ref.registers.findIndex((v,i)=>v!==actualRegisters[i]);const memDiff=ref.memory.findIndex((v,i)=>v!==actualMemory[i]);if(diff>=0)failure=`Instruction ${base.instructions}: R${diff} expected ${ref.registers[diff]}, observed ${actualRegisters[diff]}.`;else if(memDiff>=0)failure=`Instruction ${base.instructions}: MEM[${memDiff}] expected ${ref.memory[memDiff]}, observed ${actualMemory[memDiff]}.`;else if(ref.pc!==actualPc)failure=`Instruction ${base.instructions}: PC expected ${ref.pc}, observed ${actualPc}.`;else if(ref.halt!==r.trace.halt)failure="HALT disagrees with independent reference.";else for(const flag of ["z","n","c","v"] as const)if(ref.flags[flag]!==r.trace.flags[flag]){failure=`Instruction ${base.instructions}: ${flag.toUpperCase()} flag expected ${ref.flags[flag]}, observed ${r.trace.flags[flag]}.`;break;}
  }catch(e){failure=e instanceof Error?e.message:"Reference execution failed.";}}}
  if(test.reference&&committed&&!failure){const flags=d.nodes.find(n=>n.kind==="flags");const expected=ref.flags.z|ref.flags.n<<1|ref.flags.c<<2|ref.flags.v<<3;if(flags&&flags.value!==expected)failure=`Instruction ${base.instructions}: captured flags expected ${expected}, observed ${flags.value}.`;}
  if(failure)break;if(r.trace.halt){stopped=true;break;}if(cycle%8===0&&options.yield)await options.yield();
 }
 base.registers=d.nodes.find(n=>n.kind==="regfile")?.values.slice()??[d.nodes.find(n=>n.kind==="acc")?.value??0];base.memory=(d.nodes.find(n=>n.kind==="dmem"||n.kind==="umem")?.mem??[]).slice();base.pc=d.nodes.find(n=>n.kind==="pc")?.value??0;base.coverage=[...covered].sort();base.cpi=base.instructions?base.cycles/base.instructions:null;
 for(const [i,expected] of Object.entries(test.registers))base.assertions.push({target:`R${i}`,expected,actual:base.registers[Number(i)],pass:base.registers[Number(i)]===expected});
 for(const [i,expected] of Object.entries(test.memory))base.assertions.push({target:`MEM[${i}]`,expected,actual:base.memory[Number(i)],pass:base.memory[Number(i)]===expected});
 if(test.haltPc!==undefined)base.assertions.push({target:"HALT PC",expected:test.haltPc,actual:base.pc,pass:base.pc===test.haltPc});
 failure||=base.assertions.find(a=>!a.pass)?"An explicit final-state assertion failed.":!stopped?`Cycle budget exhausted (${test.maxCycles}).`:"";
 return {...base,status:cancelled?"cancelled":failure?"fail":"pass",reason:failure||"HALT reached; all requested comparisons and assertions passed."};
}
export async function runContestSuite(design:CpuDesign,tests:ContestTest[],options:{cancelled?:()=>boolean;yield?:()=>Promise<void>;progress?:(done:number,total:number)=>void}={}):Promise<ContestReport> {
 const suite=structuredClone(parseTestSuite(tests));const frozen=structuredClone(design);const results:ContestResult[]=[];for(const t of suite){results.push(await runContestTest(frozen,t,options));options.progress?.(results.length,suite.length);if(options.cancelled?.())break;if(options.yield)await options.yield();}
 const passed=results.filter(r=>r.status==="pass").length;return {engine:CONTEST_ENGINE,designHash:await sha256(executionIdentity(frozen)),suiteHash:await sha256(suite),architecture:{name:frozen.name,dataWidth:frozen.isa.dataWidth,instructionWidth:frozen.isa.instrWidth,mnemonics:frozen.isa.instructions.map(i=>i.mnemonic)},findings:contestEligibility(frozen),results,passed,total:suite.length,score:Math.floor(100*passed/suite.length)};
}
export async function createSubmission(design:CpuDesign,config:ContestConfig,report:ContestReport):Promise<Submission> {
 const tests=parseTestSuite(config.tests);const designHash=await sha256(executionIdentity(design));const suiteHash=await sha256(tests);if(report.engine!==CONTEST_ENGINE||report.designHash!==designHash||report.suiteHash!==suiteHash||report.results.length!==tests.length||report.results.some(r=>r.status==="cancelled"))throw new Error("Results are stale or incomplete. Run the current project and test suite again.");
 if(!config.participant.trim()||!config.team.trim())throw new Error("Participant and team names are required for a submission.");
 validateReport(report,tests);
 const fullHash=await sha256(design);const submission:Submission={kind:"aimer-cpu-submission",version:1,engine:CONTEST_ENGINE,participant:config.participant,team:config.team,notes:config.notes,design:structuredClone(design),tests,report,manifest:{designHash:fullHash,suiteHash,reportHash:await sha256(report)}};if(new TextEncoder().encode(JSON.stringify(submission,null,2)).byteLength>MAX_SUBMISSION_BYTES)throw new Error("Submission exceeds 64 MiB. Reduce the test trace budgets or memory capacity and rerun.");return submission;
}
export async function verifySubmission(raw:unknown):Promise<Submission> {
 if(!raw||typeof raw!=="object")throw new Error("Expected a submission object.");const s=raw as Submission;if(s.kind!=="aimer-cpu-submission"||s.version!==1||s.engine!==CONTEST_ENGINE||!s.manifest||!s.report||typeof s.participant!=="string"||typeof s.team!=="string"||typeof s.notes!=="string")throw new Error("Unsupported submission format or engine.");
 const design=migrateProject({version:2,kind:"logiclab-cpu",design:s.design});const tests=parseTestSuite(s.tests);
 if(!s.participant.trim()||!s.team.trim()||s.participant.length>200||s.team.length>200||s.notes.length>10000)throw new Error("Invalid participant metadata.");
 validateReport(s.report,tests);
 if(await sha256(s.design)!==s.manifest.designHash||await sha256(tests)!==s.manifest.suiteHash||await sha256(s.report)!==s.manifest.reportHash||s.report.designHash!==await sha256(executionIdentity(design))||s.report.suiteHash!==s.manifest.suiteHash||s.report.engine!==CONTEST_ENGINE)throw new Error("Submission hashes disagree; content changed or the package is invalid.");
 return {...s,design,tests};
}
export function validateReport(report:ContestReport,tests:ContestTest[]) {if(!report||report.engine!==CONTEST_ENGINE||!report.architecture||!Array.isArray(report.architecture.mnemonics)||!Array.isArray(report.findings)||!Array.isArray(report.results)||report.total!==tests.length||report.results.length!==tests.length)throw new Error("Invalid or incomplete contest report.");const passed=report.results.filter(r=>r.status==="pass").length;if(report.passed!==passed||report.score!==Math.floor(100*passed/tests.length))throw new Error("Reported score does not match the test results.");for(const [index,r] of report.results.entries()){if(!r||r.id!==tests[index]!.id||!['pass','fail','blocked'].includes(r.status)||!Number.isInteger(r.cycles)||r.cycles<0||r.cycles>tests[index]!.maxCycles||!Number.isInteger(r.instructions)||r.instructions<0||r.instructions>r.cycles||!Array.isArray(r.trace)||r.trace.length!==r.cycles||!Array.isArray(r.registers)||!Array.isArray(r.memory)||!Array.isArray(r.assertions)||!Array.isArray(r.listing)||!Array.isArray(r.coverage)||r.cpi!==(r.instructions?r.cycles/r.instructions:null))throw new Error("Malformed contest result, metrics or trace.");}}
export function resultsCsv(report:ContestReport):string {const cell=(s:unknown)=>{const original=String(s??"");const safe=typeof s==="string"&&/^\s*[=+\-@]/.test(original)?`'${original}`:original;return `"${safe.replace(/"/g,'""')}"`;};return [["Test","Status","Cycles","Instructions (includes HALT)","CPI","Reason"],...report.results.map(r=>[r.name,r.status,r.cycles,r.instructions,r.cpi,r.reason])].map(row=>row.map(cell).join(",")).join("\r\n");}
export function netlist(design:CpuDesign) {return {engine:CONTEST_ENGINE,name:design.name,wordAddressed:true,components:design.nodes,wires:design.wires,isa:design.isa};}


