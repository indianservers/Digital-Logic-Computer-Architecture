export function BeaconArchitecture(){
 const box=(x:number,y:number,w:number,title:string,sub:string)=><g><rect x={x} y={y} width={w} height="47" rx="4" fill="#f3f8ff" stroke="#719cbd"/><text x={x+w/2} y={y+19} textAnchor="middle" fontSize="12">{title}</text><text x={x+w/2} y={y+35} textAnchor="middle" fontSize="12">{sub}</text></g>;
 return <svg viewBox="0 0 460 260" role="img" aria-label="EPIRB GPS and activation switch MCU controller battery management 406MHz satellite 121.5MHz homing and strobe branches">
 {box(10,75,95,'GPS receiver','Position')}{box(10,165,95,'Activation','Switch / immersion')}{box(162,105,125,'Microcontroller','Encode and control')}{box(164,8,122,'Battery pack','Power management')}{box(330,55,120,'406 MHz TX','Satellite antenna')}{box(330,145,120,'121.5 MHz TX','Homing antenna')}{box(330,210,120,'Strobe light','LED')}
 <path d="M105 99h28v30h29M105 189h28v-48h29M225 55v50M287 129h23V79h20M310 129v40h20M310 169v64h20" stroke="#3576a4" fill="none"/>
 </svg>;
}
export function BeaconRescue({stage}:{stage:number}){return <svg viewBox="0 0 460 410" role="img" aria-label="Native ocean rescue scene beacon satellite ground station rescue coordination and local search relay">
 <defs><linearGradient id="beacon-sky" x2="0" y2="1"><stop stopColor="#1669a7"/><stop offset="1" stopColor="#a9d4ec"/></linearGradient></defs><rect width="460" height="410" fill="url(#beacon-sky)"/><path d="M0 210Q40 195 80 210T160 210T240 210T320 210T400 210T460 210V410H0" fill="#146890"/>{[245,280,315,350,385].map(y=><path key={y} d={`M0 ${y}q30-12 60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0`} fill="none" stroke="#8ec5dd" opacity=".7"/>)}
 <g transform="translate(180 75) rotate(-15)"><rect x="-12" y="-13" width="24" height="26" fill="#d8dce0"/><path d="M-13-6h-43v18h43M13-6h43v18H13" fill="#0e4167" stroke="#a5c9df"/><path d="M0-13V-31" stroke="#e0e6ef"/></g>
 <g transform="translate(370 160)"><path d="M-25 0q25 29 50 0Z" fill="#d1dce1"/><path d="M0 10v45m-20 0h40" stroke="#d1dce1" strokeWidth="5"/><path d="M0 10l18-29" stroke="#e4ecf2"/></g>
 <g transform="translate(65 290)"><rect x="-15" y="-46" width="30" height="65" rx="10" fill="#ffd433" stroke="#b28c18"/><path d="M0-46V-95" stroke="#222c35" strokeWidth="5"/><rect x="-13" y="-29" width="26" height="17" fill="#202c31"/></g>
 <g transform="translate(335 315)"><path d="M-67 0h134l-16 28H-46Z" fill="#d9e6ea"/><rect x="-25" y="-32" width="48" height="32" fill="#f8f9fb"/><path d="M0-32v-25" stroke="#eff4f5" strokeWidth="3"/><rect x="-19" y="-25" width="36" height="12" fill="#205879"/></g>
 <path d="M70 196L158 92M206 91L354 140M372 216L349 274M293 330L92 310" stroke="#ffd754" strokeWidth="3" strokeDasharray="7 5" fill="none" opacity={stage>0?1:.45}/>
 {[[15,26,'1 · Beacon activated'],[127,36,'2 · Satellite relay'],[290,118,'3 · Ground station'],[231,237,'4 · Rescue coordination'],[206,380,'5 · Search and local homing']].map(([x,y,t])=><text key={t} x={Number(x)} y={Number(y)} fontSize="12" fill="white">{t}</text>)}
 </svg>;}
