import type { AdvancedResult } from "./engine";

export function FADECOutputs({result,time}:{result:AdvancedResult;time:number}) {
  const scales=[1,1,10,100],limits=[100,100,1000,5000];
  return <div className="av-fadec-outputs"><div className="av-fadec-gauges">{result.metrics.slice(0,4).map((metric,i)=>{
    const value=Number(metric.value),fraction=result.valid&&Number.isFinite(value)?Math.min(1,Math.max(0,value/(limits[i]??100))):0;
    return <figure key={metric.label}><figcaption>{metric.label}</figcaption><svg viewBox="0 0 120 80" role="img" aria-label={`${metric.label}: ${metric.value} ${metric.unit}`}><path d="M20 55A40 40 0 0 1 100 55" pathLength="100" fill="none" stroke="#dceafb" strokeWidth="9"/><path d="M20 55A40 40 0 0 1 100 55" pathLength="100" fill="none" stroke={result.traces[i]?.color??'#1688ee'} strokeWidth="9" strokeDasharray={`${fraction*100} 100`}/><text x="60" y="58" textAnchor="middle" fill="#123565" fontSize="15" fontWeight="bold">{result.valid&&Number.isFinite(value)?value.toFixed(i===3?0:1):'—'}</text><text x="60" y="76" textAnchor="middle" fill="#536b89" fontSize="12">{metric.unit}</text></svg></figure>;
  })}</div><div className="av-fadec-legend">{result.traces.map((trace,i)=><span key={trace.label} style={{color:trace.color}}>● {trace.label}{(scales[i]??1)>1?` / ${scales[i]}`:''}</span>)}</div>
    <svg viewBox="0 0 600 170" role="img" aria-label="Combined engine response: N1 and N2 percent, EGT divided by ten, fuel flow divided by one hundred versus time">
      {[0,1,2,3,4].map(i=><g key={i}><path d={`M35 ${20+i*28}H580M${35+i*136.25} 20V132`} fill="none" stroke="#d9e8f4"/><text x="30" y={24+i*28} textAnchor="end" fill="#54718e" fontSize="12">{100-i*25}</text><text x={35+i*136.25} y="150" textAnchor="middle" fill="#54718e" fontSize="12">{i*45}</text></g>)}
      {result.traces.map((trace,i)=><polyline key={trace.label} points={trace.samples.map((v,j)=>`${35+j/Math.max(1,trace.samples.length-1)*545},${132-v/(scales[i]??1)*1.12}`).join(' ')} fill="none" stroke={trace.color} strokeWidth="2"/>)}<path d={`M${35+Math.min(1,time/180)*545} 20V132`} stroke="#457fa7" strokeDasharray="4 3"/><text x="300" y="167" textAnchor="middle" fill="#54718e" fontSize="12">Time (s) · scaled engine parameters</text>
    </svg><details><summary>Channel and schedule details</summary><div className="av-metrics">{result.metrics.slice(4).map(m=><div key={m.label}><small>{m.label}</small><strong>{m.value} {m.unit}</strong></div>)}</div></details>
  </div>;
}
