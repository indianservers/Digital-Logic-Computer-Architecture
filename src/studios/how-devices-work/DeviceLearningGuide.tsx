import type {Lab} from './labs/data';
import {SOURCES} from './labs/data';
import type {AdvancedLab} from './advanced/data';
import {operatingExplanation} from './learning-content';
import {BUILD_PLANS} from './build-plans';

export default function DeviceLearningGuide({lab}:{lab:Lab|AdvancedLab}){
 const plan=BUILD_PLANS[lab.number]!;
 return <>
  <section className="hdw-course-card hdw-operating-guide" aria-label={`${lab.device.name} operating explanation`}>
   <h2>How {lab.device.name} Works</h2>
   {operatingExplanation(lab).map(({title,text},i)=>title.startsWith('Inside: ')?<p key={`${title}-${i}`}><strong>{title.slice(8)}: </strong>{text}</p>:<div key={`${title}-${i}`}><h3>{title}</h3><p>{text}</p></div>)}
  </section>
  <section className="hdw-course-card hdw-making-guide">
   <h2>How to Make This Device</h2>
   <p>Build an educational prototype of {lab.device.name} using the project below. It demonstrates the operating principle; it does not reproduce every subsystem of commercial equipment.</p>
   <h3>What you need</h3><p>{plan.materials}.</p>
   <h3>Build and connect the stages</h3><p>{plan.method}</p>
   <h3>Test the result</h3><p>{plan.check}</p>
   <h3>From prototype to finished equipment</h3><p>Document the input range, calibration, response time and failure behavior. A finished product also needs an engineered enclosure, power design, environmental testing and the approvals required for its intended use. Keep this teaching project within the stated bench or software scope.</p>
   <details><summary>Reference material</summary>{'source' in lab&&<p><a href={lab.source} target="_blank" rel="noreferrer">Device technical reference ↗</a></p>}<p><a href="https://docs.arduino.cc/built-in-examples/" target="_blank" rel="noreferrer">Arduino — sensor input, timing and control examples ↗</a></p>{lab.number<=54&&<p><a href={SOURCES[0]!.url} target="_blank" rel="noreferrer">NIBIB — biomedical engineering principles ↗</a></p>}{lab.number===140&&<p><a href="https://www.ti.com/solution/digital-multimeter-dmm" target="_blank" rel="noreferrer">Texas Instruments — multimeter signal-chain design ↗</a></p>}</details>
  </section>
 </>;
}
