import type { ProjectId } from "./projectData";
import type { Runtime } from "./projectEngine";

const on = (value: unknown) => value === true;
const n = (value: unknown) => typeof value === "number" ? value : 0;
const label = (value: unknown) => String(value ?? "");

function Board({ x = 25, y = 220, name = "STM32" }: { x?: number; y?: number; name?: string }) {
  return <g transform={`translate(${x} ${y})`}>
    <rect width="105" height="98" rx="9" fill="#1763ae" stroke="#0d3f7f" strokeWidth="3" />
    <rect x="33" y="30" width="38" height="36" rx="5" fill="#1e293b" stroke="#7d92a9" strokeWidth="2" />
    {Array.from({ length: 7 }, (_, index) => <g key={index}><rect x="4" y={9 + index * 12} width="10" height="6" rx="1" fill="#e4bb60" /><rect x="91" y={9 + index * 12} width="10" height="6" rx="1" fill="#e4bb60" /></g>)}
    <rect x="42" y="80" width="22" height="10" rx="2" fill="#cad5e4" /><circle cx="20" cy="20" r="5" fill="#4ade80" />
    <text x="52" y="23" textAnchor="middle" fill="white" fontSize="11" fontWeight="700">{name}</text>
  </g>;
}

function Wire({ d, active = true, color = "#22c55e" }: { d: string; active?: boolean; color?: string }) {
  return <path d={d} fill="none" stroke={active ? color : "#9aaac0"} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className={active ? "mcu-wire-live" : ""} />;
}

function Lamp({ x, y, color, lit }: { x: number; y: number; color: string; lit: boolean }) {
  return <g><circle cx={x} cy={y} r="10" fill={lit ? color : "#2b3441"} stroke="#111827" strokeWidth="2" />{lit ? <circle cx={x} cy={y} r="18" fill={color} opacity=".22" /> : null}</g>;
}

function TrafficHead({ x, y, red, yellow, green }: { x: number; y: number; red: boolean; yellow: boolean; green: boolean }) {
  return <g><rect x={x - 17} y={y - 38} width="34" height="80" rx="9" fill="#1c2736" stroke="#697a91" strokeWidth="3" /><Lamp x={x} y={y - 23} color="#ef4444" lit={red} /><Lamp x={x} y={y} color="#fbbf24" lit={yellow} /><Lamp x={x} y={y + 23} color="#22c55e" lit={green} /></g>;
}

function Field({ color = "#b4d681" }: { color?: string }) { return <rect width="600" height="360" fill={color} />; }

function traffic(s: Runtime) {
  return <><Field color="#8baa74" /><rect x="236" width="128" height="360" fill="#4a5565" /><rect y="118" width="600" height="124" fill="#4a5565" />
    {[258, 292, 326].map((x) => <g key={x}><rect x={x} y="20" width="7" height="28" fill="#f8fafc" /><rect x={x} y="305" width="7" height="28" fill="#f8fafc" /></g>)}
    {[25, 80, 480, 535].map((x) => <rect key={x} x={x} y="176" width="28" height="6" fill="#f8fafc" />)}
    {Array.from({ length: 6 }, (_, j) => <g key={j}><rect x={194 + j * 8} y="85" width="5" height="27" fill="#f8fafc" /><rect x={368 + j * 8} y="248" width="5" height="27" fill="#f8fafc" /></g>)}
    <TrafficHead x={200} y={75} red={on(s.gpio.NS_RED)} yellow={on(s.gpio.NS_YELLOW)} green={on(s.gpio.NS_GREEN)} />
    <TrafficHead x={405} y={285} red={on(s.gpio.EW_RED)} yellow={on(s.gpio.EW_YELLOW)} green={on(s.gpio.EW_GREEN)} />
    <rect x="280" y={60 + (s.time * (on(s.gpio.NS_GREEN) ? 20 : 2)) % 55} width="38" height="22" rx="7" fill="#e54e43" stroke="#fff" strokeWidth="2" />
    <rect x={90 + (s.time * (on(s.gpio.EW_GREEN) ? 22 : 2)) % 70} y="186" width="45" height="23" rx="7" fill="#3b82f6" stroke="#fff" strokeWidth="2" />
    <rect x="14" y="14" width="165" height="37" rx="9" fill="#102a43" opacity=".86" /><text x="28" y="38" fill="white" fontSize="15">{label(s.outputs.state).replaceAll("_", " ")}</text>
  </>;
}

function street(s: Runtime) {
  const night = n(s.inputs.ambient) < 350;
  return <><Field color={night ? "#233454" : "#86c7f0"} /><circle cx="490" cy="68" r="36" fill={night ? "#e4ebf5" : "#ffe181"} />
    <path d="M0 260 230 175h140l230 85v100H0" fill="#414d5b" />
    {[20, 93, 445, 520].map((x) => <g key={x}><rect x={x} y="148" width="5" height="140" fill="#344055" /><path d={`M${x + 2} 149q15-20 37-15`} stroke="#344055" strokeWidth="5" fill="none" /><ellipse cx={x + 40} cy="136" rx="9" ry="5" fill={on(s.outputs.lamp) ? "#fff1a2" : "#9aa8bb"} />{on(s.outputs.lamp) ? <ellipse cx={x + 40} cy="165" rx="38" ry="27" fill="#ffe98b" opacity=".23" /> : null}</g>)}
    {[70, 130, 390, 455].map((x) => <g key={x}><rect x={x} y="133" width="38" height="70" fill="#586579" /><rect x={x + 7} y="146" width="10" height="12" fill={night ? "#fcd98e" : "#bcdaf6"} /><rect x={x + 22} y="146" width="10" height="12" fill={night ? "#fcd98e" : "#bcdaf6"} /></g>)}
    <Board x={22} y={248} /><Wire d="M128 284 Q210 250 248 156" active={on(s.outputs.lamp)} color="#f59e0b" />
    <rect x="400" y="18" width="178" height="40" rx="9" fill="#102a43" opacity=".85" /><text x="414" y="43" fill="white" fontSize="15">{label(s.outputs.daypart)} · {on(s.outputs.lamp) ? "Lamps ON" : "Lamps OFF"}</text>
  </>;
}

function thermometer(s: Runtime) {
  return <><Field color="#e9eef1" /><rect y="268" width="600" height="92" fill="#bb8d61" /><rect x="35" y="86" width="85" height="155" rx="12" fill="#263140" /><rect x="45" y="95" width="65" height="40" rx="5" fill="#577895" /><text x="77" y="119" textAnchor="middle" fill="white" fontSize="12">LM35</text><rect x="52" y="240" width="5" height="29" fill="#f59e0b" /><rect x="74" y="240" width="5" height="29" fill="#111827" /><rect x="96" y="240" width="5" height="29" fill="#ef4444" />
    <Board x={213} y={157} /><Wire d="M57 257 H145 V232 H213" color="#f59e0b" /><Wire d="M100 257 H170 V256 H213" color="#ef4444" />
    <rect x="379" y="143" width="189" height="116" rx="9" fill="#14532d" stroke="#4b5563" strokeWidth="8" /><rect x="391" y="154" width="165" height="90" rx="4" fill="#bde87b" /><text x="474" y="186" textAnchor="middle" fill="#21421e" fontSize="14">Temperature</text><text x="474" y="217" textAnchor="middle" fill="#173c1a" fontSize="28" fontWeight="700">{label(s.outputs.temperature)} {label(s.inputs.unit)}</text><Wire d="M318 206 H375" color="#22c55e" />
    <circle cx="157" cy="85" r="44" fill="#fff" stroke="#b6c6d5" strokeWidth="6" /><rect x="151" y="59" width="12" height="48" rx="6" fill="#ef4444" /><circle cx="157" cy="103" r="13" fill="#ef4444" />
  </>;
}

function ultrasonic(s: Runtime) {
  const distance = n(s.inputs.distance); const objectX = 280 + distance / 200 * 260;
  return <><Field color="#eef2f5" /><rect y="264" width="600" height="96" fill="#bd936c" /><Board x={22} y={244} />
    <rect x="70" y="115" width="155" height="90" rx="12" fill="#1474ae" stroke="#0e4d74" strokeWidth="5" /><circle cx="113" cy="160" r="35" fill="#8898a7" stroke="#293d4b" strokeWidth="8" /><circle cx="183" cy="160" r="35" fill="#8898a7" stroke="#293d4b" strokeWidth="8" /><circle cx="113" cy="160" r="20" fill="#26394d" /><circle cx="183" cy="160" r="20" fill="#26394d" /><text x="147" y="194" textAnchor="middle" fill="white" fontSize="12">HC-SR04</text>
    {[20, 42, 66, 92].map((r) => <path key={r} d={`M${225 + r} ${160 - r * .55} Q${245 + r * 1.1} 160 ${225 + r} ${160 + r * .55}`} fill="none" stroke="#32b8ed" strokeWidth="2" opacity=".7" />)}
    <rect x={objectX} y="90" width="42" height="172" rx="3" fill="#a38a6c" stroke="#756348" strokeWidth="4" />
    <path d={`M225 234 H${objectX}`} stroke="#258bd2" strokeDasharray="8 6" strokeWidth="3" /><text x={(225 + objectX) / 2} y="225" textAnchor="middle" fill="#145484" fontWeight="700">{label(s.outputs.distance)} cm</text>
    <Wire d="M128 280 H180 V205" color="#f59e0b" /><circle cx="540" cy="43" r="22" fill={on(s.outputs.buzzer) ? "#ef4444" : "#aab8c6"} /><text x="540" y="49" textAnchor="middle" fill="white">♪</text>
  </>;
}

function irrigation(s: Runtime) {
  const zones = label(s.outputs.zones).split(",").map(Number);
  return <><Field color="#afd9ed" /><path d="M0 170 Q200 120 600 180V360H0" fill="#6d9e58" /><rect x="35" y="215" width="100" height="115" rx="8" fill="#357ba1" stroke="#1e4f70" strokeWidth="5" /><text x="85" y="272" textAnchor="middle" fill="white" fontSize="13">TANK</text>
    <path d="M130 300 H575 M210 300 V205 M363 300 V205 M516 300 V205" stroke="#1d6ca6" strokeWidth="12" fill="none" />
    {[0, 1, 2].map((z) => <g key={z}><rect x={157 + z * 150} y="207" width="120" height="120" rx="7" fill="#946c45" /><rect x={166 + z * 150} y="216" width="102" height="87" fill="#493b2c" />
      {[0, 1, 2].map((j) => <g key={j}><path d={`M${190 + z * 150 + j * 26} 267v-34`} stroke="#2f7d32" strokeWidth="4" /><path d={`M${190 + z * 150 + j * 26} 249q-19-15-17-24q18 0 17 24 M${190 + z * 150 + j * 26} 252q18-13 15-25q-17 2-15 25`} fill="#4da64d" /></g>)}
      {on(s.outputs.pump) && (zones[z] ?? 0) < n(s.inputs.offThreshold) ? <g>{[0, 1, 2].map((j) => <circle key={j} cx={189 + z * 150 + j * 26} cy={214 + (s.time * 18 + j * 14) % 25} r="4" fill="#5cc6ee" />)}</g> : null}
      <rect x={166 + z * 150} y="303" width="102" height="24" fill="#b98b57" /><text x={217 + z * 150} y="320" textAnchor="middle" fontSize="12" fill="#3d2b1d">{["Vegetables", "Herbs", "Flowers"][z]} {Math.round(zones[z] ?? 0)}%</text></g>)}
    <rect x="15" y="15" width="175" height="42" rx="8" fill="#102a43" opacity=".85" /><text x="30" y="42" fill="white">Pump {on(s.outputs.pump) ? "ON · 2.4 L/min" : "OFF"}</text>
  </>;
}

function robot(s: Runtime) {
  const x = 70 + n(s.outputs.x) * 455, y = 35 + n(s.outputs.y) * 270;
  const track = label(s.inputs.track); const path = track === "Oval" ? "M300 80 C515 80 515 280 300 280 C85 280 85 80 300 80" : track === "S curve" ? "M100 50 C500 80 90 260 500 315" : track === "Figure eight" ? "M300 180 C60 20 65 335 300 180 C535 20 535 335 300 180" : "M40 90 C480-20 100 240 560 130 C250 350 120 180 520 320";
  return <><Field color="#e7e9eb" /><path d={path} fill="none" stroke="#2d333a" strokeWidth="26" strokeLinecap="round" /><path d={path} fill="none" stroke="#151a1f" strokeWidth="16" strokeLinecap="round" />
    <g transform={`translate(${x} ${y}) rotate(${n(s.outputs.heading) * 55})`}><rect x="-32" y="-27" width="64" height="54" rx="10" fill="#2264b6" stroke="#153763" strokeWidth="4" /><rect x="-43" y="-21" width="12" height="42" rx="5" fill="#222831" /><rect x="31" y="-21" width="12" height="42" rx="5" fill="#222831" /><rect x="-16" y="-18" width="32" height="26" fill="#2b3441" /><circle cx="-16" cy="31" r="5" fill="#ef4444" /><circle cx="0" cy="31" r="5" fill={label(s.outputs.sensors).split(" ")[1] === "1" ? "#ef4444" : "#737d89"} /><circle cx="16" cy="31" r="5" fill="#ef4444" /></g>
    <rect x="15" y="15" width="163" height="63" rx="9" fill="#102a43" opacity=".87" /><text x="30" y="40" fill="white" fontSize="13">Track: {track}</text><text x="30" y="61" fill="white" fontSize="12">Lap {label(s.outputs.lap)} · {on(s.outputs.lost) ? "Line lost" : "Tracking"}</text>
  </>;
}

function motor(s: Runtime) {
  const angle = s.time * n(s.outputs.rpm) / 60 * 360;
  return <><Field color="#d1b293" /><Board x={25} y={165} /><Wire d="M130 208 H210" color="#e04a3e" /><Wire d="M130 245 H210" color="#f5bd29" />
    <rect x="210" y="174" width="112" height="88" rx="8" fill="#be3b35" stroke="#80291f" strokeWidth="4" /><rect x="239" y="189" width="53" height="52" rx="6" fill="#273343" /><text x="266" y="255" textAnchor="middle" fill="white" fontSize="13">H-BRIDGE</text>
    <Wire d="M322 205 H385" active={on(s.gpio.PA8)} color="#e04a3e" /><Wire d="M322 239 H385" active={on(s.gpio.PA8)} color="#1c6bbb" />
    <rect x="385" y="171" width="125" height="91" rx="28" fill="#a6b1bd" stroke="#687685" strokeWidth="5" /><path d="M403 184v63m15-66v69m15-70v72m15-70v70m15-70v70" stroke="#d8e0e8" strokeWidth="3" /><rect x="507" y="207" width="29" height="17" fill="#788b9a" />
    <g transform={`translate(545 215) rotate(${angle})`}><circle r="17" fill="#1b6cbd" /><path d="M-8-50 0-12 8-50Z M-8 50 0 12 8 50Z M-50-8-12 0-50 8Z M50-8 12 0 50 8Z" fill="#258ce1" /></g>
    <rect x="360" y="15" width="215" height="45" rx="8" fill="#1d2938" /><text x="376" y="43" fill="#81f574" fontSize="21" fontWeight="700">{label(s.outputs.rpm)} RPM</text>
  </>;
}

function arm(s: Runtime) {
  const shoulder = n(s.outputs.shoulder) * Math.PI / 180, elbow = (n(s.outputs.shoulder) - n(s.outputs.elbow)) * Math.PI / 180;
  const baseX = 410, baseY = 290; const x1 = baseX - 105 * Math.cos(shoulder), y1 = baseY - 105 * Math.sin(shoulder); const x2 = x1 - 96 * Math.cos(elbow), y2 = y1 - 96 * Math.sin(elbow);
  return <><Field color="#eef1f4" /><rect y="305" width="600" height="55" fill="#adb8c2" />
    <rect x="380" y="286" width="65" height="31" rx="10" fill="#222b36" /><ellipse cx="412" cy="288" rx="54" ry="17" fill="#f18a24" stroke="#60370f" strokeWidth="4" />
    <path d={`M${baseX} ${baseY} L${x1} ${y1} L${x2} ${y2}`} stroke="#513117" strokeWidth="30" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d={`M${baseX} ${baseY} L${x1} ${y1} L${x2} ${y2}`} stroke="#f29424" strokeWidth="21" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <circle cx={x1} cy={y1} r="19" fill="#263241" stroke="#fbb45a" strokeWidth="6" /><circle cx={x2} cy={y2} r="15" fill="#263241" stroke="#fbb45a" strokeWidth="5" />
    <path d={`M${x2} ${y2}v27 m0 0l-10 12 m10-12l10 12`} stroke="#303947" strokeWidth="9" strokeLinecap="round" fill="none" />
    <rect x={on(s.outputs.holding) ? x2 - 15 : on(s.outputs.placed) ? 166 : 105} y={on(s.outputs.holding) ? y2 + 35 : 263} width="45" height="42" rx="5" fill="#e84e47" /><rect x="163" y="266" width="43" height="39" rx="5" fill="#2c83d1" /><rect x="47" y="268" width="43" height="37" rx="5" fill="#31aa65" />
    <text x="20" y="35" fill="#193b60" fontWeight="700">End effector: {label(s.outputs.endX)} cm, {label(s.outputs.endY)} cm</text>
  </>;
}

function weather(s: Runtime) {
  const wind = n(s.inputs.wind), rain = n(s.inputs.rain);
  return <><Field color={rain > 4 ? "#8aa7ba" : "#87c4ea"} /><path d="M0 288 Q200 245 600 290V360H0" fill="#679d62" /><rect x="272" y="78" width="10" height="225" fill="#8294a3" /><rect x="230" y="205" width="93" height="70" rx="7" fill="#dde6ea" stroke="#6d8792" strokeWidth="4" /><text x="276" y="243" textAnchor="middle" fill="#2f5366">LOGGER</text>
    <path d="M277 95 H370" stroke="#6d8792" strokeWidth="7" /><path d="M370 95l-20-11v22Z" fill="#333d45" /><circle cx="277" cy="91" r="10" fill="#263645" /><g transform={`translate(277 91) rotate(${s.time * wind * 8})`}><path d="M0 0 L-16-20 0-16Z M0 0 L22-6 13 7Z M0 0 L-4 23 -12 12Z" fill="#e6edf1" /></g>
    <rect x="342" y="211" width="75" height="43" rx="4" fill="#1c649d" stroke="#d9e7ee" strokeWidth="4" /><path d="M353 218h53m-53 11h53m-53 11h53m-43-22v30m15-30v30" stroke="#82bdde" strokeWidth="2" />
    <path d="M160 115 Q168 90 185 100 Q193 78 220 90 Q238 80 250 105 Q270 105 270 125H160Z" fill="#f2f7f9" />
    {rain > 0 && Array.from({ length: Math.min(14, Math.ceil(rain)) }, (_, j) => <path key={j} d={`M${80 + j * 35} ${135 + j % 3 * 22}l-7 20`} stroke="#d7f0ff" strokeWidth="3" />)}
    <rect x="20" y="18" width="150" height="55" rx="9" fill="#fff" opacity=".91" /><text x="33" y="43" fill="#183a5a">Weather station</text><text x="33" y="63" fill="#178a50" fontSize="13">● Collecting data</text>
  </>;
}

function home(s: Runtime) {
  const rooms: Array<[string, number, number, number, number, string]> = [["Living", 30, 30, 244, 135, "living"], ["Bedroom", 300, 30, 245, 135, "bedroom"], ["Kitchen", 30, 192, 244, 135, "kitchen"], ["Garage", 300, 192, 245, 135, "garage"]];
  return <><Field color="#8fbd7c" />{rooms.map(([name, x, y, w, h, key]) => <g key={key}><rect x={x} y={y} width={w} height={h} fill={on(s.outputs[key]) ? "#fce9b8" : "#d5dee5"} stroke="#35485b" strokeWidth="9" /><circle cx={x + w / 2} cy={y + 34} r="13" fill={on(s.outputs[key]) ? "#ffcf53" : "#81909d"} />{on(s.outputs[key]) ? <circle cx={x + w / 2} cy={y + 34} r="35" fill="#ffcf53" opacity=".25" /> : null}<text x={x + 20} y={y + h - 20} fill="#243851" fontSize="16" fontWeight="700">{name}</text></g>)}
    <rect x="268" y="155" width="36" height="45" fill="#8b674b" /><text x="280" y="182" fill={on(s.outputs.lock) ? "#22c55e" : "#ef4444"} fontSize="22">{on(s.outputs.lock) ? "●" : "○"}</text>
    <rect x="402" y="251" width="81" height="38" rx="12" fill="#5d7183" /><circle cx="416" cy="289" r="10" fill="#1f2937" /><circle cx="469" cy="289" r="10" fill="#1f2937" />
  </>;
}

function iot(s: Runtime) {
  return <><Field color="#b5d6e3" /><path d="M0 260 Q250 190 600 265V360H0" fill="#6b9b54" /><rect x="280" y="63" width="18" height="285" fill="#836d56" /><rect x="222" y="112" width="136" height="158" rx="8" fill="#e3e7d9" stroke="#758a7f" strokeWidth="7" /><rect x="238" y="128" width="105" height="117" rx="5" fill="#2b3745" /><Board x={249} y={137} name="ESP32" />
    <rect x="159" y="30" width="82" height="55" fill="#286fa9" stroke="#e1e7ea" strokeWidth="5" /><path d="M174 34v45m16-45v45m16-45v45m16-45v45M162 51h75m-75 17h75" stroke="#70b7e0" strokeWidth="2" /><Wire d="M222 70 H197 V140 H239" color="#f59e0b" />
    <path d="M323 129q20-23 40 0m-46-8q27-34 54 0m-61-9q34-44 69 0" stroke={on(s.outputs.connected) ? "#28aae9" : "#9ba7af"} strokeWidth="4" fill="none" />
    <path d="M62 294v-66m0 0q-30-28-35-4q12 18 35 4m0 0q30-28 35-4q-12 18-35 4" stroke="#2c7b3e" fill="#59a957" strokeWidth="4" /><rect x="50" y="292" width="24" height="25" rx="4" fill="#293a43" />
    <rect x="395" y="28" width="185" height="135" rx="9" fill="#183851" /><text x="411" y="54" fill="white" fontSize="15">Local dashboard</text><text x="411" y="81" fill="#89d5ff" fontSize="13">Temperature {label(s.outputs.temperature)} °C</text><text x="411" y="106" fill="#89d5ff" fontSize="13">Moisture {label(s.outputs.moisture)}%</text><text x="411" y="131" fill={on(s.outputs.connected) ? "#6be68a" : "#fca5a5"} fontSize="13">{on(s.outputs.connected) ? "Connected" : "Offline · buffering"}</text>
  </>;
}

function builder(s: Runtime) {
  const modules = JSON.parse(String(s.memory.modules)) as string[];
  const has = (name: string) => modules.includes(name);
  const powered = s.memory.supply === true && s.memory.ground === true;
  return <><Field color="#d9c1a8" /><rect x="35" y="61" width="530" height="247" rx="10" fill="#f2f0e9" stroke="#bbc4c2" strokeWidth="5" />
    {Array.from({ length: 10 }, (_, j) => <g key={j}><circle cx={58 + j * 52} cy="74" r="3" fill="#768995" /><circle cx={58 + j * 52} cy="290" r="3" fill="#768995" /></g>)}
    <Board x={245} y={132} name={label(s.inputs.board)} />{(has("OLED") || has("LCD")) && <><rect x="36" y="115" width="102" height="57" rx="7" fill="#1c2937" stroke="#4789b4" strokeWidth="5" /><text x="46" y="137" fill="#8bddff" fontSize="12">MCU PROJECT</text><text x="46" y="155" fill="#8bddff" fontSize="10">{label(s.outputs.display).slice(0, 17)}</text><Wire d="M138 142 H200 V167 H245" color="#36a969" active={powered} /></>}
    {has("LED_GREEN") && <circle cx="188" cy="227" r="14" fill={on(s.outputs.green) ? "#23d45e" : "#66816a"} />}{has("LED_RED") && <><circle cx="225" cy="227" r="14" fill={on(s.outputs.red) ? "#f03434" : "#8f6868"} /><Wire d="M245 221 H225" color="#e34843" active={on(s.outputs.red)} /></>}
    {has("RELAY") && <><rect x="399" y="156" width="90" height="61" rx="8" fill="#1d73bb" stroke="#194e80" strokeWidth="5" /><rect x="412" y="167" width="63" height="39" rx="3" fill={on(s.outputs.relay) ? "#258bdb" : "#1c4e7a"} /><text x="444" y="192" textAnchor="middle" fill="white" fontSize="12">RELAY</text><Wire d="M350 190 H399" active={on(s.outputs.relay)} /></>}
    {has("BUTTON") && <><circle cx="86" cy="231" r="18" fill={on(s.inputs.button) ? "#c21e2a" : "#ec4747"} stroke="#5c2020" strokeWidth="5" /><text x="55" y="267" fill="#304456" fontSize="12">BUTTON</text></>}
    {has("BUZZER") && <><circle cx="527" cy="246" r="19" fill={on(s.outputs.buzzer) ? "#f7bc41" : "#7b8793"} /><text x="501" y="282" fill="#304456" fontSize="12">BUZZER</text></>}
    {has("SERVO") && <><rect x="43" y="205" width="65" height="28" rx="5" fill="#337ab7" /><path d={`M76 205l${Math.cos(n(s.outputs.servoAngle) * Math.PI / 180) * 23} ${-Math.sin(n(s.outputs.servoAngle) * Math.PI / 180) * 23}`} stroke="#263849" strokeWidth="8" /><text x="45" y="250" fontSize="12">SERVO</text></>}
    {has("DC_MOTOR") && <><circle cx="485" cy="109" r="20" fill="#8a9bab" /><g transform={`translate(485 109) rotate(${s.time * n(s.outputs.motorDuty) * 4})`}><path d="M-27 0H27M0-27V27" stroke="#235f9c" strokeWidth="8" /></g><text x="452" y="145" fontSize="12">MOTOR</text></>}
    {has("TEMP_SENSOR") && <text x="24" y="41" fontSize="12" fill="#234863">TEMP {label(s.outputs.temperature)} °C</text>}{has("DISTANCE_SENSOR") && <text x="160" y="41" fontSize="12" fill="#234863">DIST {label(s.outputs.distance)} cm</text>}{has("LIGHT_SENSOR") && <text x="295" y="41" fontSize="12" fill="#234863">LIGHT {label(s.outputs.light)} lux</text>}{has("POTENTIOMETER") && <text x="455" y="41" fontSize="12" fill="#234863">POT {label(s.outputs.potentiometer)}%</text>}
  </>;
}

export function ProjectScene({ id, state }: { id: ProjectId; state: Runtime }) {
  const views: Record<ProjectId, (s: Runtime) => React.ReactNode> = { traffic, street, thermometer, ultrasonic, irrigation, robot, motor, arm, weather, home, iot, builder };
  return <svg className="mcu-scene" viewBox="0 0 600 360" role="img" aria-label={`${id} simulation at ${state.time.toFixed(1)} seconds`}>{views[id](state)}</svg>;
}
