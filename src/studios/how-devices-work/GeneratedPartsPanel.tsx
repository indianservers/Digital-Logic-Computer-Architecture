import {useState} from 'react';
import {GENERATED_PART_ART} from './generated-assets';
import GeneratedPartView from './GeneratedPartView';
import {partImage} from './part-images';

export default function GeneratedPartsPanel({number,parts,deviceId}:{number:number;parts:string[];deviceId:string}){
 const available=parts.filter(part=>GENERATED_PART_ART[number]?.[part]||partImage(deviceId,part));
 const [selected,setSelected]=useState(available[0]??'');
 if(!available.length)return null;
 const name=available.includes(selected)?selected:available[0]!;
 const art=partImage(deviceId,name);
 return <section className="hdw-course-card"><h2>Individual Component Views</h2><p>Inspect each component or functional circuit region. Several functions can share a single printed circuit board in a real device. Images show representative hardware or a labelled component-family reference.</p><div className="hdw-generated-part-options">{available.map(part=><button type="button" key={part} aria-pressed={name===part} onClick={()=>setSelected(part)}>{part}</button>)}</div><GeneratedPartView key={name} name={name} src={art?.src??GENERATED_PART_ART[number]![name]!} art={art}/></section>;
}
