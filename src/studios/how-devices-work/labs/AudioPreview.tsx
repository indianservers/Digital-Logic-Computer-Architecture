import { useEffect, useRef, useState } from "react";
import type { Lab } from "./data";
export default function AudioPreview({lab,values,mode,fault}:{lab:Lab;values:Record<string,number>;mode:string;fault:boolean}) {
 const active=useRef<AudioContext|null>(null),[playing,setPlaying]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>()=>{void active.current?.close();},[]);
 useEffect(()=>{void active.current?.close();active.current=null;setPlaying(false);},[values,mode,fault]);
 async function play(){if(active.current){await active.current.close();active.current=null;setPlaying(false);return;}try{
  const context=new AudioContext();active.current=context;const buffer=context.createBuffer(1,context.sampleRate*3,context.sampleRate),channel=buffer.getChannelData(0),rate=(values.rate??72)/60;
  for(let i=0;i<channel.length;i++){const t=i/context.sampleRate,phase=(t*rate)%1,gauss=(m:number,s:number)=>Math.exp(-.5*((phase-m)/s)**2);let signal=lab.engine==="hearing"?Math.sin(t*(values.frequency??1000)*Math.PI*2)*.05:Math.sin(t*180*Math.PI*2)*(gauss(.15,.035)+.6*gauss(.47,.025))*.08;
   if(mode==="Heart murmur")signal+=.025*Math.sin(t*320*Math.PI*2)*gauss(.32,.1);if(mode==="Wheeze")signal=.055*Math.sin(t*550*Math.PI*2)*(.5+.5*Math.sin(t*2));if(mode==="Crackles")signal=.09*Math.sin(t*1800)*Number(Math.sin(t*37)>.97);
   const suppression=lab.engine==="hearing"?(1-(values.reduction??50)/100):(values.filter? .05:1);signal+=.015*suppression*(values.noise??15)/15*Math.sin(t*2873);const gain=lab.engine==="hearing"?Math.pow(10,((values.gain??40)-40)/20):(values.gain??4)/4;channel[i]=fault?0:Math.max(-.15,Math.min(.15,signal*gain));
  }
  const source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);source.onended=()=>{void context.close();if(active.current===context)active.current=null;setPlaying(false);};source.start();setPlaying(true);setMessage("Synthetic three-second sound example");
 }catch{setMessage("Audio output is unavailable in this browser.");}}
 return <div className="dl-audio"><button disabled={fault} onClick={()=>void play()}>{playing?"■ Stop Sound":"▷ Play Sound"}</button><small role="status">{message}</small></div>;
}
