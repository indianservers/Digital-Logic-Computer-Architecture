export function VhfArchitecture(){
 const box=(x:number,y:number,w:number,title:string,sub:string)=><g><rect x={x} y={y} width={w} height="38" fill="#f2f8ff" stroke="#739ec1"/><text x={x+w/2} y={y+15} textAnchor="middle" fontSize="10">{title}</text><text x={x+w/2} y={y+29} textAnchor="middle" fontSize="9">{sub}</text></g>;
 return <svg viewBox="0 0 550 265" role="img" aria-label="Marine VHF transmit microphone preamp FM modulator RF power low pass and antenna receive duplexer receiver FM demodulator speaker with DSC GPS and MCU">
 {[[20,'Audio preamp'],[130,'FM modulator'],[240,'RF power amp'],[350,'Low-pass filter']].map(([x,t])=><g key={t}>{box(Number(x),22,87,String(t),'Transmit')}</g>)}
 {[[20,'Audio amp'],[130,'FM demod'],[240,'RF receiver'],[350,'Duplexer / T-R']].map(([x,t])=><g key={t}>{box(Number(x),113,87,String(t),'Receive')}</g>)}
 {box(15,207,90,'Display / UI','Keys')}{box(130,207,115,'Control MCU','Synthesizer / control')}{box(274,207,100,'DSC circuitry','Channel 70')}{box(405,207,115,'GPS interface','NMEA 0183')}
 <path d="M107 41h23M217 41h23M327 41h23M437 41h55v91h-55M492 41V18m-8-10 8 10 8-10M350 132h-23M240 132h-23M130 132h-23M105 226h25M245 226h29M374 226h31M187 207v-30h-14v-26M324 207v-30h70v-26" fill="none" stroke="#245c89"/>
 <text x="493" y="7" textAnchor="middle" fontSize="9">Antenna</text><text x="22" y="94" fontSize="9">Speaker ←</text><text x="22" y="12" fontSize="9">Microphone →</text>
 </svg>;
}
export function VhfFlow(){return <div className="vhf-flow">{[['Microphone','Preamp / audio','FM modulation','RF PA / filter','VHF antenna'],['Received VHF','RF front end','FM demodulation','Audio amplifier','Speaker output']].map((row,i)=><div key={i}>{row.map((t,j)=><span key={t}><b>{['◉','▥','∿','▣','♧'][j]}</b>{t}{j<4&&<i>→</i>}</span>)}</div>)}</div>;}
export function VhfDsc(){return <div className="vhf-dsc"><h3>DSC & GPS Data Flow</h3><div>{['Distress button','DSC encoder · Ch 70','GPS position · NMEA','Digital calling message'].map((t,i)=><span key={t}><b>{['▣','▧','⌖','◉'][i]}</b>{t}{i<3&&<i>→</i>}</span>)}</div></div>;}
