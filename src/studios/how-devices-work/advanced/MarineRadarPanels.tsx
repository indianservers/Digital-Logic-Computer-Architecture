export function MarineRadarArchitecture({detail=false}:{detail?:boolean}){
 const box=(x:number,y:number,w:number,label:string,caption:string,fill="#e7f4ff")=><g><rect x={x} y={y} width={w} height="46" rx="4" fill={fill} stroke="#6c9fc9"/><text x={x+w/2} y={y+18} textAnchor="middle" fontSize="11">{label}</text><text x={x+w/2} y={y+34} textAnchor="middle" fontSize="9">{caption}</text></g>;
 return <svg viewBox="0 0 680 285" role="img" aria-label="Marine radar timing modulator RF amplifier duplexer antenna receive LNA mixer IF ADC DSP and display with local oscillator and heading GPS reference">
 {box(8,35,81,"Timing","Control")}{box(117,35,90,"Modulator","Pulse trigger")}{box(235,35,111,"Power amplifier","Magnetron / SSPA","#ffe8e8")}{box(378,64,92,"Duplexer","T/R switch","#fff2d0")}
 <path d="M89 58h28M207 58h28M346 58h18v29h14M470 87h89" stroke="#2a679b" fill="none"/>
 <path d="M565 82l27-36 23 30-50 6Zm24-6v56m-17 0h33m-37 7h44M625 71q25 20 0 40M638 58q40 35 0 65" stroke="#287ba9" fill="none" strokeWidth="2"/><text x="588" y="27" textAnchor="middle" fontSize="12">Scanner antenna</text>
 <path d="M422 110v24H53v33" stroke="#3bab77" strokeDasharray="5 3" fill="none"/>
 {box(8,167,89,"Receiver","LNA","#e3f5e8")}{box(117,167,80,"Mixer","Downconversion","#e3f5e8")}{box(218,167,96,"IF amplifier","Filter","#e3f5e8")}{box(335,167,60,"ADC","Samples","#e3f5e8")}{box(415,167,120,"DSP / Targets","Range and bearing","#e3f5e8")}{box(556,167,115,"Display unit","PPI")}
 <path d="M97 190h20M197 190h21M314 190h21M395 190h20M535 190h21" stroke="#2a679b"/>
 {box(112,234,91,"Local oscillator","Stable RF","#efe9ff")}{box(505,234,129,detail?"DC supply":"Heading / GPS",detail?"Regulated rails":"Interface","#eaf0fa")}
 <path d="M157 234v-21M505 257h-30v-44" stroke="#6d8199" fill="none"/>
 <text x="510" y="156" fontSize="10">Echo receive path</text>
 </svg>;
}
export function MarineRadarParts(){return <div className="marine-radar-parts"><h3>External parts on vessel</h3><p><b>1 Radar scanner</b>Rotates through 360° to transmit and receive.</p><p><b>2 Radome</b>Weatherproof cover over the antenna assembly.</p><p><b>3 Pedestal</b>Drive motor, slip rings and waveguide.</p></div>;}
