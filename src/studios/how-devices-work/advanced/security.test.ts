import {itemAt} from './parameters';
import {describe,it,expect} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from '../test-course-render';
import {MemoryRouter} from "react-router-dom";
import {ADVANCED_LABS,advancedPath,initialAdvancedValues} from "./data";
import {simulateAdvanced} from "./engine";
import {compassHeading} from "./security-engine";
import SecurityLabPage from "./SecurityLabPage";
const labs=ADVANCED_LABS.filter(l=>l.number>=85&&l.number<=94);
const assets=import.meta.glob("/public/device-labs/advanced/*.webp",{eager:true,query:"?url",import:"default"});
describe("Phase D: optical, RF, identification and navigation",()=>{
 it("maps ten distinct category routes including the separate INS and satellite contexts",()=>{expect(labs.map(l=>l.number)).toEqual(Array.from({length:10},(_,i)=>85+i));expect(new Set(labs.map(advancedPath)).size).toBe(10);expect(advancedPath(labs.find(l=>l.number===90)!)).toContain("/defence/");expect(advancedPath(labs.find(l=>l.number===93)!)).toContain("/defence/");});
 for(const lab of labs){
 it(`${lab.number}: renders its source hardware, functional diagram and inputs`,()=>{const html=renderToStaticMarkup(createElement(MemoryRouter,{},createElement(SecurityLabPage,{lab})));expect(html).toContain(`Device ${lab.number} — ${lab.device.name}`);expect(html).not.toContain("Coming Soon");expect(html).toContain("Quick Quiz");for(const role of ["device","external","internal"] as const)expect(assets[`/public/device-labs/advanced/${String(lab.number).padStart(3,"0")}-${role}.webp`]).toBeTruthy();for(const control of lab.controls)expect(html).toContain(`aria-label="${control.label}"`);});
 it(`${lab.number}: controls change finite outputs in every applicable mode`,()=>{const p=initialAdvancedValues(lab);for(const control of lab.controls){let changed=false;for(const mode of lab.modes){const a=simulateAdvanced(lab,{...p,[control.key]:control.min},mode,3,false),b=simulateAdvanced(lab,{...p,[control.key]:control.max},mode,3,false);expect([...a.traces,...b.traces].every(t=>t.samples.every(Number.isFinite))).toBe(true);changed ||= JSON.stringify(a)!==JSON.stringify(b);}expect(changed,control.label).toBe(true);}});
 it(`${lab.number}: invalid acquisition inhibits outputs`,()=>{const r=simulateAdvanced(lab,initialAdvancedValues(lab),itemAt(lab.modes, 0),3,true);expect(r.valid).toBe(false);expect(r.metrics.filter(m=>m.label!=="Validity").every(m=>m.value==="Unavailable")).toBe(true);expect(r.traces.every(t=>t.samples.every(v=>v===0))).toBe(true);});
 }
});
const model=(number:number,p:Record<string,number>={},mode?:string,time=3)=>{const lab=labs.find(l=>l.number===number)!;return simulateAdvanced(lab,{...initialAdvancedValues(lab),...p},mode??itemAt(lab.modes,0),time,false);};
const val=(r:ReturnType<typeof model>,label:string)=>Number(r.metrics.find(m=>m.label===label)!.value);
describe("Phase D engineering relationships",()=>{
 it("optical delay doubles with range",()=>{expect(val(model(85,{distance:500}),"Round-trip delay")/val(model(85,{distance:250}),"Round-trip delay")).toBeCloseTo(2,4);});
 it("SDR mutes an out-of-channel carrier and warns on sample bandwidth",()=>{expect(model(86,{frequency:100}).status).toContain("outside");expect(model(86,{bandwidth:400,rate:100}).status).toContain("Aliasing");});
 it("verification rejection inhibits secure payload",()=>{expect(val(model(87,{},"Wrong key"),"Delivered payload")).toBe(0);expect(val(model(87,{},"Authenticated link"),"Delivered payload")).toBeGreaterThan(0);});
 it("IFF validates octal and leaves a failed verification unknown",()=>{expect(model(88,{code:1280}).valid).toBe(false);expect(model(88,{code:7777}).valid).toBe(true);expect(model(88,{},"Secure mode — unverified").status).toContain("Unknown");});
 it("credential reading and authorization are distinct",()=>{expect(model(89,{},"Unknown card").metrics.find(m=>m.label==="Credential")!.value).toBe("SYN-1024587");expect(model(89,{},"Unknown card").status).toContain("denied");expect(model(89,{distance:15}).status).toContain("denied");expect(model(89).status).toContain("granted");});
 it("INS bias produces quadratic position drift",()=>{expect(val(model(90,{duration:120}),"Position drift")/val(model(90,{duration:60}),"Position drift")).toBeCloseTo(4,4);});
 it("GNSS requires four satellites and valid carrier strength",()=>{expect(model(91,{satellites:3}).valid).toBe(false);expect(model(91,{strength:20}).valid).toBe(false);expect(model(91,{satellites:4}).valid).toBe(true);});
 it("compass tilt compensation recovers heading across pitch and roll",()=>{for(const yaw of [0,90,180,287] as const)for(const pitch of [-45,0,45] as const)for(const roll of [-40,0,40] as const){const heading=compassHeading({yaw,pitch,roll,offset:0,declination:0},"Tilt compensated");expect(Math.abs(((heading-yaw+540)%360)-180)).toBeLessThan(1e-8);}});
 it("calibration removes hard-iron offset",()=>{const p={yaw:287,pitch:35,roll:20,offset:20,declination:0};expect(Math.abs(((compassHeading(p,"Calibrated offset")-287+540)%360)-180)).toBeLessThan(1e-8);expect(Math.abs(((compassHeading(p,"Tilt compensated")-287+540)%360)-180)).toBeGreaterThan(1);});
 it("ground-terminal pointing loss reduces payload",()=>{expect(val(model(93,{azimuth:210}),"Payload throughput")).toBe(0);expect(val(model(93),"Payload throughput")).toBeGreaterThan(0);});
 it("perimeter filters brief and weak disturbances",()=>{expect(model(94,{persistence:.1}).status).toContain("monitoring");expect(model(94,{},"Wind disturbance").status).toContain("monitoring");expect(model(94).status).toContain("criterion met");});
});
