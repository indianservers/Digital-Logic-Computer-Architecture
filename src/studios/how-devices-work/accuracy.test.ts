import {describe,it,expect} from 'vitest';
import {LABS} from './labs/data';
import {ADVANCED_LABS} from './advanced/data';
import {componentDescription} from './labs/education';
describe('component explanations follow the physical function',()=>{
 const description=(number:number,part:string)=>componentDescription(LABS.find(l=>l.number===number)!,part);
 it('distinguishes physical filters, fluid reservoirs and breathing valves',()=>{
  expect(description(39,'Air inlet filter')).toContain('physical inlet filter');
  expect(description(40,'Fluid reservoir')).toContain('fluid container');
  expect(description(39,'Expiratory valve')).toContain('breathing-circuit valve');
 });
 it('distinguishes command encoding, event localization and energy storage',()=>{
  expect(description(8,'Command encoder')).toContain('protocol bits');
  expect(description(35,'Event-position electronics')).toContain('gamma photon');
  expect(description(42,'Energy-storage capacitor')).toContain('½CV²');
 });
 it('assigns recorder functions to the corresponding components',()=>{
  const functions=ADVANCED_LABS.find(l=>l.number===75)!.partFunctions!;
  expect(functions['Audio ADC']).toContain('digital samples');
  expect(functions['Circular memory']).toContain('recording interval');
  expect(functions['Power section']).toContain('electrical power');
 });
});
