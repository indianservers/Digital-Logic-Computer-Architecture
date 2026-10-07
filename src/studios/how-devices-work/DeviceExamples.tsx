import {useMemo} from 'react';
import {initialValues,type Lab} from './labs/data';
import {simulate} from './labs/engine';
import {LiveVisual,Waveform} from './labs/visuals';
import {initialAdvancedValues,type AdvancedLab} from './advanced/data';
import {simulateAdvanced} from './advanced/engine';
import {simulateSystems} from './advanced/systems-engine';
import {simulateMarine} from './advanced/marine-engine';
import {simulateControl} from './advanced/control-engine';
import {simulateRobotics} from './advanced/robotics-engine';
import {simulateConsumer} from './advanced/consumer-engine';
import {simulateHousehold} from './advanced/household-engine';

export default function DeviceExamples({lab}:{lab:Lab|AdvancedLab}){
 const examples=useMemo(()=>{
  const modes=lab.modes.slice(0,5);
  if(lab.number<=54){const l=lab as Lab,p=initialValues(l);return modes.map(mode=>({mode,p,result:simulate(l,p,mode,false,5,'')}));}
  const l=lab as AdvancedLab,p=initialAdvancedValues(l);
  const run=l.number>=135?simulateHousehold:l.number>=125?simulateConsumer:l.number>=115?simulateRobotics:l.number>=105?simulateControl:l.number>=95?simulateMarine:l.number>=75&&l.number<85?simulateSystems:simulateAdvanced;
  return modes.map(mode=>({mode,p,result:run(l,p,mode,5,false)}));
 },[lab]);
 return <section className="hdw-course-card"><h2>{lab.device.name} — Representative Output Examples</h2><p>These fixed examples use the device’s existing educational model at a five-second teaching snapshot. Each mode uses the declared default parameters. They are independent of your Simulation settings.</p><div className="hdw-example-grid">{examples.map(({mode,p,result})=><article key={mode}><h3>{mode}</h3>{'binary' in result&&<LiveVisual lab={lab as Lab} result={result} values={p} time={5} mode={mode}/>}<p>{result.status}</p><dl>{result.metrics.map(m=><div key={m.label}><dt>{m.label}</dt><dd>{m.value} {m.unit}</dd></div>)}</dl>{result.traces.map(trace=><Waveform key={trace.label} trace={trace}/>)}</article>)}</div></section>;
}
