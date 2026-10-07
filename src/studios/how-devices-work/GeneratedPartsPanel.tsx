import {useState} from 'react';
import {GENERATED_PART_ART} from './generated-assets';
import GeneratedPartView from './GeneratedPartView';

export default function GeneratedPartsPanel({number,parts}:{number:number;parts:string[]}){
 const available=parts.filter(part=>GENERATED_PART_ART[number]?.[part]);
 const [selected,setSelected]=useState(available[0]??'');
 if(!available.length)return null;
 const name=available.includes(selected)?selected:available[0]!;
 return <section className="hdw-course-card"><h2>Individual Component Views</h2><p>Inspect each component or functional circuit region. Several functions can share a single printed circuit board in a real device; these illustrations show representative hardware.</p><div className="hdw-generated-part-options">{available.map(part=><button type="button" key={part} aria-pressed={name===part} onClick={()=>setSelected(part)}>{part}</button>)}</div><GeneratedPartView key={name} name={name} src={GENERATED_PART_ART[number]![name]!}/></section>;
}
