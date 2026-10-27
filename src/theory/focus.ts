import { CHAPTER_BY_ID } from "./chapters";
import { THEORY_ARTICLES, normalizeRoute } from "./catalogue";
import type { TheoryArticle } from "./types";
import { topicFor } from "./lessonPlans";
import { TOPIC_CHAPTERS } from "./topicChapters";

/** Deliberate lesson mappings take precedence over automatic concept matching. */
export const LAB_CHAPTERS:Record<string,string[]>={
  "/studios/number-systems?tab=convert":["numbers"],
  "/studios/number-systems?tab=math":["arithmetic","signed"],
  "/studios/number-systems?tab=signed":["signed"],
  "/studios/number-systems?tab=fixed":["fixed-detail"],
  "/studios/number-systems?tab=ieee":["ieee-detail"],
  "/studios/number-systems?tab=codes":["gray-detail"],
  "/studios/number-systems?tab=parity":["parity-detail","crc-detail"],
  "/studios/number-systems?tab=hamming":["hamming-detail"],
  "/studios/memory?tab=array":["ram-detail"],
  "/studios/memory?tab=sram":["sram-detail"],
  "/studios/memory?tab=dram":["dram-detail"],
  "/studios/memory?tab=rom":["rom-detail"],
  "/studios/memory?tab=eeprom":["eeprom-detail"],
  "/studios/memory?tab=flash":["flash-detail"],
  "/studios/memory?tab=addressing":["address-detail"],
  "/studios/memory?tab=organization":["organization-detail"],
  "/studios/memory?tab=cells":["sram-detail","dram-detail"],
  "/studios/memory?tab=types":["rom-detail","eeprom-detail","flash-detail"],
  "/studios/memory?tab=org":["organization-detail"],
  "/studios/memory?tab=decode":["address-detail","routing"],
  "/studios/memory?tab=expand":["organization-detail"],
  "/studios/memory?tab=banks":["organization-detail","dram"],
  "/studios/memory?tab=timing":["ram-detail","timing"],
  "/studios/interrupts?tab=timeline":["interrupt"],
  "/studios/interrupts?tab=priority":["priority"],
  "/studios/interrupts?tab=vectors":["vectors"],
  "/studios/interrupts?tab=exceptions":["vectors"],
  "/studios/interrupts?tab=dma":["dma"],
  "/studios/control?tab=hardwired":["hardwired-detail"],
  "/studios/control?tab=micro":["micro-detail"],
  "/studios/control?tab=compare":["encoding-detail"],
  "/studios/rtl?tab=transfer":["cpu"],
  "/studios/rtl?tab=bus":["bus","cpu"],
  "/studios/rtl?tab=word":["control"],
};
const DEFAULT_TAB:Record<string,string>={"/studios/control":"hardwired","/studios/interrupts":"timeline","/studios/memory":"array","/studios/number-systems":"convert"};
const MEMORY_INTROS:Record<string,string>={
  array:"RAM connects a numbered address to a stored data word. Follow address decoding, bus direction, and read/write controls to see exactly when a value is selected, transferred, or changed.",
  sram:"SRAM stores a bit in a powered feedback circuit. Follow the wordline and complementary bitlines to understand how a cell holds its state, exposes that state during a read, and accepts a new value during a write.",
  dram:"DRAM stores a bit as a small amount of charge. Reading and restoring that charge, selecting rows and columns, and refreshing cells explain both its high density and its timing constraints.",
  rom:"ROM supplies a stored pattern when an address is selected. Compare fabrication and programming methods, then trace a lookup without confusing design-time initialization with a runtime write.",
  eeprom:"EEPROM retains data without power and allows electrical updates. Explore how a write begins, why completion takes time, and how endurance and retention constrain repeated updates.",
  flash:"Flash retains data without power, but programming and erasing have different granularity. Understand why a bit can be programmed from one to zero, why an erase is needed to restore ones, and how blocks affect updates.",
  addressing:"An address identifies a location within a defined map. Calculate region boundaries, identify offsets and alignment, and distinguish the address sent by the CPU from the data stored at that address.",
  organization:"A memory system combines chips to supply the required number of words and bits per word. Separate depth expansion from width expansion, then work out bank selection and the number of chips needed.",
};
function chaptersFor(a:TheoryArticle):string[]{
  const exact=LAB_CHAPTERS[normalizeRoute(a.route)];
  if(exact)return exact;
  const topic=topicFor({...a,chapterIds:[]});
  const mapped=topic?TOPIC_CHAPTERS[topic.id]:undefined;
  if(mapped)return mapped;
  if(a.studio==="vlsi")return a.chapterIds.filter(id=>["mos","cmos","physical","reliability","fabrication","test","memcells","timing","storage","fsm","boolean","routing","soc"].includes(id)).slice(0,2);
  const text=`${a.title} ${a.concepts.join(" ")}`.toLowerCase();
  const matches=a.chapterIds.filter(id=>{
    const c=CHAPTER_BY_ID.get(id);
    return c?.keywords.split(/\s+/).some(word=>word.length>3&&new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`,"i").test(text));
  });
  return matches.length?matches.slice(0,2):a.chapterIds.slice(0,1);
}
export function focusedArticle(source:TheoryArticle,resolveDefault=true):TheoryArticle {
  let a=source;
  const defaultTab=DEFAULT_TAB[a.route];
  if(defaultTab&&resolveDefault)a=THEORY_ARTICLES.find(item=>item.route===`${a.route}?tab=${defaultTab}`)??a;
  const chapterIds=chaptersFor(a).filter(id=>CHAPTER_BY_ID.has(id));
  const tab=new URLSearchParams(a.route.split("?")[1]??"").get("tab")??"";
  const introduction=a.studio==="memory"?(MEMORY_INTROS[tab]??a.introduction):a.introduction;
  return {...a,introduction,chapterIds,concepts:a.concepts.filter(c=>!/^overview$/i.test(c))};
}
