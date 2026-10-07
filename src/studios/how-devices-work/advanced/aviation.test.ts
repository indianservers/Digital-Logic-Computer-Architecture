import {itemAt} from './parameters';
import {describe,it,expect} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from '../test-course-render';
import {MemoryRouter} from "react-router-dom";
import {ADVANCED_LABS,advancedPath,initialAdvancedValues} from "./data";
import {simulateAdvanced} from "./engine";
import AviationLabPage from "./AviationLabPage";
const labs=ADVANCED_LABS.filter(l=>l.number>=65&&l.number<=74);
const assets=import.meta.glob("/public/device-labs/advanced/*.webp",{eager:true,query:"?url",import:"default"});
describe("Phase B: device-specific aviation pages",()=>{
 it("maps mockups 65–74 to ten distinct routes",()=>{expect(labs.map(l=>l.number)).toEqual(Array.from({length:10},(_,i)=>65+i));expect(new Set(labs.map(advancedPath)).size).toBe(10);});
 for(const lab of labs){
  it(`${lab.number}: renders its hardware, architecture, controls and quiz`,()=>{const html=renderToStaticMarkup(createElement(MemoryRouter,{},createElement(AviationLabPage,{lab})));expect(html).toContain(`<h1>${lab.device.name}</h1>`);expect(html).toContain("Internal Components (Exploded View)");expect(html).toContain("Quick Quiz");expect(html).toContain("aviation-controls");expect(html).not.toContain("Coming Soon");for(const role of ["device","external","internal","hero"] as const)expect(assets[`/public/device-labs/advanced/${String(lab.number).padStart(3,"0")}-${role}.webp`]).toBeTruthy();for(const c of lab.controls)expect(html).toContain(`aria-label="${c.label}"`);});
  it(`${lab.number}: inputs affect the model and extreme settings remain finite`,()=>{const p=initialAdvancedValues(lab);for(const c of lab.controls){let changed=false;for(const mode of lab.modes){const a=simulateAdvanced(lab,{...p,[c.key]:c.min},mode,3,false),b=simulateAdvanced(lab,{...p,[c.key]:c.max},mode,3,false);expect([...a.traces,...b.traces].every(t=>t.samples.every(Number.isFinite))).toBe(true);changed ||= JSON.stringify(a)!==JSON.stringify(b);}expect(changed,c.label).toBe(true);}});
  it(`${lab.number}: acquisition failure clears dependent outputs`,()=>{const r=simulateAdvanced(lab,initialAdvancedValues(lab),itemAt(lab.modes,0)!,3,true);expect(r.valid).toBe(false);expect(r.metrics.slice(1).every(m=>m.value==="Unavailable")).toBe(true);expect(r.traces.every(t=>t.samples.every(v=>v===0))).toBe(true);});
 }
});
const model=(number:number,p:Record<string,number>={},mode?:string,time=3)=>{const lab=labs.find(l=>l.number===number)!;return simulateAdvanced(lab,{...initialAdvancedValues(lab),...p},mode??itemAt(lab.modes,0)!,time,false);};
const value=(r:ReturnType<typeof model>,label:string)=>Number(r.metrics.find(m=>m.label===label)!.value);
describe("Aviation engineering relationships",()=>{
 it("FMCW beat frequency doubles with height and sweep bandwidth",()=>{expect(value(model(69,{height:500}),"Beat frequency")/value(model(69,{height:250}),"Beat frequency")).toBeCloseTo(2,2);expect(value(model(69,{sweep:200}),"Beat frequency")/value(model(69,{sweep:100}),"Beat frequency")).toBeCloseTo(2,2);});
 it("landing delay and beat track current height and stop at touchdown",()=>{const start=model(70,{},undefined,0),landing=model(70,{},undefined,10),touchdown=model(70,{},undefined,60);expect(value(landing,"Height above ground")).toBeLessThan(value(start,"Height above ground"));expect(value(landing,"Round-trip delay")).toBeCloseTo(2*value(landing,"Height above ground")*.3048/299792458*1e6,3);expect(value(landing,"Beat frequency")/value(start,"Beat frequency")).toBeCloseTo(value(landing,"Height above ground")/value(start,"Height above ground"),2);expect(value(touchdown,"Height above ground")).toBe(0);expect(value(touchdown,"Round-trip delay")).toBe(0);expect(touchdown.traces.at(-1)!.samples.every(v=>v>=0)).toBe(true);});
 it("rejects non-octal squawk digits",()=>{expect(model(71,{squawk:1280}).valid).toBe(false);expect(model(71,{squawk:7777}).valid).toBe(true);});
 it("TCAS advisories respond to closure and vertical separation",()=>{expect(model(73,{range:2.8,closure:450,relative:700},undefined,0).status).toContain("Resolution");expect(model(73,{range:2.8,closure:0,relative:700},undefined,0).status).toContain("No advisory");expect(model(73,{range:2.8,closure:450,relative:3000},undefined,0).status).toContain("No advisory");expect(model(73,{range:2.8,closure:450,relative:700},"TA only",0).status).toContain("Traffic-advisory");});
 it("invalid GNSS prevents ADS-B position output",()=>{const r=model(72,{},"GNSS source failure");expect(r.valid).toBe(false);expect(r.metrics.find(m=>m.label==="Latitude")!.value).toBe("Unavailable");});
 it("FADEC hot-temperature demand is limited",()=>{const r=model(65,{throttle:100,temperature:50,mach:0},undefined,180);expect(r.status).toContain("limit");expect(value(r,"EGT")).toBeLessThanOrEqual(850);});
 it("flight recorder scenarios change the captured parameters",()=>{expect(value(model(74,{},"Approach",30),"Altitude")).toBeLessThan(32000);expect(value(model(74,{},"Engine event",30),"Engine N1")).toBeLessThan(70);expect(value(model(74,{},"Maneuver",3),"Bank")).not.toBe(0);});
});

