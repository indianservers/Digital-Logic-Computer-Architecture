import type { AdvancedLab } from './data';
import type { AdvancedResult } from './engine';

export function CVRArchitecture({sampleRate,bits}:{sampleRate:number;bits:number}){
 return <svg className="cvr-architecture" viewBox="0 0 550 230" role="img" aria-label="Four microphones feed preamplifiers and filters, ADC, recording processor and protected memory; aircraft power and independent immersion beacon">
 <defs><marker id="cvr-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5 0 10" fill="#176bc0"/></marker></defs>
 <text x="43" y="18" textAnchor="middle" fontSize="10">Cockpit microphones</text><text x="43" y="34" textAnchor="middle">4 channels</text>
 {[58,78,98,118].map(y=><g key={y}><rect x="22" y={y-10} width="9" height="14" rx="4" fill="#176bc0"/><path d={`M18 ${y-4}v6q0 9 9 9t9-9v-6M27 ${y+11}v6M21 ${y+17}h12M44 ${y}H86`} stroke="#176bc0" fill="none" markerEnd="url(#cvr-arrow)"/></g>)}
 {[[90,'Audio interface','Preamps / filters'],[205,'ADC',`${bits}-bit · ${sampleRate} kHz/ch`],[320,'Processor','Timestamp / control'],[435,'Memory','Solid-state circular']].map(([x,title,detail])=><g key={title}><rect x={x} y="47" width="102" height="90" rx="5" fill="#f2f8ff" stroke="#72a9d7"/><text x={Number(x)+51} y="80" textAnchor="middle" fontWeight="bold">{title}</text><text x={Number(x)+51} y="102" textAnchor="middle" fontSize="10">{detail}</text>{Number(x)<435&&<path d={`M${Number(x)+102} 92h13`} stroke="#176bc0" markerEnd="url(#cvr-arrow)"/>}</g>)}
 <rect x="90" y="174" width="145" height="45" rx="4" fill="#edf6ff" stroke="#72a9d7"/><text x="163" y="191" textAnchor="middle">Power supply</text><text x="163" y="208" textAnchor="middle" fontSize="10">Aircraft power → regulated rails</text><path d="M142 174v-37M235 195h22v-58" stroke="#176bc0" fill="none" markerEnd="url(#cvr-arrow)"/>
 <rect x="315" y="166" width="222" height="53" rx="4" fill="#f2fbf8" stroke="#5b8c78" strokeDasharray="4 3"/><text x="426" y="184" textAnchor="middle">Independent underwater locator</text><text x="426" y="201" textAnchor="middle" fontSize="10">Immersion → battery → 37.5 kHz pinger</text><text x="426" y="214" textAnchor="middle" fontSize="9">Beacon is separate from audio memory</text>
 </svg>;
}
export function CVRFlow(){return <div className="cvr-flow">{['Cockpit audio','Condition & digitize','Process & store','Recorded data'].map((name,i)=><div key={name}><svg viewBox="0 0 50 40" aria-hidden="true">{i===0?<g stroke="#0869d5" fill="none" strokeWidth="3"><rect x="20" y="3" width="10" height="22" rx="5"/><path d="M15 18v5q0 12 10 12t10-12v-5M25 35v5"/></g>:i===1?<g fill="#0869d5"><path d="M20 3h10l2 8 8 2v10l-8 2-2 8H20l-2-8-8-2V13l8-2Z"/><circle cx="25" cy="18" r="6" fill="white"/></g>:i===2?<g fill="#0869d5" stroke="#0869d5"><rect x="12" y="7" width="26" height="26" rx="2"/>{[16,25,34].map(x=><path key={x} d={`M${x} 2v5M${x} 33v5M7 ${x-9}h5M38 ${x-9}h5`}/>)}</g>:<g fill="#0869d5" stroke="white"><ellipse cx="25" cy="8" rx="15" ry="6"/><path d="M10 8v23c0 8 30 8 30 0V8c0 8-30 8-30 0Z"/><path d="M10 18c0 8 30 8 30 0M10 26c0 8 30 8 30 0" fill="none"/></g>}</svg><strong>{name}</strong><small>{['Voices / radio / ambient','Preamps / filters / ADC','Timestamp / circular writes','Protected memory'][i]}</small></div>)}</div>;}
export function CVRChannels({result}:{result:AdvancedResult}){
 return <svg className="cvr-channels" viewBox="0 0 600 160" role="img" aria-label="Four stacked synthetic audio channels; amplitudes follow input level and quantization">
 <rect width="600" height="160" rx="6" fill="#10233d"/>{[130,220,310,400,490,580].map(x=><path key={x} d={`M${x} 12v126`} stroke="#28405b"/>)}
 {result.traces.map((trace,i)=><g key={trace.label}><text x="8" y={27+i*31} fill="#e1ebff" fontSize="12">Ch {i+1} {trace.label}</text><path d={`M125 ${23+i*31}H585`} stroke="#344763"/><polyline points={trace.samples.map((v,j)=>`${125+j*460/(trace.samples.length-1)},${23+i*31-v*12}`).join(' ')} fill="none" stroke={trace.color} strokeWidth="1.2"/></g>)}
 <text x="125" y="151" fontSize="10" fill="#b4cce8">0</text><text x="585" y="151" textAnchor="end" fontSize="10" fill="#b4cce8">25 ms · synthetic sampled audio</text>
 </svg>;
}
export function CVRComponents({lab}:{lab:AdvancedLab}){return <div className="cvr-components">{lab.parts.map((part,i)=><span key={part}><b>{i+1}</b> {part}</span>)}</div>;}
