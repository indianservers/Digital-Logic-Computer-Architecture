import type {Lab} from './labs/data';
import type {AdvancedLab} from './advanced/data';
import {componentDescription} from './labs/education';
import {GENERATED_PART_ART} from './generated-assets';
import GeneratedPartView from './GeneratedPartView';
import partIdentities from './part-identities.json';
import {anatomySupplements,BUILD_PLANNING_FIELDS} from './anatomy-supplements';
import {BUILD_REFERENCES} from './build-references';
import {partImage} from './part-images';

function BuildPartImage({deviceId,name}:{deviceId:string;name:string}){
 const art=partImage(deviceId,name);
 if(!art)return null;
 return <figure className="hdw-build-part-image"><a href={art.src} target="_blank" rel="noreferrer"><img src={art.thumbnail??art.src} alt={art.caption} loading="lazy" decoding="async"/></a><figcaption>{art.caption}{art.sourceUrl&&<><br/><a href={art.sourceUrl} target="_blank" rel="noreferrer">{art.attribution} · {art.license}</a></>}</figcaption></figure>;
}

function SupportingParts({lab}:{lab:Lab|AdvancedLab}){
 const reference=BUILD_REFERENCES[lab.number];
 return <>
  <section className="hdw-course-card hdw-anatomy-cards"><h2>Supporting Parts & Assembly Details</h2><p>These design-dependent components expand the overview above. A purchased module may already include them. Select the actual design, quantities, ratings and connections before buying; this guide is not a validated shopping list.</p><div className="hdw-anatomy-grid">{anatomySupplements(lab.number).map((part,i)=>{
   const art=partImage(lab.device.id,part.name);
   return <details key={part.name} className="hdw-anatomy-card" data-part-id={(partIdentities as Record<string,string>)[`${lab.device.id}::${part.name}`]}><summary><span className="hdw-anatomy-number">{lab.parts.length+i+1}</span><span>{part.name}</span>{art&&<img className="hdw-anatomy-thumb" src={art.thumbnail??art.src} alt="" loading="lazy" decoding="async"/>}<span className="hdw-anatomy-toggle" aria-hidden="true"/></summary><div className="hdw-anatomy-content"><h3>Purpose and selection</h3><p>{part.purpose}</p><p><strong>Specification:</strong> Design-dependent; may be integrated into an existing assembly.</p>{art&&<GeneratedPartView name={part.name} src={art.src} art={art}/>}</div></details>;
  })}</div></section>
  {reference&&<section className="hdw-course-card"><h2>Documented Educational Build Reference</h2><h3>{reference.title}</h3><p>{reference.scope}</p><div className="hdw-build-table"><table><thead><tr><th>Part / assembly</th><th>Quantity</th><th>Purpose</th><th>Purchase note</th></tr></thead><tbody>{reference.items.map(item=><tr key={item.name} data-part-id={(partIdentities as Record<string,string>)[`${lab.device.id}::${item.name}`]}><td>{item.name}<BuildPartImage deviceId={lab.device.id} name={item.name}/></td><td>{item.quantity}</td><td>{item.purpose}</td><td>{item.purchase}</td></tr>)}</tbody></table></div><p>{reference.completion}</p><p><a href={reference.source} target="_blank" rel="noreferrer">Manufacturer / author parts reference ↗</a> · <a href={reference.assemblySource} target="_blank" rel="noreferrer">Wiring, assembly and software guide ↗</a></p></section>}
  <section className="hdw-course-card"><h2>Before Turning This Guide Into a Build</h2><p>Each physical assembly needs a model-specific breakdown. Signal-processing labels, timing logic and calibration algorithms can be firmware or integrated circuit functions rather than separate parts.</p><ul>{BUILD_PLANNING_FIELDS.map(field=><li key={field}>{field}</li>)}</ul><p><strong>Coverage status:</strong> Existing inventory and supporting assemblies reviewed. Complete purchase-and-assembly BOM validation remains design-specific.</p></section>
 </>;
}

export default function PartsAnatomyCards({lab}:{lab:Lab|AdvancedLab}){
 return <><section className="hdw-course-card hdw-anatomy-cards"><h2>Parts Anatomy — {lab.device.name}</h2><p>Expand a component to learn why it is used and its purpose in this device. Open several cards to compare their roles.</p><p>Images are representative component-family examples. The caption identifies the pictured hardware; functions can be integrated into a shared board, and actual hardware depends on the device model.</p><div className="hdw-anatomy-grid">{lab.parts.map((part,i)=>{
  const purpose='steps' in lab?lab.partFunctions?.[part]:componentDescription(lab,part);
  const art=partImage(lab.device.id,part);
  const src=GENERATED_PART_ART[lab.number]?.[part]??art?.src;
  const partId=(partIdentities as Record<string,string>)[`${lab.device.id}::${part}`];
  return <details key={part} className="hdw-anatomy-card" data-part-id={partId}><summary><span className="hdw-anatomy-number">{i+1}</span><span>{part}</span>{src&&<img className="hdw-anatomy-thumb" src={art?.thumbnail??src} alt="" loading="lazy" decoding="async"/>}<span className="hdw-anatomy-toggle" aria-hidden="true"/></summary><div className="hdw-anatomy-content"><h3>Why it is used in {lab.device.name}</h3><p>{purpose||`${part} is part of this device’s hardware chain. Its exact implementation depends on the design; refer to the original component controls below for the illustrated arrangement.`}</p>{src&&<GeneratedPartView name={part} src={src} art={art}/>}</div></details>;
 })}</div></section><SupportingParts lab={lab}/></>;
}
