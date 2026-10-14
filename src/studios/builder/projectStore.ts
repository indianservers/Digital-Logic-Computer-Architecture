import { useEffect, useSyncExternalStore } from "react";
import type { CpuDesign } from "../../engines/builder/model";
import { CPU_TEMPLATES } from "../../engines/builder/templates";
import { ensureProject } from "../../engines/builder/project";
import { designJson, parseDesignJson } from "../../engines/builder/sim";
import { listRecords, saveRecord } from "../../store/projects";
import { saveVersion, tabEditIdentity } from "../../engines/builder/workspace";
let design: CpuDesign = ensureProject(CPU_TEMPLATES[2]!.build());
const listeners = new Set<() => void>();
let revision = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let initialized = false;
let storageStatus = "Restoring local project…";
const DRAFT_KEY="aimer-cpu-latest-draft";
let incoming:CpuDesign|null=null;
let listening=false;
export function cpuConflict(){return incoming;}
export function useCpuConflict(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn);};},cpuConflict);}
export function resolveCpuConflict(choice:"incoming"|"current"){
 if(!incoming)return;
 try{saveVersion(design,"Tab conflict · local copy");saveVersion(incoming,"Tab conflict · incoming copy");}catch{storageStatus="Conflict recovery failed — export both copies before resolving";listeners.forEach(fn=>fn());return;}
 const next=choice==="incoming"?incoming:design;incoming=null;setCpuProject(next);
}
function checkpoint(value:CpuDesign,updated:number){try{localStorage.setItem(DRAFT_KEY,JSON.stringify({data:designJson(value),updated}));return true;}catch{return false;}}
function localDraft():{data:string;updated:number}|null {try{const raw=localStorage.getItem(DRAFT_KEY);if(!raw)return null;const item=JSON.parse(raw);return typeof item.data==="string"&&Number.isFinite(item.updated)?item:null;}catch{return null;}}
export function getCpuProject() { return design; }
export function setCpuProject(value: CpuDesign | ((old: CpuDesign) => CpuDesign)) {
  if(incoming){storageStatus="Another tab edited this project — resolve the conflict before continuing";listeners.forEach(fn=>fn());return;}
  design = ensureProject(typeof value === "function" ? value(design) : value); storageStatus="Unsaved changes"; revision++; listeners.forEach(fn => fn());
  checkpoint(design,Date.now());
  clearTimeout(timer);
  timer = setTimeout(() => { const savedRevision=revision;const captured=design;const updated=Date.now();void saveRecord({ id: "builder-autosave", kind: "builder", name: captured.name, data: designJson(captured), updated }).then(() => { if(revision===savedRevision&&!incoming){storageStatus = "Autosaved";checkpoint(captured,updated);}listeners.forEach(fn=>fn()); }).catch(() => { if(revision===savedRevision&&!incoming)storageStatus = "Autosave unavailable — export to keep your project"; listeners.forEach(fn=>fn()); }); }, 700);
}
export function cpuStorageStatus() { return storageStatus; }
export function useCpuStorageStatus() { return useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn);};},cpuStorageStatus); }
export async function restoreCpuProject(){
 if(!listening&&typeof window!=="undefined"){listening=true;window.addEventListener("storage",event=>{if(event.key!==DRAFT_KEY||!event.newValue)return;try{const raw=JSON.parse(event.newValue);const parsed=parseDesignJson(raw.data);if(parsed.ok&&tabEditIdentity(parsed.design)!==tabEditIdentity(design)){incoming=parsed.design;clearTimeout(timer);storageStatus="Another tab edited this project — review both copies";listeners.forEach(fn=>fn());}}catch{/* Ignore invalid external storage records. */}});}
 if(initialized)return;initialized=true;const atRevision=revision;
 try{const records=await listRecords("builder");const record=records.find(r=>r.id==="builder-autosave");const draft=localDraft();const latest=draft&&(!record||draft.updated>record.updated)?draft:record;
  if(revision!==atRevision)return;
  if(latest){const parsed=parseDesignJson(latest.data);if(parsed.ok){design=ensureProject(parsed.design);storageStatus=draft===latest?"Recovered latest draft":"Ready";}else storageStatus="Saved project could not be restored; inspect Open Local or import a backup.";}else storageStatus="Ready";
 }catch{if(revision!==atRevision)return;const draft=localDraft();const parsed=draft&&parseDesignJson(draft.data);if(parsed&&parsed.ok){design=parsed.design;storageStatus="Recovered draft; IndexedDB unavailable";}else storageStatus="Storage unavailable";
 }finally{listeners.forEach(fn=>fn());}
}
export function useCpuProject(): [CpuDesign, typeof setCpuProject] {
  const current = useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, getCpuProject);
  useEffect(() => {void restoreCpuProject();},[]);
  return [current, setCpuProject];
}



