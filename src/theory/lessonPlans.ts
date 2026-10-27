import { CHAPTER_BY_ID } from "./chapters";
import { DIGITAL_TOPICS } from "./lessonTopics";
import { ARCHITECTURE_TOPICS } from "./architectureTopics";
import { EMBEDDED_TOPICS } from "./embeddedTopics";
import { VLSI_TOPICS } from "./vlsiTopics";
import { SYSTEM_TOPICS } from "./systemTopics";
import { ADVANCED_TOPICS } from "./advancedTopics";
import deviceExamples from "./deviceExamples.json";
import type { LessonDiagram, LessonTopic, TheoryArticle } from "./types";

export const CHAPTER_FLOWS:Record<string,string>={
  numbers:"Choose base and width → Assign place weights → Add contributions → Equivalent representation",
  signed:"Choose signed format → Encode operands → Add within width → Interpret overflow",
  floating:"Select scale or exponent → Encode fields → Round result → Check representable range",
  codes:"Data bits → Add redundant checks → Receive codeword → Check or correct",
  boolean:"Input combination → Product terms → Combine terms → Function value",
  gates:"Input wires → First gate layer → Intermediate nodes → Final output",
  kmap:"Minterms → Gray-code grid → Adjacent groups → Simplified expression",
  arithmetic:"Operand bits → Add or invert inputs → Carry propagation → Result and flags",
  routing:"Data or address → Select decoding → Enabled path → Routed output",
  timing:"Launch edge → Data propagation → Stable window → Capture edge",
  storage:"Old state → Input and enable → Active clock event → New state",
  fsm:"Current state → Input symbol → Transition rule → Output and next state",
  memory:"CPU address → Address decoder → Selected storage → Data bus",
  cache:"Byte address → Set and tag lookup → Hit or miss → Refill or result",
  vm:"Virtual address → Translation lookup → Permission check → Physical address",
  cpu:"Program counter → Instruction fetch → Execute transfers → Commit next state",
  isa:"Instruction word → Opcode and fields → Operand interpretation → Defined operation",
  control:"Opcode or micro-PC → Control selection → Enables and selects → Datapath action",
  pipeline:"Fetch and decode → Execute → Memory stage → Writeback",
  ooo:"Rename and issue → Ready execution → Speculative result → In-order retirement",
  interrupt:"Request → Eligibility check → Save and vector → Service and return",
  priority:"Pending sources → Mask eligibility → Priority arbitration → Selected handler",
  vectors:"Cause identifier → Vector selection → Save precise state → Handler entry",
  dma:"CPU setup → Device ownership → DMA transfer → Completion and visibility",
  io:"Device status → Poll or event → Programmed transfer → Acknowledge",
  bus:"Request → Arbitration → Address/control/data → Response",
  coherence:"Shared copies → Ownership request → Invalidation or transfer → Consistent line state",
  performance:"Work and resources → Limiting service rate → Total execution time → Measured speedup",
  accelerator:"Load operands → Multiply → Accumulate → Store output",
  soc:"System workload → Assign engine → Move shared data → Synchronize completion",
  embedded:"Firmware instruction → Peripheral register → Hardware action → Status or event",
  gpio:"Pin configuration → External voltage → Input threshold → Software reading",
  timers:"Clock source → Prescaler → Counter → Compare or capture event",
  analog:"Physical signal → Sampling → Quantization → Calibrated units",
  serial:"Payload → Framing → Clocked or timed link → Decoded payload",
  rtos:"Ready task → Scheduler → Run or block → Synchronization event",
  devices:"Physical input → Sensor interface → Digital processing → Display or actuator",
  mos:"Gate bias → Channel charge → Operating region → Drain current",
  cmos:"Input voltage → Complementary networks → Charge transfer → Output voltage",
  physical:"Netlist and constraints → Placement → Routing → Extract and verify",
  reliability:"Operating stress → Electrical disturbance → Timing or aging effect → Design margin",
  fabrication:"Substrate → Repeated layer patterning → Contacts and wires → Tested die",
  test:"Fault model → Test stimulus → Fault propagation → Observable response",
  builder:"ISA and components → Wire datapath → Define control → Validate execution",
  branch:"PC and history → Prediction → Execute branch → Update or recover",
  dram:"Bank/row selection → Activate → Column transfer → Restore/precharge",
  atomics:"Shared state → Atomic operation → Ordering relation → Synchronized result",
  simd:"Data elements → Lane mapping → Parallel operation → Combine results",
  multipliers:"Operands → Partial products → Compressor reduction → Final addition",
  memcells:"Select cell → Cell/bitline interaction → Sense or write → Stored/read bit",
  controlsystem:"Target → Error computation → Control decision → Plant and feedback",
  ranging:"Transmit → Round-trip propagation → Time measurement → Range calculation",
  signal:"Sensor waveform → Gain and filter → Sample → Estimate and quality",
  "hamming-detail":"Place data → Compute parity → Inject one error → Decode syndrome and repair",
  "parity-detail":"Count data ones → Select parity → Transmit → Recheck parity",
  "crc-detail":"Append check zeros → XOR division → Attach remainder → Receiver division",
  "gray-detail":"Binary value → Shifted copy → XOR → Gray code",
  "ram-detail":"Address → Decoder → Read/write controls → Data transfer",
  "sram-detail":"Cell feedback → Wordline selection → Bitline interaction → Sense or update",
  "dram-detail":"Stored charge → Row selection → Sense and restore → Refresh scheduling",
  "rom-detail":"Stored pattern → Address selection → Decode → Output word",
  "eeprom-detail":"Address and new data → Start write → Busy interval → Ready and retained data",
  "flash-detail":"Current bits → Program allowed bits → Block erase if needed → Updated page",
  "address-detail":"Base and size → Region boundary → Address offset → Selected location",
  "organization-detail":"Required depth/width → Chips in parallel → Banks in depth → Decoded memory",
  "fixed-detail":"Real value → Apply scale → Stored integer → Reconstruct and round",
  "ieee-detail":"Real value → Normalize → Sign/exponent/fraction → Reconstructed value",
  "hardwired-detail":"Instruction opcode → Decoder → Control lines → Datapath operations",
  "micro-detail":"Micro-PC → Control-store read → Data operation → Next-address logic",
  "encoding-detail":"Control operation → Direct or encoded word → Decode if required → Same control lines",
};
export interface LessonPlan {
  id:string;
  kind:"device"|"topic"|"foundation";
  diagram:LessonDiagram;
  concepts:Array<[string,string]>;
  examples:Array<{title:string;steps:string[]}>;
  questions:Array<{question:string;answer:string}>;
  experiment:string[];
}
function lessonText(a:TheoryArticle){return `${a.title} ${a.route.split("/").pop()?.replace(/[-_]/g," ")??""}`.toLowerCase();}
export function topicFor(a:TheoryArticle):LessonTopic|undefined {
  const text=lessonText(a);
  const choices=a.studio==="vlsi"?[...VLSI_TOPICS,...DIGITAL_TOPICS,...ARCHITECTURE_TOPICS,...SYSTEM_TOPICS]:a.studio==="microcontroller"?[...EMBEDDED_TOPICS,...ARCHITECTURE_TOPICS,...SYSTEM_TOPICS,...DIGITAL_TOPICS]:[...ARCHITECTURE_TOPICS,...DIGITAL_TOPICS,...SYSTEM_TOPICS,...EMBEDDED_TOPICS];
  // Explicit detail chapters already have a fully worked and focused lesson.
  if(a.chapterIds.some(id=>id.endsWith("-detail")))return undefined;
  const found=[...ADVANCED_TOPICS,...choices].find(t=>t.match.test(text));
  if(found)return found;
  const path=a.route.split("?")[0]??"";
  const fallback:Record<string,string>={gates:"gates",truth:"gates",boolean:"boolean-laws",kmap:"kmap",combo:"gates",adders:"multi-adder",mux:"mux",alu:"alu",timing:"clock",latches:"flipflop-tables",registers:"parallel-register",counters:"mod-counter",fsm:"fsm",memory:"memory-hierarchy",cache:"cache-address",hierarchy:"memory-hierarchy",vm:"virtual","cpu-blocks":"fde",isa:"instruction",assembly:"fde",fde:"fde",control:"control-word",pipeline:"pipeline",hazards:"pipeline",io:"polling",interrupts:"interrupts",bus:"interconnect",parallel:"simd",multicore:"mesi",aca:"cpi",accelerator:"training",hetero:"offload",soc:"soc-blocks",cpu8:"fde",cpu16:"fde",mips:"instruction",riscv:"instruction",arm:"instruction",x86:"microops",compare:"instruction",mobile:"soc-blocks",desktop:"soc-blocks",builder:"builder-validation",sandbox:"builder-validation",microcontroller:"mcu-architecture",vlsi:"placement-routing"};
  const fixed=path==="/studios/rtl"?(a.route.includes("word")?"control-word":"rtl-transfer"):undefined;
  return choices.find(t=>t.id===(fixed??fallback[a.studio]));
}
interface DeviceSnapshot {
  route:string; mode:string; principle:string; flow:string[]; question:string; answer?:string;
  inputs:Array<{label:string;value:number;unit:string}>;
  change:{label:string;from:number;to:number;unit:string}|null;
  before:Array<{label:string;value:string|number;unit:string}>;
  after:Array<{label:string;value:string|number;unit:string}>;
  fault:Array<{label:string;value:string|number;unit:string}>;
  faultStatus:string;
}
const deviceScenarios:DeviceSnapshot[]=deviceExamples;
const snapshots=new Map<string,DeviceSnapshot>(deviceScenarios.map(d=>[d.route,d]));
function metricText(metrics:Array<{label:string;value:string|number;unit:string}>){return metrics.slice(0,4).map(m=>`${m.label} = ${m.value}${m.unit?` ${m.unit}`:""}`).join("; ");}
export function lessonPlan(a:TheoryArticle):LessonPlan {
  const device=snapshots.get(a.route);
  if(device){
    const inputs=device.inputs.map(c=>`${c.label}=${c.value} ${c.unit}`.trim()).join(", ");
    const change=device.change;
    const steps=[`Use the lab’s ${device.mode} mode with no injected fault. Set ${inputs}. Keep simulated time fixed at 5 s for this comparison.`,device.principle,`Evaluate the baseline teaching model: ${metricText(device.before)}.`,change?`Change only ${change.label} from ${change.from} to ${change.to} ${change.unit}; retain the other inputs, mode, and comparison time.`:"Keep the same inputs and evaluate the same deterministic model again.",`The second evaluation gives ${metricText(device.after)}. Compare the changed and unchanged quantities; do not assume every output must move.`];
    const flow=device.flow.slice(0,6);
    return {id:a.id,kind:"device",concepts:[["The mechanism in this device",device.principle],["Controlled comparison",`The worked scenario uses the actual ${a.title} teaching model, with one input changed and the remaining inputs held fixed. Its numbers describe that simulation and its stated assumptions.`]],diagram:{title:`${a.title}: signal and control path`,nodes:flow.map(s=>{const colon=s.indexOf(":");return {label:colon>0?s.slice(0,colon):s,detail:colon>0?s.slice(colon+1).trim():`${s} is a stage in this device’s documented signal path. ${device.principle}`};}),note:"Arrows show the functional sequence. Feedback paths, physical placement, and timing may need additional interpretation in the interactive lab."},examples:[{title:`Solved ${a.title} model scenario`,steps}],questions:[{question:"answer" in device?device.question:`How does the injected “${device.question}” condition affect ${a.title}?`,answer:"answer" in device?`${device.answer}. ${device.principle}`:`With the injected “${device.question}” condition, the model status is “${device.faultStatus}” and reports ${metricText(device.fault)}. Compare this with the no-fault baseline ${metricText(device.before)}. ${device.principle}`},{question:change?`What does changing only ${change.label} do in the solved scenario?`:"What numerical results should this setup produce?",answer:change?`At ${change.to} ${change.unit}, the model reports ${metricText(device.after)}. The baseline was ${metricText(device.before)}.`:metricText(device.before)},{question:"Why must mode, elapsed time, and fault state be kept fixed during this comparison?",answer:"They are additional model inputs. Changing them together would make it impossible to attribute an output difference to the selected control alone."}],experiment:a.guide};
  }
  const chapters=a.chapterIds.flatMap(id=>{const c=CHAPTER_BY_ID.get(id);return c?[c]:[];});
  const first=chapters[0]!;
  const selected=topicFor(a);
  const flow=selected?.flow??(CHAPTER_FLOWS[first.id]??"Inputs → Mechanism → Intermediate result → Output").split(" → ");
  const example=selected?.example??first.example;
  const stageNotes=first.id==="hamming-detail"?[example[0]??"",`${example[1]} ${example[2]}`,example[3]??"",`${example[4]} ${example[5]}`]:example;
  const concepts=selected?.concepts??[["Principle",first.paragraphs[0]??a.introduction],["Relationship",first.equation]];
  const questions=[{question:selected?.question??first.question,answer:selected?.answer??first.answer},...chapters.filter(c=>c.question!==(selected?.question??first.question)).map(c=>({question:c.question,answer:c.answer})),...(a.questions??[])];
  questions.push({question:`How can you check the solved result in ${a.title}?`,answer:`Use these exact intermediate steps as checkpoints: ${example.join(" ")} Keep the word widths, units, timing convention, and model assumptions the same when comparing with the simulation.`});
  return {id:a.id,kind:selected?"topic":"foundation",concepts,diagram:{title:`${a.title}: ${selected?"follow the worked example":first.title}`,variant:first.id==="hamming-detail"?"hamming":selected?.id==="kmap"||selected?.id==="qm"?"kmap":selected?.id==="pipeline"?"pipeline":undefined,nodes:flow.map((label,i)=>({label,detail:stageNotes[Math.min(i,stageNotes.length-1)]??concepts[0]?.[1]??""})),note:"The arrows show the order used to explain the mechanism. Select a numbered step to inspect the corresponding part of the solved example."},examples:[{title:selected?`${a.title}: step-by-step solution`:first.title,steps:example}],questions,experiment:a.guide};
}
