import type { Trace } from '../labs/engine';

export function EngineMonitorOutputs({traces,valid}:{traces:Trace[];valid:boolean}) {
 const minimum=Math.min(0,...traces.flatMap(t=>t.samples)),maximum=Math.max(1,...traces.flatMap(t=>t.samples)),span=maximum-minimum;
 return <div className="av-monitor-chart"><div className="av-monitor-legend">{traces.map(t=><span key={t.label} style={{color:t.color}}>● {t.label} ({t.unit})</span>)}</div>{!valid?<p>Acquisition unavailable</p>:<svg viewBox="0 0 420 195" role="img" aria-label={`Combined ${traces.map(t=>t.label).join(' and ')} response trends`}>
 {[0,1,2,3,4].map(i=><g key={i}><path d={`M36 ${15+i*36}H405M${36+i*92.25} 15V159`} fill="none" stroke="#dae8f4"/><text x="31" y={19+i*36} textAnchor="end" fill="#456d92" fontSize="12">{(maximum-i*span/4).toFixed(maximum<2?2:0)}</text><text x={36+i*92.25} y="175" textAnchor="middle" fill="#456d92" fontSize="12">{i*(traces[0]?.timeSpan??180)/4}</text></g>)}
 {traces.map(t=><polyline key={t.label} points={t.samples.map((v,i)=>`${36+i/Math.max(1,t.samples.length-1)*369},${159-(v-minimum)/span*144}`).join(' ')} fill="none" stroke={t.color} strokeWidth="2"/>)}<text x="220" y="192" textAnchor="middle" fill="#456d92" fontSize="12">Time ({traces[0]?.axisLabel?.includes('µs')?'µs':'seconds'}) · units shown in legend</text>
 </svg>}</div>;
}
