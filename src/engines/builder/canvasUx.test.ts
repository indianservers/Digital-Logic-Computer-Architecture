import { describe,expect,it } from "vitest";
import { addNode,connect,emptyDesign } from "./model";
import { crosses,editDescription,reconnectWire,routeWire,tracedWires } from "./canvasUx";

describe("Canvas authoring",()=>{
  it("routes around multiple component bounds with only orthogonal segments",()=>{
    const obstacles=[{x:60,y:-20,width:50,height:60},{x:130,y:10,width:40,height:80}];
    const points=routeWire({x:0,y:0},{x:220,y:70},obstacles);
    expect(points[0]).toEqual({x:0,y:0});expect(points.at(-1)).toEqual({x:220,y:70});
    for(let i=1;i<points.length;i++){const a=points[i-1]!,b=points[i]!;expect(a.x===b.x||a.y===b.y).toBe(true);expect(obstacles.some(r=>crosses(a,b,r))).toBe(false);}
  });
  it("preserves the original connection when a reconnect is invalid",()=>{
    let d=addNode(emptyDesign(),"const",0,0,16);d=addNode(d,"gpr",200,0,16);d=addNode(d,"const",0,200,1);
    const [a,b,c]=d.nodes;d=connect(d,a!.id,"y",b!.id,"d").design;const w=d.wires[0]!;
    const bad=reconnectWire(d,w.id,c!.id,"y",b!.id,"d");expect(bad.error).toBeTruthy();expect(bad.design).toBe(d);
    const good=reconnectWire(d,w.id,a!.id,"y",b!.id,"d");expect(good.error).toBeNull();expect(good.design.wires).toHaveLength(1);expect(good.design.wires[0]!.id).toBe(w.id);
  });
  it("traces downstream paths and direct drivers without looping",()=>{
    const d=emptyDesign();d.wires=[{id:"a",from:"source",fromPort:"y",to:"middle",toPort:"a"},{id:"b",from:"middle",fromPort:"y",to:"sink",toPort:"a"},{id:"c",from:"sink",fromPort:"y",to:"middle",toPort:"b"},{id:"d",from:"other",fromPort:"y",to:"else",toPort:"a"}];
    expect([...tracedWires(d,["middle"])].sort()).toEqual(["a","b","c"]);
  });
  it("describes a movement for undo and redo",()=>{
    const d=addNode(emptyDesign(),"gpr",0,0);expect(editDescription(d,{...d,nodes:d.nodes.map(n=>({...n,x:160}))})).toBe("move components");
  });
});
