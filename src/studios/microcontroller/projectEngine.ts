import type { ProjectDef, ProjectId } from "./projectData";
import { compileFirmware, executeFirmware, type FirmwareProgram } from "./firmware";
import { enhancementDefaults } from "./projectEnhancements";
import { applyEnhancements, prepareEnhancements } from "./enhancementEngine";

export type Value = number | string | boolean;
export type InputMap = Record<string, Value | undefined>;
export type Sample = { time: number; values: Record<string, number> };
export type Diagnostic = { line: number; message: string };
export type Command = { name: string; args: string[]; line: number };
export type Program = FirmwareProgram;
export type Runtime = {
  running: boolean; time: number; inputs: InputMap; outputs: Record<string, Value | undefined>; gpio: Record<string, boolean>;
  memory: Record<string, unknown>; history: Sample[]; logs: string[];
  program: Program; lastSample: number; diagnostics: Diagnostic[];
};

const number = (v: unknown, fallback = 0) => typeof v === "number" && Number.isFinite(v) ? v : fallback;
const bool = (v: unknown) => v === true || v === 1;
const string = (v: unknown, fallback = "") => typeof v === "string" ? v : fallback;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round = (v: number, digits = 1) => Number(v.toFixed(digits));
const log = (state: Runtime, message: string) => { state.logs = [`${state.time.toFixed(1)} s · ${message}`, ...state.logs].slice(0, 40); };
const constant = (program: Program, key: string, fallback: number) => program.constants[key] ?? fallback;
const lastCommand = (program: Program, name: string, pin?: string) => [...program.commands].reverse().find((item) => item.name === name && (pin === undefined || item.args[0] === pin));

export function compileProjectCode(source: string): { program?: Program; diagnostics: Diagnostic[] } {
  return compileFirmware(source);
}

function argument(program: Program, command: string, index: number, fallback: number, env: Record<string, number> = {}): number {
  const call = lastCommand(program, command);
  const expr = call?.args[index];
  if (!expr) return fallback;
  if (expr === "true") return 1;
  if (expr === "false") return 0;
  if (Object.hasOwn(program.constants, expr)) return program.constants[expr] ?? fallback;
  if (Object.hasOwn(env, expr)) return env[expr] ?? fallback;
  const n = Number(expr);
  return Number.isFinite(n) ? n : fallback;
}

function evaluate(expression: string, program: Program, environment: Record<string, number>): number {
  const source = expression.replace(/\b(readTemperature|readDistance|digitalRead|analogRead)\s*\(\s*([A-Z_]*)\s*\)/g, (_, method: string, pin: string) => {
    if (method === "readTemperature") return String(environment.temperature ?? 0);
    if (method === "readDistance") return String(environment.distance ?? 0);
    if (method === "digitalRead") return String(environment[pin] ?? 0);
    return String(environment[pin] ?? 0);
  });
  const tokens = source.match(/\d+(?:\.\d+)?|[A-Za-z_]\w*|&&|\|\||<=|>=|==|!=|[()+*/<>-]/g) ?? [];
  let cursor = 0;
  const precedence: Record<string, number> = { "||": 1, "&&": 2, "==": 3, "!=": 3, "<": 3, ">": 3, "<=": 3, ">=": 3, "+": 4, "-": 4, "*": 5, "/": 5 };
  const primary = (): number => {
    const token = tokens[cursor++];
    if (token === "(") { const result = parse(0); if (tokens[cursor] === ")") cursor++; return result; }
    if (token === "-") return -primary();
    if (token === "true") return 1;
    if (token === "false") return 0;
    if (token && Object.hasOwn(environment, token)) return environment[token] ?? 0;
    if (token && Object.hasOwn(program.constants, token)) return program.constants[token] ?? 0;
    const n = Number(token);
    return Number.isFinite(n) ? n : 0;
  };
  const parse = (minimum: number): number => {
    let left = primary();
    while (cursor < tokens.length) {
      const op = tokens[cursor] ?? "", rank = precedence[op];
      if (!rank || rank < minimum) break;
      cursor++;
      const right = parse(rank + 1);
      switch (op) {
        case "+": left += right; break; case "-": left -= right; break; case "*": left *= right; break; case "/": left = right ? left / right : 0; break;
        case "<": left = Number(left < right); break; case ">": left = Number(left > right); break; case "<=": left = Number(left <= right); break; case ">=": left = Number(left >= right); break; case "==": left = Number(left === right); break; case "!=": left = Number(left !== right); break; case "&&": left = Number(Boolean(left) && Boolean(right)); break; case "||": left = Number(Boolean(left) || Boolean(right)); break;
      }
    }
    return left;
  };
  const result = parse(0);
  return Number.isFinite(result) ? result : 0;
}

function callValue(program: Program, name: string, index: number, env: Record<string, number>, fallback: number): number {
  const expr = lastCommand(program, name)?.args[index];
  return expr === undefined ? fallback : evaluate(expr, program, env);
}

function initialInputs(def: ProjectDef, program: Program): InputMap {
  const defaults: Record<ProjectId, InputMap> = {
    traffic: { greenTime: 8, yellowTime: 2, mode: "Auto", pedestrian: false, emergency: false },
    street: { ambient: 180, threshold: 300, mode: "Auto", override: false },
    thermometer: { environment: 25, sensor: "LM35", unit: "°C", alarm: 40 },
    ultrasonic: { distance: 45, alert: 30, temperature: 20, buzzer: true },
    irrigation: { zone: "Vegetables", moisture: 18, onThreshold: 30, offThreshold: 50, weather: "Sunny", mode: "Auto", override: false },
    robot: { track: "Figure eight", speed: 70, control: "PID", kp: 0.6, ki: 0, kd: 0.3 },
    motor: { duty: 60, voltage: 12, load: 20, direction: "Forward", acceleration: 2 },
    arm: { base: 90, shoulder: 45, elbow: 60, wrist: 20, gripper: 80 },
    weather: { temperature: 25, humidity: 55, wind: 12, rain: 0, light: 700, logging: true },
    home: { mode: "Home", ambient: 250, motion: false, hour: 19, schedule: "None", living: true, bedroom: false, kitchen: true, fan: true, lock: true, garage: false },
    iot: { temperature: 25, humidity: 56, moisture: 68, light: 780, rssi: -67, sample: 5, transmit: 15, sleep: false },
    builder: { board: "STM32", temperature: 25, distance: 18, light: 600, pot: 80, button: false },
  };
  const inputs = { ...defaults[def.id], ...enhancementDefaults(def.id) };
  if (def.id === "traffic") Object.assign(inputs, { greenTime: constant(program, "GREEN_TIME", 8), yellowTime: constant(program, "YELLOW_TIME", 2) });
  if (def.id === "street") inputs.threshold = constant(program, "LDR_THRESHOLD", 300);
  if (def.id === "thermometer") inputs.alarm = constant(program, "ALARM_TEMP", 40);
  if (def.id === "ultrasonic") inputs.alert = constant(program, "ALERT_DISTANCE", 30);
  if (def.id === "irrigation") Object.assign(inputs, { onThreshold: constant(program, "MOISTURE_ON", 30), offThreshold: constant(program, "MOISTURE_OFF", 50) });
  if (def.id === "robot") Object.assign(inputs, { kp: constant(program, "KP", 0.6), ki: constant(program, "KI", 0), kd: constant(program, "KD", 0.3) });
  if (def.id === "motor") inputs.duty = argument(program, "analogWrite", 1, constant(program, "PWM_DUTY", 60));
  if (def.id === "arm") {
    const servoKeys = ["base", "shoulder", "elbow", "wrist", "gripper"];
    for (const key of servoKeys) {
      const call = lastCommand(program, "servo_write", key.toUpperCase());
      if (call) inputs[key] = argument({ ...program, commands: [call] }, "servo_write", 1, number(inputs[key]));
    }
  }
  if (def.id === "iot") Object.assign(inputs, { sample: constant(program, "SAMPLE_INTERVAL", 5), transmit: constant(program, "TRANSMIT_INTERVAL", 15) });
  return inputs;
}

export function createRuntime(def: ProjectDef, program: Program): Runtime {
  const state: Runtime = { running: false, time: 0, inputs: initialInputs(def, program), outputs: {}, gpio: {}, memory: {}, history: [], logs: [], program, lastSample: -Infinity, diagnostics: [] };
  if (def.id === "irrigation") state.memory.zones = [18, 62, 35];
  if (def.id === "traffic") state.memory.trafficState = "NS_GREEN";
  if (def.id === "robot") Object.assign(state.memory, { x: 0.5, y: 0.3, heading: 0, integral: 0, lastError: 0, lap: 0 });
  if (def.id === "arm") Object.assign(state.memory, { pose: [90, 45, 60, 20, 80], recordedPoses: "[]", playing: false, playIndex: 0, playElapsed: 0, holding: false, placed: false });
  if (def.id === "iot") Object.assign(state.memory, { battery: 4.1, packets: 0, lost: 0, buffered: 0, lastTransmit: 0 });
  if (def.id === "builder") Object.assign(state.memory, { modules: JSON.stringify(["LED_GREEN", "LED_RED", "BUTTON", "RELAY", "BUZZER", "OLED", "TEMP_SENSOR", "DISTANCE_SENSOR"]), pins: JSON.stringify({ LED_GREEN: "PA4", LED_RED: "PA5", BUTTON: "PC13", RELAY: "PB1", BUZZER: "PB0", OLED: "PB7", TEMP_SENSOR: "PA1", DISTANCE_SENSOR: "PA2" }), ground: true, supply: true });
  return advanceRuntime(def, state, 0);
}

export function updateInput(def: ProjectDef, previous: Runtime, key: string, value: Value): Runtime {
  const state = { ...previous, inputs: { ...previous.inputs, [key]: value }, memory: { ...previous.memory }, outputs: { ...previous.outputs }, gpio: { ...previous.gpio }, logs: [...previous.logs] };
  if (def.id === "irrigation" && key === "moisture") {
    const zones = [...(state.memory.zones as number[])];
    zones[["Vegetables", "Herbs", "Flowers"].indexOf(string(state.inputs.zone))] = number(value);
    state.memory.zones = zones;
  }
  if (def.id === "home" && ["living", "bedroom", "kitchen", "fan", "lock", "garage"].includes(key)) state.inputs.mode = "Custom";
  return advanceRuntime(def, state, 0);
}

export function advanceRuntime(def: ProjectDef, previous: Runtime, dt: number): Runtime {
  const s: Runtime = { ...previous, time: round(previous.time + dt, 3), inputs: { ...previous.inputs }, outputs: { ...previous.outputs }, gpio: { ...previous.gpio }, memory: { ...previous.memory }, history: [...previous.history], logs: [...previous.logs] };
  const i = s.inputs, o = s.outputs, g = s.gpio, m = s.memory;
  if (def.id === "arm" && bool(m.playing) && dt) {
    const poses = JSON.parse(string(m.recordedPoses, "[]")) as number[][];
    const elapsed = number(m.playElapsed) + dt;
    if (poses.length) {
      const index = Math.min(poses.length - 1, Math.floor(elapsed / 1.5));
      ["base", "shoulder", "elbow", "wrist", "gripper"].forEach((key, n) => { i[key] = poses[index]?.[n] ?? i[key]; });
      m.playIndex = index + 1; m.playElapsed = elapsed;
      if (elapsed >= poses.length * 1.5) { m.playing = false; log(s, "Pose sequence complete"); }
    } else m.playing = false;
  }
  const sensorOverrides = prepareEnhancements(def.id, s, dt);
  const sensors: Record<string, number> = {
    temperature: number(i.environment ?? i.temperature), distance: number(i.distance), moisture: number(i.moisture), humidity: number(i.humidity), light: number(i.ambient ?? i.light),
    LDR: number(i.ambient), BUTTON: Number(bool(i.button)), MOTION: Number(bool(i.motion)), POT: number(i.pot), AMBIENT: number(i.light),
    GREEN_TIME: number(i.greenTime), YELLOW_TIME: number(i.yellowTime), LDR_THRESHOLD: number(i.threshold), ALARM_TEMP: number(i.alarm), ALERT_DISTANCE: number(i.alert),
    MOISTURE_ON: number(i.onThreshold), MOISTURE_OFF: number(i.offThreshold), KP: number(i.kp), KI: number(i.ki), KD: number(i.kd), PWM_DUTY: number(i.duty),
    BASE_ANGLE: number(i.base), SHOULDER_ANGLE: number(i.shoulder), ELBOW_ANGLE: number(i.elbow), WRIST_ANGLE: number(i.wrist), GRIPPER_OPEN: number(i.gripper),
  };
  Object.assign(sensors, sensorOverrides);
  if (typeof i.sample === "number") sensors.SAMPLE_INTERVAL = i.sample;
  if (typeof i.transmit === "number") sensors.TRANSMIT_INTERVAL = i.transmit;
  const firmware = executeFirmware(s.program, sensors, (m.firmwareVars as Record<string, number>) ?? {}, s.time, !bool(m.firmwareInitialized));
  if (firmware.error) { s.diagnostics = [{ line: 0, message: firmware.error }]; s.running = false; o.warning = firmware.error; return s; }
  if (dt || !bool(m.firmwareInitialized)) m.firmwareVars = firmware.variables;
  if (dt || !bool(m.firmwareInitialized)) m.firmwareTicks = number(m.firmwareTicks) + 1;
  m.firmwareTrace = firmware.commands.map((command) => `L${command.line} ${command.name}(${command.args.join(", ")})`);
  m.firmwareInitialized = true; s.diagnostics = [];
  const p: Program = { ...s.program, commands: firmware.commands };
  const called = (name: string) => p.commands.some((command) => command.name === name);
  if (dt) for (const command of p.commands) if (["serialPrint", "Serial.print", "Serial.println"].includes(command.name)) log(s, `Serial: ${command.args.join(", ")}`);
  if (def.id === "traffic") {
    const order = ["NS_GREEN", "NS_YELLOW", "ALL_RED_NS", "EW_GREEN", "EW_YELLOW", "ALL_RED_EW"];
    const greenTime = clamp(callValue(p, "trafficCycle", 0, { GREEN_TIME: number(i.greenTime, 8) }, number(i.greenTime, 8)), 1, 60);
    const yellowTime = clamp(callValue(p, "trafficCycle", 1, { YELLOW_TIME: number(i.yellowTime, 2) }, number(i.yellowTime, 2)), 1, 20);
    const imbalance = bool(i.adaptive) ? clamp((number(m.nsQueue) - number(m.ewQueue)) * .3, -3, 3) : 0;
    const durations = [clamp(greenTime + imbalance, 1, 60), yellowTime, constant(p, "ALL_RED_TIME", 1), clamp(greenTime - imbalance, 1, 60), yellowTime, constant(p, "ALL_RED_TIME", 1)];
    const cycle = durations.reduce((sum, v) => sum + v, 0);
    let t = s.time % cycle, index = 0;
    while (index < order.length - 1 && t >= (durations[index] ?? 1)) t -= durations[index++] ?? 1;
    const state = !called("trafficCycle") || bool(i.emergency) || bool(i.detectorFault) ? "ALL_RED" : bool(i.nightFlash) ? "FLASH_YELLOW" : string(i.mode) === "Manual" ? string(m.trafficState, "NS_GREEN") : order[index] ?? "NS_GREEN";
    if (bool(i.pedestrian) && state.startsWith("ALL_RED")) o.pedestrianWalk = true; else o.pedestrianWalk = false;
    const currentIndex = Math.max(0, order.indexOf(state));
    o.state = state; o.remaining = round(bool(i.emergency) ? 0 : string(i.mode) === "Manual" ? durations[currentIndex] ?? 1 : (durations[index] ?? 1) - t); o.next = order[(currentIndex + 1) % order.length] ?? "NS_GREEN";
    g.NS_GREEN = state === "NS_GREEN"; g.NS_YELLOW = state === "NS_YELLOW" || state === "FLASH_YELLOW" && Math.floor(s.time * 2) % 2 === 0; g.NS_RED = !g.NS_GREEN && !g.NS_YELLOW;
    g.EW_GREEN = state === "EW_GREEN"; g.EW_YELLOW = state === "EW_YELLOW" || state === "FLASH_YELLOW" && Math.floor(s.time * 2) % 2 === 0; g.EW_RED = !g.EW_GREEN && !g.EW_YELLOW;
    if (previous.outputs.state !== state) log(s, `Signal state: ${state.replaceAll("_", " ")}`);
  }
  if (def.id === "street") {
    const on = string(i.mode) === "Manual" ? bool(i.override) : called("setLamp") && Boolean(callValue(p, "setLamp", 0, {}, 0));
    o.ldr = Math.round(number(m.sensedLux, number(i.ambient)) / 1000 * 4095); o.lamp = on; o.power = on ? 0.6 : 0; o.daypart = number(i.ambient) < 100 ? "Night" : number(i.ambient) < 350 ? "Dusk" : number(i.ambient) < 700 ? "Afternoon" : "Day"; g.PB5 = on;
    if (previous.outputs.lamp !== on) log(s, `Street lamps ${on ? "ON" : "OFF"}`);
  }
  if (def.id === "thermometer") {
    const actual = number(i.environment); const voltage = actual * .01; const adc = Math.round(clamp(voltage / 3.3, 0, 1) * 4095);
    const shown = round(callValue(p, "displayTemperature", 0, {}, actual)); o.actual = actual; o.temperature = called("displayTemperature") ? string(i.unit) === "°F" ? round(shown * 9 / 5 + 32) : shown : "Display off"; o.celsius = shown; o.voltage = round(voltage, 3); o.adc = string(i.sensor) === "LM35" ? adc : "Digital"; o.alarm = called("displayTemperature") && shown >= number(i.alarm); g.PC13 = bool(o.alarm);
    m.min = Math.min(number(m.min, shown), shown); m.max = Math.max(number(m.max, shown), shown);
  }
  if (def.id === "ultrasonic") {
    const speed = 331.3 + 0.606 * number(i.temperature); const pulse = round(number(m.effectiveDistance, number(i.distance)) / 100 * 2 / speed * 1e6, 0);
    o.echoUs = called("measureDistance") ? pulse : 0; o.distance = called("measureDistance") ? round(pulse * speed / 2 / 1e4) : 0; o.triggerUs = called("measureDistance") ? callValue(p, "measureDistance", 0, {}, 10) : 0; o.alert = called("measureDistance") && number(o.distance) < number(i.alert); o.buzzer = bool(i.buzzer) && bool(o.alert); g.PA1 = called("measureDistance") && s.time % 0.1 < number(o.triggerUs) / 1e6; g.PA2 = called("measureDistance") && s.time % 0.1 < pulse / 1e6; g.PA5 = bool(o.buzzer);
  }
  if (def.id === "irrigation") {
    const zones = [...(m.zones as number[])]; const selected = ["Vegetables", "Herbs", "Flowers"].indexOf(string(i.zone)); const on = callValue(p, "controlIrrigation", 0, { MOISTURE_ON: number(i.onThreshold) }, number(i.onThreshold)), off = callValue(p, "controlIrrigation", 1, { MOISTURE_OFF: number(i.offThreshold) }, number(i.offThreshold)); const badHysteresis = off <= on;
    let pump = string(i.mode) === "Manual" ? bool(i.override) : called("controlIrrigation") && (zones.some((v) => v + number(i.zoneBias) < on) || (bool(m.pump) && zones.some((v) => v + number(i.zoneBias) < off)));
    const manual = string(i.mode) === "Manual";
    const minimumRun = Math.max(0, constant(p, "MIN_RUN_TIME", 3));
    if (bool(m.pump) && !pump && !manual && s.time - number(m.pumpStarted) < minimumRun) pump = true;
    if ((string(i.weather) === "Rain" || Math.abs(Math.sin(s.time * .11 + 1)) * 100 < number(i.rainChance)) && !manual) pump = false;
    if (number(i.reservoir) - number(m.water) * 10 <= 0 || number(m.water) >= number(i.waterBudget)) pump = false;
    if (pump && !bool(m.pump)) m.pumpStarted = s.time;
    if (dt) { const evaporation = string(i.weather) === "Sunny" ? .045 : .02; for (let z = 0; z < 3; z++) zones[z] = round(clamp((zones[z] ?? 0) + dt * (pump && (zones[z] ?? 0) < off ? .8 : -evaporation), 0, 100), 2); m.zones = zones; m.water = round(number(m.water) + (pump ? dt * .04 : 0), 2); }
    i.moisture = zones[selected] ?? 0; o.moisture = zones[selected] ?? 0; o.zones = zones.join(","); o.pump = pump; o.flow = pump ? 2.4 : 0; o.water = number(m.water); o.warning = badHysteresis ? "OFF threshold must exceed ON threshold; pump may chatter." : ""; g.PB0 = pump; m.pump = pump;
    if (previous.outputs.pump !== pump) log(s, `Pump ${pump ? "ON" : "OFF"}`);
  }
  if (def.id === "robot") {
    let x = number(m.x, .5), y = number(m.y, .3), heading = number(m.heading);
    const track = string(i.track), curvature = track === "Oval" ? .25 : track === "S curve" ? .32 : track === "Figure eight" ? .48 : .72;
    const desired = .5 + curvature * .27 * Math.sin(y * (track === "Figure eight" ? 11 : 6)); const error = desired - x + number(i.irNoise) / 100 * .08 * Math.sin(s.time * 21);
    const kp = number(i.kp), ki = number(i.ki), kd = number(i.kd);
    const integral = clamp(number(m.integral) + error * dt, -1, 1);
    const derivative = dt > 0 ? (error - number(m.lastError)) / dt : 0;
    const correction = string(i.control) === "PID" ? kp * error + ki * integral + kd * derivative * .03 : Math.sign(error) * .16;
    const leftBase = called("setMotorSpeed") ? argument(p, "setMotorSpeed", 0, 0) : 0, rightBase = called("setMotorSpeed") ? argument(p, "setMotorSpeed", 1, 0) : 0;
    const power = number(i.robotBattery) / 100;
    const halted = bool(i.obstacle) || bool(i.emergencyStop);
    const left = called("setMotorSpeed") && !halted ? clamp((leftBase * number(i.speed) / 70 - correction * 120) * power, 0, 255) : 0;
    const right = called("setMotorSpeed") && !halted ? clamp((rightBase * number(i.speed) / 70 + correction * 120) * power, 0, 255) : 0;
    if (dt && (left > 0 || right > 0)) { heading += (right - left) / 255 * dt * 2 + Math.sin(y * 4) * .02 * dt; x = clamp(x + Math.sin(heading) * dt * .18, .04, .96); y += Math.cos(heading) * dt * .13; if (y > 1) y -= 1; }
    const previousPhase = number(m.visualPhase);
    const phase = previousPhase + (left + right) / 510 * dt * .9;
    m.visualPhase = phase; m.lap = Math.floor(phase / (Math.PI * 2));
    const theta = phase % (Math.PI * 2);
    const visual = track === "Oval" ? { x: .5 + .36 * Math.cos(theta), y: .5 + .29 * Math.sin(theta), dx: -.36 * Math.sin(theta), dy: .29 * Math.cos(theta) }
      : track === "S curve" ? { x: .5 + .3 * Math.sin(theta), y: .16 + .68 * theta / (Math.PI * 2), dx: .3 * Math.cos(theta), dy: .68 / (Math.PI * 2) }
      : { x: .5 + .37 * Math.sin(theta), y: .49 - .31 * Math.sin(2 * theta), dx: .37 * Math.cos(theta), dy: -.62 * Math.cos(2 * theta) };
    Object.assign(m, { x, y, heading, integral, lastError: error });
    o.x = round(x, 3); o.y = round(y, 3); o.heading = round(heading, 2); o.trackX = round(visual.x, 3); o.trackY = round(visual.y, 3); o.trackHeading = round(Math.atan2(visual.dx, -visual.dy) * 180 / Math.PI, 1); o.error = round(error, 3); o.leftPWM = Math.round(left); o.rightPWM = Math.round(right); o.lap = number(m.lap); o.lost = Math.abs(error) > .23 * number(i.lineContrast) / 100;
    o.sensors = [x < desired - .035, Math.abs(x - desired) <= .055, x > desired + .035].map((v) => v ? 1 : 0).join(" "); g.PB0 = left > 0; g.PB1 = right > 0;
  }
  if (def.id === "motor") {
    const duty = called("analogWrite") ? clamp(argument(p, "analogWrite", 1, 0), 0, 100) : 0;
    const target = duty / 100 * number(i.voltage) / 12 * 5000 * (1 - number(i.load) / 140); const fault = number(i.load) > 90 && duty > 85;
    const desired = fault ? 0 : target; const tau = Math.max(.15, number(i.acceleration)); const rpm = number(m.rpm) + (desired - number(m.rpm)) * (dt ? Math.min(1, dt / tau) : 0);
    m.rpm = rpm; o.rpm = Math.round(rpm); o.target = Math.round(target); o.current = round(duty / 100 * (.15 + number(i.load) / 100 * 1.3), 2); o.fault = fault; o.averageVoltage = round(number(i.voltage) * duty / 100); o.duty = duty; o.frequency = Math.max(1, constant(p, "PWM_FREQUENCY", 1000)); o.direction = i.direction; g.PA8 = duty > 0 && !fault; g.PB0 = i.direction === "Forward"; g.PB1 = i.direction === "Reverse";
  }
  if (def.id === "arm") {
    const keys = ["base", "shoulder", "elbow", "wrist", "gripper"]; const pose = [...(m.pose as number[])];
    keys.forEach((key, n) => { const command = lastCommand(p, "servo_write", key.toUpperCase()); const target = clamp(command ? number(Number(command.args[1])) : pose[n] ?? number(i[key]), 0, number(i.softLimit, 180)); pose[n] = (pose[n] ?? target) + (target - (pose[n] ?? target)) * (dt && !bool(i.armStop) ? Math.min(1, dt * 2.4 * number(i.motionSpeed, 60) / 60) : 0); o[key] = Math.round(pose[n] ?? target); g[`PWM${n + 1}`] = Boolean(command) && !bool(i.armStop); }); m.pose = pose;
    const sh = (pose[1] ?? 45) * Math.PI / 180, el = ((pose[1] ?? 45) - (pose[2] ?? 60)) * Math.PI / 180;
    const nearObject = Math.abs(number(o.base) - 45) < 28 && Math.abs(number(o.shoulder) - 115) < 35;
    if (nearObject && number(i.gripper) < 35 && number(i.gripForce) >= number(i.payload) / 5 && !bool(m.placed)) { if (!bool(m.holding)) log(s, "Gripper picked up the object"); m.holding = true; }
    if (number(i.gripper) > 65 && bool(m.holding)) { m.holding = false; m.placed = true; log(s, "Gripper released the object"); }
    o.endX = round(10 * Math.cos(sh) + 9 * Math.cos(el)); o.endY = round(10 * Math.sin(sh) + 9 * Math.sin(el)); o.pulseMs = round(1 + (pose[0] ?? 90) / 180, 2); o.holding = bool(m.holding); o.placed = bool(m.placed); o.sequence = `${number(m.playIndex)} / ${(JSON.parse(string(m.recordedPoses, "[]")) as number[][]).length}`;
  }
  if (def.id === "weather") {
    o.temperature = constant(p, "TEMP_SENSOR", 1) ? i.temperature : "Disabled"; o.humidity = constant(p, "HUMIDITY_SENSOR", 1) ? i.humidity : "Disabled"; o.wind = constant(p, "WIND_SENSOR", 1) ? i.wind : "Disabled"; o.rain = i.rain; o.light = i.light; o.pressure = round(1013 - number(i.rain) * .3 - number(i.wind) * .04); o.sampleInterval = called("sampleWeather") ? callValue(p, "sampleWeather", 0, {}, 2) : 0; o.sensorCount = ["TEMP_SENSOR", "HUMIDITY_SENSOR", "WIND_SENSOR"].filter((key) => constant(p, key, 1) !== 0).length; g.PC13 = bool(i.logging) && called("sampleWeather");
  }
  if (def.id === "home") {
    const mode = string(i.mode); const dark = number(i.ambient) < callValue(p, "automateHome", 0, {}, 300); const useMotion = callValue(p, "automateHome", 1, {}, 1) !== 0;
    const hour = number(i.hour), scheduled = string(i.schedule) === "Evening 18–23" ? hour >= 18 && hour < 23 : string(i.schedule) === "Night 23–06" ? hour >= 23 || hour < 6 : false;
    const living = !called("automateHome") ? false : mode === "Custom" ? bool(i.living) : mode === "Away" ? false : mode === "Night" ? false : dark || scheduled || (useMotion && bool(i.motion));
    const bedroom = called("automateHome") && (mode === "Custom" ? bool(i.bedroom) : mode === "Night");
    const kitchen = called("automateHome") && (mode === "Custom" ? bool(i.kitchen) : mode === "Home" && dark);
    const fan = called("automateHome") && (mode === "Custom" ? bool(i.fan) : mode === "Home");
    const garage = called("automateHome") && (mode === "Custom" ? bool(i.garage) : mode === "Home" && bool(i.motion));
    const lock = called("automateHome") && (mode === "Custom" ? bool(i.lock) : mode !== "Home");
    Object.assign(o, { living, bedroom, kitchen, fan, garage, lock, motion: i.motion, mode, scheduled, power: (living ? 12 : 0) + (bedroom ? 12 : 0) + (kitchen ? 12 : 0) + (garage ? 15 : 0) + (fan ? 70 : 0), active: [living, bedroom, kitchen, garage, fan].filter(Boolean).length });
    [living, bedroom, kitchen, fan, garage, lock].forEach((value, n) => { g[`PB${n}`] = value; });
    if (previous.outputs.power !== o.power) log(s, `Home devices now draw ${o.power} W`);
  }
  if (def.id === "iot") {
    const sample = Math.max(.2, callValue(p, "publishMQTT", 0, {}, number(i.sample)));
    const baseTransmit = Math.max(.2, callValue(p, "publishMQTT", 1, {}, number(i.transmit)));
    const transmit = baseTransmit * (bool(i.sleep) ? 3 : number(m.battery, 4.1) <= number(i.lowBattery) ? 2 : 1), rssi = number(i.rssi); const connected = rssi > -95;
    if (dt) { m.battery = round(clamp(number(m.battery, 4.1) - dt * (bool(i.sleep) ? .00001 : .00009), 3.3, 4.2), 4); }
    const payload = i.payloadMode === "Compact" ? { t: i.temperature, m: i.moisture } : { ...(constant(p, "SEND_TEMPERATURE", 1) ? { temperature: i.temperature } : {}), ...(constant(p, "SEND_MOISTURE", 1) ? { moisture: i.moisture } : {}), humidity: i.humidity, light: i.light };
    if (called("publishMQTT") && (bool(m.forceTransmit) || dt && s.time - number(m.lastTransmit) >= transmit)) {
      m.forceTransmit = false;
      m.lastTransmit = s.time;
      const injectedLoss = Math.abs(Math.sin(s.time * 11.31)) * 100 < number(i.packetLoss);
      let success = connected && (rssi > -80 || Math.floor(s.time / transmit) % 3 !== 0) && !injectedLoss;
      if (!success && connected && number(i.retryLimit) > 0) { m.retryCount = number(m.retryCount) + number(i.retryLimit); success = rssi > -100 && number(i.packetLoss) < 50; }
      if (success) { m.packets = number(m.packets) + 1; m.buffered = 0; log(s, `Telemetry delivered: ${JSON.stringify(payload)}`); }
      else { m.lost = number(m.lost) + 1; m.buffered = number(m.buffered) + 1; log(s, "Packet buffered: weak or unavailable signal"); }
    }
    Object.assign(o, { temperature: i.temperature, humidity: i.humidity, moisture: i.moisture, light: i.light, payload: JSON.stringify(payload), rssi, connected, battery: number(m.battery), packets: number(m.packets), lost: number(m.lost), buffered: number(m.buffered), sampleInterval: sample, transmitInterval: transmit, nextTransmit: round(Math.max(0, transmit - (s.time - number(m.lastTransmit)))) }); g.GPIO2 = connected && !bool(i.sleep);
  }
  if (def.id === "builder") {
    const modules = JSON.parse(String(m.modules)) as string[]; const pins = JSON.parse(String(m.pins)) as Record<string, string>;
    const used = modules.map((module) => pins[module]).filter(Boolean); const duplicates = used.filter((pin, index) => used.indexOf(pin) !== index);
    const unwired = modules.find((module) => !pins[module]);
    const valid = bool(m.ground) && bool(m.supply) && number(i.supplyVoltage) >= 2.7 && duplicates.length === 0 && !unwired;
    const env = { temperature: modules.includes("TEMP_SENSOR") && !bool(i.analogFault) ? number(i.temperature) : 0, distance: modules.includes("DISTANCE_SENSOR") && !bool(i.analogFault) ? number(i.distance) : 0, BUTTON: Number(modules.includes("BUTTON") && bool(i.button)), AMBIENT: modules.includes("LIGHT_SENSOR") ? number(i.light) : 0, POT: modules.includes("POTENTIOMETER") ? number(i.pot) : 0, TEMP_LIMIT: constant(p, "TEMP_LIMIT", 30), DISTANCE_LIMIT: constant(p, "DISTANCE_LIMIT", 20) };
    const greenCall = lastCommand(p, "digitalWrite", "LED_GREEN");
    const redCall = lastCommand(p, "digitalWrite", "LED_RED");
    const green = valid && modules.includes("LED_GREEN") && Boolean(greenCall ? evaluate(greenCall.args[1] ?? "0", p, env) : 0);
    const red = valid && modules.includes("LED_RED") && Boolean(redCall ? evaluate(redCall.args[1] ?? "0", p, env) : 0);
    const relay = valid && modules.includes("RELAY") && Boolean(callValue(p, "relayWrite", 1, env, 0));
    const warning = !bool(m.ground) ? "Connect ground to complete the circuit." : !bool(m.supply) ? "Connect the supply rail." : number(i.supplyVoltage) < 2.7 ? "Supply voltage is too low for this board." : unwired ? `Assign a GPIO pin to ${unwired.replaceAll("_", " ")}.` : duplicates.length ? `GPIO conflict: ${duplicates[0]} is assigned more than once.` : bool(i.analogFault) ? "Analog sensors are disconnected." : "";
    const servoCall = lastCommand(p, "servo_write", "SERVO");
    const motorCall = lastCommand(p, "analogWrite", "DC_MOTOR");
    const servo = valid && modules.includes("SERVO") ? clamp(servoCall ? evaluate(servoCall.args[1] ?? "90", p, env) : number(i.pot) * 1.8, 0, 180) : 0;
    const motor = valid && modules.includes("DC_MOTOR") ? clamp(motorCall ? evaluate(motorCall.args[1] ?? "0", p, env) : number(i.pot), 0, 100) : 0;
    Object.assign(o, { green, red, relay, buzzer: valid && modules.includes("BUZZER") && red, temperature: env.temperature, distance: env.distance, light: env.AMBIENT, potentiometer: env.POT, servoAngle: servo, motorDuty: motor, display: (modules.includes("OLED") || modules.includes("LCD")) && valid ? `${env.temperature} °C  ·  ${env.distance} cm` : "Display disconnected", board: i.board, warning, activeModules: modules.length });
    s.gpio = {};
    for (const module of modules) if (pins[module]) s.gpio[pins[module]] = module === "LED_GREEN" ? green : module === "LED_RED" ? red : module === "RELAY" ? relay : module === "BUZZER" ? bool(o.buzzer) : module === "SERVO" ? servo > 0 : module === "DC_MOTOR" ? motor > 0 : module === "BUTTON" ? bool(i.button) : false;
    if (previous.outputs.green !== green || previous.outputs.red !== red || previous.outputs.relay !== relay) log(s, `Outputs: green ${green ? "ON" : "OFF"}, red ${red ? "ON" : "OFF"}, relay ${relay ? "ON" : "OFF"}`);
  }
  applyEnhancements(def.id, s, previous, dt);
  const interval = def.id === "weather" ? Math.max(.2, number(o.sampleInterval, 2)) : def.id === "iot" ? Math.max(.2, number(o.sampleInterval, 5)) : 1;
  if (dt && (def.id !== "weather" || bool(i.logging) && called("sampleWeather")) && (def.id !== "iot" || called("publishMQTT")) && s.time - s.lastSample >= interval - .0001) {
    const values: Record<string, number> = {};
    for (const [key, value] of Object.entries(o)) if (typeof value === "number") values[key] = value;
    s.history = [...s.history, { time: s.time, values }].slice(-90); s.lastSample = s.time;
    if (def.id === "builder") log(s, `Serial: temp=${o.temperature}°C distance=${o.distance}cm button=${bool(i.button) ? 1 : 0} LEDs=${bool(o.green) ? 1 : 0}/${bool(o.red) ? 1 : 0}`);
  }
  return s;
}
