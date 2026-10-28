import { useSimulatorCapture } from "../../layout/SimulatorCapture";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useStudioTab } from "../../layout/useStudioTab";
import { signalsFor, stepStage, type CpuState, type StageSignals } from "../../engines/isa/cpu";
import { assemble } from "../../engines/isa/assembler";
import { decode } from "../../engines/isa/spec";
import { FDE_LESSONS, lessonOf } from "../../data/studioLessons";
import { Icon } from "../../design-system/icons";
import { Toggle } from "../../design-system/ui";
import { usePrefs } from "../../store/prefs";
import { addMachine, displayedStage, finishInstruction, STAGES, type FdeStage } from "./fdeModel";
import "./fde.css";

const TABS=[{id:"cycle",label:"Cycle"},{id:"signals",label:"Control"},{id:"rtl",label:"Transfers"}];
const LABELS=["Fetch","Decode","Execute","Memory","Write Back"];
const DESCRIPTIONS=["Read instruction from memory. PC ← PC + 1","Decode opcode and read registers from register file.","Perform ALU operation or calculate address.","Read from or write to data memory (if needed).","Write result to register file."];
const TRANSFERS=["MAR ← PC, MDR ← IMem[MAR], IR ← MDR, PC ← PC + 1","Decode instruction and read registers from register file","ALU ← register or register plus immediate","Load or store, or a branch writing PC","Rd ← ALU or Rd ← MDR"];
const PURPOSES=["Read instruction and increment PC","Identify operation and source/destination registers","Perform ALU operation or calculate address","DMem[address] for loads/stores or update PC for branch","Write result to register file"];
const ROWS:Array<{key:keyof StageSignals;label:string;help:string}>=[
  {key:"regWrite",label:"RegWrite",help:"Writes the destination register during write-back when the instruction has a destination."},
  {key:"memRead",label:"MemRead",help:"Reads instruction memory during IF, or data memory during MEM for a load."},
  {key:"memWrite",label:"MemWrite",help:"Writes data memory during the memory stage of STORE."},
  {key:"aluSrc",label:"ALUSrc",help:"1 selects an immediate, 0 selects a register; — means this stage does not select an ALU operand."},
  {key:"aluOp",label:"ALUOp",help:"The decoded ALU operation; an operation name is not itself a write enable."},
  {key:"pcWrite",label:"PCWrite",help:"Advances PC during fetch. A taken branch can also replace PC during MEM in this teaching engine."},
];
const EXAMPLES:Record<string,string>={ADD:"ADD R3, R1, R2",ADDI:"ADDI R1, R0, 5",LOAD:"LOAD R1, 0(R0)",STORE:"STORE R1, 0(R0)",BEQ:"BEQ R1, R2, 2",HALT:"HALT"};

function StageIcon({stage}:{stage:FdeStage}) {
  return <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.3" aria-hidden="true">{stage==="IF"?<><rect x="6" y="10" width="36" height="23" rx="2"/>{[13,23,33].map(x=><path key={x} d={`M${x} 16v11h4V16z`}/>)}<path d="M10 37h28"/></>:stage==="ID"||stage==="WB"?<><path d="M12 5h17l8 8v30H12zM29 5v9h8M18 21h13M18 27h13M18 33h8"/></>:stage==="EX"?<path d="M9 5l30 19L9 43zM24 15v18M29 24h10"/>:<><ellipse cx="24" cy="9" rx="15" ry="6"/><path d="M9 9v29c0 8 30 8 30 0V9M9 19c0 8 30 8 30 0M9 29c0 8 30 8 30 0"/></>}</svg>;
}
function MiniPath({stage}:{stage:FdeStage}) {
  const box=(x:number,y:number,w:number,label:string)=><g><rect x={x} y={y} width={w} height="37" rx="5" fill="white" fillOpacity=".8" stroke="currentColor" strokeOpacity=".3"/><text x={x+w/2} y={y+23} textAnchor="middle">{label}</text></g>;
  return <svg viewBox="0 0 250 235" fill="none" stroke="currentColor" role="img" className="fdx-mini-path" aria-label={`${stage} register-transfer diagram`}><defs><marker id={`fdx-arr-${stage}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="currentColor" stroke="none"/></marker></defs>{stage==="IF"?<>{box(8,22,61,"PC")}{box(126,16,80,"MAR")}{box(121,110,87,"Memory")}{box(14,151,48,"+1")}<path d="M73 40h48M161 55v49M46 145V66M162 153v59H38v-17M211 132h27V38h-28" markerEnd={`url(#fdx-arr-${stage})`}/><text x="88" y="33">PC</text><text x="166" y="83">Mem[MAR]</text><text x="209" y="163">MDR</text><text x="68" y="203">PC + 1</text></>:stage==="ID"?<>{box(51,15,148,"MDR")}{box(51,92,148,"IR")}{box(19,175,212,"Register File")}<path d="M125 55v30M110 168v-32M140 168v-32" markerEnd={`url(#fdx-arr-${stage})`}/></>:stage==="EX"?<><text x="58" y="27">Rs</text><text x="149" y="27">Rt / Imm</text><path d="M64 38v44M168 38v44M126 152v29" markerEnd={`url(#fdx-arr-${stage})`}/><path d="M43 88h165l-23 61H66z" fill="#c9f8e3"/><text x="125" y="123" textAnchor="middle">ALU</text>{box(35,187,180,"Result")}</>:stage==="MEM"?<>{box(8,14,234,"Result / Address")}<path d="M90 58v43M180 101V59M125 155v28" markerEnd={`url(#fdx-arr-${stage})`}/><text x="11" y="83">Store</text><text x="192" y="83">Load</text>{box(8,107,234,"Memory")}{box(8,188,234,"MDR")}</>:<>{box(9,14,232,"Result from ALU")}<text x="125" y="65" textAnchor="middle">or MDR</text><path d="M125 78v37" markerEnd={`url(#fdx-arr-${stage})`}/><rect x="25" y="124" width="200" height="78" rx="8" fill="#ffe2e6" stroke="currentColor" strokeOpacity=".25"/><path d="M107 140v20M123 140v20M139 140v20" strokeWidth="5"/><text x="125" y="188" textAnchor="middle">Register File</text><text x="125" y="229" textAnchor="middle">Rd ← Result</text></>}</svg>;
}
function CpuPicture(){return <div className="fdx-cpu-picture" aria-label="CPU connected to instruction memory, data memory, and register file"><span>Instruction<br/>Memory</span><i>↕</i><div><b>CPU</b><em>⇄</em><span>Data<br/>Memory</span></div><i>↕</i><span>Register File</span></div>;}

export function FdeStudio() {
  useSimulatorCapture("studios/fde/FdeStudio.tsx:FdeStudio", () => ({ tab, cpu, preview, instruction }), "ea3477bc77db");

  const [tab,setTab]=useStudioTab(TABS,"cycle");
  const [cpu,setCpu]=useState<CpuState|null>(null);
  const [preview,setPreview]=useState<FdeStage|null>(null);
  const [instruction,setInstruction]=useState("LOAD");
  const {prefs,update}=usePrefs();
  const active=preview??displayedStage(cpu),activeIndex=STAGES.indexOf(active);
  const lesson=lessonOf(FDE_LESSONS,tab,"cycle");
  const built=assemble(EXAMPLES[instruction]??EXAMPLES.ADD!);
  const sample=built.ok?decode(built.words[0]??0):null;
  const decoded=tab==="signals"&&(!cpu||preview)?sample:cpu?.decoded??sample;
  const signals=signalsFor(decoded,active);
  const cpi=cpu&&cpu.retired>0?(cpu.cycles/cpu.retired).toFixed(2):"—";
  function step(whole=false){setPreview(null);setCpu(old=>whole?finishInstruction(old??addMachine()):stepStage(old??addMachine()));}
  function cell(key:keyof StageSignals,stage:FdeStage){if(key==="pcWrite"&&stage==="MEM"&&decoded?.mnemonic==="BEQ")return "if taken";const value=signalsFor(decoded,stage)[key];return value==="imm"?"1":value==="reg"?"0":value==="off"?"—":String(value);}
  const explain=<div className="fdx-explain"><div><i>✓</i><section><h3>What changed</h3><p>{preview?`Inspecting ${preview}; the CPU state has not advanced.`:cpu?.trace.at(-1)??"Load the add program, then step a cycle."}</p></section></div><div><i>?</i><section><h3>Why</h3><p>{decoded?.explain??"The control signals come from the decoded opcode and the current stage."}</p></section></div><div><i>i</i><section><h3>Notice</h3><p>CPI for this run is {cpi}. That number belongs to this simulator, not to every CPU.</p></section></div></div>;
  return <div className={`fdx fdx-${tab}`}><div className="fdx-layout"><main className="fdx-main">
    <header className="fdx-heading"><span className="fdx-title-icon"><Icon name="bolt" size={28}/></span><div><h1>Fetch–Decode–Execute</h1><p>Step the same CPU one cycle at a time. Fetch reads instruction memory, then decode, execute, memory, and<br className="fdx-wide"/> write-back take their turns.</p></div><div className="fdx-heading-actions"><Toggle on={prefs.explain} onChange={value=>update({explain:value})} label="Explain" tone="primary"/><Link to="/learn">‹　Back to Path</Link></div></header>
    <nav className="fdx-tabs" role="tablist" aria-label="Fetch Decode Execute labs">{TABS.map(t=><button key={t.id} role="tab" aria-selected={tab===t.id} onClick={()=>setTab(t.id)}>{t.label}</button>)}</nav>
    <section className="fdx-card fdx-diagram"><header><span className="fdx-panel-icon"><Icon name={tab==="rtl"?"table":"sheet"} size={23}/></span><div><h2>{tab==="cycle"?"Five-stage instruction sequence (multicycle FDE)":tab==="signals"?"Control Signals per Stage":"Register Transfers"}</h2><p>{tab==="cycle"?"Each instruction goes through five cycles: IF, ID, EX, MEM, WB. Fetch reads instruction memory and increments PC.":tab==="signals"?"The same opcode produces different control signals in different stages. Data memory belongs to MEM; RegWrite belongs to WB.":"Each cycle is an RTL assignment. The diagram shows how data moves between the PC, registers, ALU, memory and IR."}</p></div>{tab==="signals"?<label className="fdx-instruction-choice">Instruction<select aria-label="Inspect instruction controls" value={cpu&&!preview?(cpu.decoded?.mnemonic??"ADDI"):instruction} onChange={e=>{setInstruction(e.target.value);setPreview(active);}}>{Object.keys(EXAMPLES).map(op=><option key={op}>{op}</option>)}</select></label>:<div className="fdx-progress"><b>Cycle {activeIndex+1} of 5</b>{STAGES.map(s=><span key={s} className={s===active?"on":""}/>)}</div>}</header>
      <div className={`fdx-stage-flow ${tab==="signals"?"compact":""}`}>{STAGES.map((stage,i)=><div className="fdx-stage-unit" key={stage}><section className={`fdx-stage fdx-${stage.toLowerCase()} ${active===stage?"active":""}`}><b className="fdx-stage-badge">{stage}</b><h3>{LABELS[i]}</h3>{tab==="rtl"?<MiniPath stage={stage}/>:tab==="cycle"?<><StageIcon stage={stage}/><p>{DESCRIPTIONS[i]}</p></>:<p>{["instruction","and read registers","(ALU operation)","access","to register file"][i]}</p>}</section>{i<4&&<span className="fdx-flow-arrow">→</span>}</div>)}{tab==="cycle"&&<CpuPicture/>}</div>
      {tab==="signals"&&<div className="fdx-table-wrap"><table className="fdx-signal-table"><thead><tr><th>Control Signal</th>{STAGES.map(s=><th className={`fdx-${s.toLowerCase()}`} key={s}>{s}</th>)}</tr></thead><tbody>{ROWS.map(row=><tr key={row.key}><th scope="row">{row.label}<span className="fdx-help" title={row.help} aria-label={row.help}>?</span></th>{STAGES.map(stage=>{const value=cell(row.key,stage);return <td key={stage}><span className={`fdx-signal-value ${value!=="0"&&value!=="NONE"&&value!=="—"?`asserted fdx-${stage.toLowerCase()}`:""}`}>{value}</span></td>;})}</tr>)}</tbody></table><p className="fdx-table-note">MemRead in IF reads instruction memory; in MEM it reads data for LOAD. The table follows the teaching engine.</p></div>}
    </section>
    {tab==="cycle"&&<section className="fdx-cycle-note"><Icon name="info" size={26}/><div><h2>Multi-cycle FDE</h2><p>Each instruction uses five cycles here: IF, ID, EX, MEM, WB. Fetch reads instruction memory and increments PC. A branch may replace the PC during MEM.</p></div></section>}
    {prefs.explain&&explain}
    <div className="fdx-controls"><button className="primary" onClick={()=>{setCpu(addMachine());setPreview(null);setInstruction("ADD");}}><Icon name="play" size={19}/>Load ADD</button><button onClick={()=>step()} disabled={cpu?.stage==="done"}><Icon name="reset" size={19}/>Step cycle</button><button onClick={()=>step(true)} disabled={cpu?.stage==="done"}><Icon name="step" size={19}/>Step instruction</button><div className="fdx-stage-picker" aria-label="Inspect stage">{STAGES.map(stage=><button key={stage} aria-pressed={active===stage} className={active===stage?"active":""} onClick={()=>setPreview(stage)}>{stage}</button>)}</div>{cpu?.stage==="done"&&<span className="fdx-halted">Program halted · Load ADD to restart</span>}</div>
    {tab==="rtl"&&<section className="fdx-card fdx-transfers"><h2><Icon name="sheet" size={20}/>Register transfers</h2><div className="fdx-table-wrap"><table><tbody>{STAGES.map((stage,i)=><tr key={stage} className={active===stage?"active":""}><th><span className={`fdx-stage-label fdx-${stage.toLowerCase()}`}>●　{stage}</span></th><td>{TRANSFERS[i]}</td><td>{PURPOSES[i]}</td></tr>)}</tbody></table></div></section>}
    {tab==="signals"&&<section className="fdx-card fdx-current-signals"><Icon name="sheet" size={22}/><div><h2>Signals for this stage</h2><p>RegWrite {signals.regWrite} · MemRead {signals.memRead} · MemWrite {signals.memWrite}<br/>ALUSrc {signals.aluSrc} · ALUOp {signals.aluOp} · PCWrite {active==="MEM"&&decoded?.mnemonic==="BEQ"?"if taken":signals.pcWrite}</p></div><span>Stage: {active}</span></section>}
    {cpu&&tab==="cycle"&&<section className="fdx-card fdx-machine"><div><h2>CPU state</h2><p>PC <b>{cpu.pc}</b>　MAR <b>{cpu.mar}</b>　MDR <b>{cpu.mdr}</b></p><code>IR {cpu.ir.toString(2).padStart(16,"0")}</code><p>{cpu.decoded?.mnemonic??"Ready for fetch"}</p></div><div><h2>Registers</h2><div className="fdx-registers">{cpu.regs.map((value,i)=><span key={i}>R{i}<b>{value}</b></span>)}</div></div><div><h2>Timing</h2><p>Cycles <b>{cpu.cycles}</b></p><p>Retired <b>{cpu.retired}</b>　CPI <b>{cpi}</b></p></div></section>}
  </main><aside className="fdx-sidebar"><section className="fdx-card"><h2><Icon name="book" size={23}/>Studio Guide</h2><ol>{lesson.guide.map((item,i)=><li key={item}><span>{i+1}</span>{item}</li>)}</ol></section><section className="fdx-card fdx-takeaways"><h2><span>💡</span>Key Takeaways</h2><ul>{lesson.takeaways.map(item=><li key={item}>{item}</li>)}</ul></section><section className="fdx-card fdx-quote"><b>“</b><p>“Numbers are the language in which the universe is written.”<small>— Galileo</small></p></section></aside></div></div>;
}
