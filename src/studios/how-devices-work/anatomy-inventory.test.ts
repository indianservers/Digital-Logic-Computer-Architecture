import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {LABS} from './labs/data';
import {ADVANCED_LABS} from './advanced/data';
import {DEVICES} from './catalogue';
import {anatomySupplements} from './anatomy-supplements';
import {BUILD_REFERENCES} from './build-references';
import PartsAnatomyCards from './PartsAnatomyCards';
import registry from './parts-registry.json';
import identities from './part-identities.json';
const labs=[...LABS,...ADVANCED_LABS];
describe('Complete educational anatomy coverage',()=>{
 it('covers each catalogue device once, preserving every original inventory item',()=>{
  expect(labs).toHaveLength(DEVICES.length);
  expect(new Set(labs.map(l=>l.device.id)).size).toBe(DEVICES.length);
  for(const lab of labs){
   const usages=registry.usages.filter(u=>u.deviceId===lab.device.id);
   for(const name of [...lab.parts,...anatomySupplements(lab.number).map(p=>p.name),...(BUILD_REFERENCES[lab.number]?.items.map(p=>p.name)??[])]){
    expect(usages.some(u=>u.part===name&&u.purpose.trim().length>0),`${lab.number}: ${name}`).toBe(true);
    expect((identities as Record<string,string>)[`${lab.device.id}::${name}`],name).toMatch(/^PART-[A-F0-9]{12}$/);
   }
  }
 });
 it('renders original and supporting cards for all 140 pages with reusable identities',()=>{
  for(const lab of labs){
   const html=renderToStaticMarkup(createElement(PartsAnatomyCards,{lab}));
   expect(html).toContain('Supporting Parts &amp; Assembly Details');
   for(const name of [...lab.parts,...anatomySupplements(lab.number).map(p=>p.name),...(BUILD_REFERENCES[lab.number]?.items.map(p=>p.name)??[])]){
    const id=(identities as Record<string,string>)[`${lab.device.id}::${name}`];
    expect(html,`${lab.number}: ${name}`).toContain(`data-part-id="${id}"`);
   }
  }
 });
 it('keeps quantities and completion boundaries visible for inferred entries',()=>{
  for(const u of registry.usages.filter(u=>u.scope==='Educational design-dependent guide')){
   expect(u.quantity).toBe('Design-specific');
   expect(u.purchase).toContain('confirm implementation');
  }
  const parts=new Map(registry.parts.map(p=>[p.id,p]));
  expect(parts.size).toBe(registry.parts.length);
  expect(registry.usages.every(u=>parts.has(u.partId))).toBe(true);
 });
});
