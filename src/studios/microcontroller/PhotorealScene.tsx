import type { ProjectId } from "./projectData";
import type { Runtime } from "./projectEngine";

const number = (value: unknown) => typeof value === "number" ? value : 0;
const active = (value: unknown) => value === true;
const display = (value: unknown) => String(value ?? "—");

function Badge({ label, value, position = "top-left", tone = "dark" }: { label: string; value: string; position?: string; tone?: string }) {
  return <div className={`mcu-photo-badge ${position} ${tone}`}><small>{label}</small><strong>{value}</strong></div>;
}

function Signals({ state }: { state: Runtime }) {
  const head = (prefix: "NS" | "EW", name: string, position: string) => <div className={`mcu-photo-signal ${position}`} aria-label={`${name} signal`}>
    <span className={active(state.gpio[`${prefix}_RED`]) ? "lit red" : ""} /><span className={active(state.gpio[`${prefix}_YELLOW`]) ? "lit amber" : ""} /><span className={active(state.gpio[`${prefix}_GREEN`]) ? "lit green" : ""} />
  </div>;
  return <>{head("NS", "North South", "signal-ns")}{head("EW", "East West", "signal-ew")}</>;
}

export function PhotorealScene({ id, state }: { id: ProjectId; state: Runtime }) {
  const o = state.outputs, i = state.inputs;
  const brightness = number(o.brightness);
  const targetDistance = Math.max(0, number(o.rawDistance ?? i.distance));
  const targetPosition = 43 + 47 * (1 - Math.exp(-targetDistance / 55));
  return <div className={`mcu-photo-scene mcu-photo-${id}`} role="img" aria-label={`${id} live simulation at ${state.time.toFixed(1)} seconds`}>
    <img src={`/mcu-project-scenes/${id === "robot" ? i.track === "Oval" ? "robot-oval" : i.track === "S curve" ? "robot-s" : "robot-track" : id === "motor" ? "motor-bench" : id === "ultrasonic" ? "ultrasonic-bench" : id}.png`} alt="" draggable={false} style={id === "street" ? { filter: `brightness(${Math.max(.6, Math.min(1.12, .6 + number(i.ambient) / 1000 * .5))})` } : undefined} />
    {id === "traffic" && <><Signals state={state} /><Badge label="CURRENT PHASE" value={display(o.state).replaceAll("_", " ")} /><Badge label="NEXT TRANSITION" value={`${display(o.remaining)} s`} position="top-right" /></>}
    {id === "street" && <><div className="mcu-street-glow glow-near" style={{ opacity: brightness / 100 }} /><div className="mcu-street-glow glow-far" style={{ opacity: brightness / 100 }} /><Badge label="AMBIENT LIGHT" value={`${display(i.ambient)} lux`} /><Badge label="STREET LIGHTS" value={active(o.lamp) ? `${display(o.brightness)}% ON` : "OFF"} position="top-right" tone={active(o.lamp) ? "green" : "dark"} /></>}
    {id === "thermometer" && <><div className="mcu-photo-lcd"><small>Temperature</small><strong>{display(o.temperature)} {display(i.unit)}</strong></div><Badge label="ROOM TEMPERATURE" value={`${display(i.environment)} °C`} /></>}
    {id === "ultrasonic" && <><div className="mcu-sonar-waves" style={{ opacity: o.echoQuality === "Valid" ? 1 : .18 }}><span /><span /><span /></div><img className="mcu-ultrasonic-target" src="/mcu-project-scenes/ultrasonic-upright-target.png" alt="" draggable={false} style={{ left: `${targetPosition}%`, transform: `translateX(-50%) scale(${Math.max(.55, 1.25 - targetDistance / 350)})` }} /><div className="mcu-sonar-measure"><span>←────────→</span><strong>{display(o.distance)} cm</strong></div><Badge label="ECHO" value={display(o.echoQuality)} position="top-right" tone={o.echoQuality === "Valid" ? "green" : "dark"} /></>}
    {id === "irrigation" && <><Badge label="WATER PUMP" value={active(o.pump) ? `ON · ${display(o.flow)} L/min` : "OFF"} tone={active(o.pump) ? "green" : "dark"} /><div className="mcu-zone-overlay">{display(o.zones).split(",").map((value, index) => <div key={index} className={active(o.pump) && Number(value) < number(i.offThreshold) ? "watering" : ""}><small>ZONE {index + 1}</small><strong>{Math.round(Number(value))}%</strong></div>)}</div></>}
    {id === "robot" && <><img className="mcu-robot-sprite" src="/mcu-project-scenes/robot-cutout.png" alt="" draggable={false} style={{ left: `${number(o.trackX) * 100}%`, top: `${number(o.trackY) * 100}%`, transform: `translate(-50%, -50%) rotate(${number(o.trackHeading)}deg)` }} /><Badge label="TRACK" value={display(i.track)} /><Badge label="ROBOT" value={`${display(o.velocity)} cm/s · Lap ${display(o.lap)}`} position="top-right" /></>}
    {id === "motor" && <><Badge label="DC MOTOR" value={`${display(o.rpm)} RPM`} tone={active(o.fault) ? "red" : "dark"} /><Badge label="H-BRIDGE" value={display(o.direction)} position="top-right" /><img className="mcu-motor-fan" src="/mcu-project-scenes/motor-fan.png" alt="" draggable={false} style={{ transform: `translate(-50%, -50%) rotate(${state.time * number(o.rpm) * (i.direction === "Reverse" ? -6 : 6)}deg)`, filter: number(o.rpm) > 1000 ? "blur(1.5px) drop-shadow(0 2px 3px #0007)" : "drop-shadow(0 2px 3px #0007)" }} /></>}
    {id === "arm" && <><Badge label="END EFFECTOR" value={`X ${display(o.endX)} · Y ${display(o.endY)} cm`} /><Badge label="GRIPPER" value={active(o.holding) ? "HOLDING OBJECT" : active(o.placed) ? "OBJECT PLACED" : `${display(o.gripper)}% open`} position="top-right" tone={active(o.holding) ? "green" : "dark"} /><div className="mcu-arm-joint shoulder">Shoulder {display(o.shoulder)}°</div><div className="mcu-arm-joint elbow">Elbow {display(o.elbow)}°</div><div className="mcu-arm-joint base">Base {display(o.base)}°</div><div className="mcu-arm-joint wrist">Wrist {display(o.wrist)}°</div></>}
    {id === "weather" && <><Badge label="WEATHER STATION" value={state.running ? "● Collecting data" : "● Ready"} /><Badge label="WIND" value={`${display(o.wind)} km/h`} position="top-right" /><div className="mcu-weather-rain" style={{ opacity: Math.min(.8, number(o.rainRate) / 20) }} /></>}
    {id === "home" && <><div className={`mcu-room-light living ${active(o.living) ? "on" : ""}`} /><div className={`mcu-room-light bedroom ${active(o.bedroom) ? "on" : ""}`} /><div className={`mcu-room-light kitchen ${active(o.kitchen) ? "on" : ""}`} /><div className={`mcu-room-light garage ${active(o.garage) ? "on" : ""}`} /><Badge label="HOME MODE" value={display(i.mode)} /><Badge label="SECURITY" value={active(o.intrusion) ? "DOOR ALERT" : active(o.lock) ? "LOCKED" : "UNLOCKED"} position="top-right" tone={active(o.intrusion) ? "red" : "green"} /></>}
    {id === "iot" && <><Badge label="ESP32 NODE" value={active(o.connected) ? "● Connected" : "● Offline"} tone={active(o.connected) ? "green" : "red"} /><Badge label="BATTERY" value={`${display(o.battery)} V`} position="top-right" /><div className={`mcu-wifi-beacon ${active(o.connected) ? "connected" : ""}`}>◔</div></>}
    {id === "builder" && <><div className="mcu-builder-screen"><small>MY MCU PROJECT</small><strong>{display(o.temperature)}°C · {display(o.distance)} cm</strong><span>{o.warning ? "CHECK WIRING" : "RUNNING"}</span></div><div className={`mcu-builder-led green ${active(o.green) ? "on" : ""}`} /><div className={`mcu-builder-led red ${active(o.red) ? "on" : ""}`} /><Badge label="BOARD" value={display(i.board)} position="top-right" /></>}
  </div>;
}
