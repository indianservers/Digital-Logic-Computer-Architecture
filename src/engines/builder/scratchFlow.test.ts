import {describe,expect,it} from "vitest";
import authoredProject from "./fixtures/scratch-accumulator.cpu.json";
import {parseDesignJson,loadProgram,stepMicroCycle,designJson} from "./sim";
import {encapsulate,flattenCircuit} from "./construction";
import {resetCircuit,runCircuitTest} from "./constructionTools";
import {connect,addNode,patchNode,type CpuDesign} from "./model";
import {validateDesign} from "./validate";

// This fixture was built, wired, assembled, run, and exported through the studio UI.
function authoredCpu():CpuDesign {
  const parsed=parseDesignJson(JSON.stringify(authoredProject));
  if(!parsed.ok)throw new Error(parsed.error);return parsed.design;
}
function run(d:CpuDesign){let current=d;const states=[];for(let cycle=1;cycle<=10;cycle++){
  const result=stepMicroCycle(current,cycle);expect(result.trace.mnemonic,result.trace.reason).not.toBe("FAULT");current=result.design;states.push(result);
  if(result.trace.halt)break;
}return {design:current,states};}
function inner(d:CpuDesign,name:string){return flattenCircuit(d).design.nodes.find(n=>n.name===name)!;}
describe("Scratch CPU studio flow",()=>{
  it("replays the manually authored and exported CPU from reset",()=>{
    const d=resetCircuit(authoredCpu());expect(validateDesign(d).filter(i=>i.level==="error")).toEqual([]);
    const result=run(d);expect(result.states).toHaveLength(2);expect(inner(result.states[0]!.design,"ACC").value).toBe(5);
    expect(inner(result.design,"ACC").value).toBe(12);expect(result.states.at(-1)!.trace.halt).toBe(true);
    expect(runCircuitTest(d,{name:"Arithmetic",cycles:2,inputs:{},expect:{"ACC.q":12,"PC.q":2}}).passed).toBe(true);
  });
  it("assembles new source into instruction memory inside two module levels",()=>{
    let d=authoredCpu();d=encapsulate(d,d.nodes.map(n=>n.id),"CPU");d=encapsulate(d,d.nodes.map(n=>n.id),"System");
    d={...d,program:"LOADI R0, 9\nADDI 4\nHALT\n"};const loaded=loadProgram(d);expect(loaded.error).toBeNull();
    expect(loaded.design.nodes[0]?.circuit?.nodes[0]?.circuit).toBeDefined();
    const result=run(resetCircuit(loaded.design));expect(inner(result.design,"ACC").value).toBe(13);
    expect(result.states.at(-1)!.trace.halt).toBe(true);expect(result.states.at(-1)!.trace.pc).toBe(2);
    expect(parseDesignJson(designJson(result.design)).ok).toBe(true);
  });
  it("detects HALT inside a complete CPU module",()=>{
    let d=authoredCpu();d=encapsulate(d,d.nodes.map(n=>n.id),"CPU");const result=run(resetCircuit(d));
    expect(inner(result.design,"ACC").value).toBe(12);expect(result.states).toHaveLength(2);expect(result.states.at(-1)!.trace.halt).toBe(true);
  });
  it("reloads assembled words when resetting a unified instruction/data memory",()=>{
    let d=authoredCpu();const memory=d.nodes.find(n=>n.kind==="imem")!;d={...d,nodes:d.nodes.map(n=>n.id===memory.id?{...n,kind:"umem"}:n)};
    const clock=d.nodes.find(n=>n.kind==="clock")!;d=connect(d,clock.id,"y",memory.id,"clk").design;
    d=addNode(d,"const",0,0,1);const zero=d.nodes.at(-1)!;d=patchNode(d,zero.id,{value:0});
    d=connect(d,zero.id,"y",memory.id,"we").design;d=addNode(d,"const",0,0,1);const one=d.nodes.at(-1)!;
    d=connect(d,one.id,"y",memory.id,"re").design;
    const reset=resetCircuit(d);expect(reset.nodes.find(n=>n.id===memory.id)?.mem.slice(0,3)).toEqual([0x1005,0x2007,0]);
    expect(inner(run(reset).design,"ACC").value).toBe(12);
  });
});
