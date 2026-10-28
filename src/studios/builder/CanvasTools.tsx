import { useSimulatorCapture } from "../../layout/SimulatorCapture";
import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import { PALETTE, GATE_PALETTE, portsOf, type CpuDesign, type NodeKind } from "../../engines/builder/model";
import { componentContract } from "./../../engines/builder/componentContract";
import { validateDesign } from "../../engines/builder/validate";
import { stateChanges } from "../../engines/builder/workspace";
import { type ExecTrace } from "../../engines/builder/sim";
import "./canvasUx.css";

export function readPreference<T>(key:string,fallback:T):T {
  try {const value=JSON.parse(localStorage.getItem(`cpu-ux-${key}`)??"null");if(Array.isArray(fallback))return Array.isArray(value)?value as T:fallback;return value!==null&&typeof value===typeof fallback&&(typeof value!=="number"||Number.isFinite(value))?value:fallback;}catch{return fallback;}
}
export function usePreference<T>(key:string,fallback:T){
  const [value,setValue]=useState<T>(()=>readPreference(key,fallback));
  useEffect(()=>{try{localStorage.setItem(`cpu-ux-${key}`,JSON.stringify(value));}catch{/* Preferences are optional when browser storage is unavailable. */}},[key,value]);
  return [value,setValue] as const;
}
type Props={design:CpuDesign;previous?:CpuDesign;trace:ExecTrace|null;running:boolean;error:string|null;storage:string;selected:string[];selectedWire:string;panel:RefObject<HTMLDivElement|null>;fullscreen:boolean;
  locate:(id:string)=>void;add:(kind:NodeKind)=>void;patch:(id:string,patch:Partial<CpuDesign["nodes"][number]>)=>void;action:(name:string)=>void;
  context:{id:string;x:number;y:number}|null;closeContext:()=>void;setView:(pan:CpuDesign["pan"])=>void;preview:boolean;acceptArrange:()=>void;cancelArrange:()=>void;
};
export function CanvasTools(p:Props){
  useSimulatorCapture("studios/builder/CanvasTools.tsx:CanvasTools", () => ({ drawer, partSearch, bookmarkName, bookmarks, anchor }), "04298a640c76");

  const {design}=p;const [drawer,setDrawer]=useState("");const [query,setQuery]=useState("");const [partSearch,setPartSearch]=useState("");
  const [bookmarkName,setBookmarkName]=useState("");
  const [bookmarks,setBookmarks]=usePreference<{name:string;pan:CpuDesign["pan"];project:string}[]>("bookmarks",[]);
  const [anchor,setAnchor]=useState({x:12,y:110});
  const node=design.nodes.find(n=>n.id===p.selected[0]);const issues=validateDesign(design);
  useLayoutEffect(()=>{const panel=p.panel.current,svg=panel?.querySelector("svg.arch-canvas");if(!panel||!(svg instanceof SVGSVGElement)||!node)return;const update=()=>{const m=svg.getScreenCTM(),box=panel.getBoundingClientRect();if(!m)return;const point=svg.createSVGPoint();point.x=design.pan.x+(node.x+148)*design.pan.k;point.y=design.pan.y+node.y*design.pan.k;const screen=point.matrixTransform(m);setAnchor({x:Math.max(8,Math.min(panel.clientWidth-220,screen.x-box.left+10)),y:Math.max(100,Math.min(panel.clientHeight-90,screen.y-box.top))});};update();const observer=new ResizeObserver(update);observer.observe(panel);return()=>observer.disconnect();},[node,design.pan,p.fullscreen]);
  useEffect(()=>{if(!p.context)return;const close=(e:KeyboardEvent)=>{if(e.key==="Escape")p.closeContext();};window.addEventListener("keydown",close);return()=>window.removeEventListener("keydown",close);},[p.context]);
  const toggle=(name:string)=>setDrawer(drawer===name?"":name);
  const button=(label:string,name:string)=> <button key={name} type="button" aria-expanded={drawer===name} onClick={()=>toggle(name)}>{label}</button>;
  function patchNumber(id:string,text:string){const value=Number(text);if(Number.isSafeInteger(value))p.patch(id,{value:value>>>0});}
  return <>
    <div className="ux-rail" role="toolbar" aria-label="Canvas tools">
      {button("＋ Parts","parts")}{button("Inspector","inspector")}{button("Find","find")}{button("Views","views")}{button(`Issues ${issues.length}`,"issues")}{button("Changes","changes")}{button("? Keys","help")}
      <output className="ux-status" aria-live="polite">{p.error?"Error":p.running?"Running":p.trace?.halt?"Halted":"Paused"} · Cycle {p.trace?.cycle??0} · {p.trace?.mnemonic??"Ready"} · {p.storage}</output>
    </div>
    {p.error&&<div className="ux-error" role="alert">{p.error}</div>}
    {p.preview&&<div className="ux-preview" role="status">Layout preview <button onClick={p.acceptArrange}>Apply arrangement</button><button onClick={p.cancelArrange}>Cancel</button></div>}
    {node&&!p.context&&<div className="ux-selection" style={{left:anchor.x,top:anchor.y}} role="toolbar" aria-label="Selection actions"><strong>{p.selected.length>1?`${p.selected.length} selected`:node.name}</strong>{["Edit","Duplicate","Rotate","Probe","Delete"].map(name=><button key={name} onClick={()=>p.action(name)}>{name}</button>)}</div>}
    {p.context&&<div className="ux-context" role="menu" aria-label="Canvas context menu" style={{left:Math.max(8,Math.min((p.panel.current?.clientWidth??400)-190,p.context.x-(p.panel.current?.getBoundingClientRect().left??0))),top:Math.max(90,Math.min((p.panel.current?.clientHeight??500)-240,p.context.y-(p.panel.current?.getBoundingClientRect().top??0)))}}>{(p.context.id?["Edit","Duplicate","Rotate","Probe","Delete"]:p.selectedWire?["Delete wire","Fit"]:["Add part","Fit","Bookmark"]).map(name=><button role="menuitem" key={name} onClick={()=>{if(name==="Add part")setDrawer("parts");else if(name==="Bookmark")setDrawer("views");else p.action(name);p.closeContext();}}>{name}</button>)}<button role="menuitem" onClick={p.closeContext}>Close</button></div>}
    {drawer&&<aside className="ux-drawer" aria-label={`Canvas ${drawer}`}><header><strong>{({parts:"Component palette",inspector:"Inspector",find:"Find on canvas",views:"Saved views",issues:"Validation",changes:"Step changes",help:"Canvas shortcuts"} as Record<string,string>)[drawer]}</strong><button onClick={()=>setDrawer("")} aria-label="Close canvas drawer">×</button></header>
      {drawer==="parts"&&<><input aria-label="Find floating palette component" placeholder="Search parts" value={partSearch} onChange={e=>setPartSearch(e.target.value)}/><div className="ux-parts">{[...PALETTE,...GATE_PALETTE.filter(g=>!PALETTE.some(p=>p.kind===g.kind))].filter(item=>`${item.label} ${item.group}`.toLowerCase().includes(partSearch.toLowerCase())).map(item=><button draggable onDragStart={e=>e.dataTransfer.setData("kind",item.kind)} title={componentContract(item.kind).behavior} key={item.kind} onClick={()=>p.add(item.kind)}>{item.label}</button>)}</div></>}
      {drawer==="inspector"&&(node?<><label>Name<input value={node.name} onChange={e=>p.patch(node.id,{name:e.target.value})}/></label><label>Width<select value={node.width} onChange={e=>p.patch(node.id,{width:Number(e.target.value) as typeof node.width})}>{componentContract(node.kind).widths.map(w=><option key={w}>{w}</option>)}</select></label>{(componentContract(node.kind).storage||node.kind==="const"||node.behavior?.device==="switch")&&<label>Stored / configured value<input type="number" value={node.value} onChange={e=>patchNumber(node.id,e.target.value)}/></label>}<label>Note<textarea value={node.note} onChange={e=>p.patch(node.id,{note:e.target.value})}/></label><button onClick={()=>p.action("Edit")}>Edit ports and behavior</button><ul>{portsOf(node).map(port=><li key={port.id}>{port.dir} · {port.name} · {port.width} bits</li>)}</ul>{node.behavior?.device==="terminal"&&<pre>{node.behavior.text||"Terminal ready"}</pre>}</>:<p>Select a component to edit its properties.</p>)}
      {drawer==="find"&&<><input autoFocus aria-label="Find canvas component" placeholder="Name, type, or ID" value={query} onChange={e=>setQuery(e.target.value)}/>{design.nodes.filter(n=>`${n.name} ${n.id} ${n.kind}`.toLowerCase().includes(query.toLowerCase())).map(n=><button className="ux-result" key={n.id} onClick={()=>p.locate(n.id)}>{n.name}<small>{n.kind} · {n.id}</small></button>)}</>}
      {drawer==="views"&&<><label>View name<input value={bookmarkName} onChange={e=>setBookmarkName(e.target.value)} placeholder="e.g. ALU and registers"/></label><button disabled={!bookmarkName.trim()} onClick={()=>{setBookmarks([...bookmarks.filter(b=>b.project!==design.name||b.name!==bookmarkName.trim()),{name:bookmarkName.trim(),pan:{...design.pan},project:design.name}]);setBookmarkName("");}}>Save current view</button>{bookmarks.filter(b=>b.project===design.name).map((b,i)=><div className="ux-bookmark" key={i}><button onClick={()=>p.setView(b.pan)}>{b.name}</button><button aria-label={`Remove view ${b.name}`} onClick={()=>setBookmarks(bookmarks.filter(v=>v!==b))}>×</button></div>)}</>}
      {drawer==="issues"&&<>{!issues.length&&<p>All connections are consistent.</p>}{issues.map((issue,i)=><button className="ux-result" key={i} disabled={!issue.nodeId&&!issue.wireId} onClick={()=>{p.action(`Issue:${i}`);}}><small>{issue.level}</small>{issue.message}</button>)}</>}
      {drawer==="changes"&&<>{p.previous?stateChanges(p.previous,design).map((c,i)=><button className="ux-result" key={i} onClick={()=>{const n=design.nodes.find(n=>n.name===c.component||n.id===c.component);if(n)p.locate(n.id);}}>{c.component} · {c.field}<small>{c.before} → {c.after}</small></button>):<p>Step the CPU to compare before and after values.</p>}</>}
      {drawer==="help"&&<dl>{[["V / H / W","Select / Pan / Wire"],["Drag empty area","Pan canvas"],["Shift + drag","Select a region"],["Shift + click","Add to selection"],["Scroll","Zoom at pointer"],["Arrows on component","Move by grid step"],["Enter on output, then input","Connect ports with keyboard"],["Enter on endpoint handle","Reconnect selected wire"],["Escape","Cancel wire / exit fullscreen"],["Ctrl D / Delete","Duplicate / delete selection"],["Ctrl Z / Ctrl Y","Undo / redo"],["F6","Focus canvas"]].map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>}
    </aside>}
  </>;
}
