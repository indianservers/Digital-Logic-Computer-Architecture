import {itemAt} from './parameters';
import {describe,it,expect} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from '../test-course-render';
import {MemoryRouter} from "react-router-dom";
import {ADVANCED_LABS,advancedPath,initialAdvancedValues} from "./data";
import {simulateSystems,arrayFactor,apparentTemperature} from "./systems-engine";
import SystemsLabPage from "./SystemsLabPage";
const labs=ADVANCED_LABS.filter(l=>l.number>=75&&l.number<=84);
const assets=import.meta.glob("/public/device-labs/advanced/*.webp",{eager:true,query:"?url",import:"default"});
describe("Phase C: recording, space, radar and imaging",()=>{
 it("maps ten independent contextual routes",()=>{expect(labs.map(l=>l.number)).toEqual(Array.from({length:10},(_,i)=>75+i));expect(new Set(labs.map(advancedPath)).size).toBe(10);});
 for(const lab of labs){
 it(`${lab.number}: renders device-specific art, architecture and controls`,()=>{const html=renderToStaticMarkup(createElement(MemoryRouter,{},createElement(SystemsLabPage,{lab})));expect(html).toContain(`<h1>${lab.device.name}</h1>`);expect(html).toContain("Quick Quiz");expect(html).not.toContain("Coming Soon");for(const role of lab.number===83?["device","external"]:["device","external","internal","hero"])expect(assets[`/public/device-labs/advanced/${String(lab.number).padStart(3,"0")}-${role}.webp`]).toBeTruthy();for(const c of lab.controls)expect(html).toContain(c.label);});
 it(`${lab.number}: every control affects a finite model`,()=>{const p=initialAdvancedValues(lab);for(const control of lab.controls){let changed=false;for(const mode of lab.modes){const a=simulateSystems(lab,{...p,[control.key]:control.min},mode,3,false),b=simulateSystems(lab,{...p,[control.key]:control.max},mode,3,false);expect([...a.traces,...b.traces].every(t=>t.samples.every(Number.isFinite))).toBe(true);changed ||= JSON.stringify(a)!==JSON.stringify(b);}expect(changed,control.label).toBe(true);}});
 it(`${lab.number}: faults inhibit dependent outputs`,()=>{const r=simulateSystems(lab,initialAdvancedValues(lab),itemAt(lab.modes, 0),3,true);expect(r.valid).toBe(false);expect(r.metrics.every(m=>m.value==="Unavailable")).toBe(true);expect(r.traces.every(t=>t.samples.every(v=>v===0))).toBe(true);expect(r.visual.every(v=>v===0)).toBe(true);});
 }
});
const model=(number:number,p:Record<string,number>={},mode?:string,time=3)=>{const lab=labs.find(l=>l.number===number)!;return simulateSystems(lab,{...initialAdvancedValues(lab),...p},mode??itemAt(lab.modes,0),time,false);};
const val=(r:ReturnType<typeof model>,label:string)=>Number(r.metrics.find(m=>m.label===label)!.value);
describe("Phase C engineering relationships",()=>{
 it("four-channel 8 kHz 16-bit PCM requires 64 kB/s and 460.8 MB for two hours",()=>{const r=model(75);expect(val(r,"PCM data rate")).toBe(64);expect(val(r,"Circular capacity")).toBe(460.8);});
 it("recorder write pointer wraps at the retention interval",()=>{expect(val(model(75,{},undefined,7201),"Write position")).toBe(64);});
 it("satellite pointing error lowers SNR and inhibits throughput",()=>{const aligned=model(76,{},"Manual pointing"),off=model(76,{azimuth:150},"Manual pointing");expect(val(off,"SNR")).toBeLessThan(val(aligned,"SNR"));expect(val(off,"Payload throughput")).toBe(0);});
 it("attitude feedback reduces Earth-pointing error",()=>{expect(Math.abs(val(model(77,{},undefined,60),"Attitude error"))).toBeLessThan(Math.abs(val(model(77,{},undefined,0),"Attitude error")));});
 it("array factor peaks at the commanded direction",()=>{expect(arrayFactor(24,24,16)).toBeCloseTo(1,10);expect(arrayFactor(-24,24,16)).toBeLessThan(.2);});
 it("doubling PRF halves unambiguous pulse range",()=>{expect(val(model(78,{prf:2000}),"Unambiguous pulse range")/val(model(78,{prf:1000}),"Unambiguous pulse range")).toBeCloseTo(.5,4);});
 it("passive excess path is nonnegative and delay follows the speed of light",()=>{const r=model(80);expect(val(r,"Excess bistatic path")).toBeGreaterThanOrEqual(0);expect(val(r,"Correlation delay")/val(r,"Excess bistatic path")).toBeCloseTo(1e9/299792458,3);});
 it("passive target motion follows speed and updates propagation delay",()=>{const start=model(80,{speed:720},undefined,0),moving=model(80,{speed:720},undefined,10),stopped=model(80,{speed:0},undefined,10);expect(moving.visual[0]! - start.visual[0]!).toBeCloseTo(2,8);expect(stopped.visual[0]).toBe(start.visual[0]);expect(val(moving,"Correlation delay")).toBeGreaterThan(val(start,"Correlation delay"));});
 it("unit emissivity recovers object temperature; zero emissivity reflects ambient",()=>{expect(apparentTemperature(60,20,1)).toBeCloseTo(60);expect(apparentTemperature(60,20,0)).toBeCloseTo(20);});
 it("intensifier gain increases brightness but not photon shot-noise SNR",()=>{expect(val(model(83,{gain:50}),"Display brightness")).toBeGreaterThan(val(model(83,{gain:10}),"Display brightness"));expect(val(model(83,{gain:50}),"Photon shot-noise SNR")).toBe(val(model(83,{gain:10}),"Photon shot-noise SNR"));});
 it("IR-cut filter and LEDs follow day/night mode",()=>{expect(model(84,{},"Day").metrics.find(m=>m.label==="IR-cut filter")!.value).toBe("Inserted");expect(val(model(84,{},"Day"),"LED illumination")).toBe(0);expect(val(model(84,{},"Night — 850 nm"),"LED illumination")).toBeGreaterThan(0);});
});
