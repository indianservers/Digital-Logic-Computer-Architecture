import type { AdvancedResult } from "./engine";
import type { Trace } from "../labs/engine";

export function DeviceResponseTrace({trace,time}:{trace:Trace;time:number}) {
  const span=trace.timeSpan??10,limit=Math.max(5,...trace.samples.map(Math.abs))*1.15;
  const points=trace.samples.map((v,i)=>`${35+i*240/Math.max(1,trace.samples.length-1)},${111-v/limit*85}`).join(" ");
  return <figure className="adv-fbw-trace"><figcaption>{trace.label}</figcaption><svg viewBox="0 0 300 235" preserveAspectRatio="none" role="img" aria-label={`${trace.label} versus time in ${trace.unit}`}>
    {[0,1,2,3,4].map(i=><g key={i}><path d={`M35 ${26+i*42.5}H275M${35+i*60} 26V196`} stroke="#284b65" fill="none"/><text x="31" y={30+i*42.5} textAnchor="end" fill="#aac8dc" fontSize="12">{(limit*(1-i/2)).toFixed(1)}</text><text x={35+i*60} y="214" textAnchor="middle" fill="#aac8dc" fontSize="12">{(span*i/4).toFixed(1)}</text></g>)}
    <path d="M35 26V196H275" stroke="#7197b1" fill="none"/><polyline points={points} fill="none" stroke={trace.color} strokeWidth="2"/><path d={`M${35+Math.min(1,time/span)*240} 26V196`} stroke="#f2bd50" strokeDasharray="4 3"/><text x="155" y="231" textAnchor="middle" fill="#aac8dc" fontSize="12">Time (s) · {trace.unit}</text>
  </svg></figure>;
}

export function FlyByWireResponse({result}:{result:AdvancedResult}) {
  const bank=result.visual[0]??0,pitch=result.visual[1]??0;
  return <div className="adv-fbw-response"><h3>Aircraft attitude response</h3><svg viewBox="0 0 300 165" role="img" aria-label={`Aircraft response: bank ${bank.toFixed(1)} degrees, pitch ${pitch.toFixed(1)} degrees`}><g transform={`rotate(${-bank} 150 82) translate(0 ${-pitch*.6})`}><image href="/device-labs/advanced/059-attitude.webp" x="15" y="22" width="270" height="120" preserveAspectRatio="xMidYMid meet"/></g></svg><dl><div><dt>Actual bank</dt><dd>{bank.toFixed(2)}°</dd></div><div><dt>Actual pitch</dt><dd>{pitch.toFixed(2)}°</dd></div><div><dt>Airspeed</dt><dd>{(result.visual[2]??0).toFixed(0)} kt</dd></div></dl></div>;
}
