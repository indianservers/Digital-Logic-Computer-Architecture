import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from '../test-course-render';
import { MemoryRouter } from "react-router-dom";
import { LABS, initialValues, labPath } from "./data";
import { simulate } from "./engine";
import LabPage from "./LabPage";
const artwork = import.meta.glob("/public/device-labs/*.webp", {query:"?url",import:"default",eager:true});
for(const [first,last] of [[1,10],[11,20],[21,30],[31,40],[41,54]] as const) describe(`Device labs ${first}–${last}`,()=>{
 for(const lab of LABS.filter(l=>l.number>=first&&l.number<=last)) {
  it(`${lab.number}: ${lab.device.name} renders real controls, artwork and learning content`,()=>{
   const html=renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:[labPath(lab)]},createElement(LabPage,{lab})));
   expect(html).toContain(`<h1>${lab.device.name}</h1>`);
   expect(html).toContain("Input → Processing → Output");expect(html).toContain("Test Your Knowledge");
   for(const c of lab.controls) expect(html).toContain(`aria-label="${c.label.replace(/&/g,"&amp;")}"`);
   for(const role of ["hero","external","internal"])expect(artwork[`/public/device-labs/${String(lab.number).padStart(2,"0")}-${role}.webp`]).toBeTruthy();
   expect(lab.device.signalFlow.length).toBeGreaterThanOrEqual(5);expect(lab.parts.length).toBeGreaterThanOrEqual(6);expect(lab.applications.length).toBeGreaterThanOrEqual(3);
  });
  it(`${lab.number}: all control extrema remain finite and each input changes model output`,()=>{
   const p=initialValues(lab);
   for(const c of lab.controls){const a=simulate(lab,{...p,[c.key]:c.min},lab.modes[0]!,false,3,"charge"),b=simulate(lab,{...p,[c.key]:c.max},lab.modes[0]!,false,3,"charge");
    for(const r of [a,b])expect(r.traces.every(t=>t.samples.every(Number.isFinite)),c.label).toBe(true);
    const baseline=simulate(lab,p,lab.modes[0]!,false,3,"charge");
    const affected=JSON.stringify(a)!==JSON.stringify(b)||JSON.stringify(a)!==JSON.stringify(baseline)||lab.modes.some(mode=>JSON.stringify(simulate(lab,{...p,[c.key]:c.min},mode,false,3,"charge"))!==JSON.stringify(simulate(lab,{...p,[c.key]:c.max},mode,false,3,"charge")));
    expect(affected,`${lab.device.name}: ${c.label} must alter an output in a supported mode`).toBe(true);
   }
  });
  it(`${lab.number}: every mode runs and faults invalidate acquisition`,()=>{
   for(const mode of lab.modes){const r=simulate(lab,initialValues(lab),mode,false,4,"send");expect(r.traces.length).toBeGreaterThan(0);expect(r.status).toBeTruthy();expect(r.metrics.length).toBeGreaterThan(0);}
   const fault=simulate(lab,initialValues(lab),lab.modes[0]!,true,4,"send");expect(fault.quality).toBe(0);expect(fault.status).toContain(lab.fault);expect(fault.metrics[0]?.label).toBe("Safety response");
  });
 }
});
describe("Physical relationships",()=>{
 it("flow-volume coordinates integrate the same expiratory flow",()=>{const l=LABS.find(l=>l.engine==="spirometer")!,r=simulate(l,initialValues(l),l.modes[0]!,false,0,"");const curve=r.traces.find(t=>t.label==="Flow–volume loop")!;expect(curve.xSamples?.[0]).toBe(0);expect(curve.xSamples?.at(-1)).toBeCloseTo(Number(r.metrics.find(m=>m.label==="FVC")?.value),2);expect(curve.samples[0]).toBeGreaterThan(curve.samples.at(-1)!);});
 it("EEG spectral peak tracks frequency rather than elapsed time",()=>{const l=LABS.find(l=>l.engine==="eeg")!,r=simulate(l,{...initialValues(l),frequency:22},"Eyes open (beta)",false,0,"");const spectrum=r.traces.find(t=>t.label==="Frequency spectrum")!,i=spectrum.samples.indexOf(Math.max(...spectrum.samples));expect(spectrum.xSamples?.[i]).toBeCloseTo(22,0);expect(spectrum.xUnit).toBe("Hz");});
 it("ICD rate detection gates the virtual event",()=>{const l=LABS.find(l=>l.engine==="icd")!,p=initialValues(l);expect(simulate(l,{...p,rate:150,detection:180},"Ventricular tachycardia",false,4,"deliver").status).toContain("blocked");expect(simulate(l,{...p,rate:190,detection:180},"Ventricular tachycardia",false,4,"deliver").status).toContain("logged");});
 it("pacemaker pulse timing and capture are independent",()=>{const l=LABS.find(l=>l.engine==="pacemaker")!,p=initialValues(l);const r=simulate(l,{...p,output:.5},l.modes[0]!,false,0,"");expect(r.status).toContain("ineffective");expect(r.metrics.find(m=>m.label==="Observed rate")?.value).toBe(p.rate);});
 it("pump target completion holds delivered volume and stops rate",()=>{const l=LABS.find(l=>l.engine==="pump")!,r=simulate(l,{...initialValues(l),rate:100,limit:10},"Normal flow",false,3600,"");expect(r.metrics.find(m=>m.label==="Delivered volume")?.value).toBe(10);expect(r.metrics.find(m=>m.label==="Rate")?.value).toBe(0);expect(r.status).toContain("target reached");});
 it("dialysis air detection stops circulation in the model",()=>{const l=LABS.find(l=>l.engine==="dialysis")!,r=simulate(l,initialValues(l),"Air detector event",false,0,"");expect(r.metrics.find(m=>m.label==="Blood flow")?.value).toBe(0);expect(r.metrics.find(m=>m.label==="Model clearance")?.value).toBe(0);expect(r.traces[0]?.samples.every(v=>v===1)).toBe(true);});
 it("NTC resistance decreases with temperature and ADC fits 12 bits",()=>{const l=LABS[0]!,p=initialValues(l);const r=(t:number)=>simulate(l,{...p,temperature:t},"Body",false,0,"");expect(Number(r(20).metrics[1]?.value)).toBeGreaterThan(Number(r(40).metrics[1]?.value));expect(r(40).binary).toHaveLength(12);expect(Number(r(36.8).metrics[0]?.value)).toBeCloseTo(36.8,1);});
 it("sonar echo delay equals twice range divided by sound speed",()=>{const l=LABS.find(l=>l.engine==="sonar")!,p=initialValues(l);expect(simulate(l,{...p,distance:150},l.modes[0]!,false,0,"").metrics[0]?.value).toBe(200);});
 it("Doppler shift decreases as the probe approaches perpendicular",()=>{const l=LABS.find(l=>l.engine==="doppler")!,p=initialValues(l);expect(Number(simulate(l,{...p,angle:0},l.modes[0]!,false,0,"").metrics[0]?.value)).toBeGreaterThan(Number(simulate(l,{...p,angle:80},l.modes[0]!,false,0,"").metrics[0]?.value));});
 it("all 54 device links are canonical and unique",()=>{expect(LABS).toHaveLength(54);expect(new Set(LABS.map(labPath)).size).toBe(54);});
 it("ventilator pressure uses flow in litres per second and compliance in litres per pressure",()=>{const l=LABS.find(l=>l.engine==="ventilator")!,p={...initialValues(l),volume:500,rate:15,compliance:50,resistance:5,peep:5};const result=simulate(l,p,"Volume AC",false,0,"");expect(result.metrics.find(m=>m.label==="Peak pressure")?.value).toBeCloseTo(5+.5/.05+5*.5/1.6,3);});
 it("pump faults and air detection inhibit fluid delivery",()=>{const l=LABS.find(l=>l.engine==="pump")!,p=initialValues(l);for(const [fault,mode] of [[true,"Normal flow"],[false,"Air-in-line event"]] as const){const r=simulate(l,p,mode,fault,3600,"");expect(r.metrics.find(m=>m.label==="Rate")?.value).toBe(0);expect(r.traces.find(t=>t.label==="Delivered volume")?.samples.every(v=>v===0)).toBe(true);}});
 it("IR packet includes address, complement, command and complement",()=>{const l=LABS.find(l=>l.engine==="remote")!,p={...initialValues(l),address:18,command:52};expect(simulate(l,p,"Power",false,0,"send").binary).toBe("00010010111011010011010011001011");});
 it("virtual AED output is blocked for non-shockable rhythms and poor pad contact",()=>{const l=LABS.find(l=>l.engine==="aed")!,p=initialValues(l);expect(simulate(l,p,"Asystole",false,3,"deliver").status).toContain("blocked");expect(simulate(l,{...p,contact:0},"Ventricular fibrillation",false,3,"deliver").status).toContain("blocked");});
});
