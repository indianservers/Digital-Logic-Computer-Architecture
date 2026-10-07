export function SatcomArchitecture(){
 const block=(x:number,y:number,w:number,title:string,detail:string,tx=false)=><g><rect x={x} y={y} width={w} height="42" rx="4" fill={tx?'#fff2e9':'#edf7ff'} stroke={tx?'#e79670':'#69a9da'}/><text x={x+w/2} y={y+17} textAnchor="middle">{title}</text><text x={x+w/2} y={y+32} textAnchor="middle" fontSize="12">{detail}</text></g>;
 return <svg className="satcom-architecture" viewBox="0 0 600 275" role="img" aria-label="SATCOM antenna receive LNA downconverter demodulator and transmit upconverter HPA modulator paths, data interfaces, control processor and power supply">
 <defs><marker id="sat-rx" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5 0 10" fill="#177acb"/></marker><marker id="sat-tx" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5 0 10" fill="#db7447"/></marker></defs>
 <text x="280" y="17" textAnchor="middle" fontWeight="bold">Aircraft satellite communication terminal</text>
 <image href="/device-labs/advanced/076-antenna.webp" x="4" y="32" width="88" height="128"/>
 <path d="M86 72H106M181 72h19M287 72h18M405 72h16M486 94h23" stroke="#177acb" fill="none" markerEnd="url(#sat-rx)"/>
 {block(106,51,75,'LNA','Weak RF gain')}{block(200,51,87,'Downconverter','RF → IF')}{block(305,51,100,'Demodulator','Modem receive')}
 <path d="M421 128h-16M305 128h-18M200 128h-19M106 128H86" stroke="#db7447" fill="none" markerEnd="url(#sat-tx)"/>
 {block(106,108,75,'Upconverter','IF → RF',true)}{block(200,108,87,'HPA','Transmit power',true)}{block(305,108,100,'Modulator','Modem transmit',true)}
 {block(421,77,65,'Data I/O','Ethernet / ARINC')}{block(509,77,84,'Aircraft systems','Voice / IP / ACARS')}
 <path d="M55 157v30h42M144 174v-24M244 174v-24M355 174v-24M453 119v68h-54" stroke="#607897" fill="none"/>
 {block(97,174,302,'Control processor','Antenna tracking / modem supervision / health')}
 {block(97,228,302,'Regulated power','Aircraft power → electronic rails')}
 <path d="M248 228v-12" stroke="#607897"/>
 <path d="M430 200h25" stroke="#177acb" markerEnd="url(#sat-rx)"/><text x="462" y="204" fontSize="12">Receive path</text><path d="M430 222h25" stroke="#db7447" markerEnd="url(#sat-tx)"/><text x="462" y="226" fontSize="12">Transmit path</text>
 </svg>;
}
export function SatcomGeometry({azimuth,elevation,loss}:{azimuth:number;elevation:number;loss:number}){return <svg className="satcom-geometry" viewBox="0 0 470 225" role="img" aria-label="Aircraft satellite ground station relay with separate uplink and downlink">
 <rect width="470" height="225" fill="#f0f8ff"/><image href="/device-labs/advanced/076-link-aircraft.webp" x="15" y="115" width="140" height="72"/><image href="/device-labs/advanced/076-link-satellite.webp" x="165" y="10" width="140" height="90"/><image href="/device-labs/advanced/076-link-ground.webp" x="345" y="99" width="85" height="94"/>
 <path d="M117 127L192 87M294 87L366 122" fill="none" stroke={loss>20?'#dba94c':'#1a8ce5'} strokeWidth="2" strokeDasharray="6 4"/><path d="M190 100L126 140M358 137L292 99" stroke="#e06d4d" strokeDasharray="5 3"/>
 <text x="30" y="201">Aircraft terminal</text><text x="226" y="108" textAnchor="middle">GEO relay</text><text x="340" y="207">Ground station</text><text x="95" y="90" fill="#197dd0">14 GHz uplink</text><text x="268" y="132" fill="#d66744">12 GHz downlink</text><text x="15" y="222" fontSize="12">Az {azimuth.toFixed(1)}° · El {elevation.toFixed(1)}° · Pointing loss {loss.toFixed(1)} dB</text>
 </svg>;}
