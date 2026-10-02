import type { ProjectId } from "./projectData";
import type { Runtime } from "./projectEngine";

const n = (v: unknown, fallback = 0) => typeof v === "number" && Number.isFinite(v) ? v : fallback;
const yes = (v: unknown) => v === true || v === 1;
const clip = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const r = (v: number, digits = 1) => Number(v.toFixed(digits));

export function prepareEnhancements(id: ProjectId, s: Runtime, dt: number): Record<string, number> {
  const i = s.inputs, m = s.memory;
  if (id === "street") {
    const hysteresis = n(i.hysteresis), bias = n(i.sensorBias);
    const sensed = clip(n(i.ambient) + bias + (yes(m.lastLamp) ? -hysteresis : hysteresis), 0, 1000);
    m.sensedLux = sensed;
    return { LDR: sensed, light: sensed };
  }
  if (id === "thermometer") {
    const raw = n(i.environment) + n(i.calibration) + n(i.sensorNoise) * Math.sin(s.time * 19.37);
    const samples = [...((m.tempSamples as number[] | undefined) ?? [])];
    if (dt || samples.length === 0) samples.push(raw); else samples[samples.length - 1] = raw;
    m.tempSamples = samples.slice(-10);
    const window = clip(Math.round(n(i.filterWindow, 1)), 1, 10);
    const recent = (m.tempSamples as number[]).slice(-window);
    const filtered = r(recent.reduce((sum, v) => sum + v, 0) / recent.length, 2);
    m.previousTemp = m.filteredTemp; m.filteredTemp = filtered;
    if (dt || n(m.sampleCount) === 0) m.sampleCount = n(m.sampleCount) + 1;
    return { temperature: yes(i.sensorDisconnected) ? 0 : filtered };
  }
  if (id === "ultrasonic") {
    const distance = clip(n(i.distance) + n(i.targetSpeed) * s.time, 0, 400);
    const random = Math.abs(Math.sin(Math.floor(s.time * 10 + 1) * 12.9898));
    m.effectiveDistance = distance;
    m.echoDropped = random * 100 < n(i.echoDropout);
    return { distance };
  }
  if (id === "irrigation") return { moisture: clip(n(i.moisture) + n(i.zoneBias), 0, 100) };
  if (id === "builder" && yes(i.analogFault)) return { temperature: 0, distance: 0 };
  return {};
}

export function applyEnhancements(id: ProjectId, s: Runtime, previous: Runtime, dt: number): void {
  const i = s.inputs, o = s.outputs, g = s.gpio, m = s.memory;
  if (id === "traffic") {
    let ns = n(m.nsQueue), ew = n(m.ewQueue), passed = n(m.throughput);
    if (dt) { ns += n(i.nsDemand) * dt / 60; ew += n(i.ewDemand) * dt / 60;
      if (o.state === "NS_GREEN") { const moved = Math.min(ns, 1.4 * dt); ns -= moved; passed += moved; }
      if (o.state === "EW_GREEN") { const moved = Math.min(ew, 1.4 * dt); ew -= moved; passed += moved; }
    }
    Object.assign(m, { nsQueue: ns, ewQueue: ew, throughput: passed });
    Object.assign(o, { nsQueue: r(ns, 1), ewQueue: r(ew, 1), throughput: Math.floor(passed), walkCountdown: yes(o.pedestrianWalk) ? n(o.remaining) : 0,
      safety: yes(i.detectorFault) ? "Detector fault · all red" : yes(i.nightFlash) ? "Night flash" : g.NS_GREEN && g.EW_GREEN ? "Conflict blocked" : "Interlock safe" });
  }
  if (id === "street") {
    const relay = yes(g.PB5), brightness = relay && !yes(i.lampFault) ? yes(i.occupancy) ? 100 : n(i.dimLevel, 35) : 0;
    const power = r(.6 * brightness / 100, 3);
    m.energyWh = n(m.energyWh) + power * dt / 3600;
    if (dt && previous.gpio.PB5 !== g.PB5) m.relayCycles = n(m.relayCycles) + 1;
    m.lastLamp = relay;
    Object.assign(o, { lamp: brightness > 0, brightness, power, energyWh: r(n(m.energyWh), 4), relayCycles: n(m.relayCycles), ldrVoltage: r(n(m.sensedLux) / 1000 * 3.3, 2),
      lampHealth: yes(i.lampFault) ? "Failed" : !relay ? "Off" : brightness < 100 ? "Dimmed" : "Operating" });
  }
  if (id === "thermometer") {
    const filtered = n(m.filteredTemp), disconnected = yes(i.sensorDisconnected);
    const state = disconnected ? "Sensor fault" : filtered < n(i.lowAlarm) ? "Low" : yes(o.alarm) ? "High" : "Normal";
    if (disconnected) { o.temperature = "Sensor error"; o.alarm = false; g.PC13 = false; }
    else if (state === "Low") { o.alarm = true; g.PC13 = true; }
    Object.assign(o, { filteredTemp: disconnected ? "—" : filtered, tempTrend: r(filtered - n(m.previousTemp, filtered), 2), sampleCount: n(m.sampleCount), alarmState: state, sensorHealth: disconnected ? "Disconnected" : "Connected" });
  }
  if (id === "ultrasonic") {
    const raw = n(m.effectiveDistance), blind = raw < n(i.blindZone), dropped = yes(m.echoDropped), valid = !blind && !dropped && n(o.triggerUs) > 0;
    const samples = [...((m.echoSamples as number[] | undefined) ?? [])];
    if (valid) { if (dt || samples.length === 0) samples.push(raw); else samples[samples.length - 1] = raw; }
    m.echoSamples = samples.slice(-8);
    if (dt && !valid && n(o.triggerUs) > 0) m.timeoutCount = n(m.timeoutCount) + 1;
    const recent = (m.echoSamples as number[]).slice(-clip(Math.round(n(i.averaging, 1)), 1, 8));
    const filtered = recent.length ? r(recent.reduce((sum, v) => sum + v, 0) / recent.length) : 0;
    if (valid) m.closestSeen = Math.min(n(m.closestSeen, raw), raw);
    o.distance = valid ? filtered : 0;
    o.echoUs = valid ? o.echoUs : 0;
    o.alert = valid && (filtered < n(i.alert) || yes(previous.outputs.alert) && filtered < n(i.alert) + n(i.alertHysteresis));
    o.buzzer = yes(i.buzzer) && yes(o.alert); g.PA5 = yes(o.buzzer);
    Object.assign(o, { rawDistance: r(raw), filteredDistance: filtered, echoQuality: n(o.triggerUs) === 0 ? "Idle" : blind ? "Blind zone" : dropped ? "Dropped" : "Valid", timeoutCount: n(m.timeoutCount), closestSeen: m.closestSeen === undefined ? "—" : r(n(m.closestSeen)) });
  }
  if (id === "irrigation") {
    const used = n(m.water) + (yes(i.leak) ? s.time * .005 : 0);
    const tank = clip(n(i.reservoir) - used * 10, 0, 100);
    const zones = (m.zones as number[] | undefined) ?? [0, 0, 0];
    const min = Math.min(...zones), selected = zones.indexOf(min);
    Object.assign(o, { activeValve: yes(o.pump) ? ["Vegetables", "Herbs", "Flowers"][selected] : "Closed", tankRemaining: r(tank), usedToday: r(used, 2), dryRun: tank <= 0, leakRate: yes(i.leak) ? .3 : 0 });
  }
  if (id === "robot") {
    const left = n(o.leftPWM), right = n(o.rightPWM);
    const velocity = (left + right) / 510 * 20;
    m.encoderTicks = n(m.encoderTicks) + velocity * dt * 3;
    if (n(o.lap) > n(previous.outputs.lap)) m.lapStart = s.time;
    Object.assign(o, { velocity: r(velocity), encoderTicks: Math.floor(n(m.encoderTicks)), lapTime: r(s.time - n(m.lapStart)), steering: Math.round(right - left),
      recovery: yes(i.emergencyStop) ? "Emergency stop" : yes(i.obstacle) ? "Obstacle stop" : yes(o.lost) ? "Searching" : "Tracking" });
  }
  if (id === "motor") {
    const ambient = n(i.ambientTemp), current = n(o.current), cooling = n(i.cooling) / 100;
    const temperature = clip(n(m.motorTemp, ambient) + dt * (current * current * 2 - (n(m.motorTemp, ambient) - ambient) * (.06 + cooling * .14)), ambient, 200);
    m.motorTemp = temperature;
    const reason = yes(i.brake) ? "Dynamic brake" : current > n(i.currentLimit) ? "Overcurrent" : temperature > n(i.thermalLimit) ? "Overheat" : yes(o.fault) ? "Stall" : "Normal";
    if (reason !== "Normal") { o.rpm = 0; m.rpm = 0; g.PA8 = false; o.fault = reason !== "Dynamic brake"; }
    m.energyWh = n(m.energyWh) + n(i.voltage) * current * dt / 3600;
    Object.assign(o, { motorTemp: r(temperature), backEmf: r(n(o.rpm) / 5000 * n(i.voltage), 2), efficiency: reason === "Normal" ? r(clip(65 + n(o.rpm) / 5000 * 20 - n(i.load) * .2, 0, 90)) : 0, energyWh: r(n(m.energyWh), 4), tripReason: reason });
  }
  if (id === "arm") {
    const reach = Math.hypot(n(o.endX), n(o.endY)), torque = n(i.payload) / 1000 * 9.81 * reach / 100;
    if (yes(o.placed) && !yes(previous.outputs.placed)) m.pickCycles = n(m.pickCycles) + 1;
    const collision = n(o.endY) < 1 ? "Table contact" : "Clear";
    Object.assign(o, { reach: r(reach), servoPulse: o.pulseMs, loadTorque: r(torque, 2), collision, pickCycles: n(m.pickCycles) });
  }
  if (id === "weather") {
    const t = n(i.temperature), rh = clip(n(i.humidity), 1, 100), wind = n(i.wind) + (yes(i.stormFront) ? 25 : 0);
    const gamma = Math.log(rh / 100) + 17.625 * t / (243.04 + t);
    const dew = 243.04 * gamma / (17.625 - gamma);
    const heat = t + (rh - 40) * Math.max(0, t - 26) * .035;
    const chill = t <= 10 && wind > 4.8 ? 13.12 + .6215 * t - 11.37 * wind ** .16 + .3965 * t * wind ** .16 : t;
    o.wind = r(wind); o.pressure = r(n(i.seaPressure) - (yes(i.stormFront) ? 24 : 0) - n(i.rain) * .3 - wind * .04);
    Object.assign(o, { dewPoint: r(dew), heatIndex: r(heat), windChill: r(chill), rainRate: r(n(i.rain) + (yes(i.stormFront) ? 8 : 0)),
      weatherAlert: yes(i.stormFront) ? "Storm" : t >= n(i.alertTemp) ? "Heat" : wind >= n(i.alertWind) ? "Wind" : n(i.uvIndex) >= 8 ? "High UV" : "Normal" });
  }
  if (id === "home") {
    const firmwareActive = (m.firmwareTrace as string[] | undefined)?.some((entry) => entry.includes("automateHome("));
    const thermostat = firmwareActive && n(i.indoorTemp) > n(i.setpoint) && i.mode !== "Away";
    if (thermostat && !yes(o.fan)) { o.fan = true; g.PB3 = true; o.active = n(o.active) + 1; o.power = n(o.power) + 70; }
    if (firmwareActive && yes(i.autoLock) && i.mode === "Away") { o.lock = true; g.PB5 = true; }
    const appliance = firmwareActive && yes(i.appliance) ? 120 : 0;
    o.power = n(o.power) + appliance; o.active = n(o.active) + (appliance ? 1 : 0);
    m.energyWh = n(m.energyWh) + n(o.power) * dt / 3600;
    Object.assign(o, { intrusion: yes(i.doorOpen) && i.mode === "Away", thermostat, appliancePower: appliance, energyWh: r(n(m.energyWh), 3), occupied: i.mode !== "Away" || yes(i.motion) });
  }
  if (id === "iot") {
    const battery = clip(n(m.battery) + n(i.solarInput) * dt / 360000, 3.3, 4.2);
    m.battery = r(battery, 4); o.battery = m.battery as number;
    const payload = i.payloadMode === "Compact" ? { t: i.temperature, m: i.moisture } : JSON.parse(String(o.payload)) as Record<string, unknown>;
    o.payload = JSON.stringify(payload);
    Object.assign(o, { retryCount: n(m.retryCount), queueDepth: n(m.buffered), payloadBytes: String(o.payload).length, uptime: r(s.time),
      powerMode: yes(i.sleep) ? "Deep sleep" : battery <= n(i.lowBattery) ? "Conserve" : "Active" });
  }
  if (id === "builder") {
    const modules = JSON.parse(String(m.modules)) as string[], pins = JSON.parse(String(m.pins)) as Record<string, string>;
    const assigned = modules.map((item) => pins[item]).filter(Boolean), duplicates = assigned.length - new Set(assigned).size;
    const current = (yes(o.green) ? 12 : 0) + (yes(o.red) ? 12 : 0) + (yes(o.relay) ? 70 : 0) + (yes(o.buzzer) ? 25 : 0) + (n(o.motorDuty) > 0 ? 250 * n(o.motorDuty) / 100 : 0) + (modules.includes("OLED") ? 20 : 0);
    const drop = current / 1000 * n(i.wireResistance), over = current > n(i.maxCurrent), brownout = n(i.supplyVoltage) - drop < 2.7;
    if (over || brownout) { o.warning = over ? `Current budget exceeded: ${Math.round(current)} mA` : n(i.supplyVoltage) < 2.7 ? "Supply voltage is too low for this board." : "Wire voltage drop caused a brown-out."; o.green = false; o.red = false; o.relay = false; for (const pin of Object.keys(s.gpio)) s.gpio[pin] = false; }
    if (yes(i.debugBreak) && dt) s.running = false;
    Object.assign(o, { estimatedCurrent: Math.round(current), voltageDrop: r(drop, 2), pinConflicts: duplicates, connectedCount: assigned.length,
      debugState: yes(i.debugBreak) && dt ? "Breakpoint" : s.running ? "Running" : "Paused" });
  }
}
