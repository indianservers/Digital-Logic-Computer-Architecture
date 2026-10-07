import {lazy,Suspense,Children,cloneElement,createContext,isValidElement,useContext,useEffect,useRef,useState,type ReactElement,type ReactNode,type MouseEvent} from 'react';
import {LABS,labPath,type Lab} from './labs/data';
import {ADVANCED_LABS,advancedPath} from './advanced/data';
import {DEVICES,devicePath} from './catalogue';
import {Link} from 'react-router-dom';
import type {AdvancedLab} from './advanced/data';
import './course.css';
import {ACCURACY_NOTES} from './accuracy-notes';
import GeneratedPartsPanel from './GeneratedPartsPanel';

const DeviceExamples=lazy(()=>import('./DeviceExamples'));
export const CourseAuditContext=createContext(false);
export const COURSE_TABS=[['overview','Overview'],['inside','Inside'],['deep','Deep Dive'],['working','How It Works'],['examples','Live Examples'],['simulation','Simulation'],['applications','Applications & Quiz']] as const;
type Tab=typeof COURSE_TABS[number][0];
type Props={children?:ReactNode;className?:string;id?:string;name?:string;title?:string;open?:boolean;'data-course-kind'?:string};
type Item={node:ReactNode;name:string;tab:Tab;anatomy?:boolean};
const destinations:Record<string,Tab>={telemetry:'examples',features:'inside',sequence:'examples',formulas:'deep',device:'overview',overview:'overview',about:'overview',context:'overview',advantages:'applications',external:'inside',internal:'inside',inside:'inside',anatomy:'inside',parts:'inside',reader:'inside',views:'inside',hardware:'inside',inputs:'deep',explanation:'deep',authentication:'deep',coupling:'deep',circuit:'deep',computation:'deep',conflict:'deep',build:'deep',architecture:'working',flow:'working',journey:'working',signal:'working',steps:'working',working:'working',stages:'working',satellites:'working',geometry:'examples',signals:'examples',waveforms:'examples',drift:'examples',output:'examples',tracking:'examples',display:'examples',visual:'examples',interpretation:'examples',readout:'simulation',reading:'simulation',controls:'simulation',simulation:'simulation',simulator:'simulation',digital:'simulation',gallery:'simulation',spectrum:'examples',panel:'simulation',applications:'applications',safety:'applications',keys:'applications',takeaways:'applications',quiz:'applications'};

function nameOf(node:ReactElement<Props>):string{
 const p=node.props;
 if(p['data-course-kind'])return p['data-course-kind'];
 if(p.title?.includes("Formulas"))return "formulas";
 if(p.name)return p.name;
 if(p.id)return p.id.replace(/^(advanced-|aviation-)/,'').replace('device-overview','overview');
 const classes=p.className??'';
 const slot=classes.match(/(?:sy|se|ma|ct|rb|cn|hh)-slot-([\w-]+)/);
 if(slot)return slot[1]!;
 for(const key of Object.keys(destinations))if(classes.split(' ').some(c=>c===`dl-${key}`))return key;
 if(/hero|title|breadcrumb|source-note|mission/.test(classes))return 'overview';
 if(p.title?.includes('Quiz'))return 'quiz';
 if(p.title?.includes('SPECT'))return 'gallery';
 if(p.title?.includes('Pacemaker'))return 'simulation';
 if(p.title?.includes('Radiograph'))return 'inside';
 if(p.title?.includes('Block Diagram'))return 'architecture';
 return 'deep';
}

function includesText(node:ReactNode,text:string):boolean{if(typeof node==='string')return node.includes(text);if(Array.isArray(node))return node.some(child=>includesText(child,text));return isValidElement<Props>(node)&&includesText(node.props.children,text);}

function keyed(nodes:ReactNode[]){return nodes.map((node,i)=>isValidElement(node)?cloneElement(node,{key:node.key??`moved-${i}`}):node);}

// Move existing React elements, retaining their props, handlers, assets and state.
// Only dashboard wrappers and the obsolete anchor tab bar are replaced.
function containsControlPanel(node:ReactNode):boolean{return isValidElement<Props>(node)&&(node.props.name==='controls'||node.props.name==='simulation'||Children.toArray(node.props.children).some(containsControlPanel));}

function inventory(children:ReactNode,principle:string):Item[]{
 const items:Item[]=[];
 Children.forEach(children,node=>{
  if(!isValidElement<Props>(node)){if(node!==null&&node!==false)items.push({node,name:'note',tab:'overview'});return;}
  const cls=node.props.className??'';
  if(cls==='dl-section-tabs')return;
  if(/(?:^| )\w+-dashboard(?: |$)/.test(cls)){items.push(...inventory(node.props.children,principle));return;}
  if(node.type==='footer'){items.push({node,name:'references',tab:'applications'});return;}
  if(/-slot-/.test(cls)){
   const name=nameOf(node);
   const nested=inventory(node.props.children,principle);
   items.push(...nested.map(item=>({...item,name:item.name==='deep'?name:item.name,tab:item.name==='deep'?(destinations[name]??item.tab):item.tab,anatomy:item.anatomy||name==='parts'||name==='reader'||name==='views'})));
   return;
  }
  const name=nameOf(node),tab:Tab=name==='visual'&&containsControlPanel(node)?'simulation':destinations[name]??'deep';
  if(tab==='overview'&&['overview','device'].includes(name)){
   const remaining:ReactNode[]=[],theory:ReactNode[]=[];
   Children.forEach(node.props.children,child=>{
    if(isValidElement<Props>(child)&&((child.type==='p'&&child.props.children===principle)||(child.type==='details'&&Children.toArray(child.props.children).some(c=>isValidElement<Props>(c)&&c.type==='summary'&&c.props.children==='Device overview'))))theory.push(child);
    else remaining.push(child);
   });
   if(theory.length){items.push({node:cloneElement(node,{},keyed(remaining)),name,tab});items.push({node:<section className="hdw-course-card"><h2>Detailed Operating Principle</h2>{keyed(theory)}</section>,name:'operating-principle',tab:'deep'});return;}
  }
  // Split physical cutaways from component inspection without copying either.
  if(tab==='inside'&&['internal','inside','anatomy'].includes(name)){
   const physical:ReactNode[]=[],parts:ReactNode[]=[];
   Children.forEach(node.props.children,child=>{
    if(isValidElement<Props>(child)&&child.type==='details')parts.push(cloneElement(child,{open:true}));
    else physical.push(child);
   });
   items.push({node:cloneElement(node,{},keyed(physical)),name,tab});
   if(parts.length)items.push({node:<section className="hdw-course-card"><h2>Parts Anatomy — Component Functions</h2>{keyed(parts)}</section>,name:`${name}-functions`,tab,anatomy:true});
  }else items.push({node,name,tab,anatomy:['parts','reader','views','external','hardware','features'].includes(name)});
 });
 return items;
}

export default function DeviceCourse({lab,children,onTabChange}:{lab:Lab|AdvancedLab;children:ReactNode;onTabChange?:(tab:Tab)=>void}){
 const audit=useContext(CourseAuditContext);
 const [active,setActive]=useState<Tab>('overview'),[visited,setVisited]=useState<Set<Tab>>(()=>new Set(['overview'])),[inside,setInside]=useState<'physical'|'anatomy'>('physical');
 const root=useRef<HTMLDivElement>(null),tabs=useRef<(HTMLButtonElement|null)[]>([]);
 const items=inventory(children,lab.principle);
 const related=DEVICES.filter(d=>d.id!==lab.device.id&&d.categories.some(c=>lab.device.categories.includes(c))).slice(0,4);
 const courses=[...LABS,...ADVANCED_LABS];
 const previous=courses.find(l=>l.number===lab.number-1),next=courses.find(l=>l.number===lab.number+1);
 const coursePath=(l:Lab|AdvancedLab)=>l.number<=54?labPath(l as Lab):advancedPath(l as AdvancedLab);
 function activate(tab:Tab){setActive(tab);setVisited(v=>new Set([...v,tab]));onTabChange?.(tab);}
 function resolve(id:string):Tab{
  const cleaned=id.replace(/^(advanced-|aviation-)/,'');
  const item=items.find(i=>i.name===cleaned||isValidElement<Props>(i.node)&&i.node.props.id===id);
  return item?.tab??destinations[cleaned]??'overview';
 }
 function follow(event:MouseEvent<HTMLDivElement>){
  const link=(event.target as HTMLElement).closest('a[href^="#"]');
  if(!link)return;
  const id=link.getAttribute('href')!.slice(1),tab=resolve(id);
  event.preventDefault();activate(tab);
  if(tab==='inside')setInside(/parts|external/.test(id)?'anatomy':'physical');
  requestAnimationFrame(()=>root.current?.querySelector(`[id="${CSS.escape(id)}"]`)?.scrollIntoView({behavior:'smooth',block:'start'}));
 }
 useEffect(()=>{
  const followHash=()=>{if(location.hash){const id=location.hash.slice(1),tab=resolve(id);activate(tab);if(tab==='inside')setInside(/parts|external/.test(id)?'anatomy':'physical');}};
  followHash();window.addEventListener('hashchange',followHash);return()=>window.removeEventListener('hashchange',followHash);
 // Lab pages are keyed by route; keep the existing state when changing tabs.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 return <div className="hdw-course" ref={root} onClickCapture={follow} data-device={lab.number}>
  <div className="hdw-course-heading"><span>DEVICE {lab.number} · HOW DEVICES WORK</span><h1>{lab.device.name}</h1></div>
  <div className="hdw-course-tabs" role="tablist" aria-label="Device learning tabs">{COURSE_TABS.map(([id,label],i)=><button key={id} ref={el=>{tabs.current[i]=el;}} type="button" id={`course-${id}-tab`} role="tab" aria-selected={active===id} aria-controls={`course-${id}-panel`} tabIndex={active===id?0:-1} onClick={()=>activate(id)} onKeyDown={e=>{let next=i;if(e.key==='ArrowRight')next=(i+1)%COURSE_TABS.length;else if(e.key==='ArrowLeft')next=(i+COURSE_TABS.length-1)%COURSE_TABS.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=COURSE_TABS.length-1;else return;e.preventDefault();activate(COURSE_TABS[next]![0]);tabs.current[next]?.focus();}}>{label}</button>)}</div>
  {COURSE_TABS.map(([id])=>(audit||visited.has(id))&&<div key={id} id={`course-${id}-panel`} role="tabpanel" aria-labelledby={`course-${id}-tab`} hidden={!audit&&active!==id} className={`hdw-course-panel hdw-course-${id}`}>
   {id==='inside'&&<><div role="tablist" aria-label="Inside the device views" className="hdw-course-subtabs">{(['physical','anatomy'] as const).map(view=><button key={view} role="tab" id={`inside-${view}-tab`} aria-controls={`inside-${view}-panel`} aria-selected={inside===view} tabIndex={inside===view?0:-1} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'physical':e.key==='End'?'anatomy':inside==='physical'?'anatomy':'physical';setInside(next);root.current?.querySelector<HTMLButtonElement>(`#inside-${next}-tab`)?.focus();}}} onClick={()=>setInside(view)}>{view==='physical'?'Internal Components & Exploded View':'Parts Anatomy'}</button>)}</div>{(['physical','anatomy'] as const).map(view=><div role="tabpanel" id={`inside-${view}-panel`} aria-labelledby={`inside-${view}-tab`} key={view} hidden={!audit&&inside!==view}>{view==='anatomy'&&lab.number>=65&&<GeneratedPartsPanel number={lab.number} parts={lab.parts}/ >}{items.filter(item=>item.tab===id&&Boolean(item.anatomy)===(view==='anatomy')).map((item,i)=><div key={`${item.name}-${i}`} data-course-section={item.name}>{item.node}</div>)}</div>)}</>}
   {id==='overview'&&<section className="hdw-course-card hdw-quick-flow"><h2>At a Glance</h2><div>{[lab.device.signalFlow[0],lab.device.signalFlow.slice(1,-1).join(' → '),lab.device.signalFlow.at(-1)].map((text,i)=><article key={i}><strong>{['Input','Processing','Output'][i]}</strong><p>{text}</p></article>)}</div><p>Explore {lab.parts.length} hardware components, trace the complete signal path, compare representative outputs and experiment with {lab.controls.map(c=>c.label.toLowerCase()).join(', ')}.</p></section>}
   {id==='deep'&&<section className="hdw-course-card"><h2>Operating Principle & Engineering Context</h2>{!items.some(item=>item.tab==='deep'&&includesText(item.node,lab.principle))&&<p>{lab.principle}</p>}<p>{lab.device.longDescription}</p></section>}
   {id==='deep'&&ACCURACY_NOTES[lab.number]&&<section className="hdw-course-card"><h2>Design Variants & Measurement Limits</h2><p>{ACCURACY_NOTES[lab.number]!.text}</p><a href={ACCURACY_NOTES[lab.number]!.source} target="_blank" rel="noreferrer">Read the technical source ↗</a></section>}
   {id==='examples'&&<p className="hdw-course-example-note">Representative examples — synthetic teaching signals and outputs, not field or clinical records. Use Simulation to change model parameters.</p>}
   {id==='examples'&&<Suspense fallback={<p>Loading representative device outputs…</p>}><DeviceExamples lab={lab}/></Suspense>}
   {id==='applications'&&<section className="hdw-course-card"><h2>Related Devices</h2><nav className="hdw-related">{related.map(device=><Link key={device.id} to={devicePath(device)}>{device.name} →</Link>)}</nav><nav className="hdw-related" aria-label="Previous and next device">{previous&&<Link to={coursePath(previous)}>← Device {previous.number}: {previous.device.name}</Link>}{next&&<Link to={coursePath(next)}>Device {next.number}: {next.device.name} →</Link>}</nav></section>}
   {id!=='inside'&&items.filter(item=>item.tab===id).map((item,i)=><div key={`${item.name}-${i}`} data-course-section={item.name}>{item.node}</div>)}
  </div>)}
 </div>;
}
