import { emptyDesign, portsOf, type ArchNode, type ArchWire, type CpuDesign, type PortDef, type Width } from "./model";

export interface BlockBehavior {
  ports: PortDef[];
  outputs: Record<string,string>;
  registers?: Record<string,number>;
  next?: Record<string,string>;
  clock?: string;
  reset?: string;
  initial?: Record<string,number>;
  write?: {enable:string;address:string;data:string};
  latency?: number;
  pending?: {address:number;remaining:number};
  device?: "switch" | "terminal" | "timer";
  text?: string;
}
export interface CircuitModule { id:string; name:string; ports:(PortDef & {endpoint:{node:string;port:string}})[]; nodes:ArchNode[]; wires:ArchWire[]; }
export interface MicroOperation { target:string; expression:string; }
export interface MicroWord { name:string; drives:MicroOperation[]; next:number; condition?:string; alternate?:number; commit?:boolean; halt?:boolean; }
export interface ConstructionConfig { execution:"legacy"|"circuit"; microcode?:MicroWord[]; microPc?:number; useMicrocode?:boolean; modules?:CircuitModule[]; tests?:CircuitTest[]; nets?:{name:string;from:string;port:string;targets:{node:string;port:string}[]}[]; }
export interface CircuitTest {name:string;cycles:number;inputs:Record<string,number>;expect:Record<string,number>;steps?:{cycle:number;inputs?:Record<string,number>;expect?:Record<string,number>}[];}

// A small integer expression language. It never evaluates JavaScript or accesses the host.
export function expression(source:string, read:(name:string)=>number, memory:readonly number[]=[]):number {
  if(source.length>2000)throw new Error("Expression exceeds 2000 characters.");
  const tokens=source.match(/\s*(0x[\da-f]+|0b[01]+|\d+|[A-Za-z_$][\w.$]*|>>>|<<|>>|==|!=|<=|>=|&&|\|\||[()+*%&|^~!?:,<>=-])/gi)??[];
  if(tokens.join("").replace(/\s/g,"")!==source.replace(/\s/g,""))throw new Error("Invalid expression character.");
  const t=tokens.map(s=>s.trim());let at=0;let depth=0;
  const precedence:Record<string,number>={"||":1,"&&":2,"|":3,"^":4,"&":5,"==":6,"!=":6,"<":7,">":7,"<=":7,">=":7,"<<":8,">>":8,">>>":8,"+":9,"-":9,"*":10,"%":10};
  function parse(min=0):bigint {
    if(++depth>64)throw new Error("Expression nesting exceeds 64.");
    const token=t[at++];let left:bigint;
    if(token==="("){left=parse();if(t[at++]!==")")throw new Error("Expected ).");}
    else if(token==="~"||token==="-"||token==="!"||token==="+"){const v=parse(11);left=token==="~"?~v:token==="-"?-v:token==="!"?BigInt(!v):v;}
    else if(token==="mem"&&t[at]==="("){at++;const address=Number(parse());if(t[at++]!==")")throw new Error("Expected memory address closing ).");if(!Number.isSafeInteger(address)||address<0||address>=memory.length)throw new Error(`Memory address ${address} is outside capacity ${memory.length}.`);left=BigInt(memory[address]!);}
    else if(token&&/^(0x[\da-f]+|0b[01]+|\d+)$/i.test(token))left=BigInt(token);
    else if(token&&/^[A-Za-z_$][\w.$]*$/.test(token)){const value=read(token);if(!Number.isSafeInteger(value))throw new Error(`Unknown or invalid signal ${token}.`);left=BigInt(value);}
    else throw new Error(`Expected an integer or signal, received ${token??"end"}.`);
    while(t[at]&&(precedence[t[at]!]??-1)>=min){const op=t[at++]!;const right=parse(precedence[op]!+1);switch(op){case"+":left+=right;break;case"-":left-=right;break;case"*":left*=right;break;case"%":if(!right)throw new Error("Modulo by zero.");left%=right;break;case"&":left&=right;break;case"|":left|=right;break;case"^":left^=right;break;case"<<":case">>":case">>>":if(right<0n||right>32n)throw new Error("Shift amount must be 0–32.");left=op==="<<"?left<<right:op===">>>"?BigInt.asUintN(32,left)>>right:left>>right;break;case"==":left=BigInt(left===right);break;case"!=":left=BigInt(left!==right);break;case"<":left=BigInt(left<right);break;case">":left=BigInt(left>right);break;case"<=":left=BigInt(left<=right);break;case">=":left=BigInt(left>=right);break;case"&&":left=BigInt(!!left&&!!right);break;case"||":left=BigInt(!!left||!!right);break;}}
    if(min===0&&t[at]==="?"){at++;const yes=parse();if(t[at++]!==":")throw new Error("Expected : in conditional.");const no=parse();left=left?yes:no;}
    depth--;return BigInt.asIntN(64,left);
  }
  const value=parse();if(at!==t.length)throw new Error(`Unexpected token ${t[at]}.`);return Number(BigInt.asUintN(32,value));
}

export function behaviorValues(node:ArchNode, input:(port:string)=>number):Record<string,number> {
  const b=node.behavior;if(!b)return {};
  const read=(name:string)=>name in (b.registers??{})?b.registers![name]!:name==="value"?node.value:input(name);
  return Object.fromEntries(Object.entries(b.outputs).map(([port,formula])=>[port,expression(formula,read,node.mem)&(portsOf(node).find(p=>p.id===port)?.width===32?-1:2**(portsOf(node).find(p=>p.id===port)?.width??node.width)-1)]));
}

export function flattenCircuit(original:CpuDesign):{design:CpuDesign;aliases:Map<string,string>;restore:(nodes:ArchNode[])=>CpuDesign} {
  const aliases=new Map<string,string>();let count=0;
  function visit(nodes:ArchNode[],wires:ArchWire[],prefix:string,depth:number):{nodes:ArchNode[];wires:ArchWire[]} {
    if(depth>12)throw new Error("Module hierarchy exceeds 12 levels.");
    const all:ArchNode[]=[];const links:ArchWire[]=[];const endpoint=(id:string,port:string)=>{const node=nodes.find(n=>n.id===id);return node?.circuit?{id:`${prefix}${id}::${port}`,port:portsOf(node).find(p=>p.id===port)?.dir==="in"?"a":"y"}:{id:prefix+id,port};};
    for(const n of nodes){if(++count>10000)throw new Error("Expanded circuit exceeds 10000 components.");const id=prefix+n.id;
      if(!n.circuit){all.push({...n,id});continue;}
      const inner=visit(n.circuit.nodes,n.circuit.wires,id+"/",depth+1);all.push(...inner.nodes);links.push(...inner.wires);
      for(const p of n.circuit.ports){const bridge=`${id}::${p.id}`;const child=endpointInner(n.circuit.nodes,p.endpoint,id+"/");const portList:PortDef[]=[{id:"a",name:"A",dir:"in",width:p.width,role:p.role},{id:"y",name:"Y",dir:"out",width:p.width,role:p.role}];all.push({...n,id:bridge,kind:"buf",circuit:undefined,behavior:{ports:portList,outputs:{y:"a"}},mem:[],values:[]});links.push({id:bridge+"_link",from:p.dir==="in"?bridge:child.id,fromPort:p.dir==="in"?"y":child.port,to:p.dir==="in"?child.id:bridge,toPort:p.dir==="in"?child.port:"a"});if(p.dir==="out")aliases.set(`${id}:${p.id}`,`${bridge}:y`);}
    }
    links.push(...wires.map(w=>{const from=endpoint(w.from,w.fromPort),to=endpoint(w.to,w.toPort);return {...w,id:prefix+w.id,from:from.id,fromPort:from.port,to:to.id,toPort:to.port};}));return {nodes:all,wires:links};
  }
  function endpointInner(nodes:ArchNode[],p:{node:string;port:string},prefix:string){const node=nodes.find(n=>n.id===p.node);if(!node)throw new Error(`Module endpoint ${p.node} does not exist.`);return node.circuit?{id:`${prefix}${p.node}::${p.port}`,port:portsOf(node).find(v=>v.id===p.port)?.dir==="in"?"a":"y"}:{id:prefix+p.node,port:p.port};}
  const expanded=visit(original.nodes,original.wires,"",0);
  // Named nets compile into ordinary typed wires; the editor retains their shared name.
  for(const net of original.engineering?.construction?.nets??[])for(const target of net.targets){const from=original.nodes.find(n=>n.id===net.from),to=original.nodes.find(n=>n.id===target.node);expanded.wires.push({id:`net:${net.name}:${target.node}:${target.port}`,from:from?.circuit?`${from.id}::${net.port}`:net.from,fromPort:from?.circuit?"y":net.port,to:to?.circuit?`${to.id}::${target.port}`:target.node,toPort:to?.circuit?"a":target.port});}
  function restore(updated:ArchNode[]):CpuDesign{const map=new Map(updated.map(n=>[n.id,n]));function fold(nodes:ArchNode[],prefix:string):ArchNode[]{return nodes.map(n=>n.circuit?{...n,circuit:{...n.circuit,nodes:fold(n.circuit.nodes,prefix+n.id+"/")}}:{...(map.get(prefix+n.id)??n),id:n.id});}return {...original,nodes:fold(original.nodes,"")};}
  return {design:{...original,...expanded,engineering:original.engineering?{...original.engineering,construction:{...original.engineering.construction,execution:original.engineering.construction?.execution??"legacy",nets:[]}}:undefined},aliases,restore};
}

export function constructionDesign(name="Scratch CPU"):CpuDesign {const d=emptyDesign(name);return {...d,program:"",engineering:undefined};}
export function validateBehavior(node:ArchNode):void {
  const b=node.behavior;if(!b)return;if(!Array.isArray(b.ports)||b.ports.length>64)throw new Error("A custom block needs at most 64 ports.");const ids=new Set<string>();for(const p of b.ports){if(!/^[A-Za-z_]\w*$/.test(p.id)||ids.has(p.id)||!Number.isInteger(p.width)||p.width<1||p.width>32||!["in","out"].includes(p.dir)||!["data","control","clock"].includes(p.role))throw new Error("Invalid or duplicate custom port.");ids.add(p.id);}
  if(!b.outputs||typeof b.outputs!=="object"||Object.keys(b.outputs).some(p=>!b.ports.some(v=>v.id===p&&v.dir==="out")))throw new Error("Custom outputs must reference output ports.");
  const read=(name:string)=>{if(name==="value"||name in (b.registers??{})||b.ports.some(p=>p.dir==="in"&&p.id===name))return 0;throw new Error(`Unknown signal ${name}.`);};
  for(const s of Object.values(b.outputs))if(typeof s!=="string")throw new Error("Expressions must be strings.");else {try{expression(s,read,node.mem.length?node.mem:[0]);}catch(e){if(!String(e).includes("Memory address"))throw e;}}
  for(const [key,value] of Object.entries(b.registers??{}))if(!/^[A-Za-z_]\w*$/.test(key)||!Number.isSafeInteger(value))throw new Error("Invalid internal register.");
  for(const [key,s] of Object.entries(b.next??{})){if(!(key in (b.registers??{})))throw new Error(`Missing register ${key}.`);expression(s,read,node.mem.length?node.mem:[0]);}
  if(b.clock&&!b.ports.some(p=>p.id===b.clock&&p.dir==="in"&&p.width===1))throw new Error("Clock must be a one-bit input.");
}

export function customBlock(name:string,width:Width,behavior:BlockBehavior):ArchNode {return {id:"custom",name,kind:"buf",width,x:0,y:0,value:0,values:[],mem:[],we:false,op:"ADD",sel:0,note:"",behavior};}

export function encapsulate(design:CpuDesign,selected:string[],name:string):CpuDesign {
  const ids=new Set(selected);const nodes=design.nodes.filter(n=>ids.has(n.id));if(!nodes.length)throw new Error("Select components to encapsulate.");
  const ports:CircuitModule["ports"]=[];const exposed=new Map<string,string>();
  for(const n of nodes)for(const p of portsOf(n)){const boundary=design.wires.some(w=>p.dir==="in"?w.to===n.id&&w.toPort===p.id&&!ids.has(w.from):w.from===n.id&&w.fromPort===p.id&&!ids.has(w.to));const unconnected=!design.wires.some(w=>p.dir==="in"?w.to===n.id&&w.toPort===p.id:w.from===n.id&&w.fromPort===p.id);if(boundary||unconnected){const id=`p${ports.length}`;ports.push({...p,id,name:`${n.name}.${p.name}`,endpoint:{node:n.id,port:p.id}});exposed.set(`${n.id}:${p.id}`,id);}}
  const module:CircuitModule={id:`module-${design.nextId}`,name,ports,nodes:structuredClone(nodes),wires:structuredClone(design.wires.filter(w=>ids.has(w.from)&&ids.has(w.to)))};
  const node={...customBlock(name,16,{ports:[],outputs:{}}),id:`n${design.nextId}`,x:Math.min(...nodes.map(n=>n.x)),y:Math.min(...nodes.map(n=>n.y)),behavior:undefined,circuit:module};
  return {...design,nextId:design.nextId+1,nodes:[...design.nodes.filter(n=>!ids.has(n.id)),node],wires:design.wires.filter(w=>!(ids.has(w.from)&&ids.has(w.to))).map(w=>({...w,from:ids.has(w.from)?node.id:w.from,fromPort:ids.has(w.from)?exposed.get(`${w.from}:${w.fromPort}`)!:w.fromPort,to:ids.has(w.to)?node.id:w.to,toPort:ids.has(w.to)?exposed.get(`${w.to}:${w.toPort}`)!:w.toPort}))};
}

export function explainSignal(design:CpuDesign,nodeId:string,port:string):string[] {
  const flat=flattenCircuit(design),graph=flat.design;const lines:string[]=[];const seen=new Set<string>();
  function visit(id:string,p:string,depth:number){const key=`${id}:${p}`;if(seen.has(key)||depth>16)return;seen.add(key);const n=graph.nodes.find(n=>n.id===id);if(!n){lines.push(`Missing component ${id}`);return;}const def=portsOf(n).find(v=>v.id===p);if(def?.dir==="in"){const w=graph.wires.find(w=>w.to===id&&w.toPort===p);lines.push(`${"  ".repeat(depth)}${n.name}.${p}: ${w?`driven by ${w.from}.${w.fromPort}`:"DISCONNECTED (Z)"}`);if(w)visit(w.from,w.fromPort,depth+1);}else {lines.push(`${"  ".repeat(depth)}${n.name}.${p}: ${n.behavior?.outputs[p]??n.kind}`);if(!["const","clock","gpr","pc","ir","acc","dff","counter"].includes(n.kind))for(const input of portsOf(n).filter(v=>v.dir==="in"))visit(id,input.id,depth+1);}}
  const alias=flat.aliases.get(`${nodeId}:${port}`);if(alias){const at=alias.lastIndexOf(":");visit(alias.slice(0,at),alias.slice(at+1),0);}else visit(nodeId,port,0);return lines;
}
