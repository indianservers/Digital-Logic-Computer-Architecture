import {itemAt} from './parameters';
import {describe,it,expect} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from '../test-course-render';
import {MemoryRouter} from "react-router-dom";
import {ADVANCED_LABS,advancedPath,initialAdvancedValues} from "./data";
import {simulateAdvanced} from "./engine";
import {gridPath,roomGrid,rayScan,navigationScene,balanceResponse,armPoints,legIK,gaitState,inspectPixels} from "./robotics-engine";
import RoboticsLabPage from "./RoboticsLabPage";
const labs=ADVANCED_LABS.filter(l=>l.number>=115&&l.number<=124);
const assets=import.meta.glob("/public/device-labs/advanced/*.webp",{eager:true,query:"?url",import:"default"});
describe("Phase G robotics and networking",()=>{
 it("provides ten distinct routes including the recovered autonomous vehicle",()=>{expect(labs.map(l=>l.number)).toEqual(Array.from({length:10},(_,i)=>115+i));expect(new Set(labs.map(advancedPath)).size).toBe(10);});
 for(const lab of labs){
 it(`${lab.number}: renders correct local hardware and native controls`,()=>{const html=renderToStaticMarkup(createElement(MemoryRouter,{},createElement(RoboticsLabPage,{lab})));expect(html).toContain(`Device ${lab.number} — ${lab.device.name}`);expect(html).toContain("Quick Quiz");expect(html).not.toContain("Coming Soon");for(const role of lab.number===120?["device","external"]:["device","external","internal"])expect(assets[`/public/device-labs/advanced/${String(lab.number).padStart(3,"0")}-${role}.webp`]).toBeTruthy();for(const c of lab.controls)expect(html).toContain(`aria-label="${c.label}"`);});
 it(`${lab.number}: every input has a finite applicable effect`,()=>{const p=initialAdvancedValues(lab);for(const c of lab.controls){let changed=false;for(const mode of lab.modes){const a=simulateAdvanced(lab,{...p,[c.key]:c.min},mode,3,false),b=simulateAdvanced(lab,{...p,[c.key]:c.max},mode,3,false);expect([...a.traces,...b.traces].every(t=>t.samples.every(Number.isFinite))).toBe(true);changed ||=JSON.stringify(a)!==JSON.stringify(b);}expect(changed,c.label).toBe(true);}});
 it(`${lab.number}: fault inhibits derived readings`,()=>{const r=simulateAdvanced(lab,initialAdvancedValues(lab),itemAt(lab.modes, 0),3,true);expect(r.valid).toBe(false);expect(r.metrics.every(m=>m.value==="Unavailable")).toBe(true);expect(r.traces.every(t=>t.samples.every(v=>v===0))).toBe(true);});
 }
});
const model=(number:number,p:Record<string,number>={},mode?:string,time=3)=>{const lab=labs.find(l=>l.number===number)!;return simulateAdvanced(lab,{...initialAdvancedValues(lab),...p},mode??itemAt(lab.modes,0),time,false);};
const val=(r:ReturnType<typeof model>,label:string)=>Number(r.metrics.find(m=>m.label===label)!.value);
describe("Robotics model relationships",()=>{
 it("balance feedback stabilizes small tilt and no feedback falls",()=>{const p=initialAdvancedValues(itemAt(labs, 0));expect(Math.abs(balanceResponse(p,"Balance control",10).at(-1)!.angle)).toBeLessThan(3);expect(balanceResponse(p,"Controller disabled",10).at(-1)!.lost).toBe(true);});
 it("drive stop suppresses virtual motion",()=>{expect(val(model(116,{estop:1}),"Speed scale")).toBe(0);expect(val(model(116,{enabled:0}),"Speed scale")).toBe(0);});
 it("contact force and proximity limit collaborative motion",()=>{expect(val(model(117,{contact:70,force:50}),"Speed scale")).toBe(0);expect(val(model(117,{distance:.3},"Safety monitored motion"),"Speed scale")).toBeLessThan(val(model(117,{distance:2},"Safety monitored motion"),"Speed scale"));});
 it("forward kinematics rotates the arm around its base",()=>{const a=armPoints([0,-45,30,0,60,0]),b=armPoints([90,-45,30,0,60,0]);expect(b.y).toBeCloseTo(a.x);expect(b.x).toBeCloseTo(0);});
 it("grid search returns adjacent free cells and rejects occupied goals",()=>{const grid=roomGrid(),path=gridPath(grid,{x:2,y:14},{x:16,y:2});expect(path.length).toBeGreaterThan(0);for(let i=1;i<path.length;i++){expect(Math.abs(itemAt(path, i).x-itemAt(path, i-1).x)+Math.abs(itemAt(path, i).y-itemAt(path, i-1).y)).toBe(1);expect(itemAt(itemAt(grid, itemAt(path, i).y), itemAt(path, i).x)).toBe(0);}expect(gridPath(grid,{x:2,y:14},{x:8,y:4})).toEqual([]);});
 it("ray casting respects maximum range and fills measured occupancy",()=>{const grid=roomGrid(),scan=rayScan(grid,{x:2.5,y:14.5},72,3);expect(scan.every(s=>s.range<=3)).toBe(true);const scene=navigationScene(118,{speed:.5,range:8,rays:72,bias:0},"Mapping only",0);expect(scene.known.flat().some(v=>v===0)).toBe(true);expect(scene.known.flat().some(v=>v===1)).toBe(true);expect(scene.known.flat().some(v=>v===-1)).toBe(true);});
 it("landmark correction reduces accumulated drift",()=>{expect(val(model(119,{},"Landmark correction",30),"Position drift")).toBeLessThan(val(model(119,{},"Odometry only",30),"Position drift"));});
 it("autonomous vehicle curvature changes with steering and wheelbase",()=>{expect(val(model(120,{wheelbase:1}),"Yaw rate")).toBeCloseTo(2*val(model(120,{wheelbase:2}),"Yaw rate"),2);expect(val(model(120,{distance:.5},"Obstacle braking"),"Vehicle speed")).toBe(0);});
 it("warehouse payload reduces travel speed and lift approaches height",()=>{expect(val(model(121,{load:100}),"Speed")).toBeLessThan(val(model(121,{load:0}),"Speed"));expect(val(model(121,{lift:.7},"Lift only",20),"Lift height")).toBeCloseTo(.7,2);});
 it("missing pixels change measured features and reject strict inspection",()=>{const p=initialAdvancedValues(labs.find(l=>l.number===122)!);const clean=inspectPixels(p,"Normal part"),broken=inspectPixels({...p,defect:12,threshold:.1},"Missing feature");expect(broken.area).toBeLessThan(clean.area);expect(broken.defect).toBeGreaterThan(clean.defect);expect(broken.accept).toBe(false);});
 it("inverse kinematics flags impossible reach and gait contacts alternate",()=>{expect(legIK(0,.6).reachable).toBe(false);const p=initialAdvancedValues(labs.find(l=>l.number===123)!);expect(gaitState(p,"Stand",1).every(l=>l.contact)).toBe(true);expect(gaitState(p,"Trot",.5).filter(l=>l.contact).length).toBe(2);});
 it("Wi-Fi clients share capacity and interference reduces throughput",()=>{expect(val(model(124,{clients:20}),"Per-client fair share")).toBeLessThan(val(model(124,{clients:1}),"Per-client fair share"));expect(val(model(124,{interference:80}),"Total payload throughput")).toBeLessThan(val(model(124,{interference:0}),"Total payload throughput"));expect(val(model(124,{distance:20}),"Signal strength")).toBeLessThan(val(model(124,{distance:2}),"Signal strength"));});
});
