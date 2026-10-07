export function GroundSatcomArchitecture(){
 const box=(x:number,y:number,label:string,detail:string,rx=false)=><g><rect x={x} y={y} width="88" height="43" rx="4" fill="#f7fbff" stroke={rx?"#32ac89":"#228ae5"}/><text x={x+44} y={y+17} textAnchor="middle">{label}</text><text x={x+44} y={y+32} textAnchor="middle" fontSize="12">{detail}</text></g>;
 return <svg viewBox="0 0 650 230" role="img" aria-label="Ground satellite terminal uplink through codec modem and BUC; downlink through LNB modem codec network interface">
 <defs><marker id="ground-sat-tx" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5 0 10" fill="#238be5"/></marker><marker id="ground-sat-rx" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5 0 10" fill="#26aa86"/></marker></defs>
 <text x="12" y="20" fill="#167cd5" fontWeight="bold">Transmit (uplink)</text>
 {box(12,36,"User data","PC / network")}{box(121,36,"Codec","Baseband")}{box(230,36,"Modem","Modulation")}{box(339,36,"BUC","Power amplifier")}
 <path d="M100 57h21M209 57h21M318 57h21M427 57h32" stroke="#238be5" markerEnd="url(#ground-sat-tx)"/>
 <image href="/device-labs/advanced/076-link-ground.webp" x="460" y="30" width="72" height="75"/>
 <image href="/device-labs/advanced/076-link-satellite.webp" x="550" y="5" width="92" height="62"/>
 <path d="M512 42L556 30" stroke="#ec5b60" strokeDasharray="5 3" markerEnd="url(#ground-sat-tx)"/>
 <text x="12" y="126" fill="#249e77" fontWeight="bold">Receive (downlink)</text>
 {box(12,142,"User output","Data / voice / video",true)}{box(112,142,"Network","Interface",true)}{box(212,142,"Codec","Baseband",true)}{box(312,142,"Modem","Demodulation",true)}{box(412,142,"LNB","Receiver chain",true)}
 <path d="M112 163h-12M212 163h-12M312 163h-12M412 163h-12M535 163h-35" stroke="#26aa86" markerEnd="url(#ground-sat-rx)"/>
 <image href="/device-labs/advanced/076-link-ground.webp" x="532" y="130" width="72" height="72"/>
 <path d="M598 62L577 131" stroke="#238be5" strokeDasharray="5 3" markerEnd="url(#ground-sat-rx)"/>
 <text x="385" y="224" fontSize="12">14 GHz uplink · 12 GHz downlink (Ku band)</text>
 </svg>;
}
export function GroundSatcomSignal(){return <svg viewBox="0 0 460 225" role="img" aria-label="Dish earth station sends uplink to satellite transponder and downlink reaches remote dish terminal">
 <image href="/device-labs/advanced/076-link-ground.webp" x="15" y="90" width="92" height="99"/>
 <image href="/device-labs/advanced/076-link-satellite.webp" x="176" y="57" width="115" height="83"/>
 <image href="/device-labs/advanced/076-link-ground.webp" x="350" y="90" width="92" height="99"/>
 <path d="M81 108Q220 12 380 103" stroke="#ee555b" fill="none" strokeWidth="2" strokeDasharray="6 4"/><path d="M375 159Q227 209 83 159" stroke="#268ae4" fill="none" strokeWidth="2" strokeDasharray="6 4"/>
 <text x="228" y="20" textAnchor="middle" fill="#e74451">Uplink · 14 GHz</text><text x="228" y="151" textAnchor="middle">Satellite transponder</text><text x="228" y="213" textAnchor="middle" fill="#197fda">Downlink · 12 GHz</text><text x="60" y="201" textAnchor="middle" fontSize="12">Earth station</text><text x="401" y="201" textAnchor="middle" fontSize="12">Remote terminal</text>
 </svg>;}
