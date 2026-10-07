import {itemAt} from './parameters';
import {encodeCode128,decodeCode128} from './code128';
import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from '../test-course-render';
import {MemoryRouter} from 'react-router-dom';
import {createElement} from 'react';
import {ADVANCED_LABS,initialAdvancedValues,advancedPath} from './data';
import {simulateConsumer,encodeEAN,decodeEAN,eanCheck,fingerprintScore,thermalEstimate} from './consumer-engine';
import ConsumerLabPage from './ConsumerLabPage';
const labs=ADVANCED_LABS.filter(l=>l.number>=125&&l.number<=134);
const result=(n:number,change:Record<string,number>={},mode?:string,time=4)=>{const l=labs.find(l=>l.number===n)!;return simulateConsumer(l,{...initialAdvancedValues(l),...change},mode??itemAt(l.modes,0),time,false);};
const value=(n:number,label:string,change:Record<string,number>={},mode?:string)=>result(n,change,mode).metrics.find(m=>m.label===label)!.value;
describe('consumer learning models 125–134',()=>{
it('provides all ten independent routes',()=>{expect(labs).toHaveLength(10);expect(new Set(labs.map(advancedPath)).size).toBe(10);});
for(const l of labs){it(`${l.number}: renders its own layout and artwork`,()=>{const html=renderToStaticMarkup(createElement(MemoryRouter,null,createElement(ConsumerLabPage,{lab:l})));expect(html).toContain(`cn-lab-${l.number}`);expect(html).toContain(`${l.number}-internal.webp`);expect(html).toContain('Interactive Simulation');expect(l.parts.every(p=>Boolean(l.partFunctions?.[p]))).toBe(true);});it(`${l.number}: all modes have finite metrics and signals`,()=>{for(const mode of l.modes){const s=simulateConsumer(l,initialAdvancedValues(l),mode,3,false);expect(s.metrics.length).toBeGreaterThan(0);expect(s.metrics.filter(m=>typeof m.value==='number').every(m=>Number.isFinite(m.value))).toBe(true);expect(s.traces.every(t=>t.samples.every(Number.isFinite))).toBe(true);}});it(`${l.number}: component fault invalidates outputs`,()=>{const s=simulateConsumer(l,initialAdvancedValues(l),itemAt(l.modes, 0),3,true);expect(s.valid).toBe(false);expect(s.metrics.every(m=>m.value==='Unavailable')).toBe(true);});}
it('EAN-13 encoding decodes its generated modules and rejects damage',()=>{expect(eanCheck('400638133393')).toBe('1');const bits=encodeEAN('4006381333931');expect(decodeEAN(bits)).toBe('4006381333931');expect(encodeEAN('4006381333932')).toBe('');expect(decodeEAN(bits.slice(0,21)+(bits[21]==='1'?'0':'1')+bits.slice(22))).toBe('');});
it('EAN-13 validates many distinct payloads',()=>{for(const body of ['000000000000','123456789012','850045678905','978020137962'] as const){const code=body+eanCheck(body);expect(decodeEAN(encodeEAN(code))).toBe(code);}});
it('ANC reduces residual signal and disabling restores ambient noise',()=>{expect(Number(value(125,'Residual noise',{anc:100}))).toBe(0);expect(Number(value(125,'Residual noise',{anc:100,ancEnabled:0}))).toBe(35);});
it('movement integrates cadence with elapsed time',()=>{expect(result(126,{motion:120},'Move',30).metrics.find(m=>m.label==='Detected motion steps')?.value).toBe(60);});
it('LF card requires energy, authorized policy and a tap',()=>{expect(value(127,'Door relay')).toBe('Locked');expect(value(127,'Door relay',{taps:1})).toBe('Unlocked');expect(value(127,'Door relay',{taps:1},'Unknown card')).toBe('Locked');expect(value(127,'Card powered',{distance:15})).toBe('No');expect(value(127,'Card powered',{alignment:90})).toBe('No');});
it('scanner refuses damaged or dark symbols',()=>{expect(value(128,'Decoded payload',{scans:1})).toBe('850045678905');expect(value(128,'Format',{scans:1})).toBe('Code 128 B');expect(value(128,'Modulo-103 checksum',{scans:1})).toBe('Valid');expect(value(128,'Decoded payload',{scans:1,damage:7})).toBe('Read failed');expect(value(128,'Decoded payload',{scans:1,light:10})).toBe('Read failed');});
it('minutiae displacement and capture quality change actual match score',()=>{expect(fingerprintScore(100,0)).toBe(100);expect(fingerprintScore(100,10)).toBeLessThan(fingerprintScore(100,1));expect(fingerprintScore(50,0)).toBe(50);expect(value(130,'Decision',{stage:2})).toBe('Awaiting match');expect(value(130,'Decision',{stage:3,quality:100,offset:0})).toBe('Access granted');});
it('network capacity constrains delivered camera frames',()=>{expect(Number(value(131,'Delivered frame rate',{bandwidth:1}))).toBeLessThan(30);expect(value(131,'Delivered frame rate',{},'Network disconnected')).toBe(0);});
it('emissivity compensation recovers true temperature with correct setting',()=>{expect(thermalEstimate(62.3,25,.95)).toBeCloseTo(62.3,6);expect(thermalEstimate(62.3,25,.4)).toBeGreaterThan(62.3);});
it('stream source uses bandwidth and HDMI remains direct',()=>{expect(Number(value(133,'Delivered picture quality',{bandwidth:2},'Streaming Wi-Fi'))).toBeLessThan(20);expect(value(133,'Delivered picture quality',{bandwidth:2},'HDMI 1')).toBe(100);});
it('depleted lock battery inhibits latch',()=>{expect(value(134,'Latch',{unlocked:1,battery:0})).toBe('Locked');expect(value(134,'Latch',{unlocked:1,battery:80})).toBe('Unlocked');});
});

it('Code 128 B reads printable payloads and rejects damaged checksum modules',()=>{for(const value of ['850045678905','LAB-128','Hello world!'] as const){const bits=encodeCode128(value);expect(decodeCode128(bits)).toBe(value);expect(decodeCode128(bits.slice(0,25)+(bits[25]==='1'?'0':'1')+bits.slice(26))).toBe('');}expect(encodeCode128('\n')).toBe('');});
