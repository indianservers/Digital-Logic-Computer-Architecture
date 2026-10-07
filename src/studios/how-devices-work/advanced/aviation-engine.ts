import type { AdvancedLab } from "./data";
import type { AdvancedResult } from "./engine";
import type { Metric,Trace } from "../labs/engine";
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
export function simulateAviation(lab:AdvancedLab,p:Record<string,number>,mode:string,time:number,fault:boolean):AdvancedResult {
 const n=(k:string,d=0)=>p[k]??d,metrics:Metric[]=[],traces:Trace[]=[],visual:number[]=[];
 let valid=true,status="Ready",progress=clamp(time/10,0,1);
 const metric=(label:string,value:number|string,unit="")=>metrics.push({label,value:typeof value==="number"?Number(value.toFixed(3)):value,unit});
 const trace=(label:string,unit:string,color:string,duration:number,fn:(t:number)=>number,axisLabel=`${duration} s`)=>traces.push({label,unit,color,timeSpan:duration,axisLabel,samples:Array.from({length:240},(_,i)=>fn(i*duration/239))});
 switch(lab.family){
 case "fadec":{
 const density=Math.exp(-n("altitude")/30000)*288.15/(n("temperature")+273.15),target=clamp(20+.8*n("throttle")-n("mach")*3,20,100),thermal=390+4.6*target+(n("temperature")-15)*1.2;
 const limiting=thermal>850,allowed=limiting?(850-390-(n("temperature")-15)*1.2)/4.6:target;
 const response=(t:number)=>20+(allowed-20)*(1-Math.exp(-t/(mode.startsWith("Backup")?25:18)));
 const speed=response(time),core=clamp(40+speed*.55,0,100),egt=390+4.6*speed+(n("temperature")-15)*1.2,flow=(300+25*speed)*density;
 metric("N1 fan",speed,"%");metric("N2 core",core,"%");metric("EGT",egt,"°C");metric("Fuel flow",flow,"kg/h");metric("Scheduled N1",allowed,"%");metric("Active channel",mode.startsWith("Backup")?"B":"A + B");
 trace("N1 fan","%","#1688ee",180,response);trace("N2 core","%","#21b777",180,t=>40+.55*response(t));trace("EGT","°C","#ef9538",180,t=>390+4.6*response(t)+(n("temperature")-15)*1.2);trace("Fuel flow","kg/h","#a349ee",180,t=>(300+25*response(t))*density);visual.push(speed,core,egt,flow);status=limiting?"Teaching temperature limit constrains N1 demand":"Dual-channel control — scheduled engine response";break;}
 case "engine-monitor":{
 const noise=mode==="Sensor noise"?3*Math.sin(time*4):0,n1=n("n1")+noise,egt=n("egt")+noise*4,oil=n("oil")+noise*.4;
 metric("N1 fan",n1,"%");metric("N2 core",n1*.8+24,"%");metric("EGT",egt,"°C");metric("Oil pressure",oil,"psi");metric("Fuel flow",n("fuel"),"kg/h");
 const band=egt>=950||oil<25||n1>105?"Critical":egt>=850||n1>102?"Warning":egt>=750||oil<40||n1>100?"Caution":"Normal";
 metric("EPR illustrative",1+n1*.005);metric("Vibration illustrative",.04+n1*.0003+Math.abs(noise)*.005,"IPS");metric("Alert level",band);metric("Fuel trend",n("fuel")/(Math.max(20,n1)),"kg/h per N1 %");
 trace("N2","%","#1ab885",180,t=>(n("n1")*(.4+.6*(1-Math.exp(-t/35))))*.8+24);trace("EPR","ratio","#cf76d9",180,()=>1+n("n1")*.005);trace("Vibration","IPS","#ad51df",180,t=>.04+n("n1")*.0003+(mode==="Sensor noise"?Math.abs(Math.sin(t*4))*.015:0));trace("N1","%","#147aff",180,t=>n("n1")*(.4+.6*(1-Math.exp(-t/35)))+(mode==="Sensor noise"?3*Math.sin(t*4):0));trace("EGT","°C","#ed922e",180,t=>n("egt")+(mode==="Sensor noise"?12*Math.sin(t*4):0));trace("Oil pressure","psi","#13a889",180,t=>n("oil")+(mode==="Sensor noise"?1.2*Math.sin(t*4):0));trace("Fuel flow","kg/h","#9f48e8",180,()=>n("fuel"));visual.push(n1,egt,oil,n("fuel"));status=`${band} — instructional limit bands`;break;}
 case "drone-control":{
 const rateMode=mode==="Rate mode",roll=(t:number)=>rateMode?n("roll")*t/10:n("roll")*(1-Math.exp(-t/1.4))+n("wind")*.3*Math.sin(t*1.1),pitch=(t:number)=>rateMode?n("pitch")*t/10:n("pitch")*(1-Math.exp(-t/1.4))+n("wind")*.15*Math.cos(t*1.1),yaw=n("yaw")*time;
 const r=roll(time),pitchNow=pitch(time),thrust=n("throttle"),mix=[thrust+n("roll")*.5+n("pitch")*.5-n("yaw")*.05,thrust-n("roll")*.5+n("pitch")*.5+n("yaw")*.05,thrust-n("roll")*.5-n("pitch")*.5-n("yaw")*.05,thrust+n("roll")*.5-n("pitch")*.5+n("yaw")*.05];
 metric("Roll",r,"°");metric("Pitch",pitchNow,"°");metric("Yaw",((yaw%360)+360)%360,"°");metric("Vertical acceleration",(thrust-50)*.06,"m/s²");mix.forEach((v,i)=>metric(`Motor ${i+1}`,clamp(v,0,100),"%"));trace("Roll","°","#1688ee",60,roll);trace("Pitch","°","#26ba80",60,pitch);trace("Yaw","°","#f38c2b",60,t=>n("yaw")*t);visual.push(r,pitchNow,yaw,...mix.map(v=>clamp(v,0,100)));status=mix.some(v=>v<0||v>100)?"Motor mixer saturated — reduced control authority":"Feedback and motor mixing active";break;}
 case "weather-radar":{
 const attenuation=mode==="Heavy attenuation"?.28:1,tiltFactor=Math.exp(-.5*(n("tilt")/3)**2),power=n("gain")/100*tiltFactor*attenuation;
 metric("Display range",n("range"),"NM");metric("Antenna tilt",n("tilt"),"°");metric("Receiver gain",n("gain"),"%");metric("Echo scale",power);metric("Round-trip delay at range",2*n("range")*1852/299792458*1e6,"µs");
 trace("Synthetic echo range profile","relative","#10bf62",n("range"),r=>power*(Math.exp(-(((r-35)/9)**2))+.7*Math.exp(-(((r-(mode==="Scattered showers"?65:45))/7)**2))),`${n("range")} NM`);visual.push(n("range"),n("tilt"),power,mode==="Scattered showers"?1:0);status=mode==="Heavy attenuation"?"Attenuation hides returns behind heavy rain":"Synthetic precipitation display — no live weather";break;}
 case "radar-height":case "radio-height":{
 const ft=n("height"),band=n("sweep",200)*1e6,slope=band/.001,rough=mode.includes("Rough")?2:mode.includes("Water")?.5:.08;
 const error=(t:number)=>rough*Math.sin(t*3.1)*(1+n("speed")/250),descent=n("speed")*1.68781*Math.sin(3*Math.PI/180),output=clamp(ft-(lab.family==="radio-height"?descent*time:0)+error(time),0,2500),delay=2*output*.3048/299792458,beat=delay*slope;
 metric("Height above ground",output,"ft");metric("Height metric",output*.3048,"m");metric("Round-trip delay",delay*1e6,"µs");metric("Beat frequency",beat/1000,"kHz");metric("Surface uncertainty",rough*(1+n("speed")/250),"ft example");
 trace("Transmit reference","relative","#1688ee",50,t=>Math.sin(t*.5),"50 µs");trace("Delayed receive","relative","#f3614c",50,t=>Math.sin(t*.5-delay*1e6*.5),"50 µs");trace(lab.family==="radio-height"?"Landing height profile":"Computed height","ft","#1885ff",30,t=>clamp(ft-(lab.family==="radio-height"?descent*t:0)+error(t),0,2500));visual.push(output,delay,beat,descent);status="Valid illustrative AGL measurement";break;}
 case "transponder":{
 const digits=String(Math.round(n("squawk"))).padStart(4,"0");valid=/^[0-7]{4}$/.test(digits);const octal=parseInt(digits,8),alt=Math.round(n("altitude")/100)*100;
 metric("Mode",mode);metric("Squawk",digits);metric("Encoder pressure altitude",alt,"ft");metric("Reply altitude",mode==="Mode A"?"Not requested":alt,mode==="Mode A"?"":"ft");metric("Reply frequency",1090,"MHz");metric("Interrogation frequency",1030,"MHz");metric("Flight ID",mode==="Mode S"?"N738PA":"Not requested");
 const code=mode==="Mode C"?Math.round((alt+1000)/100):mode==="Mode S"?octal^0x738:octal;
 trace("Simplified coded reply","logic","#31c735",21,t=>{const i=Math.floor(t/1.45);return i===0||i===14?1:(code>>(i-1)&1)&&t%1.45<.45?1:0;},"21 µs");visual.push(octal,alt);status=valid?`${mode} reply ready — 1030 MHz in / 1090 MHz out`:"Invalid squawk — use exactly four octal digits (0–7)";break;}
 case "adsb":{
 valid=mode!=="GNSS source failure";const speed=n("speed"),heading=n("heading")*Math.PI/180,distance=speed*time/3600,north=distance*Math.cos(heading),east=distance*Math.sin(heading);
 metric("Altitude",n("altitude"),"ft");metric("Ground speed",speed,"kt");metric("Track",n("heading"),"°");metric("Transmit rate",n("rate"),"Hz example");metric("Messages sent",Math.floor(time*n("rate")));metric("Latitude",37.6+north/60,"°");metric("Longitude",-122.3+east/(60*Math.cos(37.6*Math.PI/180)),"°");trace("Broadcast scheduling","logic","#16b788",10,t=>t*n("rate")%1<.12?1:0);visual.push(n("heading"),distance,n("altitude"),mode==="Traffic hidden"?0:1);status=valid?"Automatic synthetic broadcasts — 1090 MHz extended squitter":"GNSS source invalid — position broadcast unavailable";break;}
 case "tcas":{
 const range=Math.max(0,n("range")-n("closure")*time/3600),tau=n("closure")>0?range/n("closure")*3600:Infinity,relative=n("relative"),ra=mode==="TA / RA enabled"&&tau<=25&&Math.abs(relative)<850,ta=tau<=40&&Math.abs(relative)<2350;
 metric("Current range",range,"NM");metric("Relative altitude",relative,"ft");metric("Closure rate",n("closure"),"kt");metric("Time to contact",Number.isFinite(tau)?tau:"No closure",Number.isFinite(tau)?"s":"");metric("Advisory",ra?"RA — teaching threshold":ta?"TA — traffic":"No advisory");trace("Relative range","NM","#1587ef",60,t=>Math.max(0,n("range")-n("closure")*t/3600));trace("Vertical separation","ft","#e99928",60,()=>relative);visual.push(range,relative,ra?2:ta?1:0,tau);status=ra?"Resolution-advisory band in simplified encounter model":ta?"Traffic-advisory band":"No advisory in simplified encounter model";break;}
 case "fdr":{
 const maneuver=mode==="Maneuver",approach=mode==="Approach",event=mode==="Engine event";const alt=Math.max(0,n("altitude")-(approach?time*45:0)),bank=n("bank")+(maneuver?15*Math.sin(time/4):0),pitch=n("pitch")+(maneuver?3*Math.sin(time/3):0),speed=Math.max(0,n("speed")-(approach?time*.2:0)),n1=event?85-20*(1-Math.exp(-time/4)):85;
 metric("Timestamp",time,"s");metric("Altitude",alt,"ft");metric("Airspeed",speed,"kt");metric("Pitch",pitch,"°");metric("Bank",bank,"°");metric("Engine N1",n1,"%");metric("EGT",event?650+180*(1-Math.exp(-time/4)):650,"°C");metric("Fuel flow",5200*n1/85,"pph example");metric("Record scenario",mode);metric("Nominal data rate",7,"parameters / sample");trace("Altitude","ft","#158afa",120,t=>Math.max(0,n("altitude")-(approach?t*45:0)));trace("Airspeed","kt","#d8a124",120,t=>Math.max(0,n("speed")-(approach?t*.2:0)));trace("Pitch","°","#1ac597",120,t=>n("pitch")+(maneuver?3*Math.sin(t/3):0));trace("Bank","°","#ad43f2",120,t=>n("bank")+(maneuver?15*Math.sin(t/4):0));trace("Engine N1","%","#ee7429",120,t=>event?85-20*(1-Math.exp(-t/4)):85);visual.push(alt,speed,pitch,bank,n1,event?650+180*(1-Math.exp(-time/4)):650,5200*n1/85);status="Synthetic parameters ready for time-stamped recording";break;}
 default:throw new Error(`Unimplemented aviation family: ${lab.family}`);
 }
 if(fault){valid=false;status="Required acquisition component failed — output unavailable";}
 if(!valid){metrics.forEach(m=>{m.value="Unavailable";m.unit="";});metrics.unshift({label:"Validity",value:"Affected output unavailable",unit:""});traces.forEach(t=>t.samples.fill(0));progress=0;}
 return {metrics,traces,visual,status,valid,progress};
}
