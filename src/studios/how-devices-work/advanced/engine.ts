import { simulateHousehold } from "./household-engine";
import { simulateConsumer } from "./consumer-engine";
import { simulateRobotics } from "./robotics-engine";
import { simulateControl } from "./control-engine";
import { simulateMarine } from "./marine-engine";
import type { AdvancedLab } from "./data";
import { simulateSecurity } from "./security-engine";
import { simulateSystems } from "./systems-engine";
import { simulateAviation } from "./aviation-engine";
import type { Trace, Metric } from "../labs/engine";

export interface AdvancedResult { metrics:Metric[]; traces:Trace[]; status:string; valid:boolean; visual:number[]; progress:number }
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const wave=(t:number)=>Math.sin(t*71)*.6+Math.sin(t*113)*.4;
export function simulateAdvanced(lab:AdvancedLab,p:Record<string,number>,mode:string,time:number,fault:boolean):AdvancedResult {
  const n=(key:string,fallback=0)=>p[key]??fallback;
  const metrics:Metric[]=[],traces:Trace[]=[],visual:number[]=[];
  let status="Ready — teaching model",valid=true,progress=clamp(time/10,0,1);
  const metric=(label:string,value:number|string,unit="")=>metrics.push({label,value:typeof value==="number"?Number(value.toFixed(3)):value,unit});
  const trace=(label:string,unit:string,color:string,duration:number,fn:(t:number)=>number,xUnit="s")=>traces.push({label,unit,color,timeSpan:duration,axisLabel:`${duration} ${xUnit}`,samples:Array.from({length:240},(_,i)=>fn(i/239*duration))});
  switch(lab.family) {
    case "centrifuge": {
      const rcf=1.118e-5*n("radius")*n("rpm")**2;
      const speed=(t:number)=>n("rpm")*Math.min(t/2,1)*Math.max(0,Math.min(1,(12-t)/2));
      const factor=mode==="Blood"?1:mode==="Cell suspension"?.7:.4;
      progress=1-Math.exp(-rcf*n("duration")/25000*factor);
      metric("Relative centrifugal force",rcf,"× g");metric("Separation model",progress*100,"%");metric("Duration",n("duration"),"min");metric("Rotor radius",n("radius"),"cm");
      trace("Rotor speed","rpm","#39b2ff",12,speed,"compressed cycle");
      trace("RCF","× g","#56d9bb",12,t=>1.118e-5*n("radius")*speed(t)**2,"compressed cycle");
      visual.push(rcf,progress,n("rpm"));
      metric("Current rotor speed",speed(Math.min(time,12)),"rpm");
      progress=1-Math.exp(-rcf*n("duration")*clamp(time/10,0,1)/25000*factor);
      if(n("imbalance")>10){valid=false;status="Imbalance detected — motor inhibited";}
      else status=time>=12?"Cycle complete — rotor stopped":time>=10?"Controlled deceleration":time>=2?"Balanced rotor — separation in progress":time>0?"Motor accelerating":"Balanced rotor — selected cycle ready";
      break;
    }
    case "hematology": {
      const rbc=mode.startsWith("Low")?3.1:4.92,wbc=mode.startsWith("Elevated")?16:6.8;
      const noise=n("noise")/100,sigma=Math.hypot(13,86*noise);
      const distribution=Array.from({length:400},(_,i)=>{const volume=(i+.5)*.5;return {volume,weight:Math.exp(-.5*((volume-86)/sigma)**2)};});
      const all=distribution.reduce((sum,b)=>sum+b.weight,0),accepted=distribution.filter(b=>b.volume>=n("threshold")),acceptedWeight=accepted.reduce((sum,b)=>sum+b.weight,0);
      const efficiency=acceptedWeight/all,mcv=accepted.reduce((sum,b)=>sum+b.volume*b.weight,0)/Math.max(1e-12,acceptedWeight),detectedRBC=rbc*efficiency,hgb=rbc*2.86,hct=detectedRBC*mcv/10;
      const counted=rbc*1e6*n("volume")/n("dilution")*efficiency;
      metric("RBC teaching value",rbc*efficiency,"10¹²/L");metric("WBC teaching value",wbc,"10⁹/L");metric("Platelet teaching value",250*efficiency,"10⁹/L");metric("Sampled RBC events",counted,"events");metric("Sampling uncertainty",100/Math.sqrt(Math.max(1,counted))+noise*5,"%");
      metric("Hemoglobin teaching value",hgb,"g/dL");metric("Hematocrit teaching value",hct,"%");metric("MCV teaching value",mcv,"fL");metric("MCH teaching value",hgb*10/Math.max(.01,detectedRBC),"pg");metric("MCHC teaching value",hgb*100/Math.max(.01,hct),"g/dL");
      trace("RBC volume histogram","events","#fb5266",200,t=>t<n("threshold")?0:counted/150*Math.exp(-.5*((t-86)/sigma)**2)*(1+noise*wave(t)),"fL");
      trace("Platelet volume histogram","events","#36aeff",40,t=>250*n("volume")/n("dilution")*Math.exp(-.5*((t-10)/4)**2)*(1+noise*wave(t)),"fL");
      visual.push(rbc,wbc,efficiency);status="Illustrative CBC — not patient results";
      if(efficiency<.02){valid=false;status="RBC discriminator rejects almost all cells — count invalid";}
      break;
    }
    case "chemistry": {
      const optimal=mode.startsWith("Glucose")?505:mode.startsWith("Urea")?340:510;
      const spectral=Math.exp(-(((n("wavelength")-optimal)/100)**2)),temperatureFactor=Math.exp((n("temperature")-37)*.045);
      const absorbance=n("concentration")*.0045*n("volume")/10*spectral;
      const urea=mode.startsWith("Urea");
      const reaction=(t:number)=>urea?1-Math.min(.9,absorbance)*(1-Math.exp(-t*temperatureFactor/55)):absorbance*(1-Math.exp(-t*temperatureFactor/55));
      metric(urea?"Absorbance decrease":"Final absorbance",absorbance,"A");metric("Estimated concentration",n("concentration")*spectral,"relative");metric("Transmission",100*10**(-(urea?reaction(300):absorbance)),"%");metric("Reaction rate factor",temperatureFactor,"×");
      trace("Absorbance versus time","A","#4bbdff",300,reaction);
      trace("Transmitted light","I/I₀","#f6c65d",300,t=>10**(-reaction(t)));
      visual.push(reaction(time));status=urea?"Urea teaching mode: NADH absorbance decreases at 340 nm":"Virtual assay — assay-specific calibration required";
      if(absorbance>(urea?.9:2)){valid=false;status="Outside the illustrative assay range — dilute and recalibrate";}
      break;
    }
    case "flight-computer": {
      const target=mode.startsWith("Heading")?n("heading"):n("target"),start=mode.startsWith("Heading")?0:n("altitude");
      const response=(t:number)=>start+(target-start)*(1-Math.exp(-t*n("gain")/5));
      metric("Current altitude input",n("altitude"),"ft");metric("Altitude target",n("target"),"ft");metric("Heading target",n("heading"),"°");metric("Guidance output",response(time),mode.startsWith("Heading")?"°":"ft");
      trace("Guidance tracking",mode.startsWith("Heading")?"°":"ft","#349fff",20,response);trace("Selected target",mode.startsWith("Heading")?"°":"ft","#e8bc52",20,()=>target);visual.push(n("heading"),response(time));break;
    }
    case "fly-by-wire": {
      const authority=mode.startsWith("Direct")?1:clamp(250/n("speed"),.5,1.5),rate=n("gain")*authority;
      metric("Elevator demand",n("pitch")*authority,"°");metric("Aileron demand",n("roll")*authority,"°");metric("Airspeed",n("speed"),"kt");metric("Tracking gain",rate,"×");
      trace("Pitch response","°","#4ebaff",10,t=>n("pitch")*authority*(1-Math.exp(-t*rate)));trace("Roll response","°","#e7c35d",10,t=>n("roll")*authority*(1-Math.exp(-t*rate)));visual.push(n("roll")*authority*(1-Math.exp(-time*rate)),n("pitch")*authority*(1-Math.exp(-time*rate)),n("speed"));metric("Current elevator angle",visual[1]!,"°");metric("Current aileron angle",visual[0]!,"°");break;
    }
    case "cockpit": case "pfd": {
      metric("Altitude",n("altitude"),"ft");metric("Airspeed",n("speed"),"kt");metric("Heading",n("heading"),"°");metric("Bank angle",n("roll"),"°");if(lab.family==="pfd"){metric("Pitch",n("pitch"),"°");metric("Vertical speed",n("climb"),"ft/min");}
      trace("Bank angle","°","#49baff",10,()=>n("roll"));trace("Altitude trend","ft","#63d1a0",10,t=>n("altitude")+t*n("climb")/60);visual.push(n("roll"),n("pitch"),n("heading"),n("altitude"),n("speed"));status=`${mode} — validated virtual source data`;if(mode.startsWith("Source failure")){valid=false;status="Source invalid — flight indication flagged";}break;
    }
    case "air-data": {
      const pressure=(mode.startsWith("Blocked static")?800:n("static"))+n("bias"),dynamic=mode.startsWith("Blocked pitot")?0:n("dynamic"),kelvin=n("temperature")+273.15;
      const altitude=44330*(1-(pressure/1013.25)**.1903)*3.28084,ias=Math.sqrt(2*dynamic*100/1.225)*1.94384,density=pressure*100/(287.05*kelvin),tas=Math.sqrt(2*dynamic*100/density)*1.94384;
      metric("Pressure altitude",altitude,"ft");metric("Indicated-speed model",ias,"kt");metric("True-speed model",tas,"kt");metric("Density",density,"kg/m³");metric("Temperature input",n("temperature"),"°C");metric("Mach model",tas/1.94384/Math.sqrt(1.4*287.05*kelvin),"M");
      trace("Static pressure","hPa","#42bdff",10,()=>pressure);trace("Dynamic pressure","hPa","#eeb64c",10,()=>dynamic);visual.push(altitude,ias,tas);status=mode.startsWith("Normal")?"Simplified incompressible air-data model":`${mode} — compare affected channels`;break;
    }
    case "ins": {
      const duration=n("duration"),bias=n("bias")*(mode.startsWith("GNSS")?.1:1),a=n("acceleration");
      metric("Estimated displacement",.5*(a+bias)*duration**2,"m");metric("Velocity estimate",(a+bias)*duration,"m/s");metric("Position drift",.5*bias*duration**2,"m");metric("Yaw change",n("rotation")*duration,"°");
      trace("Velocity estimate","m/s","#48afff",duration,t=>(a+bias)*t);trace("Position drift","m","#f19952",duration,t=>.5*bias*t*t);trace("Yaw change","°","#77d49a",duration,t=>n("rotation")*t);visual.push(n("rotation")*time,.5*(a+bias)*time*time);status=mode.startsWith("GNSS")?"Aiding attenuates bias in this teaching example":"Unaided integration — drift accumulates";break;
    }
    case "gps": {
      const speed=n("speed",128),heading=n("heading",267);
      valid=n("satellites")>=4&&n("strength")>=28;
      const geometry=mode.startsWith("Poor")?4:1,multipath=mode.startsWith("Urban")?3:1,error=5*geometry*multipath/Math.sqrt(Math.max(1,n("satellites")-3))*Math.exp((45-n("strength"))/12);
      metric("Tracked satellites",n("satellites"));metric("Position uncertainty example",valid?error:"No 3D fix","m");metric("Ground speed",speed,"kt");metric("Track heading",heading,"°");
      const distance=speed*time/3600,north=distance*Math.cos(heading*Math.PI/180),east=distance*Math.sin(heading*Math.PI/180);
      const targetNorth=(n("waypointLatitude",37.7213)-37.6213)*60-north,targetEast=(n("waypointLongitude",-122.2216)+122.3790)*60*Math.cos(37.6213*Math.PI/180)-east;
      metric("Latitude",37.6213+north/60,"° N");metric("Longitude",122.3790-east/(60*Math.cos(37.6213*Math.PI/180)),"° W");metric("Altitude teaching input",1250,"ft");metric("Distance to waypoint",Math.hypot(targetNorth,targetEast),"NM");metric("Waypoint bearing",(Math.atan2(targetEast,targetNorth)*180/Math.PI+360)%360,"°");
      const utc=10*3600+27*60+15+time;
      metric("Teaching clock",[Math.floor(utc/3600)%24,Math.floor(utc/60)%60,Math.floor(utc)%60].map(v=>String(v).padStart(2,"0")).join(":"),"UTC");
      trace("Pseudorange error illustration","m","#51baff",20,t=>error*wave(t));trace("Distance traveled","NM","#51d2a2",20,t=>speed*t/3600);visual.push(n("satellites"),error,heading);status=valid?"Virtual GNSS fix available":"Insufficient satellites / signal — no 3D fix";break;
    }
    default: return lab.number>=135?simulateHousehold(lab,p,mode,time,fault):lab.number>=125?simulateConsumer(lab,p,mode,time,fault):lab.number>=115?simulateRobotics(lab,p,mode,time,fault):lab.number>=105?simulateControl(lab,p,mode,time,fault):lab.number>=95?simulateMarine(lab,p,mode,time,fault):lab.number>=85?simulateSecurity(lab,p,mode,time,fault):lab.number>=75?simulateSystems(lab,p,mode,time,fault):simulateAviation(lab,p,mode,time,fault);
  }
  if(fault){valid=false;status="Required component fault — affected output invalid";}
  if(!valid){traces.forEach(t=>t.samples.fill(0));metrics.forEach(m=>{m.value="Unavailable";m.unit="";});metrics.unshift({label:"Validity",value:"Affected output unavailable",unit:""});progress=0;}
  return {metrics,traces,status,valid,visual,progress};
}




