import {itemAt} from './parameters';
import {describe,it,expect} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from '../test-course-render';
import {MemoryRouter} from "react-router-dom";
import {ADVANCED_LABS,advancedPath,initialAdvancedValues} from "./data";
import {simulateAdvanced} from "./engine";
import {sonarEchoTime,autopilotResponse} from "./marine-engine";
import MarineLabPage from "./MarineLabPage";
const labs=ADVANCED_LABS.filter(l=>l.number>=95&&l.number<=104);
const assets=import.meta.glob("/public/device-labs/advanced/*.webp",{eager:true,query:"?url",import:"default"});
describe("Phase E: access, acoustics and marine navigation",()=>{
 it("maps all ten labs with a separate marine compass",()=>{expect(labs.map(l=>l.number)).toEqual(Array.from({length:10},(_,i)=>95+i));expect(new Set(labs.map(advancedPath)).size).toBe(10);expect(advancedPath(labs.find(l=>l.number===104)!)).toContain("/marine/");});
 for(const lab of labs){
 it(`${lab.number}: renders its source hardware, functional diagram and inputs`,()=>{const html=renderToStaticMarkup(createElement(MemoryRouter,{},createElement(MarineLabPage,{lab})));expect(html).toContain(`Device ${lab.number} — ${lab.device.name}`);expect(html).not.toContain("Coming Soon");expect(html).toContain("Quick Quiz");for(const role of ["device","external","internal"] as const)expect(assets[`/public/device-labs/advanced/${String(lab.number).padStart(3,"0")}-${role}.webp`]).toBeTruthy();for(const control of lab.controls)expect(html).toContain(`aria-label="${control.label}"`);});
 it(`${lab.number}: controls change finite outputs in every applicable mode`,()=>{const p=initialAdvancedValues(lab);for(const control of lab.controls){let changed=false;for(const mode of lab.modes){const a=simulateAdvanced(lab,{...p,[control.key]:control.min},mode,3,false),b=simulateAdvanced(lab,{...p,[control.key]:control.max},mode,3,false);expect([...a.traces,...b.traces].every(t=>t.samples.every(Number.isFinite))).toBe(true);const aligned=simulateAdvanced(lab,p,mode,3,false);changed ||= JSON.stringify(a)!==JSON.stringify(b)||JSON.stringify(a)!==JSON.stringify(aligned);}expect(changed,control.label).toBe(true);}});
 it(`${lab.number}: invalid acquisition inhibits outputs`,()=>{const r=simulateAdvanced(lab,initialAdvancedValues(lab),itemAt(lab.modes, 0),3,true);expect(r.valid).toBe(false);expect(r.metrics.filter(m=>m.label!=="Validity").every(m=>m.value==="Unavailable")).toBe(true);expect(r.traces.every(t=>t.samples.every(v=>v===0))).toBe(true);});
 }
});
const model=(number:number,p:Record<string,number>={},mode?:string,time=3)=>{const lab=labs.find(l=>l.number===number)!;return simulateAdvanced(lab,{...initialAdvancedValues(lab),...p},mode??itemAt(lab.modes,0),time,false);};
const val=(r:ReturnType<typeof model>,label:string)=>Number(r.metrics.find(m=>m.label===label)!.value);

describe("Phase E engineering relationships",()=>{
 it("acoustic round-trip time doubles with range",()=>{expect(sonarEchoTime(200,1500)/sonarEchoTime(100,1500)).toBe(2);});
 it("poor capture is denied even with a high nominal match",()=>{expect(model(95,{quality:20,similarity:100}).status).toContain("rejected");});
 it("higher policy threshold can reject a synthetic biometric match",()=>{expect(model(95,{threshold:99}).status).toContain("No authorized");});
 it("passive sonar does not report pulse-derived target range",()=>{expect(model(96,{},"Passive Sonar").metrics.find(m=>m.label==="First target range")!.value).toBe("Not determined");});
 it("UAV wind increases power demand",()=>{expect(val(model(97,{wind:15}),"Estimated demand")).toBeGreaterThan(val(model(97,{wind:0}),"Estimated demand"));});
 it("zero radar gain clears targets and clutter returns",()=>{const r=model(98,{gain:0});expect(val(r,"Visible targets")).toBe(0);expect(val(r,"Near-range sea return")).toBe(0);expect(val(r,"Rain return")).toBe(0);});
 it("radar sea clutter suppression attenuates near-range sea returns",()=>{expect(val(model(98,{sea:100}),"Near-range sea return")).toBeLessThan(val(model(98,{sea:0}),"Near-range sea return"));});
 it("longer acoustic pulses reduce depth resolution",()=>{expect(val(model(99,{pulse:100}),"Range resolution")).toBeGreaterThan(val(model(99,{pulse:20}),"Range resolution"));});
 it("incorrect sound-speed calibration produces proportional depth error",()=>{expect(val(model(100,{depth:100,sound:1500}),"Displayed depth")).toBe(100);expect(val(model(100,{depth:100,sound:1600}),"Displayed depth")).toBeCloseTo(106.667,3);});
 it("chartplotter distance scales with speed",()=>{expect(val(model(101,{speed:10}),"Distance travelled")).toBeCloseTo(2*val(model(101,{speed:5}),"Distance travelled"),2);});
 it("AIS reports follow the selected update interval",()=>{expect(val(model(102,{interval:2},undefined,10),"Reports generated")).toBe(5);expect(val(model(102,{interval:10},undefined,10),"Reports generated")).toBe(1);});
 it("closed-loop autopilot approaches commanded heading and standby removes rudder",()=>{const a=autopilotResponse(238,8,"Calm (0–0.5 m)",60);expect(Math.abs(a.at(-1)!.heading-238)).toBeLessThan(3);expect(autopilotResponse(238,8,"Standby",3).at(-1)!.rudder).toBe(0);});
 it("marine compass calibration removes a synthetic hard-iron offset",()=>{expect(val(model(104,{},"Calibrated disturbance"),"Heading deviation")).toBeCloseTo(0,3);expect(Math.abs(val(model(104,{},"Hard-iron disturbance"),"Heading deviation"))).toBeGreaterThan(1);});
});
