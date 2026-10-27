import { useId, useState } from "react";
import type { LessonDiagram as Diagram } from "./types";

/** Code-native diagrams stay sharp, searchable, and keyboard accessible. */
export function LessonDiagram({diagram}:{diagram:Diagram}) {
  const [selected,setSelected]=useState(0);
  const id=useId().replace(/:/g,"");
  const width=Math.max(600,diagram.nodes.length*170);
  return <figure className="lesson-figure">
    <figcaption>{diagram.title}</figcaption>
    {diagram.variant&&<div className="lesson-figure-scroll"><ConceptDiagram variant={diagram.variant}/></div>}
    <div className="lesson-figure-scroll"><svg viewBox={`0 0 ${width} 138`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{diagram.title}</title><desc id={`${id}-desc`}>{diagram.nodes.map(n=>`${n.label}: ${n.detail}`).join(". ")}</desc>
      <defs><marker id={`${id}-arrow`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#4074d6"/></marker></defs>
      {diagram.nodes.map((node,index)=>{const x=index*(width/diagram.nodes.length)+8;const w=width/diagram.nodes.length-30;const words=node.label.split(" ");const lines:string[]=[];for(const word of words){if(!lines.length||`${lines[lines.length-1]} ${word}`.length>19)lines.push(word);else lines[lines.length-1]+=` ${word}`;}return <g key={index}>
        <rect x={x} y="22" width={w} height="90" rx="13" fill={selected===index?"#e3efff":"#f7faff"} stroke={selected===index?"#1769ef":"#c9d9ef"} strokeWidth={selected===index?2:1}/>
        <text x={x+12} y="42" fill="#1769ef" fontSize="11" fontWeight="700">{index+1}</text>
        {lines.slice(0,3).map((line,row)=><text key={row} x={x+w/2} y={65+row*17} textAnchor="middle" fontSize="12" fill="#17335b" fontWeight="600">{line}</text>)}
        {index<diagram.nodes.length-1&&<path d={`M${x+w+2} 68 H${x+w+26}`} fill="none" stroke="#4074d6" strokeWidth="2" markerEnd={`url(#${id}-arrow)`}/>}
      </g>;})}
    </svg></div>
    <div className="lesson-figure-steps" aria-label="Diagram steps">{diagram.nodes.map((node,index)=><button key={index} aria-pressed={selected===index} onClick={()=>setSelected(index)}>{index+1}. {node.label}</button>)}</div>
    <p className="lesson-figure-detail" aria-live="polite"><strong>{diagram.nodes[selected]?.label}: </strong>{diagram.nodes[selected]?.detail}</p><p className="lesson-figure-note">{diagram.note}</p>
  </figure>;
}

function ConceptDiagram({variant}:{variant:NonNullable<Diagram["variant"]>}) {
  if(variant==="hamming")return <svg viewBox="0 0 720 220" role="img" aria-label="Hamming parity coverage: position five is flipped; checks one and four fail, giving syndrome 101 and error position five.">
    <text x="12" y="24" fontSize="13" fill="#17335b">Data 1011 → codeword 0110011 → flip position 5 → received 0110111</text>
    {[1,2,3,4,5,6,7].map((pos,i)=><g key={pos}><rect x={112+i*60} y="40" width="48" height="37" rx="7" fill={pos===5?"#ffe5e9":[1,2,4].includes(pos)?"#e4ecff":"#e6f7ee"} stroke={pos===5?"#e34f6b":"#cbdaf0"}/><text x={136+i*60} y="64" textAnchor="middle" fontSize="16" fill="#17335b">{[0,1,1,0,1,1,1][i]}</text><text x={136+i*60} y="93" textAnchor="middle" fontSize="11" fill="#526d90">pos {pos}</text></g>)}
    {[1,2,4].map((parity,row)=><g key={parity}><text x="12" y={122+row*32} fontSize="12" fill="#17335b">Check {parity}</text>{[1,2,3,4,5,6,7].map((pos,col)=><circle key={pos} cx={136+col*60} cy={118+row*32} r="9" fill={(pos&parity)!==0?"#347af0":"#e9eef5"}/>)}<text x="560" y={122+row*32} fontSize="12" fill={parity===2?"#078455":"#c42c4b"}>{parity===2?"0 · passes":"1 · fails"}</text></g>)}
    <text x="112" y="215" fontSize="13" fill="#1749a7">Read s4 s2 s1 = 1 0 1₂ = 5 → flip received position 5 back.</text>
  </svg>;
  if(variant==="kmap")return <svg viewBox="0 0 720 210" role="img" aria-label="Three-variable Karnaugh map with columns BC 00,01,11,10. The entire A equals zero row is grouped, giving F equals NOT A.">
    <text x="18" y="24" fontSize="13" fill="#17335b">F(A,B,C)=Σm(0,1,2,3) · Gray-code columns change one bit at a time</text>
    {["00","01","11","10"].map((s,col)=><text key={s} x={168+col*100} y="52" textAnchor="middle" fontSize="12" fill="#17335b">BC={s}</text>)}
    {[0,1].map((a,row)=><g key={a}><text x="25" y={93+row*58} fontSize="13" fill="#17335b">A={a}</text>{[0,1,2,3].map(col=><g key={col}><rect x={120+col*100} y={66+row*58} width="96" height="52" rx="8" fill={a===0?"#dcf7e9":"#f3f7fc"} stroke="#c9d9ef"/><text x={168+col*100} y={98+row*58} textAnchor="middle" fontSize="19" fill="#17335b">{a===0?1:0}</text></g>)}</g>)}
    <rect x="115" y="61" width="406" height="62" rx="13" fill="none" stroke="#0ba26c" strokeWidth="3"/>
    <text x="550" y="97" fontSize="18" fill="#078455">Group of 4</text><text x="120" y="202" fontSize="13" fill="#1749a7">B and C vary; A stays 0. Eliminate B and C: F=¬A.</text>
  </svg>;
  const labels=["IF","ID","EX","MEM","WB"],colors=["#dce9ff","#e4e0ff","#d8f2e8","#fff0d2","#e0effa"];
  return <svg viewBox="0 0 720 245" role="img" aria-label="Four independent instructions overlap in a five-stage pipeline and finish in eight ideal cycles.">
    <text x="14" y="24" fontSize="13" fill="#17335b">Five stages, four independent instructions, no stalls: 4+5−1=8 cycles</text>
    {Array.from({length:8},(_,i)=><text key={i} x={121+i*72} y="51" fontSize="11" textAnchor="middle" fill="#526d90">Cycle {i+1}</text>)}
    {[0,1,2,3].map(row=><g key={row}><text x="20" y={88+row*42} fontSize="13" fill="#17335b">I{row+1}</text>{labels.map((label,col)=><g key={col}><rect x={87+(row+col)*72} y={65+row*42} width="67" height="33" rx="7" fill={colors[col]}/><text x={121+(row+col)*72} y={86+row*42} textAnchor="middle" fontSize="12" fill="#17335b">{label}</text></g>)}</g>)}
    <text x="87" y="240" fontSize="12" fill="#1749a7">Instructions overlap; each one still traverses all five stages.</text>
  </svg>;
}
