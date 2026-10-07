import {itemAt} from './parameters';
import type {AdvancedResult} from './engine';
export function AutopilotArchitecture({detail=false}:{detail?:boolean}){
 const box=(x:number,y:number,w:number,title:string,sub:string,fill="#e8f5ff")=><g><rect x={x} y={y} width={w} height="42" rx="4" fill={fill} stroke="#7dadce"/><text x={x+w/2} y={y+17} textAnchor="middle" fontSize="12">{title}</text><text x={x+w/2} y={y+32} textAnchor="middle" fontSize="12">{sub}</text></g>;
 return <svg viewBox="0 0 570 270" role="img" aria-label={detail?"Marine autopilot regulated power sensor interfaces MCU H bridge hydraulic actuator rudder and angle feedback circuit":"Marine autopilot GPS compass rudder sensor and desired heading control loop through actuator and rudder feedback"}>
 {['GPS position / COG','Heading sensor','Rudder angle sensor','User heading input'].map((t,i)=><g key={t}>{box(8,22+i*59,126,t,detail?'NMEA / analog interface':'Feedback / reference')}<path d={`M134 ${43+i*59}h19V132h28`} fill="none" stroke="#315e85"/></g>)}
 {box(181,112,124,detail?'Controller MCU / DSP':'Autopilot controller','PID control law','#e2f2e7')}{box(332,112,108,detail?'H-bridge driver':'Actuator drive','Pump / motor','#ffe7ec')}{box(469,112,93,'Rudder','Steering','#e8f5ff')}{box(181,22,124,detail?'DC–DC regulator':'Power supply',detail?'12/24 V → 5 / 3.3 V':'12 / 24 V DC','#f2eaff')}
 <path d="M243 64v48M305 133h27M440 133h29M515 154v75H243v-75" fill="none" stroke="#315e85"/><text x="365" y="247" textAnchor="middle" fontSize="12">Rudder angle and heading feedback</text>
 </svg>;
}
export function AutopilotScene({result,time}:{result:AdvancedResult;time:number}){
 const desired=itemAt(result.visual,3),heading=itemAt(result.visual,0),a=desired*Math.PI/180,actual=heading*Math.PI/180;
 return <svg viewBox="0 0 440 290" role="img" aria-label="Autopilot desired green course actual blue heading and red rudder with live heading rudder cross track and mode">
 <rect width="440" height="290" rx="5" fill="#a2cee3"/><path d="M0 0h170l-24 25 30 32-55 20 25 30-70 35-76 50" fill="#bedbd8"/>{[40,80,120,160,200,240].map(y=><path key={y} d={`M0 ${y}h440`} stroke="#91bed6" strokeDasharray="3 7"/>)}
 <path d={`M190 160l${Math.sin(a)*150} ${-Math.cos(a)*150}`} stroke="#28964d" strokeWidth="2" strokeDasharray="7 5"/><path d={`M190 160l${Math.sin(actual)*100} ${-Math.cos(actual)*100}`} stroke="#1878ce" strokeWidth="2"/>
 <g transform={`translate(190 160) rotate(${heading})`}><path d="M0-28q-14 24-7 48h14Q14-4 0-28" fill="white" stroke="#526e80"/><rect x="-5" y="-10" width="10" height="19" rx="3" fill="#577d91"/><path d={`M0 20l${Math.sin(itemAt(result.visual,1)*Math.PI/180)*16} 16`} stroke="#e85a5a" strokeWidth="3"/></g>
 <text x="20" y="30" fontSize="12">N ↑</text><text x="270" y="25" fontSize="12" fill="#258340">— — Desired course {desired.toFixed(0)}°</text><text x="270" y="43" fontSize="12" fill="#1878ce">—— Actual heading</text><text x="270" y="61" fontSize="12" fill="#c64b4b">— — Rudder angle</text>
 <rect x="265" y="170" width="165" height="107" rx="4" fill="#f5faff"/>{[['Heading',heading.toFixed(1)+'°'],['Rudder angle',itemAt(result.visual,1).toFixed(1)+'°'],['Cross track',itemAt(result.visual,2).toFixed(1)+' m'],['Elapsed',time.toFixed(1)+' s']].map(([k,v],i)=><g key={k}><text x="273" y={192+i*23} fontSize="12">{k}</text><text x="422" y={192+i*23} textAnchor="end" fontSize="12">{result.valid?v:'—'}</text></g>)}
 </svg>;
}
