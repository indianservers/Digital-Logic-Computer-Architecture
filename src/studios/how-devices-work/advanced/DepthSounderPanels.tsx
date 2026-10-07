import { AcousticStepIcon } from "./FishFinderPanels";
export function DepthSounderArchitecture({detail=false}:{detail?:boolean}){
 const box=(x:number,y:number,w:number,label:string,caption:string,fill="#e7f4ff")=><g><rect x={x} y={y} width={w} height="50" rx="4" fill={fill} stroke="#6b9cc6"/><text x={x+w/2} y={y+19} textAnchor="middle" fontSize="12">{label}</text><text x={x+w/2} y={y+37} textAnchor="middle" fontSize="12">{caption}</text></g>;
 return <svg viewBox="0 0 600 250" role="img" aria-label={detail?"Depth sounder DC regulator high-voltage pulser T-R switch low-noise receiver amplifier ADC and MCU timing with transducer and display":"Depth sounder power and MCU timing drive pulser and transducer; receiver amplifier ADC and depth display recover seabed echoes"}>
 {detail?<>{box(8,15,94,"DC–DC","12 / 24 V input","#ededed")}{box(135,80,78,"Pulser","High voltage","#ffe5c5")}{box(231,80,75,"T/R switch","Protection","#fff7e1")}{box(325,80,80,"Receiver","LNA","#fff1c5")}{box(423,80,78,"Amplifier","Filter","#eadfff")}{box(519,80,73,"ADC","Samples")}
 {box(193,185,235,"MCU / DSP","Timing, processing and depth calculation","#dcf5e3")}{box(483,185,109,"Display","LCD / plotter")}
 <path d="M102 40H555v40M174 40v40M364 40v40M462 40v40M555 130v55M405 105h18M501 105h18M306 105h19M213 105h18M174 130v33h93v22M268 130v55M364 130v55M462 130v33h-93v22M428 210h55" stroke="#365f7b" fill="none"/>
 <path d="M95 188v29m-17-20h34m-34 11h34" stroke="#7b704f" strokeWidth="5"/><path d="M112 203h81M95 188v-40h79v-18" stroke="#365f7b" fill="none"/><text x="14" y="238" fontSize="12">Hull transducer</text>
 </>:<>
 {box(8,10,115,"Power supply","12 / 24 V DC","#ededed")}{box(178,75,104,"Pulser","High-voltage pulse","#ffe0b9")}{box(328,75,132,"Transducer","Electro-acoustic","#e2f4e2")}
 {box(8,169,132,"MCU / DSP","Control and ranging")}{box(173,169,97,"Receiver","Low noise","#fff1b8")}{box(291,169,99,"Amplifier","Conditioning","#eadfff")}{box(411,169,78,"ADC","Samples")}{box(510,169,82,"Display","Depth profile","#e1eff9")}
 <path d="M123 35h277v40M230 35v40M66 60v109M140 194h33M270 194h21M390 194h21M489 194h21M282 100h46M230 125v44" stroke="#365f7b" fill="none"/>
 </>}</svg>;
}
export function DepthSounderFlow(){return <div className="depth-ipo"><div><h3>Input</h3><AcousticStepIcon index={0}/><p>Short high-voltage electrical pulse to the transducer</p></div><div><h3>Processing</h3><AcousticStepIcon index={6}/><p>Receive weak echo</p><p>Amplify and filter</p><p>Convert to digital samples</p><p>Measure time of flight</p><p>Calculate D = cΔt / 2</p></div><div><h3>Output</h3><AcousticStepIcon index={7}/><p>Depth value and seabed profile on the display</p></div></div>;}
export function DepthSounderSignal(){return <div className="depth-signal">{["Electrical pulse","Transducer","Acoustic wave","Seabed reflection","Return echo","Received voltage","Sampled data","Depth output"].map((t,i)=><div key={t}><AcousticStepIcon index={[0,4,1,2,3,0,5,7][i]??0}/><span>{t}</span>{i<7&&<b>→</b>}</div>)}</div>;}
