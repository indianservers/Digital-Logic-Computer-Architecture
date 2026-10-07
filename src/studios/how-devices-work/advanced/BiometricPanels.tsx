export function BiometricArchitecture({detail=false}:{detail?:boolean}){
 const box=(x:number,y:number,w:number,title:string,caption:string,fill="#eff7ff")=><g><rect x={x} y={y} width={w} height="42" rx="4" fill={fill} stroke="#72a5ce"/><text x={x+w/2} y={y+16} textAnchor="middle" fontSize="10">{title}</text><text x={x+w/2} y={y+31} textAnchor="middle" fontSize="8">{caption}</text></g>;
 return <svg viewBox="0 0 460 290" role="img" aria-label={detail?"Biometric access circuit with DC regulation camera fingerprint card reader MCU memory secure element relay lock and buzzer":"Biometric sensors and exit button feed SoC feature matching; memory and secure element support door alarm event and network outputs"}>
 {detail?<>
 {box(8,8,85,"12 V DC","Power source")}{box(105,8,95,"DC–DC","Regulated rails")}
 {box(8,69,104,"Camera","USB / MIPI")}{box(8,130,104,"Fingerprint","UART / USB")}{box(8,191,104,"Card reader","RS485 / UART")}
 {box(178,101,110,"MCU / SoC","Linux / RTOS","#d4ebff")}
 {box(345,101,107,"Relay driver","MOSFET / lock")}
 {box(178,224,90,"Flash","eMMC")}{box(288,224,90,"Secure element","Key / crypto")}{box(348,171,104,"Buzzer / LED","Local status")}
 <path d="M93 29h12M152 50v72h26M112 90h38v28h28M112 151h66M112 212h38v-77h28M288 122h57M398 143v28M224 143v81M257 143v56h76v25" stroke="#268bdd" fill="none"/>
 </>:<>
 {["Fingerprint","Face camera","RFID card","Exit button"].map((label,i)=><g key={label}>{box(6,8+i*60,105,label,"Credential input")}<path d={"M111 "+(29+i*60)+"H140V112H177"} stroke="#268bdd" fill="none"/></g>)}
 <rect x="177" y="67" width="135" height="93" rx="5" fill="#238cfa"/><text x="244" y="92" textAnchor="middle" fill="white">MCU / SoC</text><text x="244" y="114" textAnchor="middle" fill="white" fontSize="10">Feature extraction</text><text x="244" y="133" textAnchor="middle" fill="white" fontSize="10">Matching + policy decision</text>
 {box(165,204,87,"Memory","eMMC / flash")}{box(263,204,88,"Secure element","Keys / crypto")}
 {["Door unlock","Alarm / buzzer","Event log","Network"].map((label,i)=><g key={label}>{box(355,8+i*60,99,label,i===3?"Wi-Fi / Ethernet":"Local output")}<path d={"M312 112h24v"+((29+i*60)-112)+"h19"} stroke="#268bdd" fill="none"/></g>)}
 <path d="M208 160v44M292 160v44" stroke="#268bdd"/>
 </>}
 </svg>;
}
export function BiometricSignal(){return <ol className="biometric-signal">{["Capture image or template","Preprocess and extract features","Compare with enrolled reference","Apply permission and threshold","Pulse relay and record event","Optional network report"].map((text,i)=><li key={text}><b>{i+1}</b><span>{text}</span></li>)}</ol>;}
