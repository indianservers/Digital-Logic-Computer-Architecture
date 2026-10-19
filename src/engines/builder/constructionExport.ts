import { portsOf, type CpuDesign } from "./model";
import { flattenCircuit } from "./construction";
import type { CircuitTest } from "./construction";
export interface HdlExport {source:string;diagnostics:string[];}
const safe=(s:string)=>"n_"+Array.from(s).map(c=>/[A-Za-z0-9_]/.test(c)?c:`_${c.codePointAt(0)!.toString(16)}_`).join("");
export function exportVerilog(original:CpuDesign):HdlExport {
  const diagnostics:string[]=[];let design:CpuDesign;try{design=flattenCircuit(original).design;}catch(e){return {source:"",diagnostics:[String(e)]};}
  const lines:string[]=["// Generated from the actual expanded circuit. Unsigned logical values; no physical timing model."];
  const top:string[]=[];const body:string[]=[];const key=(id:string,p:string)=>safe(id+"__"+p);const bits=(w:number)=>w===1?"":`[${w-1}:0] `;
  const wire=(id:string,p:string)=>{const w=design.wires.find(w=>w.to===id&&w.toPort===p);return w?key(w.from,w.fromPort):key(id,p);};
  for(const n of design.nodes){if(n.kind==="clock"){top.push(`input wire ${key(n.id,"y")}`);continue;}
    if(n.behavior?.device==="switch")top.push(`input wire ${bits(n.width)}${safe(n.id+"_switch")}`);
    for(const p of portsOf(n)){if(p.dir==="in"){if(!design.wires.some(w=>w.to===n.id&&w.toPort===p.id))top.push(`input wire ${bits(p.width)}${key(n.id,p.id)}`);}else {top.push(`output wire ${bits(p.width)}${key(n.id,p.id)}`);}}
  }
  lines.push(`module user_cpu(\n  ${top.join(",\n  ")}\n);`);
  for(const n of design.nodes){const assign=(p:string,s:string)=>body.push(`assign ${key(n.id,p)} = ${s};`);const a=wire(n.id,"a"),b=wire(n.id,"b");
    if(n.behavior){const behavior=n.behavior;if(behavior.device==="terminal"){diagnostics.push(`${n.name}: terminal text output is a simulator device; replace it with physical UART logic before synthesis.`);continue;}
      const translate=(formula:string)=>{
        if(formula.includes(">>>"))diagnostics.push(`${n.name}: unsigned-shift expressions need an explicit 32-bit mask and >> before HDL export.`);
        let result=formula.replace(/0x[\da-f]+|0b[01]+|\b\d+\b|\b[A-Za-z_]\w*\b/gi,name=>{if(/^(0x[\da-f]+|0b[01]+|\d+)$/i.test(name))return `64'sd${BigInt(name)}`;if(name==="value")return behavior.device==="switch"?`$signed({{${64-n.width}{1'b0}}, ${safe(n.id+"_switch")}})`:`64'sd${n.value>>>0}`;if(name in (behavior.registers??{}))return `$signed({32'b0, ${safe(n.id+"_reg_"+name)}})`;const port=behavior.ports.find(p=>p.id===name&&p.dir==="in");return port?`$signed({{${64-port.width}{1'b0}}, ${wire(n.id,name)}})`:name;});
        function memoryCalls(text:string):string{const start=/\bmem\s*\(/.exec(text);if(!start)return text;let depth=1,end=start.index+start[0].length;for(;end<text.length&&depth;end++){if(text[end]==="(")depth++;if(text[end]===")")depth--;}if(depth){diagnostics.push(`${n.name}: unbalanced memory expression.`);return text;}const inner=memoryCalls(text.slice(start.index+start[0].length,end-1));return memoryCalls(text.slice(0,start.index)+`$signed({32'b0, ${safe(n.id+"_mem")}[${inner}]})`+text.slice(end));}
        result=memoryCalls(result);return result;
      };
      if(n.mem.length){body.push(`reg [31:0] ${safe(n.id+"_mem")} [0:${n.mem.length-1}];`,"initial begin",...n.mem.map((v,i)=>`  ${safe(n.id+"_mem")}[${i}] = 32'd${v>>>0};`),"end");}
      for(const r of Object.keys(behavior.registers??{}))body.push(`reg [31:0] ${safe(n.id+"_reg_"+r)} = 32'd${behavior.initial?.[r]??0};`);
      for(const [port,formula] of Object.entries(behavior.outputs))assign(port,translate(formula));
      if(behavior.clock){body.push(`always @(posedge ${wire(n.id,behavior.clock)}) begin`);for(const [r,formula] of Object.entries(behavior.next??{}))body.push(`  ${safe(n.id+"_reg_"+r)} <= ${behavior.reset?`${wire(n.id,behavior.reset)} ? 32'd${behavior.initial?.[r]??0} : `:""}(${translate(formula)});`);if(behavior.write)body.push(`  if (${translate(behavior.write.enable)}) ${safe(n.id+"_mem")}[${translate(behavior.write.address)}] <= ${translate(behavior.write.data)};`);body.push("end");}
      continue;
    }
    if(n.circuit)continue;
    if(n.kind==="const")assign("y",`${n.width}'d${n.value>>>0}`);
    else if(n.kind==="clock")continue;
    else if(n.kind==="buf")assign("y",a);
    else if(["and","or","xor","nand","not"].includes(n.kind))assign("y",n.kind==="not"?`~${a}`:n.kind==="nand"?`~(${a} & ${b})`:`${a} ${{and:"&",or:"|",xor:"^"}[n.kind as "and"|"or"|"xor"]} ${b}`);
    else if(n.kind==="mux")assign("y",`${wire(n.id,"s")} ? ${wire(n.id,"i1")} : ${wire(n.id,"i0")}`);
    else if(n.kind==="bus")assign("y",`${wire(n.id,"en")} ? ${a} : ${n.width}'bz`);
    else if(n.kind==="inc")assign("y",`${a} + 1'b1`);
    else if(n.kind==="shifter")assign("y",`${a} << 1`);
    else if(n.kind==="cmp")assign("eq",`${a} == ${b}`);
    else if(n.kind==="sext"){const iw=n.inputWidth??n.width;assign("y",iw===n.width?a:`{{${n.width-iw}{${a}[${iw-1}]}}, ${a}}`);}
    else if(n.kind==="split"){assign("lo",`${a}[${n.width/2-1}:0]`);assign("hi",`${a}[${n.width-1}:${n.width/2}]`);}
    else if(n.kind==="join")assign("y",`{${wire(n.id,"hi")}, ${wire(n.id,"lo")}}`);
    else if(["pc","gpr","acc","ir","mar","mdr","sp","dff","counter"].includes(n.kind)){const state=safe(n.id+"_state");body.push(`reg ${bits(n.width)}${state} = ${n.width}'d0;`);assign("q",state);body.push(`always @(posedge ${wire(n.id,"clk")}) ${n.kind==="counter"?`${state} <= ${state} + 1'b1;`:n.kind==="dff"?`${state} <= ${wire(n.id,"d")};`:`if (${wire(n.id,"we")}) ${state} <= ${wire(n.id,"d")};`}`);}
    else if(["imem","dmem","umem"].includes(n.kind)){const memory=safe(n.id+"_mem");body.push(`reg ${bits(n.width)}${memory} [0:${n.mem.length-1}];`,"initial begin",...n.mem.map((v,i)=>`  ${memory}[${i}] = ${n.width}'d${v>>>0};`),"end");assign("q",n.kind==="dmem"?`${wire(n.id,"re")} ? ${memory}[${wire(n.id,"addr")}] : ${n.width}'d0`:`${memory}[${wire(n.id,"addr")}]`);if(n.kind!=="imem")body.push(`always @(posedge ${wire(n.id,"clk")}) if (${wire(n.id,"we")}) ${memory}[${wire(n.id,"addr")}] <= ${wire(n.id,"d")};`);}
    else if(!["probe","led","num","hex","bin"].includes(n.kind))diagnostics.push(`${n.name}: ${n.kind} has no HDL lowering. Replace it with custom expressions or gate-level internals.`);
  }
  if(original.engineering?.construction?.useMicrocode)diagnostics.push("Microcode currently drives simulator input overrides. Build its control ROM and sequencer as circuit blocks before HDL export.");
  if(diagnostics.length)return {source:"",diagnostics};return {source:[...lines,...body,"endmodule",""].join("\n"),diagnostics};
}

export function exportVerilogTestbench(original:CpuDesign,test:CircuitTest):HdlExport {
  const hdl=exportVerilog(original);if(hdl.diagnostics.length)return hdl;const graph=flattenCircuit(original).design;const inputs:{id:string;width:number;clock:boolean}[]=[],outputs:{id:string;width:number}[]=[];const key=(id:string,p:string)=>safe(id+"__"+p);
  for(const n of graph.nodes){if(n.kind==="clock"){inputs.push({id:key(n.id,"y"),width:1,clock:true});continue;}if(n.behavior?.device==="switch")inputs.push({id:safe(n.id+"_switch"),width:n.width,clock:false});for(const p of portsOf(n)){if(p.dir==="out")outputs.push({id:key(n.id,p.id),width:p.width});else if(!graph.wires.some(w=>w.to===n.id&&w.toPort===p.id))inputs.push({id:key(n.id,p.id),width:p.width,clock:false});}}
  const declarations=[...inputs.map(p=>`reg [${p.width-1}:0] ${p.id} = 0;`),...outputs.map(p=>`wire [${p.width-1}:0] ${p.id};`)];const body:string[]=[];const diagnostics:string[]=[];
  const resolve=(reference:string,input:boolean)=>{const at=reference.lastIndexOf(".");const n=graph.nodes.find(n=>n.id===reference.slice(0,at)||n.name===reference.slice(0,at));const port=reference.slice(at+1);if(!n){diagnostics.push(`Unknown testbench signal ${reference}.`);return "";}const id=input&&n.behavior?.device==="switch"?safe(n.id+"_switch"):key(n.id,port);if(!(input?inputs:outputs).some(p=>p.id===id)){diagnostics.push(`${reference} is not an exposed ${input?"input":"output"} of the generated HDL.`);return "";}return id;};
  const drive=(values:Record<string,number>)=>{for(const [ref,value] of Object.entries(values)){const id=resolve(ref,true);if(id)body.push(`${id} = 32'd${value>>>0};`);}};
  const check=(values:Record<string,number>)=>{for(const [ref,value] of Object.entries(values)){const id=resolve(ref,false);if(id)body.push(`if (${id} !== 32'd${value>>>0}) $fatal(1, "${ref.replace(/[^\w.]/g,"_")} mismatch");`);}};
  drive(test.inputs);for(let cycle=1;cycle<=test.cycles;cycle++){for(const s of test.steps?.filter(s=>s.cycle===cycle)??[])drive(s.inputs??{});body.push("#5;",...inputs.filter(p=>p.clock).map(p=>`${p.id} = 1;`),"#1;");for(const s of test.steps?.filter(s=>s.cycle===cycle)??[])check(s.expect??{});body.push("#4;",...inputs.filter(p=>p.clock).map(p=>`${p.id} = 0;`));}check(test.expect);
  if(diagnostics.length)return {source:"",diagnostics};return {source:["`timescale 1ns/1ps","module user_cpu_tb;",...declarations,`user_cpu dut(${[...inputs,...outputs].map(p=>`.${p.id}(${p.id})`).join(", ")});`,"initial begin",...body.map(s=>"  "+s),'  $display("PASS");',"  $finish;","end","endmodule",""].join("\n"),diagnostics:[]};
}
