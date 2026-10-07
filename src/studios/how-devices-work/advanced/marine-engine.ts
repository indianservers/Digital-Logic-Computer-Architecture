import {itemAt} from './parameters';
import type { AdvancedLab } from "./data";
import type { AdvancedResult } from "./engine";
import type { Metric,Trace } from "../labs/engine";
import { compassField,compassHeading } from "./security-engine";
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export function sonarEchoTime(distance:number,speed:number){return 2*distance/speed;}
export function autopilotResponse(target:number,speed:number,mode:string,duration:number){
 let heading=200,rate=0,rudder=0,integral=0,crossTrack=0;
 const history:{time:number;heading:number;rudder:number;crossTrack:number}[]=[];
 for(let i=0;i<=Math.ceil(duration/.05);i++){
  const t=i*.05,error=((target-heading+540)%360)-180;
  integral=clamp(integral+error*.05,-80,80);
  rudder=mode==="Standby"?0:clamp(error*1.8+integral*.08-rate*3,-35,35);
  const disturbance=(mode==="Rough sea"?2:mode==="Moderate waves"?.7:.05)*Math.sin(t*.8);
  rate+=((rudder*speed*.018+disturbance)-rate*.55)*.05;
  heading=(heading+rate*.05+360)%360;
  crossTrack+=speed*.514444*Math.sin((heading-target)*Math.PI/180)*.05;
  history.push({time:t,heading,rudder,crossTrack});
 }
 return history;
}
export function simulateMarine(lab:AdvancedLab,p:Record<string,number>,mode:string,time:number,fault:boolean):AdvancedResult{
 const n=(k:string)=>p[k]??0,metrics:Metric[]=[],traces:Trace[]=[],visual:number[]=[];
 let valid=true,status="Synthetic system ready",progress=clamp(time/10,0,1);
 const metric=(label:string,value:number|string,unit="")=>metrics.push({label,value:typeof value==="number"?Number(value.toFixed(3)):value,unit});
 const trace=(label:string,unit:string,color:string,span:number,fn:(t:number)=>number)=>traces.push({label,unit,color,timeSpan:span,axisLabel:`${span} s`,samples:Array.from({length:240},(_,i)=>fn(i/239*span))});
 switch(lab.family){
 case "biometric-access":{
  const score=n("similarity")*n("quality")/100,quality=n("quality")>=40,grant=quality&&(mode==="RFID Card"?n("similarity")>=n("threshold"):score>=n("threshold"));
  metric("Effective match score",score,"%");metric("Capture quality",n("quality"),"%");metric("Policy threshold",n("threshold"),"%");metric("Decision",grant?"Access granted":"Access denied");metric("Relay",time>0&&grant?"Virtual unlock pulse":"Locked");
  visual.push(score,grant?1:0,n("quality"));status=quality?grant?"Synthetic credential accepted":"No authorized match":"Capture rejected — retry with adequate quality";break;
 }
 case "sonar-detection":{
  const passive=mode==="Passive Sonar",targets=[820,1340,1760],loss=20*Math.log10(820)+n("frequency")*.004*820/1000,snr=n("gain")+42-loss+10*Math.log10(n("pulse")),count=targets.filter(d=>d<=n("range")&&snr-20*Math.log10(d/820)>0).length;
  metric("First target range",passive?"Not determined":820,passive?"":"m");metric("First echo delay",passive?"No transmit pulse":sonarEchoTime(820,1500)*1000,passive?"":"ms");metric("Pulse range resolution",passive?"Not applicable":1500*n("pulse")/2000,passive?"":"m");metric("Acoustic wavelength",1500/(n("frequency")*1000),"m");metric("Relative detection SNR",snr,"dB");metric("Visible synthetic targets",count);
  trace(passive?"Passive source waveform":"Echo envelope","relative","#2c99ef",3,t=>passive?Math.sin(t*n("frequency")*2)*10**(n("gain")/40):targets.reduce((v,d)=>v+Math.exp(-(((t-sonarEchoTime(d,1500))/(n("pulse")/1000))**2)),0)*10**(n("gain")/40));
  visual.push(n("range"),count,snr,n("pulse"),passive?1:0);status=passive?"Listening — bearing illustration only; no pulse-derived range":"Active ping / echo timing model";break;
 }
 case "surveillance-uav":{
  const elapsed=Math.max(0,time),altitude=n("altitude")*(1-Math.exp(-elapsed/4))+n("wind")*.12*Math.sin(elapsed*1.2),speed=n("speed")/(1+n("wind")*.015),power=65+n("speed")**2*1.5+n("wind")**2*.7+n("altitude")*.05,battery=Math.max(0,78-power*elapsed/(3600*120)*100);
  metric("Altitude",altitude,"m");metric("Ground speed",speed,"m/s");metric("Estimated demand",power,"W");metric("Battery",battery,"%");metric("Wind attitude correction",Math.atan(n("wind")*.05)*180/Math.PI,"°");metric("Camera output",mode);visual.push(altitude,speed,battery,n("wind"),mode==="Return Home"?1:0);trace("Altitude response","m","#268deb",30,t=>n("altitude")*(1-Math.exp(-t/4))+n("wind")*.12*Math.sin(t*1.2));status=mode==="Return Home"?"Synthetic return-home route selected":"Stabilized observation — reduced vehicle response";break;
 }
 case "marine-radar":{
  const loss=n("tuning")**2*2,targets=[1.2,2.8,4.4,8.2],strength=targets.map(d=>clamp(n("gain")-loss-20*Math.log10(d)-n("sea")*.5*Math.exp(-d/1.5)-n("rain")*.15,0,100)),count=strength.filter((s,i)=>s>12&&itemAt(targets, i)<=n("range")).length;
  metric("Display range",n("range"),"NM");metric("Visible targets",count);metric("Near-range sea return",Math.max(0,65-n("sea")*.6)*n("gain")/100,"%");metric("Rain return",Math.max(0,50-n("rain")*.45)*n("gain")/100,"%");metric("Tuning loss",loss,"dB");metric("Orientation",mode);visual.push(n("range"),time*24%360,...strength,Math.max(0,65-n("sea")*.6)*n("gain")/100,Math.max(0,50-n("rain")*.45)*n("gain")/100);trace("Range echo profile","relative","#3aba6b",n("range"),r=>targets.reduce((sum,d,i)=>sum+itemAt(strength, i)*Math.exp(-(((r-d)/.08)**2)),0));status="Synthetic vessel, land and buoy echoes";break;
 }
 case "fish-finder":case "depth-sounder":{
  const fish=lab.family==="fish-finder",speed=fish?1500:mode.startsWith("Freshwater")?1480:1500,calibration=fish?1500:n("sound"),delay=sonarEchoTime(n("depth"),speed),reading=calibration*delay/2,pulse=fish?n("pulse")*1e-6:50e-6,frequency=fish?n("frequency"):200,attenuation=frequency**1.5*.000004*n("depth"),gain=fish?n("gain"):35,amplitude=clamp(gain+25-attenuation,0,100),fishStrength=fish?clamp(n("strength")+gain-35-attenuation*.5,0,100):0;
  metric("Displayed depth",reading,"m");metric("Round-trip delay",delay*1000,"ms");metric("Sound speed used",calibration,"m/s");metric("Depth error",reading-n("depth"),"m");metric("Range resolution",1500*pulse/2*(mode==="CHIRP illustration"?.25:1),"m");if(fish){metric("Fish echo strength",fishStrength,"relative");metric("Acoustic wavelength",1500/(frequency*1000),"m");}
  visual.push(reading,n("depth"),amplitude,fishStrength,frequency,pulse,speed);trace("Acoustic echo envelope","relative","#238ee1",delay*1.2,t=>amplitude*Math.exp(-(((t-delay)/Math.max(.0002,pulse))**2))+(fish?fishStrength*Math.exp(-(((t-delay*.45)/Math.max(.0002,pulse))**2)):0));status="Synthetic echo timing and echogram";break;
 }
 case "chartplotter":{
  const distance=n("speed")*.514444*time,lat=27.4123+distance*Math.cos(n("course")*Math.PI/180)/111320+n("noise")*Math.sin(time)/111320,lon=-82.4821+distance*Math.sin(n("course")*Math.PI/180)/(111320*Math.cos(27.4123*Math.PI/180));
  metric("Latitude",lat,"°");metric("Longitude",lon,"°");metric("Speed over ground",n("speed"),"kn");metric("Course over ground",n("course"),"°");metric("Distance travelled",distance,"m");metric("Position uncertainty",n("noise"),"m");visual.push(lat,lon,distance,n("course"),n("noise"));status="Synthetic chart / local route planning";break;
 }
 case "marine-ais":{
  const reports=Math.floor(time/n("interval")),age=time%n("interval"),distance=n("speed")*.514444*time;
  metric("Speed over ground",n("speed"),"kn");metric("Course over ground",n("course"),"°");metric("Update interval",n("interval"),"s");metric("Reports generated",reports);metric("Report age",age,"s");metric("Vessel type",mode);metric("Radio channels","161.975 / 162.025","MHz");visual.push(distance,n("course"),reports,age);status="Synthetic AIS reports — no radio transmission";break;
 }
 case "marine-autopilot":{
  const history=autopilotResponse(n("heading"),n("speed"),mode,time),last=itemAt(history,history.length-1);
  metric("Desired heading",n("heading"),"°");metric("Actual heading",last.heading,"°");metric("Heading error",((n("heading")-last.heading+540)%360)-180,"°");metric("Rudder angle",last.rudder,"°");metric("Cross-track illustration",last.crossTrack,"m");metric("Mode",mode==="Standby"?"STBY":"AUTO");visual.push(last.heading,last.rudder,last.crossTrack,n("heading"));const future=autopilotResponse(n("heading"),n("speed"),mode,60);trace("Closed-loop heading","°","#238de5",60,t=>itemAt(future, Math.min(future.length-1,Math.floor(t/.05))).heading);status=mode==="Standby"?"Standby — automatic actuator command removed":"Heading feedback loop active";break;
 }
 case "marine-compass":{
  const fieldParams={...p,offset:mode.includes("disturbance")?15:0,declination:0},compensation=mode==="Uncompensated tilt"?"Uncompensated":mode==="Calibrated disturbance"?"Calibrated offset":"Tilt compensated",field=compassField(fieldParams),heading=compassHeading(fieldParams,compensation);
  metric("Magnetic heading",heading,"°");metric("Pitch",n("pitch"),"°");metric("Roll",n("roll"),"°");metric("Heading deviation",((heading-n("yaw")+540)%360)-180,"°");field.forEach((v,i)=>metric(itemAt(["Hx","Hy","Hz"], i),v,"µT"));visual.push(heading,...field);status="Marine heading sensor / local NMEA illustration";break;
 }
 default:throw new Error(`Unsupported marine family ${lab.family}`);
 }
 if(fault){valid=false;status="Input / acquisition fault — outputs unavailable";metrics.forEach(m=>{m.value="Unavailable";m.unit="";});traces.forEach(t=>t.samples.fill(0));visual.fill(0);progress=0;}
 return {metrics,traces,visual,valid,status,progress};
}
