export function SonarArchitecture({detail=false}:{detail?:boolean}){
 const box=(x:number,y:number,w:number,title:string,caption:string,fill="#e7f4ff")=><g><rect x={x} y={y} width={w} height="48" rx="3" fill={fill} stroke="#80acd0"/><text x={x+w/2} y={y+20} textAnchor="middle" fontSize="12">{title}</text><text x={x+w/2} y={y+36} textAnchor="middle" fontSize="12">{caption}</text></g>;
 return <svg viewBox="0 0 640 250" role="img" aria-label={detail?"Hydrophone LNA bandpass ADC beamforming display receive circuit with clock and common DC supply":"Sonar navigation timing projector transducer LNA filter ADC beamforming display and DC supply architecture"}>
 {detail?<>{box(8,65,90,"Hydrophone","Transducer")}{box(115,65,64,"LNA","Low noise")}
 {box(200,65,97,"Band-pass","Filter")}{box(318,65,61,"ADC","Samples")}{box(400,65,113,"DSP / Beamforming","Processor")}{box(534,65,98,"Display","Console")}
 <path d="M98 89h17M179 89h21M297 89h21M379 89h21M513 89h21" stroke="#2a6596"/>
 {box(263,137,105,"Clock","Timing reference","#f3efff")}
 <path d="M263 159H147v-46M368 159h89v-46M348 137v-24" stroke="#69819a" strokeDasharray="4 3" fill="none"/>
 <rect x="43" y="211" width="557" height="28" fill="#e9f2fa" stroke="#69819a"/><text x="320" y="230" textAnchor="middle">DC regulated power supply</text><path d="M147 211v-98M348 211v-35M456 211v-98M580 211v-98" stroke="#69819a" strokeDasharray="4 3"/>
 </>:<>
 {box(8,10,113,"Navigation","GPS / INS")}{box(8,101,89,"Projector","Transmitter","#fff0d8")}{box(119,101,97,"Transducer","Array / water")}{box(237,101,92,"Preamplifier","LNA","#e8f4e7")}{box(350,101,58,"Filter","Band-pass","#e8f4e7")}{box(429,101,54,"ADC","Samples","#e8f4e7")}{box(503,101,72,"DSP","Beamforming","#fff0d8")}{box(590,101,45,"LCD","Output","#eee7ff")}
 <path d="M97 125h22M216 125h21M329 125h21M408 125h21M483 125h20M575 125h15M54 58v43" stroke="#2485d2" fill="none"/>
 <path d="M283 149v42H168v-42" stroke="#35a579" strokeDasharray="4 3" fill="none"/>
 <path d="M121 35h168v66" stroke="#607b91" strokeDasharray="4 3" fill="none"/>
 {box(490,195,102,"Power supply","Regulated DC","#ffe8e8")}<path d="M540 195v-46" stroke="#607b91" strokeDasharray="4 3"/>
 <text x="24" y="227" fontSize="12">Acoustic pulse → reflected echo → sampled receive signal</text>
 </>}</svg>;
}
export function SonarScene({active,range}:{active:boolean;range:number}){return <svg viewBox="0 0 360 250" role="img" aria-label="Synthetic sonar water column with three ranged targets">
 <defs><linearGradient id="sonar-water" x2="0" y2="1"><stop stopColor="#9ddbec"/><stop offset=".18" stopColor="#248bb7"/><stop offset="1" stopColor="#042c49"/></linearGradient></defs><rect width="360" height="250" fill="url(#sonar-water)"/><path d="M0 220L50 205L94 227L150 210L220 223L280 193L360 216V250H0Z" fill="#173e49"/><path d="M0 16Q75 10 150 16T360 16" fill="none" stroke="#d2f4ff"/>
 <rect width="360" height="250" fill="#003251" opacity=".25"/>
 {[820,1340,1760].map((r,i)=><g key={r}><path d={"M"+(95+i*93)+" "+(90+i*47)+"h35l10 6-10 6h-35l-8-6Z"} fill="#132e3c"/><text x={86+i*86} y={78+i*47} fill="#baffd8" fontSize="12">{active&&r<=range?r+" m":"Bearing only"}</text></g>)}
 <text x="10" y="22" fill="white">Water column · illustrative targets</text><text x="10" y="237" fill="white" fontSize="12">{active?"Active round-trip ranging":"Passive listening: no direct range"}</text>
 </svg>;}
