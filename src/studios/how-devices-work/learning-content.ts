import type {Lab} from './labs/data';
import type {AdvancedLab} from './advanced/data';
import {componentDescription,stepDescription} from './labs/education';
import {ACCURACY_NOTES} from './accuracy-notes';

export type ExplanationSection={title:string;text:string};
export const wordCount=(text:string)=>text.trim().split(/\s+/u).filter(Boolean).length;
/** Assemble a readable device-specific narrative from the existing reviewed facts.
 * The original sections remain intact; this introduction never trims their content. */
export function operatingExplanation(lab:Lab|AdvancedLab):ExplanationSection[]{
 const advanced='steps' in lab;
 const candidates:ExplanationSection[]=[
  {title:'The basic idea',text:lab.principle},
  ...(ACCURACY_NOTES[lab.number]?[{title:'What affects the result',text:ACCURACY_NOTES[lab.number]!.text}]:[]),
  {title:'What the device does',text:lab.device.longDescription},
  ...(advanced?lab.steps.map(([title,text])=>({title,text})):lab.device.signalFlow.flatMap((stage,i)=>i===0?[]:[{title:stage,text:stepDescription(lab,stage,i)}])),
  ...lab.parts.map(part=>({title:`Inside: ${part}`,text:advanced?lab.partFunctions?.[part]??'':componentDescription(lab,part)})),
  {title:'Follow the complete chain',text:`In ${lab.device.name}, the working sequence connects ${lab.device.signalFlow.join(', then ')}. Follow this order when reading the diagram: the result at each stage becomes the input to the next. A displayed number, image or command is therefore the outcome of the complete chain, rather than the action of one component alone.`},
  {title:'Understand the controls',text:`The learning model exposes ${lab.controls.map(c=>c.label+(c.unit?` (${c.unit})`:'')).join(', ')}. Change one setting at a time and compare the resulting output. Keep the other settings fixed so that the comparison shows the effect of the selected variable. The controls describe this representative model; actual equipment can use different ranges, automatic adjustments and additional checks.`},
  {title:'Read the output in context',text:`The available examples include ${lab.modes.join(', ')}. Compare the input, intermediate signals and final output for each example. Look for changes in timing, amplitude or state, rather than checking only the final display. A useful explanation follows where the information enters, how the listed components transform it, and why the output changes when the operating conditions change.`},
 ];
 const result:ExplanationSection[]=[];const seen=new Set<string>();let words=0;
 for(const item of candidates){
  const text=item.text.trim();const count=wordCount(text);
  if(!text||seen.has(text)||text.includes('connects to the acquisition or control chain.'))continue;
  seen.add(text);
  if(words+count>400)continue;
  result.push({...item,text});words+=count;
  if(words>=260)break;
 }
 return result;
}
