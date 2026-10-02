import { describe, expect, it } from "vitest";
import { PROJECT_LABS } from "./projectData";
import { advanceRuntime, compileProjectCode, createRuntime, updateInput } from "./projectEngine";
import { PROJECT_ENHANCEMENTS } from "./projectEnhancements";

function run(number: number, change?: [string, string]) {
  const def = PROJECT_LABS.find((lab) => lab.number === number)!;
  const code = change ? def.code.replace(change[0], change[1]) : def.code;
  const result = compileProjectCode(code);
  expect(result.diagnostics).toEqual([]);
  return { def, state: createRuntime(def, result.program!) };
}

describe("Microcontroller project code controls the simulator", () => {
  it("61 changes traffic green duration and keeps opposing greens exclusive", () => {
    const original = run(61).state, edited = run(61, ["GREEN_TIME 8", "GREEN_TIME 3"]).state;
    expect(original.inputs.greenTime).toBe(8);
    expect(edited.inputs.greenTime).toBe(3);
    const moved = advanceRuntime(run(61, ["GREEN_TIME 8", "GREEN_TIME 3"]).def, { ...edited, running: true }, 3.1);
    expect(moved.outputs.state).toBe("NS_YELLOW");
    expect(moved.gpio.NS_GREEN && moved.gpio.EW_GREEN).toBe(false);
  });
  it("61 accepts a literal duration in the firmware API", () => {
    const { def, state } = run(61, ["trafficCycle(GREEN_TIME, YELLOW_TIME)", "trafficCycle(3, YELLOW_TIME)"]);
    expect(advanceRuntime(def, state, 3.1).outputs.state).toBe("NS_YELLOW");
  });
  it("62 changes the lamp switching threshold", () => {
    const a = run(62), b = run(62, ["LDR_THRESHOLD 300", "LDR_THRESHOLD 100"]);
    expect(a.state.outputs.lamp).toBe(true);
    expect(b.state.outputs.lamp).toBe(false);
  });
  it("63 changes temperature conversion", () => {
    expect(run(63).state.outputs.temperature).toBe(25);
    expect(run(63, ["TEMP_SCALE 100", "TEMP_SCALE 120"]).state.outputs.temperature).toBe(30);
  });
  it("64 changes obstacle alert threshold", () => {
    expect(run(64).state.outputs.buzzer).toBe(false);
    expect(run(64, ["ALERT_DISTANCE 30", "ALERT_DISTANCE 60"]).state.outputs.buzzer).toBe(true);
  });
  it("65 changes pump start threshold", () => {
    const a = run(65), b = run(65, ["MOISTURE_ON 30", "MOISTURE_ON 10"]);
    expect(a.state.outputs.pump).toBe(true);
    expect(b.state.outputs.pump).toBe(false);
  });
  it("66 changes motor command and robot wheel output", () => {
    const a = run(66), b = run(66, ["setMotorSpeed(150, 150)", "setMotorSpeed(100, 220)"]);
    expect(a.state.outputs.leftPWM).not.toBe(b.state.outputs.leftPWM);
    expect(a.state.outputs.rightPWM).not.toBe(b.state.outputs.rightPWM);
    expect(advanceRuntime(b.def, b.state, 1).outputs.x).not.toBe(a.state.outputs.x);
  });
  it("66 moves the rendered robot along the selected track and stops at an obstacle", () => {
    const { def, state } = run(66);
    const moving = advanceRuntime(def, state, 1);
    expect(moving.outputs.trackX).not.toBe(state.outputs.trackX);
    const stopped = updateInput(def, moving, "obstacle", true);
    const later = advanceRuntime(def, stopped, 1);
    expect(later.outputs.trackX).toBe(stopped.outputs.trackX);
    expect(later.outputs.trackY).toBe(stopped.outputs.trackY);
    const oval = updateInput(def, state, "track", "Oval");
    expect(oval.outputs.trackX).not.toBe(state.outputs.trackX);
  });
  it("67 changes PWM and motor target RPM", () => {
    expect(run(67).state.outputs.target).toBeGreaterThan(run(67, ["PWM_DUTY 60", "PWM_DUTY 30"]).state.outputs.target as number);
  });
  it("68 changes commanded servo pose", () => {
    const a = run(68), b = run(68, ["BASE_ANGLE 90", "BASE_ANGLE 160"]);
    expect(advanceRuntime(b.def, b.state, 1).outputs.base).not.toBe(advanceRuntime(a.def, a.state, 1).outputs.base);
  });
  it("69 changes sampling frequency", () => {
    const a = run(69), b = run(69, ["SAMPLE_INTERVAL 2", "SAMPLE_INTERVAL 1"]);
    expect(a.state.outputs.sampleInterval).toBe(2);
    expect(b.state.outputs.sampleInterval).toBe(1);
  });
  it("70 changes home automation rule", () => {
    const a = run(70), b = run(70, ["DARK_THRESHOLD 300", "DARK_THRESHOLD 100"]);
    expect(a.state.outputs.living).toBe(true);
    expect(b.state.outputs.living).toBe(false);
  });
  it("71 changes telemetry interval", () => {
    expect(run(71).state.outputs.transmitInterval).toBe(15);
    expect(run(71, ["TRANSMIT_INTERVAL 15", "TRANSMIT_INTERVAL 5"]).state.outputs.transmitInterval).toBe(5);
  });
  it("72 changes custom firmware output", () => {
    const a = run(72), b = run(72, ["DISTANCE_LIMIT 20", "DISTANCE_LIMIT 10"]);
    expect(a.state.outputs.red).toBe(true);
    expect(b.state.outputs.red).toBe(false);
    expect(updateInput(b.def, b.state, "distance", 6).outputs.red).toBe(true);
  });
  it("reports the source line and retains the previous valid runtime", () => {
    const result = compileProjectCode("void loop() {\n  unsupported(1);\n}");
    expect(result.program).toBeUndefined();
    expect(result.diagnostics[0]?.line).toBe(2);
  });
  it("holds the irrigation pump for the programmed minimum run time", () => {
    const { def, state } = run(65);
    const wet = advanceRuntime(def, { ...advanceRuntime(def, state, 1), memory: { ...state.memory, zones: [90, 90, 90], pump: true, pumpStarted: 0 } }, 0);
    expect(wet.outputs.pump).toBe(true);
    expect(advanceRuntime(def, wet, 3).outputs.pump).toBe(false);
  });
  it("replays recorded arm poses and carries a closed gripper object", () => {
    const { def, state } = run(68);
    const recorded = { ...state, memory: { ...state.memory, recordedPoses: JSON.stringify([[45, 115, 95, 30, 15], [135, 80, 55, 40, 80]]), playing: true, playIndex: 0, playElapsed: 0 } };
    const picked = advanceRuntime(def, recorded, 1);
    expect(picked.outputs.holding).toBe(true);
    const placed = advanceRuntime(def, picked, 2);
    expect(placed.outputs.placed).toBe(true);
    expect(placed.memory.playing).toBe(false);
  });
  it("pauses weather logging and honors disabled firmware sensors", () => {
    const { def, state } = run(69, ["TEMP_SENSOR 1", "TEMP_SENSOR 0"]);
    expect(state.outputs.temperature).toBe("Disabled");
    const disabled = updateInput(def, state, "logging", false);
    expect(advanceRuntime(def, disabled, 5).history).toHaveLength(0);
  });
  it("switches manual home controls to Custom and applies schedules", () => {
    const { def, state } = run(70);
    const manual = updateInput(def, state, "bedroom", true);
    expect(manual.inputs.mode).toBe("Custom");
    expect(manual.outputs.bedroom).toBe(true);
    const bright = updateInput(def, state, "ambient", 800);
    const scheduled = updateInput(def, bright, "schedule", "Evening 18–23");
    expect(scheduled.outputs.living).toBe(true);
  });
  it("uses firmware flags to shape IoT telemetry", () => {
    const { state } = run(71, ["SEND_TEMPERATURE 1", "SEND_TEMPERATURE 0"]);
    expect(String(state.outputs.payload)).not.toContain("temperature");
    expect(String(state.outputs.payload)).toContain("moisture");
  });
  it("sends an IoT packet immediately when requested while paused", () => {
    const { def, state } = run(71);
    const sent = advanceRuntime(def, { ...state, memory: { ...state.memory, forceTransmit: true } }, 0);
    expect(sent.outputs.packets).toBe(1);
    expect(sent.memory.forceTransmit).toBe(false);
  });
  it("validates capstone power, wiring, and GPIO conflicts", () => {
    const { def, state } = run(72);
    const unpowered = advanceRuntime(def, { ...state, memory: { ...state.memory, ground: false } }, 0);
    expect(unpowered.outputs.green).toBe(false);
    expect(String(unpowered.outputs.warning)).toContain("ground");
    const pins = JSON.parse(String(state.memory.pins)) as Record<string, string>;
    const conflict = advanceRuntime(def, { ...state, memory: { ...state.memory, pins: JSON.stringify({ ...pins, LED_RED: pins.LED_GREEN }) } }, 0);
    expect(String(conflict.outputs.warning)).toContain("GPIO conflict");
  });
  it("runs user variables and if/else against changing sensor values", () => {
    const def = PROJECT_LABS.find((lab) => lab.number === 62)!;
    const code = `void loop() {
  int lux = analogRead(LDR);
  if (lux < 200) { setLamp(true); }
  else { setLamp(false); }
}`;
    const compiled = compileProjectCode(code);
    expect(compiled.diagnostics).toEqual([]);
    const initial = createRuntime(def, compiled.program!);
    expect(initial.outputs.lamp).toBe(true);
    expect(updateInput(def, initial, "ambient", 500).outputs.lamp).toBe(false);
  });
  it("uses elapsed simulation time in conditional firmware", () => {
    const def = PROJECT_LABS.find((lab) => lab.number === 67)!;
    const code = `void loop() {
  if (millis() < 1000) { analogWrite(MOTOR_PIN, 20); }
  else { analogWrite(MOTOR_PIN, 80); }
}`;
    const compiled = compileProjectCode(code);
    expect(compiled.diagnostics).toEqual([]);
    const initial = createRuntime(def, compiled.program!);
    const later = advanceRuntime(def, initial, 1.1);
    expect(initial.outputs.duty).toBe(20);
    expect(later.outputs.duty).toBe(80);
    expect(later.outputs.target).toBeGreaterThan(initial.outputs.target as number);
  });
  it("runs builder conditionals against a digital button", () => {
    const def = PROJECT_LABS.find((lab) => lab.number === 72)!;
    const code = `void loop() {
  if (digitalRead(BUTTON)) { relayWrite(RELAY, 1); }
  else { relayWrite(RELAY, 0); }
}`;
    const compiled = compileProjectCode(code);
    expect(compiled.diagnostics).toEqual([]);
    const initial = createRuntime(def, compiled.program!);
    expect(initial.outputs.relay).toBe(false);
    expect(updateInput(def, initial, "button", true).outputs.relay).toBe(true);
  });
  it("reports unknown firmware variables and stops the run", () => {
    const def = PROJECT_LABS.find((lab) => lab.number === 62)!;
    const program = compileProjectCode("void loop() { setLamp(ambientTypo < 300); }").program!;
    const state = createRuntime(def, program);
    expect(state.running).toBe(false);
    expect(state.diagnostics[0]?.message).toContain("ambientTypo");
  });
  it("keeps setup variables between firmware ticks and applies the last output write", () => {
    const def = PROJECT_LABS.find((lab) => lab.number === 62)!;
    const code = `void setup() { int count = 0; }
void loop() {
  count += 1;
  setLamp(false);
  setLamp(count % 2 == 1);
}`;
    const compiled = compileProjectCode(code);
    expect(compiled.diagnostics).toEqual([]);
    const first = createRuntime(def, compiled.program!);
    expect(first.outputs.lamp).toBe(true);
    expect(advanceRuntime(def, first, 0.1).outputs.lamp).toBe(false);
  });
  it("does not actuate project hardware when loop issues no commands", () => {
    const program = compileProjectCode("void loop() {}").program!;
    const states = Object.fromEntries(PROJECT_LABS.map((def) => [def.id, createRuntime(def, program)]));
    expect(states.traffic?.outputs.state).toBe("ALL_RED");
    expect(states.street?.outputs.lamp).toBe(false);
    expect(states.thermometer?.outputs.temperature).toBe("Display off");
    expect(states.ultrasonic?.outputs.triggerUs).toBe(0);
    expect(states.irrigation?.outputs.pump).toBe(false);
    expect(states.robot?.outputs.leftPWM).toBe(0);
    expect(states.motor?.outputs.duty).toBe(0);
    expect(states.arm?.gpio.PWM1).toBe(false);
    expect(states.home?.outputs.active).toBe(0);
    expect(states.iot?.outputs.packets).toBe(0);
    expect(states.builder?.outputs.green).toBe(false);
  });
  it("accepts familiar pin setup and serial output in the virtual firmware", () => {
    const def = PROJECT_LABS.find((lab) => lab.number === 72)!;
    const code = `void setup() { pinMode(LED_GREEN, OUTPUT); Serial.begin(9600); }
void loop() { digitalWrite(LED_GREEN, HIGH); Serial.println("LED on"); }`;
    const compiled = compileProjectCode(code);
    expect(compiled.diagnostics).toEqual([]);
    const tick = advanceRuntime(def, createRuntime(def, compiled.program!), 0.1);
    expect(tick.outputs.green).toBe(true);
    expect(tick.logs.some((entry) => entry.includes("Serial: LED on"))).toBe(true);
  });
  it("registers five working controls and five live measurements in every project", () => {
    for (const def of PROJECT_LABS) {
      const features = PROJECT_ENHANCEMENTS[def.id];
      expect(features, def.title).toHaveLength(10);
      expect(new Set(features.map((item) => item.key)).size).toBe(10);
      expect(features.filter((item) => item.control)).toHaveLength(5);
      const state = createRuntime(def, compileProjectCode(def.code).program!);
      for (const item of features) {
        if (item.control) expect(state.inputs[item.key], `${def.title}: ${item.key}`).toBeDefined();
        else expect(state.outputs[item.key], `${def.title}: ${item.key}`).toBeDefined();
      }
    }
  });
  it("applies project enhancements to each simulator", () => {
    const changed = (lab: number, key: string, value: number | boolean | string) => {
      const { def, state } = run(lab);
      return updateInput(def, state, key, value);
    };
    expect(changed(61, "detectorFault", true).outputs.safety).toContain("Detector fault");
    const failedLamp = changed(62, "lampFault", true);
    expect(failedLamp.outputs.brightness).toBe(0);
    expect(failedLamp.gpio.PB5).toBe(true);
    expect(changed(63, "sensorDisconnected", true).outputs.sensorHealth).toBe("Disconnected");
    expect(changed(64, "echoDropout", 100).outputs.echoQuality).toBe("Dropped");
    expect(changed(65, "reservoir", 0).outputs.dryRun).toBe(true);
    expect(changed(66, "obstacle", true).outputs.recovery).toBe("Obstacle stop");
    const braked = changed(67, "brake", true);
    expect(braked.outputs.tripReason).toBe("Dynamic brake");
    expect(braked.outputs.fault).toBe(false);
    expect(changed(68, "armStop", true).gpio.PWM1).toBe(false);
    expect(changed(69, "uvIndex", 10).outputs.weatherAlert).toBe("High UV");
    const away = changed(70, "mode", "Away");
    expect(updateInput(run(70).def, away, "doorOpen", true).outputs.intrusion).toBe(true);
    const compact = changed(71, "payloadMode", "Compact");
    expect(compact.outputs.payloadBytes).toBeLessThan(run(71).state.outputs.payloadBytes as number);
    expect(String(changed(72, "supplyVoltage", 2.5).outputs.warning)).toContain("too low");
  });
});
