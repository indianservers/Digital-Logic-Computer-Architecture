import {itemAt} from './parameters';
import type { AdvancedLab } from "./data";
import type { AdvancedResult } from "./engine";
import type { Metric, Trace } from "../labs/engine";
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const c=299792458, rad=Math.PI/180;
export function arrayFactor(angle:number,steering:number,elements:number){let re=0,im=0;for(let i=0;i<elements;i++){const p=i*Math.PI*(Math.sin(angle*rad)-Math.sin(steering*rad));re+=Math.cos(p);im+=Math.sin(p);}return Math.hypot(re,im)/elements;}
export function thermalTemperature(x:number,y:number,scene:string,ambient:number){
 if(scene.startsWith("Electrical"))return ambient+(x>.35&&x<.65&&y>.2&&y<.8?25:0)+45*Math.exp(-((x-.52)**2+(y-.48)**2)/.005);
 if(scene.startsWith("Person"))return ambient+(Math.exp(-((x-.5)**2)/.02-((y-.5)**2)/.12)*16);
 const house=x>.15&&x<.85&&y>.3&&y<.85,roof=y>.12&&y<=.3&&Math.abs(x-.5)<(y-.12)*2,chimney=x>.63&&x<.68&&y>.07&&y<.3,window=house&&((x>.25&&x<.39)||(x>.61&&x<.75))&&y>.43&&y<.62,door=house&&x>.44&&x<.56&&y>.63;
 return ambient+(house?5:roof?2:chimney?14:-7)+(window?12:0)+(door?3:0)+(house&&y>.77?7:0);
}
export function apparentTemperature(actual:number,ambient:number,emissivity:number){return (emissivity*(actual+273.15)**4+(1-emissivity)*(ambient+273.15)**4)**.25-273.15;}
export function simulateSystems(lab:AdvancedLab,p:Record<string,number>,mode:string,time:number,fault:boolean):AdvancedResult{
 const n=(k:string,d=0)=>p[k]??d,metrics:Metric[]=[],traces:Trace[]=[],visual:number[]=[];
 let valid=true,status="Ready — synthetic teaching inputs",progress=clamp(time/10,0,1);
 const metric=(label:string,value:number|string,unit="")=>metrics.push({label,value:typeof value==="number"?Number(value.toFixed(4)):value,unit});
 const trace=(label:string,unit:string,color:string,duration:number,fn:(t:number)=>number,axisLabel=`${duration} s`)=>traces.push({label,unit,color,timeSpan:duration,axisLabel,samples:Array.from({length:240},(_,i)=>fn(i*duration/239))});
 switch(lab.family){
 case "voice-recorder":{
  const bytes=n("sampleRate")*1000*n("bits")/8*4,capacity=bytes*n("capacity")*60,position=(time%(n("capacity")*60))*bytes;
  metric("Audio channels",4);metric("PCM data rate",bytes/1000,"kB/s");metric("Circular capacity",capacity/1e6,"MB");metric("Write position",position/1000,"kB");metric("Quantization levels",2**n("bits"));metric("Locator beacon",mode==="Underwater recovery"?"Active — immersion":"Dry — inactive");
  for(let k=0;k<4;k++)trace(itemAt(["Pilot","Copilot","Intercom","Cockpit area"], k),"amplitude",itemAt(["#208bef","#35af85","#eaaa31","#ad63d8"], k),.025,t=>Math.round(clamp(n("level")/100*(.6*Math.sin(2*Math.PI*(220+k*110)*t)+.2*Math.sin(2*Math.PI*880*t)),-1,1)*(2**(n("bits")-1)-1))/(2**(n("bits")-1)-1),"25 ms");
  visual.push(bytes,capacity,position,n("level")/100);progress=position/capacity;status=mode==="Underwater recovery"?"Immersion detected — illustrative 37.5 kHz locator enabled":mode==="Playback"?"Synthetic channel playback":"Four-channel circular recording";break;
 }
 case "satellite-link":{
  const tracking=mode==="Automatic tracking"?Math.exp(-time/1.5):1,azError=(n("azimuth")-124.5)*tracking,elError=(n("elevation")-36.2)*tracking,loss=Math.min(60,12*(Math.hypot(azError,elError)/1.5)**2),fspl=92.45+20*Math.log10(14)+20*Math.log10(36000),received=10*Math.log10(n("power")*1000)+32+36-fspl-loss,noise=-174+10*Math.log10(n("rate")*1e6)+3,snr=received-noise,eb=10**(snr/10),ber=Math.min(.5,.5*Math.exp(-eb)),throughput=snr<3||mode==="Receive only"?0:n("rate")*(1-ber);
  metric("Free-space loss",fspl,"dB");metric("Pointing loss",loss,"dB");metric("Received signal",received,"dBm");metric("Noise power",noise,"dBm");metric("SNR",snr,"dB");metric("Error bound",ber);metric("Payload throughput",throughput,"Mbps");metric("One-way propagation",36000000/c*1000,"ms");
  trace("Pointing loss","dB","#278bee",10,t=>Math.min(60,12*(Math.hypot(n("azimuth")-124.5,n("elevation")-36.2)*(mode==="Automatic tracking"?Math.exp(-t/1.5):1)/1.5)**2));visual.push(124.5+azError,36.2+elError,loss,snr,throughput);status=snr<3?"Insufficient SNR — payload inhibited":mode==="Receive only"?"Receive chain selected — uplink inhibited":"Satellite link acquired — illustrative budget";break;
 }
 case "satellite-attitude":{
  const target=n("target")+(mode==="Sun pointing"?45:mode==="Instrument pointing"?90:0);let angle=12*rad,rate=0,momentum=0,torque=0;const states:{angle:number;rate:number;torque:number;momentum:number}[]=[];
  for(let i=0;i<=Math.floor(Math.min(time,120)/.02);i++){torque=clamp(n("gain")*(target*rad-angle)-n("damping")*rate,-.2,.2);if(Math.abs(momentum)>2&&Math.sign(-torque)===Math.sign(momentum))torque=0;states.push({angle:angle/rad,rate:rate/rad,torque,momentum});rate+=(torque+n("disturbance")*Math.sin(i*.02*.7))/5*.02;angle+=rate*.02;momentum-=torque*.02;}
  const last=states.at(-1)!;metric("Attitude",last.angle,"°");metric("Target",target,"°");metric("Attitude error",target-last.angle,"°");metric("Angular rate",last.rate,"°/s");metric("Wheel torque",last.torque,"Nm");metric("Wheel momentum",last.momentum,"Nms");
  trace("Attitude history","°","#2288ee",Math.max(.02,Math.min(time,120)),t=>itemAt(states, Math.min(states.length-1,Math.floor(t/.02))).angle);trace("Wheel torque history","Nm","#2dae87",Math.max(.02,Math.min(time,120)),t=>itemAt(states, Math.min(states.length-1,Math.floor(t/.02))).torque);visual.push(last.angle,target,last.momentum,last.torque);status=Math.abs(last.momentum)>2?"Wheel momentum saturated — unloading would be required":Math.abs(target-last.angle)<.5?"Pointing objective acquired":"Attitude feedback correcting error";break;
 }
 case "phased-array":{
  const steer=mode==="Mechanical scan illustration"?60*Math.sin(time*.5):n("azimuth"),phase=-180*Math.sin(steer*rad),unambiguous=c/(2*n("prf"))/1000,width=101.5/n("elements")/Math.max(.3,Math.cos(steer*rad));
  metric("Beam azimuth",steer,"°");metric("Beam elevation",n("elevation"),"°");metric("Element phase increment",phase,"°");metric("Unambiguous pulse range",unambiguous,"km");metric("Approximate beamwidth",width,"°");metric("Active elements",n("elements"));
  trace("Normalized array factor","relative","#2488ee",180,a=>arrayFactor(a-90,steer,n("elements")),"−90° to +90°");visual.push(steer,n("elevation"),n("elements"),unambiguous);status="Computed array factor — synthetic tracks";break;
 }
 case "ground-radar":case "air-defence-radar":{
  const air=lab.family==="air-defence-radar",rcs=air?(mode==="Aircraft"?10:mode==="Drones"?.1:1):mode==="Vehicle"?10:mode==="Person"?.5:2,range=n("range"),power=air?n("power")/250:1,relative=power*rcs/10*(20/range)**4/(1+n("clutter",0)/25),speed=air?(mode==="Aircraft"?220:mode==="Drones"?30:400):n("speed"),doppler=2*speed/.03;
  metric("Scan bearing",time*n("rpm")*6%360,"°");metric("Scan period",60/n("rpm"),"s");metric("Range-edge delay",2*range*1000/c*1e6,"µs");metric("Radial Doppler",doppler,"Hz");metric("Relative edge echo",relative<.001?relative.toExponential(3):relative);metric("Synthetic target count",air?6:n("targets"));
  if(air)metric("Illustrative 10 km target horizon",3.57*(Math.sqrt(10)+Math.sqrt(10000)),"km");
  trace("Echo scaling by range","relative","#2b8eef",range,r=>Math.min(20,power*rcs/10*(20/Math.max(2,r))**4/(1+n("clutter",0)/25)),`${range} km`);visual.push(range,time*n("rpm")*6%360,air?6:n("targets"),relative,speed);status="Synthetic moving targets — illustrative reflectivity";break;
 }
 case "passive-radar":{
  const range=n("range"),bearing=n("bearing")*rad,x=range*Math.cos(bearing)+n("speed")*time/3600,y=range*Math.sin(bearing),z=n("altitude")/1000,txRange=Math.hypot(x+20,y,z),rxRange=Math.hypot(x,y,z),excess=txRange+rxRange-20,delay=excess*1000/c*1e6,frequency=mode.startsWith("FM")?100.7:mode.startsWith("DAB")?220:650,velocity=n("speed")/3.6,derivative=velocity*((x+20)/txRange+x/rxRange),doppler=-derivative/(c/(frequency*1e6));
  metric("Excess bistatic path",excess,"km");metric("Correlation delay",delay,"µs");metric("Bistatic Doppler",doppler,"Hz");metric("Illuminator",frequency,"MHz");metric("Tx-target distance",txRange,"km");metric("Receiver-target distance",rxRange,"km");
  trace("Delay correlation","relative","#218bec",Math.max(600,delay*1.4),t=>Math.exp(-.5*((t-delay)/(mode.startsWith("FM")?10:mode.startsWith("DAB")?2:.4))**2),"µs excess delay");visual.push(x,y,excess,delay,doppler);status="Reference / surveillance correlation — no own transmitter";break;
 }
 case "thermal-imaging":{
  const actual=thermalTemperature(.5,.5,mode,n("ambient")),apparent=apparentTemperature(actual,n("ambient"),n("emissivity"));metric("Synthetic center temperature",actual,"°C");metric("Apparent radiance temperature",apparent,"°C");metric("Emissivity",n("emissivity"));metric("Display span",n("maximum")-n("minimum"),"°C");
  trace("Synthetic horizontal thermal profile","°C","#d54982",1,x=>apparentTemperature(thermalTemperature(x,.5,mode,n("ambient")),n("ambient"),n("emissivity")),"normalized image width");visual.push(n("minimum"),n("maximum"),n("emissivity"),n("ambient"),apparent);status="Synthetic thermal field — emitted radiation model";break;
 }
 case "night-vision":{
  const lux=n("light")*(mode==="Moonlight"?10:1)+(mode==="IR assist"?n("infrared")*.0004:0),photons=lux*n("exposure")*4000,signal=photons*n("gain"),snr=Math.sqrt(Math.max(0,photons)),brightness=clamp(signal/50000,0,1);
  metric("Effective illumination",lux,"lux equivalent");metric("Illustrative photons / pixel",photons);metric("Photon shot-noise SNR",snr);metric("Electron gain",n("gain"),"×");metric("Display brightness",brightness*100,"%");metric("Saturation",signal>50000?"Clipped":"Within display range");
  trace("Amplified scene sample","relative","#5ad66b",1,x=>clamp(brightness*(.4+.4*Math.sin(x*9)+Math.sin(x*97)*.2/Math.max(1,snr)),0,1),"normalized image width");visual.push(brightness,snr,photons,signal);status=signal>50000?"Intensifier display saturated — reduce gain":"Low-light amplification with photon noise";break;
 }
 case "infrared-camera":{
  const day=mode==="Day",ir=mode.startsWith("Night")?n("led")/100*(mode.includes("940")?.6:1):0,illumination=n("ambient")/100+ir,signal=illumination*n("gain")/60,snr=Math.sqrt(Math.max(0,illumination*1000))/(1+n("gain")/100)* (1+n("noise")/200),brightness=clamp(signal,0,1);
  metric("Reflected illumination",illumination,"relative");metric("Image brightness",brightness*100,"%");metric("Illustrative image SNR",snr);metric("IR-cut filter",day?"Inserted":"Removed");metric("LED illumination",ir,"relative");metric("Relative LED reach",Math.sqrt(ir)*30,"m");
  trace("Processed intensity profile","relative","#288aed",1,x=>clamp(signal*(.5+.35*Math.sin(x*8))+Math.sin(x*157)*(1-n("noise")/120)/Math.max(1,snr),0,1),"normalized image width");visual.push(brightness,snr,ir,day?1:0,n("noise"));status=brightness===0?"No illumination — no usable image":signal>1?"Image clipped — reduce gain or illumination":"Reflected near-IR teaching scene";break;
 }
 default:throw new Error(`Unsupported systems family: ${lab.family}`);
 }
 if(fault){valid=false;status="Input / acquisition fault — outputs unavailable";}
 if(!valid){metrics.forEach(m=>{m.value="Unavailable";m.unit="";});traces.forEach(t=>t.samples=t.samples.map(()=>0));progress=0;visual.fill(0);}
 return {metrics,traces,visual,valid,status,progress};
}
