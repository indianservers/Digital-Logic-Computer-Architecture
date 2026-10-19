import { portsOf, type CpuDesign } from "./model";
import { evaluateLogicGraph } from "./logicGraph";
import { designJson, parseDesignJson, type ExecTrace, type WaveSample } from "./sim";
import { stableStringify } from "./contest";
import { expression as integerExpression, flattenCircuit } from "./construction";
import { signalNumber } from "./constructionTools";

export function signalDisplay(bits:string,role="data") {
  if(!/^[01]+$/.test(bits))return {binary:bits,hex:"—",unsigned:"—",signed:"—",state:bits.includes("X")?"Unknown (X)":"Disconnected (Z)"};
  const value=BigInt(`0b${bits}`);return {binary:bits,hex:`0x${value.toString(16).toUpperCase().padStart(Math.ceil(bits.length/4),"0")}`,unsigned:String(value),signed:role==="data"?String(BigInt.asIntN(bits.length,value)):"Control",state:"Known"};
}
export function signalsOf(design:CpuDesign) {
  const graph=evaluateLogicGraph(design);
  return design.wires.map(w=>{const n=design.nodes.find(n=>n.id===w.from);const to=design.nodes.find(n=>n.id===w.to);const port=n&&portsOf(n).find(p=>p.id===w.fromPort);const bits=(graph.values.get(`${w.from}:${w.fromPort}`)??[]).join("");return {...w,label:`${n?.name??w.from}.${w.fromPort} → ${to?.name??w.to}.${w.toPort}`,width:port?.width??1,role:port?.role??"data",...signalDisplay(bits,port?.role)};});
}
export function stateChanges(before:CpuDesign,after:CpuDesign) {
  if(before.nodes.some(n=>n.circuit)||after.nodes.some(n=>n.circuit)){before=flattenCircuit(before).design;after=flattenCircuit(after).design;}
  const changes:{component:string;field:string;before:number;after:number}[]=[];
  for(const n of after.nodes){const old=before.nodes.find(v=>v.id===n.id);if(!old)continue;
    if(n.value!==old.value)changes.push({component:n.name,field:"value",before:old.value,after:n.value});
    for(const field of ["values","mem"] as const)n[field].forEach((v,i)=>{if(v!==old[field][i])changes.push({component:n.name,field:`${field==="mem"?"MEM":"R"}[${i}]`,before:old[field][i]??0,after:v});});
    for(const [field,value] of Object.entries(n.behavior?.registers??{}))if(value!==old.behavior?.registers?.[field])changes.push({component:n.name,field,before:old.behavior?.registers?.[field]??0,after:value});
  }return changes;
}
export function designChanges(before:CpuDesign,after:CpuDesign) {
  const labels:string[]=[];for(const [field,label] of [["nodes","Components"],["wires","Connections"],["isa","ISA"],["program","Program"]] as const)if(stableStringify(before[field])!==stableStringify(after[field]))labels.push(`${label} changed`);return labels;
}
export interface SavedVersion {id:string;name:string;data:string;created:number;}
export function tabEditIdentity(d:CpuDesign){return stableStringify({...d,pan:undefined,nodes:d.nodes.map(({x:_x,y:_y,...n})=>n),engineering:d.engineering?{...d.engineering,routeBends:undefined}:undefined});}
const VERSION_KEY="aimer-cpu-milestones-v1";
export function projectVersions():SavedVersion[]{try{const raw=JSON.parse(localStorage.getItem(VERSION_KEY)??"[]");return Array.isArray(raw)?raw.filter(v=>v&&typeof v.id==="string"&&typeof v.name==="string"&&typeof v.data==="string"&&Number.isFinite(v.created)&&parseDesignJson(v.data).ok):[];}catch{return [];}}
export function saveVersion(design:CpuDesign,name:string):SavedVersion[]{const next=[{id:crypto.randomUUID(),name:name.trim()||design.name,data:designJson(design),created:Date.now()},...projectVersions()].slice(0,12);localStorage.setItem(VERSION_KEY,JSON.stringify(next));return next;}

// Deliberately small grammar. No JavaScript execution, property access or eval.
export function conditionMatches(expression:string,design:CpuDesign,trace:ExecTrace|null):boolean {
  if(design.engineering?.construction?.execution==="circuit")return integerExpression(expression,reference=>signalNumber(design,reference))!==0;
  const match=/^\s*(PC|R\d+|MEM\[(?:0x[\da-f]+|\d+)\]|[ZNCV])\s*(==|!=|>=|<=|>|<)\s*(-?(?:0x[\da-f]+|\d+))\s*$/i.exec(expression);
  if(!match)throw new Error("Use PC, Rn, MEM[address] or Z/N/C/V followed by ==, !=, >=, <=, > or < and an integer.");
  const key=match[1]!.toUpperCase();const rf=design.nodes.find(n=>n.kind==="regfile"||n.kind==="acc");let value:number|undefined;
  if(key==="PC")value=design.nodes.find(n=>n.kind==="pc")?.value;
  else if(/^R\d+$/.test(key))value=rf?.kind==="acc"?(key==="R0"?rf.value:undefined):rf?.values[Number(key.slice(1))];
  else if(key.startsWith("MEM"))value=design.nodes.find(n=>n.kind==="dmem"||n.kind==="umem")?.mem[Number(key.slice(4,-1))];
  else value=trace?.flags[key.toLowerCase() as "z"|"n"|"c"|"v"];
  if(value===undefined)throw new Error(`${key} is unavailable or outside the current architecture.`);
  const text=match[3]!;const target=text.startsWith("-")?-Number(text.slice(1)):Number(text);if(!Number.isSafeInteger(target))throw new Error("Comparison requires a safe integer.");
  return match[2]==="=="?value===target:match[2]==="!="?value!==target:match[2]===">="?value>=target:match[2]==="<="?value<=target:match[2]===">"?value>target:value<target;
}
export function waveformVcd(design:CpuDesign,samples:WaveSample[]):string {
  const defs=design.nodes.flatMap(n=>portsOf(n).filter(p=>p.dir==="out").map(p=>({key:`${n.id}:${p.id}`,width:p.width,name:`${n.id}_${p.id}`.replace(/[^\w]/g,"_")})));
  const lines=["$version AIMER logical CPU waveform $end","$comment One recorded simulated microcycle = 1 ns in this export; arbitrary visualization scale, not physical clock timing. Missing values are X. $end","$timescale 1ns $end","$scope module cpu $end",...defs.map((p,i)=>`$var wire ${p.width} s${i} ${p.name} $end`),"$upscope $end","$enddefinitions $end"];
  for(const s of samples){lines.push(`#${s.cycle}`);defs.forEach((p,i)=>{const v=s.values[p.key];const bits=s.logic?.[p.key]?.toLowerCase();lines.push(`b${bits??(v===undefined?"x".repeat(p.width):BigInt.asUintN(p.width,BigInt(v)).toString(2).padStart(p.width,"0"))} s${i}`);});}return lines.join("\n")+"\n";
}
