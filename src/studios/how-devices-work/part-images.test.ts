import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {LABS} from './labs/data';
import {ADVANCED_LABS} from './advanced/data';
import {anatomySupplements} from './anatomy-supplements';
import {BUILD_REFERENCES} from './build-references';
import {partImage} from './part-images';
import registry from './parts-registry.json';
import images from './part-images.json';
import PartsAnatomyCards from './PartsAnatomyCards';

describe('Reusable anatomy images',()=>{
 it('provides a captioned local image for every registered part usage',()=>{
  expect(Object.keys(images.byId)).toHaveLength(registry.parts.length);
  for(const usage of registry.usages){
   const art=partImage(usage.deviceId,usage.part);
   expect(art,`${usage.deviceId}: ${usage.part}`).toBeDefined();
   expect(art!.src).toMatch(/^\/(device-labs|devices\/parts)\/.+\.(png|jpg|webp)$/);
   expect(art!.caption.length).toBeGreaterThan(10);
   if(art!.kind==='reference'){
    expect(art!.sourceUrl).toMatch(/^https:\/\/commons.wikimedia.org\//);
    expect(art!.attribution).toBeTruthy();
    expect(art!.license).toMatch(/CC BY|CC0|Public domain/i);
   }
  }
 });
 it('renders an image for every original, supporting and educational build item on all 140 pages',()=>{
  for(const lab of [...LABS,...ADVANCED_LABS]){
   const html=renderToStaticMarkup(createElement(PartsAnatomyCards,{lab}));
   const cardCount=lab.parts.length+anatomySupplements(lab.number).length;
   const buildCount=BUILD_REFERENCES[lab.number]?.items.length??0;
   expect((html.match(/class="hdw-anatomy-thumb"/g)??[]).length,lab.device.id).toBe(cardCount);
   expect((html.match(/class="hdw-build-part-image"/g)??[]).length,lab.device.id).toBe(buildCount);
  }
 });
 it('preserves the existing device-specific inertial navigation artwork',()=>{
  const lab=ADVANCED_LABS.find(l=>l.number===63)!;
  for(const part of lab.parts)expect(partImage(lab.device.id,part)!.src).toContain('/063-inertial-navigation-system/');
 });
});
