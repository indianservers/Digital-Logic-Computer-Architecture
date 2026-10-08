import type {Lab} from './labs/data';
import type {AdvancedLab} from './advanced/data';
import {componentDescription} from './labs/education';
import {GENERATED_PART_ART} from './generated-assets';
import GeneratedPartView from './GeneratedPartView';

export default function PartsAnatomyCards({lab}:{lab:Lab|AdvancedLab}){
 return <section className="hdw-course-card hdw-anatomy-cards"><h2>Parts Anatomy — {lab.device.name}</h2><p>Expand a component to learn why it is used and its purpose in this device. Open several cards to compare their roles.</p><div className="hdw-anatomy-grid">{lab.parts.map((part,i)=>{
  const purpose='steps' in lab?lab.partFunctions?.[part]:componentDescription(lab,part);
  const src=GENERATED_PART_ART[lab.number]?.[part];
  return <details key={part} className="hdw-anatomy-card"><summary><span className="hdw-anatomy-number">{i+1}</span><span>{part}</span><span className="hdw-anatomy-toggle" aria-hidden="true"/></summary><div className="hdw-anatomy-content"><h3>Why it is used in {lab.device.name}</h3><p>{purpose||`${part} is part of this device’s hardware chain. Its exact implementation depends on the design; refer to the original component controls below for the illustrated arrangement.`}</p>{src&&<GeneratedPartView name={part} src={src}/>}</div></details>;
 })}</div></section>;
}
