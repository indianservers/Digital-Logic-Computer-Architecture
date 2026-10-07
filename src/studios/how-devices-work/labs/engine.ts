import type { Lab } from "./data";
export interface Trace { label: string; unit: string; color: string; samples: number[]; timeSpan: number; axisLabel: string; xSamples?: number[]; xUnit?: string }
export interface Metric { label: string; value: number | string; unit: string }
export interface LabResult { traces: Trace[]; metrics: Metric[]; status: string; explanation: string; image: string; imageLevel: number; quality: number; binary: string; coordinates: number[] }
const clamp = (n:number,min:number,max:number) => Math.min(max,Math.max(min,n));
const gauss = (x:number,mu:number,sigma:number) => Math.exp(-0.5*((x-mu)/sigma)**2);
const jitter = (t:number) => .55*Math.sin(t*113)+.3*Math.sin(t*79)+.15*Math.cos(t*193);
function cardiac(t:number,rate:number,mode:string) {
 if (/fibrillation/i.test(mode) && /ventricular/i.test(mode)) return .4*Math.sin(t*28)+.27*Math.sin(t*49)+.12*jitter(t);
 const phase = (t*rate/60+(/atrial fibrillation/i.test(mode)?.15*Math.sin(t*2.3)+.08*Math.sin(t*4.7):0))%1;
 const p = /atrial fibrillation/i.test(mode)?0:.12*gauss(phase,.17,.032);
 return p-.12*gauss(phase,.37,.012)+gauss(phase,.4,.014)-.22*gauss(phase,.43,.015)+.26*gauss(phase,.69,.068);
}
export function simulate(lab:Lab,p:Record<string,number>,mode:string,fault:boolean,time:number,action:string):LabResult {
 const n=(key:string,fallback=0)=>p[key]??fallback;
 const tracks:Trace[]=[]; const metrics:Metric[]=[];
 const metric=(label:string,value:number|string,unit="")=>metrics.push({label,value:typeof value==="number"?Number(value.toFixed(3)):value,unit});
 const trace=(label:string,unit:string,color:string,fn:(t:number,i:number)=>number)=>{
  const timeSpan=lab.engine==="eeg"?2:lab.engine==="emg"||lab.engine==="audio"?1:lab.engine==="hearing"?.025:lab.engine==="tens"?.05:lab.engine==="laser"?.5:8;
  tracks.push({label,unit,color,timeSpan,axisLabel:lab.engine==="pcr"&&label.includes("fluorescence")?`${n("cycles")} cycles`:lab.engine==="pcr"||["mri","ct","xray","detector","pet","spect","mammography","remote","doppler","ultrasound","sonar"].includes(lab.engine)?"compressed acquisition":`${timeSpan} s`,samples:Array.from({length:240},(_,i)=>fn(i/239*timeSpan,i))});
 };
 let status="Signal acquired",explanation=lab.principle,image="",imageLevel=1,quality=1,binaryValue=0; let coordinates:number[]=[];
 const rate=n("rate",72),noise=n("noise")/100,filtered=n("filter",1)===1;
 switch(lab.engine) {
  case "thermometer": {
   const temperature=n("temperature"); const r=10000*Math.exp(3950*(1/(temperature+273.15)-1/298.15));
   const voltage=3.3*r/(10000+r),ref=n("reference",3.3); const code=clamp(Math.round(voltage/ref*4095),1,4094);
   const measuredR=10000*(code/4095*ref)/(3.3-code/4095*ref);
   const measured=1/(1/298.15+Math.log(measuredR/10000)/3950)-273.15;
   metric("Temperature",measured,"°C");metric("Sensor resistance",r/1000,"kΩ");metric("Analog voltage",voltage,"V");metric("12-bit ADC",code,"counts");
   trace("Divider voltage","V","#168dff",t=>voltage+noise*.1*jitter(t)); binaryValue=code; quality=n("battery")/100;
   if(n("battery")<10){status="Low battery — measurement inhibited";quality=0;metrics[0]!.value="Unavailable";}
   explanation="NTC β = 3950 K, R₂₅ = 10 kΩ, 10 kΩ divider and 12-bit ADC. Changing ADC reference alters quantization. Body / object mode changes the interpreted measurement context; this is a calibrated sensor model."; break;
  }
  case "infrared": {
   const radiation=n("emissivity")*((n("temperature")+273.15)**4-(n("ambient")+273.15)**4);
   const filling=1/(1+Math.max(0,n("distance")-5)*.03),estimated=(radiation*filling+.98*(n("ambient")+273.15)**4)/.98;
   metric("Surface estimate",Math.pow(Math.max(estimated,0),.25)-273.15,"°C");metric("Thermopile response",radiation/1e8,"relative");metric("Field filling",filling*100,"%");
   trace("Thermopile voltage","relative","#3cc8ff",t=>radiation/1e8*(1+.005*jitter(t))); binaryValue=radiation/1e7;break;
  }
  case "ecg": case "heart": case "icu": {
   const r=/brady/i.test(mode)?45:/tachy/i.test(mode)?140:rate;
   const gain=n("gain",1)*(mode==="Lead I"?.7:mode==="Lead III"?.55:1);
   trace(lab.engine==="heart"&&!/ECG/.test(mode)?"PPG pulse":"ECG — P / QRS / T",lab.engine==="heart"&&!/ECG/.test(mode)?"relative":"mV","#38ddb0",t=>gain*(lab.engine==="heart"&&!/ECG/.test(mode)?Math.max(0,Math.sin((t+time*.1)*r/60*2*Math.PI))**2:cardiac(t+time*.1,r,mode))+noise*(filtered?.05:.45)*jitter(t));
   metric("Heart rate",/ventricular fibrillation/i.test(mode)?"Unreliable":r,"BPM");metric("Sampling",500,"Hz");metric("Gain",gain,"×");binaryValue=2048+gain*cardiac(time,r,mode)*800;
   quality=clamp(1-noise*(filtered?.2:.8),0,1);
   if(lab.engine==="icu") {metric("SpO₂",n("oxygen"),"%");metric("Systolic BP",n("systolic"),"mmHg");metric("Temperature",n("temperature"),"°C");metric("Respiratory rate",n("respiration"),"/min");trace("Respiration","relative","#f8cd54",t=>Math.sin(t*n("respiration")/60*2*Math.PI));trace("Plethysmogram","relative","#37b5ff",t=>Math.max(0,Math.sin(t*r/60*2*Math.PI))*.8);if(n("oxygen")<90)status="Low oxygen input — alarm model active";}
   break;
  }
  case "oximeter": {
   const perfusion=n("perfusion")/100,motion=n("motion")/100,ambient=n("ambient")/100,R=(110-n("oxygen"))/25;
   const opticalGain=mode==="Reflective"?.6:1;
   trace("Infrared PPG","relative","#21bef1",t=>1+opticalGain*perfusion*.15*Math.sin(t*rate/60*2*Math.PI)+motion*.09*jitter(t)+ambient*.025);
   trace("Red PPG","relative","#f9798a",t=>1+R*perfusion*.15*Math.sin(t*rate/60*2*Math.PI)+motion*.1*jitter(t));
   quality=clamp(perfusion*(1-motion)*(1-ambient*.3),0,1);metric("SpO₂",quality<.1?"Unreliable":n("oxygen"),"%");metric("Pulse rate",quality<.1?"Unreliable":rate,"BPM");metric("Ratio R",R);metric("Signal quality",quality*100,"%");binaryValue=2048+perfusion*1000;
   if(quality<.1)status="Low optical signal — reading withheld";explanation="Illustrative calibration SpO₂ = 110 − 25R. R is (ACred/DCred)/(ACIR/DCIR), not a universal clinical calibration. Perfusion, motion and ambient light alter signal quality.";break;
  }
  case "bp": {
   const sys=n("systolic"),dia=Math.min(n("diastolic"),sys-10),map=dia+(sys-dia)/3;
   trace("Cuff pressure","mmHg","#438fff",t=>n("cuff")-t*18);
   const cuffFit=mode==="Medium cuff"?1:mode==="Small cuff"?.65:.8;
   trace("Oscillometric pulses","relative","#fb8192",t=>cuffFit*gauss(n("cuff")-t*18,map,20)*Math.sin(t*rate/60*Math.PI*2)*15);
   metric("Systolic",sys,"mmHg");metric("Diastolic",dia,"mmHg");metric("Mean pressure",map,"mmHg");metric("Pulse",rate,"BPM");binaryValue=map*20;
   if(n("cuff")<=sys){status="Insufficient inflation — estimate unavailable";metrics[0]!.value="Unavailable";metrics[1]!.value="Unavailable";}explanation="The pressure envelope peaks near the modeled mean pressure. Systolic and diastolic inputs define a synthetic test case; the chart is not a validated BP estimation algorithm.";break;
  }
  case "ultrasound": case "doppler": case "sonar": {
   const acousticSpeed=lab.engine==="sonar"?1500:1540,distance=lab.engine==="sonar"?n("distance"):lab.engine==="doppler"?.05:n("depth")/100;
   const delay=2*distance/acousticSpeed;image=lab.engine==="sonar"?"sonar":lab.engine==="doppler"?"doppler":"ultrasound";
   if(lab.engine==="doppler") {const shift=2*5e6*n("velocity")/100*Math.cos(n("angle")*Math.PI/180)/1540;metric("Doppler shift",shift,"Hz");metric("Velocity input",n("velocity"),"cm/s");metric("Probe angle",n("angle"),"°");trace("Velocity spectrum","relative","#efc45a",t=>gauss(t,3.4+shift/3000,.4)+noise*jitter(t));const spectrum=tracks.at(-1)!;spectrum.samples=Array.from({length:240},(_,i)=>gauss(i/239*12000,shift,200)+noise*.1*jitter(i));spectrum.xSamples=Array.from({length:240},(_,i)=>i/239*12000);spectrum.xUnit="Hz";spectrum.axisLabel="12 kHz";imageLevel=n("velocity")/100;binaryValue=shift;}
   else {metric("Round-trip delay",delay*(lab.engine==="sonar"?1000:1e6),lab.engine==="sonar"?"ms":"µs");metric("Range",distance, "m");metric("Frequency",n("frequency"),lab.engine==="sonar"?"kHz":"MHz");trace("Echo envelope","relative","#49bcff",t=>gauss(t,clamp(distance/(lab.engine==="sonar"?250:.25)*7,.3,7),.11)*(n("gain",n("power",60))/100)*Math.exp(-distance*n("frequency")/(lab.engine==="sonar"?30000:5))+gauss(t,1.2,.08)*.15); imageLevel=n("gain",n("power",60))/60;binaryValue=delay*1e7;if(lab.engine==="ultrasound"&&mode!=="B-mode"){trace(mode==="M-mode"?"Moving reflector depth":"Doppler motion example",mode==="M-mode"?"cm":"relative","#ecbd65",t=>mode==="M-mode"?n("depth")+Math.sin(t*3)*.8:Math.sin(t*8)*n("gain")/100);}}
   quality=clamp(1-noise-(n("angle",20)/90)*.15,0,1);if(lab.engine==="sonar")metric("Water depth",n("depth"),"m");break;
  }
  case "mri": case "ct": case "xray": case "detector": case "mammography": case "pet": case "spect": {
   image=lab.engine;let q=1;
   if(lab.engine==="mri") {q=n("field")*Math.sqrt(n("duration"))/5;imageLevel=(/T1/.test(mode)?.8:1.2)*(n("gradient")/100+.5);metric("Field",n("field"),"T");metric("Slice",n("slice"),"%");metric("Relative SNR",q*30);trace("RF receive envelope","relative","#5bcdf6",t=>Math.exp(-t/(/T1/.test(mode)?.8:2))*Math.cos(t*n("gradient")));}
   if(lab.engine==="ct") {q=Math.sqrt(n("thickness"))*n("kvp")/120;imageLevel=n("kvp")/120*(mode==="Bone reconstruction"?1.3:1);metric("Projection angle",(time*360/n("rotation"))%360,"°");metric("Slice thickness",n("thickness"),"mm");metric("Coverage",n("coverage"),"mm");trace("Projection intensity","relative","#43beff",t=>Math.exp(-(.5+.3*Math.sin(t*2))*120/n("kvp")));}
   if(lab.engine==="xray"||lab.engine==="mammography") {const attenuation=Math.exp(-.18*n("thickness")*(80/n("kvp"))-.08*n("filtration"));imageLevel=clamp(attenuation*n("current")/(lab.engine==="mammography"?3:1),.15,2);q=Math.sqrt(n("current"))/(1+n("filtration")*.1)/(1+noise*8);metric("Transmission",attenuation*100,"%");metric("Exposure input",n("current"),"mAs");trace("Attenuation profile","relative","#60cfff",t=>Math.exp(-.18*n("thickness")*(.6+.4*Math.sin(t*1.2)**2)*80/n("kvp")-.08*n("filtration"))+noise*.1*jitter(t));}
   if(lab.engine==="detector") {imageLevel=n("exposure")/100*n("gain")/10;q=n("resolution")/100/(1+noise);metric("Pixel response",imageLevel*2048,"counts");metric("Spatial sampling",n("resolution"),"%");trace("Detector pixel row","counts","#3eb8ff",t=>2048*imageLevel*(.5+.4*Math.sin(t)**2)+noise*200*jitter(t));}
   if(lab.engine==="pet"||lab.engine==="spect") {imageLevel=n("uptake")/2;q=Math.sqrt(n("duration")*n("uptake"))/(lab.engine==="spect"?8:3)*(lab.engine==="spect"?Math.sqrt(n("projections")/120):1);metric("Relative event counts",n("uptake")*n("duration")*(lab.engine==="spect"?n("projections"):1000));metric("Uptake input",n("uptake"),"relative");if(lab.engine==="spect"){metric("Slice position",n("slice"),"%");metric("Slice plane",mode);}if(lab.engine==="spect")metric("Orbit time",n("projections")*(n("rotation")+n("duration")),"s");trace("Detected projection counts","relative","#54e79c",t=>n("uptake")*(1+.5*Math.sin(t*1.2))+noise*jitter(t));}
   quality=clamp(q/(1+noise),.05,1);metric("Model quality",quality*100,"%");binaryValue=imageLevel*2048;explanation=lab.principle+" Image is a synthetic educational phantom. It illustrates contrast and acquisition relationships; it is not a patient scan or a diagnostic reconstruction.";break;
  }
  case "remote": {
   const code=Math.round(n("command")),address=Math.round(n("address"));binaryValue=code;
   const bits=[address,address^255,code,code^255].map(v=>v.toString(2).padStart(8,"0")).join("");
   trace("IR packet envelope","logic","#58c6ff",(_,i)=>i<20?1:i<30?0:bits[Math.min(31,Math.floor((i-30)/6))]==="1"?Number(i%6<2):Number(i%6<4));
   metric("Carrier",n("carrier"),"kHz");metric("Command",code,"decimal");metric("Packet",`0x${address.toString(16).padStart(2,"0")}${(address^255).toString(16)}${code.toString(16).padStart(2,"0")}${(code^255).toString(16)}`);metric("Receiver action",action==="send"?mode:"Idle");status=action==="send"?(Math.abs(n("carrier")-38)>3?"Carrier mismatch — receiver rejected packet":"Command transmitted to virtual receiver"):"Choose a key, then send command";break;
  }
  case "nfc": {
   const coupled=n("distance")<=4&&!fault;metric("Coupling",clamp(100-n("distance")*18,0,100),"%");metric("Transaction",n("amount"),"units");metric("Credential",n("token")?"Tokenized":"Test identifier");metric("Device",mode);status=action==="send"?(coupled?"Virtual transaction approved":"RF exchange failed — no transaction"):"Ready for virtual tap";trace("Reader field coupling","relative","#47cdff",t=>Math.exp(-n("distance")/3)*Math.sin(t*24));binaryValue=coupled?1:0;break;
  }
  case "robot": {
   const angle1=n("joint1")*Math.PI/180,angle2=n("joint2")*Math.PI/180,angle3=n("joint3")*Math.PI/180;
   const movement=/pick/i.test(mode)?Math.sin(time*n("speed")/100)*.5:0;
   const a=angle1+movement,b=a+angle2,c=b+angle3,x1=100*Math.cos(a),y1=100*Math.sin(a),x2=x1+90*Math.cos(b),y2=y1+90*Math.sin(b),x3=x2+70*Math.cos(c),y3=y2+70*Math.sin(c);
   coordinates=[x1,y1,x2,y2,x3,y3];metric("Tool X",x3,"mm");metric("Tool Y",y3,"mm");metric("Wrist pose",n("joint4")+n("joint5")+n("joint6"),"°");metric("Motor torque estimate",n("payload")*9.81*Math.abs(x3)/1000,"N·m");trace("Encoder trajectory","°","#45b8f6",t=>n("joint1")+Math.sin(t*n("speed")/50)*n("payload"));image="robot";break;
  }
  case "autopilot": {
   const convergence=1-Math.exp(-time/6),altitude=9000+(n("target")-9000)*convergence;
   metric("Altitude",altitude,"ft");metric("Heading",90+(n("heading")-90)*convergence,"°");metric("Airspeed",n("speed"),"kt");metric("Vertical speed",mode==="VS"?n("climb"):(n("target")-altitude)*2,"ft/min");trace("Altitude control error","ft","#38d7b7",t=>(n("target")-9000)*Math.exp(-t/3));image="autopilot";coordinates=[altitude,n("heading")];break;
  }
  case "radar": {
   metric("Unambiguous range",299792458/(2*n("prf"))/1000,"km");metric("Sweep bearing",(time*n("rotation")*6)%360,"°");metric("Targets",n("targets"));metric("Displayed range",n("range"),"km");trace("Range profile","relative","#32e596",t=>Array.from({length:n("targets")},(_,i)=>gauss(t,(i+1)*8/(n("targets")+1),.045)*(1-.5*i/n("targets"))).reduce((a,b)=>a+b,0)+.1*(1-n("clutter")/100)*jitter(t));image="radar";coordinates=[time*n("rotation")*6,n("targets"),n("range")];break;
  }
  case "camera": case "phone": case "endoscope": case "microscope": {
   image=lab.engine;
   if(lab.engine==="camera") {imageLevel=(n("iso")/100)*(n("shutter")/8)*(5.6/n("aperture"))**2;quality=1-Math.abs(n("focus")-50)/60;metric("Exposure multiplier",imageLevel,"×");metric("Focus match",quality*100,"%");trace("Pixel histogram","relative","#60beff",t=>gauss(t,clamp(2*imageLevel,1,7),.7));}
   if(lab.engine==="phone") {const watts=(.3+n("brightness")*.015+n("workload")*.018+n("wifi")*.2+n("bluetooth")*.08+n("network")*.3)*(n("saver")?.7:1);metric("Power use",watts,"W");metric("Estimated runtime",15/watts,"h");metric("Network",n("wifi")||n("network")?"Connected":"Offline");metric("Active app",mode);trace("Power timeline","W","#45bafa",t=>watts*(.9+.1*Math.sin(t*(mode==="Camera app"?6:2))));}
   if(lab.engine==="endoscope") {imageLevel=n("brightness")/80;quality=Math.min(1,n("contrast")/100*(mode==="Enhanced contrast"?1.5:1));metric("Optical brightness",n("brightness"),"%");metric("Zoom",n("zoom"),"×");trace("Pixel intensity","relative","#f09083",t=>imageLevel*(.5+n("contrast")/100*.3*Math.sin(t*n("zoom")))+noise*.1*jitter(t));}
   if(lab.engine==="microscope") {imageLevel=n("brightness")/65*(mode==="Fluorescence"?.75:1);quality=clamp(1-Math.abs(n("focus")-50)/50,0,1);metric("Magnification",n("magnification"),"×");metric("Focus score",quality*100,"%");trace("Optical intensity","relative","#be98ed",t=>imageLevel*(.5+n("contrast")/100*.4*Math.cos(t*n("magnification")/100)));}
   break;
  }
  case "audio": case "hearing": {
   const freq=lab.engine==="hearing"?n("frequency"):rate/60;
   const gain=lab.engine==="hearing"?10**((n("gain")-40)/20):n("gain")/4;
   trace(lab.engine==="hearing"?"Processed sound":"Chest sound — PCG","relative","#46c7ff",t=>gain*(lab.engine==="hearing"?Math.sin(t*freq*2*Math.PI):Math.sin(t*80)*(gauss((t*freq)%1,.15,.025)+.7*gauss((t*freq)%1,.47,.03))+(mode==="Heart murmur"?.15*Math.sin(t*110):mode==="Wheeze"?.35*Math.sin(t*32):mode==="Crackles"?.2*jitter(t):0))+(lab.engine==="hearing"?(1-n("reduction")/100)*.25:noise*(filtered?.02:.25))*jitter(t));
   metric("Amplification",n("gain"),lab.engine==="hearing"?"dB":"×");metric("Signal",mode);metric("Noise suppression",lab.engine==="hearing"?n("reduction"):filtered?90:0,"%");binaryValue=gain*800;break;
  }
  case "glucose": {const current=n("glucose")*.006*n("volume"),voltage=current*.33,reading=n("glucose")*n("calibration");metric("Glucose estimate",n("volume")<.3?"Insufficient sample":reading,"mg/dL");metric("Strip current",current,"µA");metric("AFE voltage",voltage,"V");trace("Electrochemical current","µA","#42c9ff",t=>current*(1-Math.exp(-t*2)));binaryValue=voltage/3.3*4095;if(n("volume")<.3)status="Sample fill check failed";break;}
  case "eeg": {const frequency=n("frequency");trace("EEG rhythm","µV","#4bbbf8",t=>n("gain")*Math.sin(t*frequency*Math.PI*2)+noise*(filtered?3:25)*jitter(t));trace("Frequency spectrum","relative","#e8c455",(_,i)=>gauss(i/239*40,frequency,1.2)*n("gain"));const spectrum=tracks.at(-1)!;spectrum.xSamples=Array.from({length:240},(_,i)=>i/239*40);spectrum.xUnit="Hz";spectrum.axisLabel="40 Hz";metric("Dominant rhythm",frequency,"Hz");metric("Amplitude",n("gain"),"µV");metric("Band",frequency<4?"Delta":frequency<8?"Theta":frequency<13?"Alpha":"Beta");break;}
  case "emg": {const contraction=n("contraction")/100*(/Resting/.test(mode)?.02:1);trace("EMG","mV","#49e2ac",t=>contraction*(Math.sin(t*123)+.5*Math.sin(t*187))*(mode==="Nerve stimulation"?gauss(t,.25,.018):gauss((t/2)%1,.5,.25))+noise*(filtered?.02:.2)*jitter(t));metric("Contraction",contraction*100,"%");metric("RMS amplitude",contraction*.58,"mV");break;}
  case "fetal": {trace("Fetal heart rate","BPM","#5bdd85",t=>rate+3*Math.sin(t*4)+(mode==="Accelerations"?20:mode==="Decelerations"?-20:0)*gauss(t,4,.7)+noise*15*jitter(t));trace("Uterine activity","relative","#c875ec",t=>n("contraction")*gauss((t/4)%1,.5,.13));metric("FHR",rate,"BPM");metric("TOCO",n("contraction"),"relative");break;}
  case "spirometer": case "peak": {const effort=n("effort")/100,obstruction=n("obstruction")/100,fvc=4.2*effort,tau=.45+obstruction*2.5,fev=fvc*(1-Math.exp(-1/tau));trace("Volume–time","L","#44c7ff",t=>fvc*(1-Math.exp(-t/tau)));trace("Expiratory flow","L/s","#f5cd52",t=>fvc/tau*Math.exp(-t/tau)+noise*.03*jitter(t));if(lab.engine==="spirometer"){trace("Flow–volume loop","L/s","#a995ed",t=>fvc/tau*Math.exp(-t/tau));const loop=tracks.at(-1)!;loop.xSamples=Array.from({length:240},(_,i)=>fvc*(1-Math.exp(-i/239*8/tau)));loop.xUnit="L exhaled";loop.axisLabel=`${fvc.toFixed(1)} L exhaled`;}metric("FVC",fvc,"L");metric("FEV₁",fev,"L");metric("FEV₁ / FVC",fvc?fev/fvc*100:0,"%");metric("Peak flow",lab.engine==="peak"?n("expected")*effort*(1-obstruction*.6):fvc/tau*60,"L/min");break;}
  case "scale": {const weight=Math.max(0,n("weight")-n("tare")),voltage=n("weight")/200*2*3.3;metric("Weight",weight+n("distribution")*.003,"kg");metric("Bridge output",voltage,"mV");metric("Tare",n("tare"),"kg");trace("Bridge signal","mV","#3bc5f8",t=>voltage*(1-Math.exp(-t*3))+noise*.05*jitter(t));binaryValue=voltage/6.6*16777215;break;}
  case "composition": {const lean=clamp(.0008*n("height")**2/(n("impedance")/500)*(n("hydration")/60),10,n("weight")),fat=(n("weight")-lean)/n("weight")*100;metric("Illustrative body fat",fat,"%");metric("Impedance",n("impedance"),"Ω");metric("Lean model mass",lean,"kg");trace("Impedance response","relative","#4fbbf7",t=>Math.sin(t*12)/n("impedance")*500);explanation+=" This is a deliberately simplified comparative model, not a validated body-composition equation.";break;}
  case "ventilator": case "cpap": case "bipap": case "anesthesia": {
   const rr=n("rate",16),vt=n("volume",450)/1000,c=n("compliance",50)/1000,r=n("resistance",5),peep=n("peep",n("pressure",n("epap",5))),leak=n("leak")/100;
   const breath=(t:number)=> (t*rr/60)%1;
   const period=60/rr,ti=.4*period,tau=r*c,pressureMode=lab.engine==="bipap"||mode==="Pressure-control principle",deltaP=lab.engine==="bipap"?Math.max(0,n("ipap")-n("epap")):vt/c,breathVolume=pressureMode?c*deltaP*(1-Math.exp(-ti/tau)):vt;
   const lungVolume=(t:number)=>breath(t)<.4?(pressureMode?c*deltaP*(1-Math.exp(-breath(t)*period/tau)):vt*breath(t)/.4):breathVolume*Math.exp(-(breath(t)-.4)*period/tau);
   const lungFlow=(t:number)=>breath(t)<.4?(pressureMode?deltaP/r*Math.exp(-breath(t)*period/tau):vt/ti):-breathVolume/tau*Math.exp(-(breath(t)-.4)*period/tau);
   trace("Airway pressure","cmH₂O","#42b8fc",t=>lab.engine==="cpap"?peep*(mode==="Leak compensation"?1:1-leak)+.2*Math.sin(t*rr/60*Math.PI*2):pressureMode?(breath(t)<.4?peep+deltaP:peep)*(1-leak):breath(t)<.4?peep+lungVolume(t)/c+r*lungFlow(t):peep);
   if(lab.engine!=="anesthesia")trace("Flow","L/min","#47e3b0",t=>lab.engine==="cpap"?30*Math.sin(t*rr/60*2*Math.PI)+n("leak"):lungFlow(t)*60*(1-leak));
   if(lab.engine!=="cpap"&&lab.engine!=="anesthesia")trace("Volume","mL","#f4cd53",t=>lungVolume(t)*1000*(1-leak));
   metric("Peak pressure",lab.engine==="cpap"?peep:pressureMode?peep+deltaP:peep+vt/c+r*vt/ti,"cmH₂O");metric("Minute volume",breathVolume*rr*(1-leak),"L/min");metric("Respiratory rate",rr,"/min");
   if(lab.engine==="bipap") {metric("Pressure support",n("ipap")-n("epap"),"cmH₂O");if(n("ipap")<=n("epap")){status="IPAP must exceed EPAP — output inhibited";quality=0;tracks.forEach(t=>{t.samples=t.samples.map(()=>0);});}}
   if(lab.engine==="anesthesia") {metric("Oxygen mix",n("oxygen"),"%");metric("Fresh gas flow",n("flow"),"L/min");metric("Agent input",n("agent"),"relative");trace("Oxygen concentration","%","#66bff3",()=>n("oxygen"));trace("Capnography","relative","#70dc8f",t=>breath(t)>.45?(1+n("agent")*.03)*(1-Math.exp(-(breath(t)-.45)*20)):0);}
   else if(lab.engine==="ventilator")metric("FiO₂ input",n("oxygen"),"%");else {metric("Humidifier level",n("humidity"));metric("Controller state",lab.engine==="cpap"&&mode==="Leak compensation"?"Compensating leak":lab.engine==="bipap"&&mode==="Timed breaths"?"Timed breath trigger":"Sensor-based supervision");}
   break;
  }
  case "pump": case "syringe": {const inhibited=fault||mode==="Air-in-line event"||(lab.engine==="pump"&&n("battery")<5),targetReached=n("rate")*time/3600>=n("limit"),deliveryRate=inhibited||targetReached?0:n("rate"),delivered=inhibited?0:Math.min(n("rate")*time/3600,n("limit")),area=Math.PI*(n("diameter",15)/2)**2;metric("Delivered volume",Math.min(delivered,n("limit")),"mL");metric("Rate",deliveryRate,"mL/h");metric("Volume target",n("limit"),"mL");metric("Alarm threshold",n("pressure"),"relative");if(lab.engine==="syringe")metric("Plunger speed",deliveryRate*1000/area,"mm/h");else metric("Battery",n("battery"),"%");trace("Delivered volume","mL","#45cfb5",t=>inhibited?0:Math.min(n("limit"),n("rate")*t/3600));trace("Line pressure","relative","#49bffa",t=>10+n("rate")*.02+Math.sin(t*5));if(mode==="Air-in-line event")status="Air detector event — delivery stopped";if(lab.engine==="pump"&&n("battery")<5)status="Low battery — delivery inhibited";if(delivered>=n("limit"))status="Volume target reached — delivery stopped";break;}
  case "defibrillator": case "aed": case "icd": case "pacemaker": {const vf=/fibrillation/i.test(mode),vt=/tachycardia/i.test(mode),asystole=/asystole/i.test(mode),shockable=vf||vt;
   trace("Sensed ECG","mV","#56e098",t=>asystole?0:cardiac(t,rate,vf?"Ventricular fibrillation":"Normal"));
   if(lab.engine==="pacemaker") {const paced=rate<n("pacing"),capture=n("output")>=1,effective=paced&&capture?n("pacing"):rate;metric("Intrinsic heart rate",rate,"BPM");metric("Pacing target",n("pacing"),"BPM");metric("Observed rate",effective,"BPM");metric("Pulse output",n("output"),"relative");trace("Pacing markers","logic","#6dbfff",t=>paced&&(t*n("pacing")/60)%1<.018?n("output"):0);status=paced&&!capture?"Pulse below model capture threshold — ineffective pacing":paced?"Escape timer expired — virtual pacing":"Intrinsic beat inhibits virtual pacing";}
   else {metric("Rhythm classification",asystole?"Asystole":shockable?"Shockable example":"Non-shockable example");metric("Battery",n("battery"),"%");if(lab.engine==="defibrillator")metric("Virtual stored energy",action==="charge"?n("energy")*clamp(time/3,0,1):0,"J");if(lab.engine==="aed")metric("Pad contact",n("contact"),"%");if(lab.engine==="icd")metric("Rate threshold",n("detection"),"BPM");const eligible=shockable&&(lab.engine!=="icd"||vf||rate>=n("detection"))&&n("battery")>10&&n("contact",100)>=50&&!fault;if(action==="deliver"&&eligible)trace("Post-event teaching example","mV","#65bef7",t=>cardiac(t,72,"Normal"));status=action==="deliver"?(eligible?"Virtual therapy event logged":"Virtual event blocked — rhythm / contact / battery checks failed"):shockable?"Rhythm model detected — safety checks required":"No shock advised in this model";}
   explanation=lab.principle+" This is a virtual timing / supervision model only. No physical energy-delivery circuit is operated or specified.";break;
  }
  case "dialysis": {const clearance=n("blood")*n("dialysate")/(n("blood")+n("dialysate"));metric("Model clearance",clearance,"mL/min");metric("Blood flow",n("blood"),"mL/min");metric("Dialysate flow",n("dialysate"),"mL/min");metric("Fluid removal input",n("removal"),"L/h");metric("Temperature",n("temperature"),"°C");trace("Solute concentration","relative","#59e6b4",t=>Math.exp(-clearance*t/1000));trace("Venous pressure","relative","#52c4f8",t=>n("blood")*.2+Math.sin(t*4)*2);if(mode==="Air detector event"){status="Air detector event — blood pump inhibited";quality=0;metrics.find(m=>m.label==="Blood flow")!.value=0;metrics.find(m=>m.label==="Model clearance")!.value=0;tracks.forEach(t=>{t.samples=t.samples.map(()=>t.label==="Solute concentration"?1:0);});}break;}
  case "electrosurgery": case "tens": case "laser": {const freq=n("frequency",lab.engine==="electrosurgery"?20:10),duty=lab.engine==="tens"?n("width")*1e-6*freq:lab.engine==="laser"?Math.min(1,n("width")/1000*freq):n("duty")/100,amplitude=n("current",n("power",20));
   const gating=(t:number)=>mode==="Continuous"||mode==="Cut"?1:mode==="Coagulation"?Number((t*freq)%1<.1):mode==="Burst"?Number((t*2)%1<.2):Number((t*freq)%1<duty);
   trace(lab.engine==="laser"?"Optical pulse train":lab.engine==="tens"?"Biphasic stimulation":"RF envelope (carrier compressed)","relative","#f4cf57",t=>lab.engine==="tens"?amplitude*(mode==="Modulated"?.65+.35*Math.sin(t*3):1)*(mode==="Burst"?Number((t*2)%1<.2):1)*(((t*freq)%1)<duty?1:((t*freq)%1)<duty+.00005*freq?0:((t*freq)%1)<2*duty+.00005*freq?-1:0):amplitude*gating(t)*(lab.engine==="electrosurgery"?Math.sin(t*70):1));
   metric("Pulse repetition",freq,"Hz");metric("Output setting",amplitude,"relative");metric("Duty ratio",duty*100,"%");metric(lab.engine==="laser"?"Spot energy index":"Output energy index",amplitude*duty/(lab.engine==="laser"?n("spot")**2:lab.engine==="electrosurgery"?n("impedance")/100:1),"relative");break;}
  case "pcr": {const efficiency=clamp(.95-Math.abs(n("annealing")-58)*.025-Math.max(0,94-n("denaturation"))*.1-Math.max(0,30-n("extension"))*.01,0,.95);
   const cyclePeriod=60+n("extension");
   trace("Thermal cycle (time compressed)","°C","#ffba68",t=>{const phase=(t%2)/2*cyclePeriod;return phase<30?n("denaturation"):phase<60?n("annealing"):72;});
   trace("qPCR fluorescence (cycles compressed)","relative","#8de052",(_,i)=>{const cycle=i/239*n("cycles");const threshold=efficiency>0?Math.log(1e6)/Math.log(1+efficiency):1e6;return 1/(1+Math.exp(-(cycle-threshold)/2));});
   metric("Cycles",n("cycles"));metric("Amplification index",Math.min(1e9,(1+efficiency)**n("cycles")),"×");metric("Modeled efficiency",efficiency*100,"%");metric("Threshold cycle",efficiency>0?Math.log(1e6)/Math.log(1+efficiency):"No amplification");break;}
 }
 if(fault) {status=`${lab.fault} — output inhibited`;quality=0;tracks.forEach(track=>{track.samples=track.samples.map((_,i)=>(lab.engine==="pump"||lab.engine==="syringe")&&track.label==="Line pressure"?10+i/30:0);});metrics.unshift({label:"Safety response",value:"Invalid signal / inhibited output",unit:""});explanation=`${lab.fault} interrupts a required acquisition or delivery stage. The model invalidates dependent readings, raises a visible fault and inhibits simulated output rather than treating a missing signal as a valid result. ${lab.principle}`;}
 const binary=lab.engine==="remote"?[n("address"),n("address")^255,n("command"),n("command")^255].map(v=>Math.round(v).toString(2).padStart(8,"0")).join(""):lab.engine==="scale"?clamp(Math.round(binaryValue),0,16777215).toString(2).padStart(24,"0"):clamp(Math.round(binaryValue),0,4095).toString(2).padStart(12,"0");
 return {traces:tracks,metrics,status,explanation,image,imageLevel:clamp(imageLevel,.1,3),quality,binary,coordinates};
}
