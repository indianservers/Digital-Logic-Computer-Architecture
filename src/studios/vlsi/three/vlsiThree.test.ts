import { describe, expect, it } from "vitest";
import { buildVlsiScene, type VlsiSceneSpec } from "./vlsiThreeModel";
import { createVlsiWorld } from "./vlsiThreeWorld";
import { packageStack } from "../systemModel";
const model = (spec: VlsiSceneSpec) => buildVlsiScene(spec);
const fin: VlsiSceneSpec = {kind:"fin",device:"finfet",height:40,width:8,count:2,vgs:.8,vds:.6};
const gaa: VlsiSceneSpec = {kind:"gaa",count:3,width:24,thickness:6,spacing:10,vgs:.7,view:"perspective"};
const pkg = (mode: "2.5d"|"3d",count:number,tsv:number,power:number): VlsiSceneSpec => { const result=packageStack(mode,count,tsv,power); return {kind:"package",mode,count:result.count,tsv:result.vertical,thermalRise:result.thermalRise}; };
describe("Selective VLSI 3D structures",()=>{
 it("adds real fins with three gate surfaces and responds to fin dimensions and drain bias",()=>{
  const a=model(fin);const b=model({...fin,count:5,height:70,width:16});
  expect(a.solids.filter(s=>/^fin-\d+$/.test(s.id))).toHaveLength(2);
  expect(b.solids.filter(s=>/^fin-\d+$/.test(s.id))).toHaveLength(5);
  expect(b.solids.find(s=>s.id==="fin-0")!.size[1]).toBeGreaterThan(a.solids.find(s=>s.id==="fin-0")!.size[1]);
  expect(a.solids.filter(s=>s.id.startsWith("fin-gate-0-")||s.id==="fin-cap-gate-0")).toHaveLength(3);
  expect(model({...fin,vds:0}).flows).toHaveLength(0);expect(model({...fin,vgs:0}).flows).toHaveLength(0);
 });
 it("wraps every nanosheet in a hollow gate and separates display explosion from sheet dimensions",()=>{
  const a=model(gaa),b=model({...gaa,view:"exploded"});
  expect(a.solids.filter(s=>s.shape==="sleeve"&&s.material==="gate")).toHaveLength(3);
  expect(b.solids.find(s=>s.id==="sheet-2")!.at[1]).toBeGreaterThan(a.solids.find(s=>s.id==="sheet-2")!.at[1]);
  expect(b.solids.find(s=>s.id==="sheet-2")!.size).toEqual(a.solids.find(s=>s.id==="sheet-2")!.size);
  expect(model({...gaa,vgs:0}).flows).toHaveLength(0);
 });
 it("changes the package topology, exact TSV count and heat with the package model",()=>{
  const flat=model(pkg("2.5d",3,16,6));const stack=model(pkg("3d",3,16,6));
  expect(flat.solids.filter(s=>s.id.startsWith("tsv-"))).toHaveLength(0);
  expect(stack.solids.filter(s=>s.id.startsWith("tsv-"))).toHaveLength(48);
  expect(stack.solids.find(s=>s.id==="die-2")!.at[1]).toBeGreaterThan(stack.solids.find(s=>s.id==="die-0")!.at[1]);
  expect(model(pkg("3d",3,64,12)).solids.find(s=>s.id==="die-0")!.glow).toBeGreaterThan(stack.solids.find(s=>s.id==="die-0")!.glow!);
 });
 it.each([fin,gaa,pkg("3d",6,64,12)])("builds and disposes finite $kind geometry",spec=>{
  const m=model(spec);m.solids.forEach(s=>{expect(s.size.every(v=>Number.isFinite(v)&&v>0)).toBe(true);expect(s.at.every(Number.isFinite)).toBe(true);});
  const world=createVlsiWorld();world.setModel(m);world.tick(.5,true);world.scene.updateMatrixWorld(true);world.scene.traverse(o=>expect(o.matrixWorld.elements.every(Number.isFinite)).toBe(true));world.setModel(m);world.tick(1,false);world.dispose();
 });
});
