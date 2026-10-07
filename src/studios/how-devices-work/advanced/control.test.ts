import {itemAt} from './parameters';
import {describe,it,expect} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from '../test-course-render';
import {MemoryRouter} from "react-router-dom";
import {ADVANCED_LABS,advancedPath,initialAdvancedValues} from "./data";
import {simulateAdvanced} from "./engine";
import {differentialPose,dpResponse,servoResponse,lineFollower} from "./control-engine";
import ControlLabPage from "./ControlLabPage";
const labs=ADVANCED_LABS.filter(l=>l.number>=105&&l.number<=114);
const assets=import.meta.glob("/public/device-labs/advanced/*.webp",{eager:true,query:"?url",import:"default"});
describe("Phase F radio, vessel and motor controls",()=>{
 it("provides all ten separate routes including the recovered robot",()=>{expect(labs.map(l=>l.number)).toEqual(Array.from({length:10},(_,i)=>105+i));expect(new Set(labs.map(advancedPath)).size).toBe(10);});
 for(const lab of labs){
 it(`${lab.number}: renders real hardware and usable native controls`,()=>{const html=renderToStaticMarkup(createElement(MemoryRouter,{},createElement(ControlLabPage,{lab})));expect(html).toContain(`Device ${lab.number} — ${lab.device.name}`);expect(html).toContain("Quick Quiz");expect(html).not.toContain("Coming Soon");for(const role of lab.number===113?["device","external"]:["device","external","internal"])expect(assets[`/public/device-labs/advanced/${String(lab.number).padStart(3,"0")}-${role}.webp`]).toBeTruthy();for(const c of lab.controls)expect(html).toContain(`aria-label="${c.label}"`);});
 it(`${lab.number}: each input changes a finite applicable response`,()=>{const p=initialAdvancedValues(lab);for(const c of lab.controls){let changed=false;for(const mode of lab.modes){const a=simulateAdvanced(lab,{...p,[c.key]:c.min},mode,3,false),b=simulateAdvanced(lab,{...p,[c.key]:c.max},mode,3,false);expect([...a.traces,...b.traces].every(t=>t.samples.every(Number.isFinite))).toBe(true);changed ||= JSON.stringify(a)!==JSON.stringify(b);}expect(changed,c.label).toBe(true);}});
 it(`${lab.number}: faults inhibit derived signals`,()=>{const r=simulateAdvanced(lab,initialAdvancedValues(lab),itemAt(lab.modes, 0),3,true);expect(r.valid).toBe(false);expect(r.metrics.every(m=>m.value==="Unavailable")).toBe(true);expect(r.traces.every(t=>t.samples.every(v=>v===0))).toBe(true);});
 }
});
const model=(number:number,p:Record<string,number>={},mode?:string,time=3)=>{const lab=labs.find(l=>l.number===number)!;return simulateAdvanced(lab,{...initialAdvancedValues(lab),...p},mode??itemAt(lab.modes,0),time,false);};
const val=(r:ReturnType<typeof model>,label:string)=>Number(r.metrics.find(m=>m.label===label)!.value);
describe("Control engineering relationships",()=>{
 it("DSC suppresses audio and receive-only suppresses transmission",()=>{expect(itemAt(model(105,{},"DSC channel 70").traces, 0).samples.every(v=>v===0)).toBe(true);expect(val(model(105,{},"Receive only"),"Transmit power")).toBe(0);});
 it("squelch mutes weak input",()=>{expect(itemAt(model(105,{signal:-110,squelch:-95}).traces, 0).samples.every(v=>v===0)).toBe(true);});
 it("self-test has no alert and relay outage blocks progression",()=>{expect(model(106,{},"Self-test",20).metrics.find(m=>m.label==="Alert output")!.value).toContain("No alert");expect(model(106,{},"Satellite relay unavailable",20).visual[0]).toBe(3);});
 it("low beacon battery prevents activation",()=>{expect(model(106,{battery:5}).valid).toBe(false);});
 it("station-keeping reduces environmental drift",()=>{const p=initialAdvancedValues(labs.find(l=>l.number===107)!);const hold=dpResponse(p,"Auto position hold",30).at(-1)!,drift=dpResponse(p,"Manual drift",30).at(-1)!;expect(Math.hypot(hold.x,hold.y)).toBeLessThan(Math.hypot(drift.x,drift.y));});
 it("ROV depth hold converges to pressure setpoint",()=>{expect(val(model(108,{depth:30},"Depth Hold",30),"Depth")).toBeCloseTo(30,0);});
 it("DVL fusion reduces accumulated inertial drift",()=>{expect(val(model(109,{},"INS + DVL fusion",30),"Position drift")).toBeLessThan(val(model(109,{},"INS only",30),"Position drift"));expect(val(model(109,{},"Surface GNSS update",30),"Position drift")).toBe(0);});
 it("cold start enriches fuel while thermal protection limits demand",()=>{expect(val(model(110,{},"Cold start"),"Injector pulse width")).toBeGreaterThan(val(model(110),"Injector pulse width"));expect(val(model(110,{},"Overtemperature protection"),"Injector pulse width")).toBeLessThan(val(model(110),"Injector pulse width"));});
 it("servo feedback approaches target",()=>{expect(Math.abs(servoResponse(90,2,0,8).at(-1)!.angle-90)).toBeLessThan(2);expect(val(model(111,{pulse:2},"Pulse-width command"),"Target angle")).toBe(180);});
 it("microsteps reduce angle and reverse winding order",()=>{expect(val(model(112,{},"Microstepping"),"Commanded angle")).toBe(val(model(112,{},"Full Step"),"Commanded angle")/16);expect(itemAt(model(112,{direction:-1},"Microstepping",.003).traces, 0).samples).not.toEqual(itemAt(model(112,{direction:1},"Microstepping",.003).traces, 0).samples);});
 it("differential drive goes straight or turns with unequal wheels",()=>{expect(differentialPose(.3,.3,.3,10).x).toBe(3);expect(differentialPose(.1,.4,.3,1).yaw).toBeCloseTo(1);expect(val(model(113,{distance:.1},"Obstacle stop"),"Forward speed")).toBe(0);});
 it("lost line stops motors and offset produces corrective differential",()=>{const p=initialAdvancedValues(labs.find(l=>l.number===114)!);expect(lineFollower(p,"Lost Line",3).left).toBe(0);const state=lineFollower({...p,offset:.5},"Straight Track",0);expect(state.left).toBeGreaterThan(state.right);});
});
