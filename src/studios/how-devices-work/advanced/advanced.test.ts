import {itemAt} from './parameters';
import { describe,it,expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from '../test-course-render';
import { MemoryRouter } from "react-router-dom";
import { ADVANCED_LABS, advancedPath, initialAdvancedValues } from "./data";
import { simulateAdvanced } from "./engine";
import AdvancedLabPage from "./AdvancedLabPage";
const phaseA=ADVANCED_LABS.filter(l=>l.number<=64);
const assets=import.meta.glob("/public/device-labs/advanced/*.webp",{eager:true,query:"?url",import:"default"});
describe("Phase A: labs 55–64",()=>{
  it("contains every numbered lab with a unique canonical route",()=>{expect(phaseA.map(l=>l.number)).toEqual(Array.from({length:10},(_,i)=>55+i));expect(new Set(phaseA.map(advancedPath)).size).toBe(10);});
  for(const lab of phaseA){
    it(`${lab.number}: renders real components and supplied hardware assets`,()=>{
      const html=renderToStaticMarkup(createElement(MemoryRouter,{},createElement(AdvancedLabPage,{lab})));
      expect(html).toContain(`<h1>${lab.number===55?"Device 55 — ":""}${lab.device.name}</h1>`);expect(html).toContain(lab.number===57?"Simplified System Schematic":[59,60].includes(lab.number)?"System Architecture / Circuit":lab.number===61?"Sensors &amp; Data Inputs":lab.number===63?"INS in Aircraft Navigation":lab.number===62?"Connections / Aircraft Inputs":"Input → Processing → Output");expect(html).toContain("Quick Quiz");
      expect(lab.steps.length).toBeGreaterThanOrEqual(6);
      for(const role of ["device","external","internal"] as const)expect(assets[`/public/device-labs/advanced/${String(lab.number).padStart(3,"0")}-${role}.webp`]).toBeTruthy();
      for(const c of lab.controls)expect(html).toContain(`aria-label="${c.label}"`);
    });
    it(`${lab.number}: every control affects output in a supported mode and all extrema stay finite`,()=>{
      const defaults=initialAdvancedValues(lab);
      for(const c of lab.controls){
        let changes=false;
        for(const mode of lab.modes){const a=simulateAdvanced(lab,{...defaults,[c.key]:c.min},mode,3,false),b=simulateAdvanced(lab,{...defaults,[c.key]:c.max},mode,3,false);expect(a.traces.every(t=>t.samples.every(Number.isFinite))).toBe(true);expect(b.traces.every(t=>t.samples.every(Number.isFinite))).toBe(true);changes ||= JSON.stringify(a)!==JSON.stringify(b);}
        expect(changes,c.label).toBe(true);
      }
    });
    it(`${lab.number}: injected faults invalidate dependent outputs`,()=>{const r=simulateAdvanced(lab,initialAdvancedValues(lab),itemAt(lab.modes,0)!,3,true);expect(r.valid).toBe(false);expect(r.metrics.slice(1).every(m=>m.value==="Unavailable")).toBe(true);expect(r.traces.every(t=>t.samples.every(v=>v===0))).toBe(true);});
  }
});
describe("Engineering relationships",()=>{
  it("rejecting smaller RBC pulses raises the retained mean cell volume",()=>{const l=ADVANCED_LABS.find(l=>l.family==="hematology")!,p=initialAdvancedValues(l);const a=simulateAdvanced(l,{...p,threshold:20},itemAt(l.modes,0)!,0,false),b=simulateAdvanced(l,{...p,threshold:90},itemAt(l.modes,0)!,0,false);const value=(r:typeof a,label:string)=>Number(r.metrics.find(m=>m.label===label)!.value);expect(value(b,"RBC teaching value")).toBeLessThan(value(a,"RBC teaching value"));expect(value(b,"MCV teaching value")).toBeGreaterThan(value(a,"MCV teaching value"));});
  it("the NADH urea teaching assay decreases in absorbance",()=>{const l=ADVANCED_LABS.find(l=>l.family==="chemistry")!,p=initialAdvancedValues(l);const r=simulateAdvanced(l,{...p,wavelength:340},"Urea teaching assay",60,false);expect(r.valid).toBe(true);expect(r.traces[0]!.samples.at(-1)!).toBeLessThan(r.traces[0]!.samples[0]!);});
  it("flying west from KSFO increases distance to the eastern KOAK waypoint",()=>{const l=ADVANCED_LABS.find(l=>l.family==="gps")!,p=initialAdvancedValues(l);const distance=(time:number)=>Number(simulateAdvanced(l,{...p,heading:270},itemAt(l.modes,0)!,time,false).metrics.find(m=>m.label==="Distance to waypoint")!.value);expect(distance(60)).toBeGreaterThan(distance(0));});
  it("the compressed centrifuge cycle brakes to zero and finishes",()=>{const l=ADVANCED_LABS.find(l=>l.family==="centrifuge")!,p=initialAdvancedValues(l);const r=simulateAdvanced(l,p,itemAt(l.modes,0)!,12,false);expect(r.status).toContain("Cycle complete");expect(r.metrics.find(m=>m.label==="Current rotor speed")!.value).toBe(0);});
  it("RCF scales with radius and the square of speed",()=>{const l=ADVANCED_LABS[0]!,p=initialAdvancedValues(l);const r=(rpm:number,radius:number)=>Number(simulateAdvanced(l,{...p,rpm,radius},"Blood",0,false).metrics[0]!.value);expect(r(12000,8)/r(6000,8)).toBeCloseTo(4);expect(r(6000,16)/r(6000,8)).toBeCloseTo(2);});
  it("constant accelerometer bias creates quadratic unaided position drift",()=>{const l=ADVANCED_LABS.find(l=>l.family==="ins")!,p=initialAdvancedValues(l);const drift=(duration:number)=>Number(simulateAdvanced(l,{...p,duration,bias:.02},"Unaided inertial",0,false).metrics.find(m=>m.label==="Position drift")!.value);expect(drift(120)/drift(60)).toBeCloseTo(4);});
  it("GNSS 3D fix is unavailable below four satellites",()=>{const l=ADVANCED_LABS.find(l=>l.family==="gps")!,p=initialAdvancedValues(l);expect(simulateAdvanced(l,{...p,satellites:3},"Open sky",0,false).valid).toBe(false);expect(simulateAdvanced(l,{...p,satellites:4},"Open sky",0,false).valid).toBe(true);});
  it("air-data pressure altitude decreases as static pressure rises",()=>{const l=ADVANCED_LABS.find(l=>l.family==="air-data")!,p=initialAdvancedValues(l);const altitude=(pressure:number)=>Number(simulateAdvanced(l,{...p,static:pressure},"Normal sensing",0,false).metrics[0]!.value);expect(altitude(700)).toBeGreaterThan(altitude(900));});
  it("air-data Mach agrees with true airspeed divided by local sound speed",()=>{
    const lab=ADVANCED_LABS.find(l=>l.number===62)!,values={...initialAdvancedValues(lab),static:800,dynamic:50,temperature:15};
    const result=simulateAdvanced(lab,values,"Normal sensing",0,false);
    const tas=Number(result.metrics.find(m=>m.label==="True-speed model")!.value)/1.94384;
    const mach=Number(result.metrics.find(m=>m.label==="Mach model")!.value);
    expect(mach).toBeCloseTo(tas/Math.sqrt(1.4*287.05*(15+273.15)),3);
    const blocked=simulateAdvanced(lab,values,"Blocked pitot",0,false);
    expect(Number(blocked.metrics.find(m=>m.label==="Mach model")!.value)).toBe(0);
  });
});







it('all later device parts expose their own learner-facing function',()=>{for(const lab of ADVANCED_LABS.filter(l=>l.number>=75)){for(const part of lab.parts)expect(lab.partFunctions?.[part],`Device ${lab.number}: ${part}`).toBeTruthy();}});
