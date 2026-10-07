import type { AdvancedResult } from "./engine";

export function AirDataConnections() {
  return <svg viewBox="0 0 480 275" role="img" aria-label="Aircraft pitot, static and outside-air-temperature connections to the Air Data Computer and avionics">
    <path d="M235 45Q240 20 245 45L252 96L415 136L420 151L252 123L250 170L283 188L283 199L245 190L240 216L235 190L197 199V188L230 170L228 123L60 151L65 136L228 96Z" fill="#abbccc" stroke="#e4f2ff" strokeWidth="2"/>
    <path d="M239 87V217H165V239M258 114V204H209V239M225 121V195H252V239" fill="none" stroke="#ff5353" strokeWidth="3"/>
    <path d="M258 114V204H209V239" fill="none" stroke="#31b9ff" strokeWidth="3"/><path d="M225 121V195H252V239" fill="none" stroke="#79da55" strokeWidth="3"/>
    {[['Pitot · total pressure','#ff5353'],['Static pressure','#31b9ff'],['Air temperature · OAT','#79da55']].map(([label,color],i)=><g key={label}><path d={`M12 ${15+i*19}H34`} stroke={color} strokeWidth="3"/><text x="41" y={19+i*19} fill="#d9eeff" fontSize="12">{label}</text></g>)}
    <rect x="135" y="238" width="145" height="32" rx="4" fill="#104569" stroke="#31b9ff"/><text x="207" y="259" fill="white" textAnchor="middle" fontSize="12">Air Data Computer</text><path d="M280 254H305" stroke="#31b9ff" strokeWidth="3"/><text x="315" y="239" fill="#d9eeff" fontSize="12">ARINC → avionics</text><text x="315" y="255" fill="#d9eeff" fontSize="12">PFD · FMS · autopilot</text><text x="315" y="271" fill="#93b6cf" fontSize="12">Computed data + validity</text>
  </svg>;
}

export function AirDataGauges({result}:{result:AdvancedResult}) {
  const names=[['Indicated-speed model','IAS','#73d954'],['True-speed model','TAS','#25b4ff'],['Pressure altitude','Altitude','#ffa529'],['Mach model','Mach','#b3cddd'],['Density','Density','#b15aff']];
  return <div className="adv-airdata-gauges">{names.map(([name,label,color])=>{
    const metric=result.metrics.find(m=>m.label===name);
    const numeric=Number(metric?.value),value=result.valid&&Number.isFinite(numeric)?numeric.toFixed(label==='Mach'?2:label==='Density'?3:0):'—';
    return <figure key={name}><figcaption>{label}</figcaption><svg viewBox="0 0 100 110" role="img" aria-label={`${label}: ${metric?.value??'Unavailable'} ${metric?.unit??''}`}><circle cx="50" cy="47" r="40" fill="#072033" stroke={color} strokeWidth="5"/><text x="50" y="49" textAnchor="middle" fill="white" fontSize="16">{value}</text><text x="50" y="68" textAnchor="middle" fill="#bed8ea" fontSize="12">{metric?.unit??''}</text></svg></figure>;
  })}</div>;
}
