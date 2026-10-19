import { STUDIOS } from "../data/curriculum";
import { MASTER_CONCEPTS } from "../data/master";
import { ARCH_STUDIOS } from "../data/architecture";
import { ACA_LABS, acaRoute } from "../data/acaLabs";
import { VLSI_LABS, vlsiRoute } from "../data/vlsiLabs";
import { LAB_META, labPath } from "../studios/microcontroller/labs/registry";
import { PROJECT_LABS } from "../studios/microcontroller/projectData";
import { DEVICES, devicePath } from "../studios/how-devices-work/catalogue";
import { LABS as DEVICE_LABS } from "../studios/how-devices-work/labs/data";
import { ADVANCED_LABS } from "../studios/how-devices-work/advanced/data";
import { PREDICTS, QUIZZES, MODEL_LIMITS } from "../studios/vlsi/content";
import * as notes from "../data/studioLessons";
import metadata from "./tabMetadata.json";
import { CHAPTERS } from "./chapters";
import { TERMS } from "./referenceData";
import type { TheoryArticle } from "./types";

const BASE: Record<string, string[]> = {
  numbers: ["numbers"], boolean: ["boolean"], gates: ["gates", "boolean"], truth: ["boolean"], kmap: ["kmap", "boolean"], combo: ["gates", "boolean"], adders: ["arithmetic"], mux: ["routing"], alu: ["arithmetic"], timing: ["timing"], latches: ["storage"], registers: ["storage"], counters: ["fsm", "storage"], fsm: ["fsm"], memory: ["memory"], cache: ["cache", "memory"], hierarchy: ["memory", "cache"], vm: ["vm"], "cpu-blocks": ["cpu"], datapath: ["cpu", "bus"], isa: ["isa"], addressing: ["isa"], assembly: ["isa", "cpu"], fde: ["cpu", "control"], control: ["control", "cpu"], pipeline: ["pipeline"], hazards: ["pipeline"], io: ["io"], interrupts: ["interrupt"], bus: ["bus"], parallel: ["simd", "ooo"], multicore: ["coherence"], aca: ["performance"], accelerator: ["accelerator"], hetero: ["soc", "accelerator"], soc: ["soc"], cpu8: ["cpu", "isa"], cpu16: ["cpu", "isa"], mips: ["isa", "pipeline"], riscv: ["isa"], arm: ["isa", "soc"], x86: ["isa", "ooo"], compare: ["isa", "performance"], mobile: ["soc"], desktop: ["soc", "performance"], builder: ["builder", "cpu"], sandbox: ["builder"], microcontroller: ["embedded"], vlsi: ["cmos"], "how-devices-work": ["devices"],
};
const VLSI_BASE: Record<string,string[]> = { device:["mos"], cmos:["cmos"], timing:["timing","physical"], layout:["physical"], cells:["cmos","physical"], physical:["physical"], power:["reliability","cmos"], memory:["memcells"], advanced:["mos"], fab:["fabrication"], dft:["test"], soc:["soc","fabrication"], flow:["physical","cmos"] };
const LESSONS: Record<string, Record<string, notes.TabLesson>> = {
  "/studios/flip-flops": notes.FLIPFLOP_LESSONS, "/studios/registers": notes.REGISTER_LESSONS, "/studios/counters": notes.COUNTER_LESSONS, "/studios/fsm": notes.FSM_LESSONS, "/studios/cache": notes.CACHE_LESSONS, "/studios/cpu-blocks": notes.CPU_LESSONS, "/studios/isa": notes.ISA_LESSONS, "/studios/fde": notes.FDE_LESSONS, "/studios/bus": notes.BUS_LESSONS, "/studios/rtl": notes.RTL_LESSONS, "/studios/assembly": notes.ASSEMBLY_LESSONS, "/studios/control": notes.CONTROL_LESSONS, "/studios/pipeline": notes.PIPELINE_LESSONS, "/studios/hazards": notes.HAZARD_LESSONS, "/studios/hierarchy": notes.HIERARCHY_LESSONS, "/studios/vm": notes.VM_LESSONS, "/studios/io": notes.IO_LESSONS, "/studios/interrupts": notes.INTERRUPT_LESSONS, "/studios/parallel": notes.PARALLEL_LESSONS, "/studios/multicore": notes.MULTICORE_LESSONS,
};
export function normalizeRoute(route: string): string {
  const [path = "", search = ""] = route.split("?");
  const tab = new URLSearchParams(search).get("tab");
  return path.replace(/\/$/, "") + (tab ? `?tab=${encodeURIComponent(tab)}` : "");
}
export function articleId(route: string): string { return normalizeRoute(route).replace(/^\//, "").replace(/\?tab=/, "/"); }

function selectChapters(studio: string, title: string, concepts: string[], override?: string[]): string[] {
  const words = `${title} ${concepts.join(" ")}`.toLowerCase().replace(/[-–]/g," ");
  const selected = CHAPTERS.map(c => ({id:c.id, score:c.keywords.split(" ").filter(w => w.length>2 && words.includes(w.replace(/-/g," "))).length})).filter(c => c.score>0).sort((a,b)=>b.score-a.score).slice(0,3).map(c=>c.id);
  return [...new Set([...(override ?? BASE[studio] ?? ["cpu"]), ...selected])].slice(0,5);
}

const articles = new Map<string,TheoryArticle>();
function add(studio: string, studioTitle: string, title: string, route: string, introduction: string, concepts: string[] = [], guide: string[] = [], takeaways: string[] = [], chapters?: string[]) {
  if(studioTitle===studio) studioTitle=ARCH_STUDIOS.find(s=>s.id===studio)?.title ?? studioTitle;
  const normalized = normalizeRoute(route);
  const previous = articles.get(normalized);
  const combined = [...new Set([...(previous?.concepts ?? []), ...concepts])];
  articles.set(normalized, {id:articleId(normalized), studio, studioTitle, title, route:normalized, introduction: introduction || previous?.introduction || "", concepts:combined, guide:guide.length ? guide : previous?.guide ?? [], takeaways:takeaways.length ? takeaways : previous?.takeaways ?? [], chapterIds:selectChapters(studio,title,combined,chapters)});
}

// Base pages make the reader available on studio landing pages as well as labs.
for (const s of STUDIOS.filter(s=>s.active)) add(s.id,s.title,s.title,s.path,s.summary,s.topics);
// Preserve all mapped curriculum concepts, grouping concepts which share one lab.
for (const c of MASTER_CONCEPTS) {
  const studio = STUDIOS.find(s=>s.id===c.studio) ?? STUDIOS.find(s=>s.path.split("?")[0]===c.route.split("?")[0]);
  add(c.studio,studio?.title ?? c.studio,c.lab.replace(/-/g," "),c.route,"",[c.title]);
}
for (const row of metadata) {
  const studio = STUDIOS.find(s=>s.path.split("?")[0]===row.path);
  if (!studio) continue;
  for (const tab of row.tabs) {
    const local = (row.lessons as Record<string, {guide?: string[]; takeaways?: string[]; theory?: {body?:string}; what?:string; why?:string}>)[tab.id];
    const lesson = LESSONS[row.path]?.[tab.id];
    const intro = lesson?.theory.body ?? local?.theory?.body ?? [local?.what,local?.why].filter(Boolean).join(" ");
    add(studio.id,studio.title,tab.label,`${row.path}?tab=${tab.id}`,intro || `${studio.summary} This lab focuses on ${tab.label.toLowerCase()}.`,[],lesson?.guide ?? local?.guide,lesson?.takeaways ?? local?.takeaways);
  }
}
// Include lesson tabs even when a studio uses a custom navigation component.
for (const [path, lessons] of Object.entries(LESSONS)) {
  const studio=STUDIOS.find(s=>s.path.split("?")[0]===path);
  if (!studio) continue;
  for (const [tab,l] of Object.entries(lessons)) {
    const route=`${path}?tab=${tab}`;
    if (!articles.get(route)?.introduction) add(studio.id,studio.title,l.theory.title,route,l.theory.body,[],l.guide,l.takeaways);
  }
}
for (const studio of ARCH_STUDIOS) for (const lab of studio.labs) {
  const route=lab.id==="overview" ? studio.path : `${studio.path}/${lab.id}`;
  add(studio.id,studio.title,lab.title,route,lab.theory ?? lab.takeaways.join(" "),[],lab.guide,lab.takeaways);
}
for (const lab of ACA_LABS) add("aca","Advanced Computer Architecture",lab.title,acaRoute(lab.slug),lab.description,[lab.category]);
for (const lab of VLSI_LABS.filter(l=>l.implemented)) {
  add("vlsi","VLSI Studio",lab.title,vlsiRoute(lab.slug),lab.summary,[lab.category],[],[],VLSI_BASE[lab.category]);
  const article=articles.get(vlsiRoute(lab.slug))!;
  article.questions=[...(PREDICTS[lab.slug]?[PREDICTS[lab.slug]!]:[]),...(QUIZZES[lab.slug]??[])].map(q=>({question:q.prompt,answer:`${q.options[q.answer]}. ${q.explain}`}));
  article.details=[{title:"Understand the model before interpreting a result",body:MODEL_LIMITS.join(" ")}];
}
for (const lab of LAB_META) add("microcontroller","Microcontrollers & Embedded Systems",lab.title,labPath(lab),`Study ${lab.title.toLowerCase()} in the context of ${lab.section.toLowerCase()}. Read the underlying mechanism, predict the result, and compare it with the lab’s state and trace.`,[lab.section]);
for (const lab of PROJECT_LABS) add("microcontroller","Microcontrollers & Embedded Systems",lab.title,`/studios/microcontroller/project/${lab.slug}`,lab.objective,lab.controls.map(c=>c.label),lab.notes,lab.pins.map(([pin,role])=>`${pin}: ${role}`));
for (const device of DEVICES) {
  const basic=DEVICE_LABS.find(l=>l.device.id===device.id);
  const advanced=ADVANCED_LABS.find(l=>l.device.id===device.id);
  add("how-devices-work","How Devices Work",device.name,devicePath(device),[device.longDescription,basic?.principle ?? advanced?.principle].filter(Boolean).join(" "),device.keywords,device.signalFlow,basic?.applications ?? [],["devices", ...(selectChapters("how-devices-work",device.name,device.keywords).filter(id=>id!=="devices").slice(0,2))]);
  const article=articles.get(devicePath(device))!;
  if(advanced) {
    article.details=[...advanced.steps.map(([title,body])=>({title,body})),...Object.entries(advanced.partFunctions??{}).map(([title,body])=>({title,body}))];
    article.guide=advanced.steps.map(([title,body])=>`${title}: ${body}`);
    article.takeaways=advanced.applications;
  } else if(basic) {
    article.details=[{title:"What the sensor measures",body:basic.sensor},{title:"Trace a fault through the system",body:basic.fault}];
  }
}
export const THEORY_ARTICLES = [...articles.values()].sort((a,b)=>a.studioTitle.localeCompare(b.studioTitle) || a.title.localeCompare(b.title));
export const THEORY_BY_ID = new Map(THEORY_ARTICLES.map(a=>[a.id,a]));
export function theoryForRoute(pathname: string, search: string): TheoryArticle | undefined {
  if(pathname==="/studios/flip-flops") {
    const params=new URLSearchParams(search);
    const device=params.get("device");
    const tab=device==="d"?"dff":device;
    if(tab && articles.has(`${pathname}?tab=${tab}`)) return articles.get(`${pathname}?tab=${tab}`);
  }
  const exact = articles.get(normalizeRoute(pathname+search));
  if (exact) return exact;
  if (pathname.endsWith("/overview")) return articles.get(pathname.replace(/\/overview$/,""));
  return articles.get(pathname) ?? THEORY_ARTICLES.filter(a=>pathname.startsWith(a.route.split("?")[0]+"/")).sort((a,b)=>b.route.length-a.route.length)[0];
}
export function searchTheory(query: string, studio = "all"): TheoryArticle[] {
  const tokens=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const collection=THEORY_ARTICLES.filter(a=>studio==="all" || a.studio===studio);
  const direct=collection.filter(a=>tokens.every(t=>`${a.title} ${a.studioTitle} ${a.introduction} ${a.concepts.join(" ")}`.toLowerCase().includes(t)));
  if(direct.length || !tokens.length)return direct;
  return collection.filter(a=>tokens.every(t=>a.chapterIds.flatMap(id=>[CHAPTERS.find(c=>c.id===id)?.title??"",...(TERMS[id]??[]).map(([term])=>term)]).join(" ").toLowerCase().includes(t)));
}
