import type { Mcu } from "../core/mcu";

/** The servo signal wire is soldered to Arduino header D9, which is PC7 (TIM3_CH2) on a Nucleo-64. */
export const SERVO_PIN = "PC7";
export const SERVO_ARD = 9;

export const DEMO = `#include <Servo.h>

Servo myServo;
const int servoPin = 9;   // D9 = PC7 on the Nucleo header
int angle = 90;           // Target angle (0 - 180)

void setup() {
  Serial.begin(9600);
  myServo.attach(servoPin, 500, 2500);  // 0.5 ms = 0 deg, 2.5 ms = 180 deg
  Serial.println("Lab 22: Servo Motor Control");
}

void loop() {
  // Read the target angle from a variable or input
  angle = constrain(angle, 0, 180);
  myServo.write(angle);   // Set servo angle (0 - 180)
  Serial.print("Servo angle: ");
  Serial.println(angle);
  delay(250);
}
`;

export const SWEEP = `#include <Servo.h>

Servo myServo;
const int servoPin = 9;   // D9 = PC7 on the Nucleo header
int pos = 0;

void setup() {
  myServo.attach(servoPin, 500, 2500);
}

void loop() {
  for (pos = 0; pos <= 180; pos += 1) {   // sweep 0 -> 180 deg
    myServo.write(pos);
    delay(15);                            // ~2.7 s per sweep
  }
  for (pos = 180; pos >= 0; pos -= 1) {   // and back
    myServo.write(pos);
    delay(15);
  }
}
`;

export const DEFAULT_RANGE = DEMO.replace("  myServo.attach(servoPin, 500, 2500);  // 0.5 ms = 0 deg, 2.5 ms = 180 deg", "  myServo.attach(servoPin);  // BUG? library default range is 544 - 2400 us");

export const ANALOG_BUG = `const int servoPin = 9;   // D9 = PC7 on the Nucleo header
int angle = 90;           // Target angle (0 - 180)

void setup() {
  pinMode(servoPin, OUTPUT);
}

void loop() {
  // BUG: analogWrite is ~1 kHz PWM, not a 50 Hz servo frame
  analogWrite(servoPin, map(angle, 0, 180, 0, 255));
  delay(250);
}
`;

const ANGLE_RE = /^(int angle = )(\d+)(;.*)$/m;
export function codeAngle(src: string): number | null { const m = ANGLE_RE.exec(src); return m ? Number(m[2]) : null; }
export function setCodeAngle(src: string, a: number): string { return src.replace(ANGLE_RE, (_, h: string, _v: string, rest: string) => `${h}${Math.round(a)}${rest}`); }

export type P22 = { load: number; noGround: boolean; weakSupply: boolean };
export const P22_DEFAULT: P22 = { load: 0, noGround: false, weakSupply: false };

/** Servo-side calibration of a standard SG90: 0.5 ms = 0 deg, 2.5 ms = 180 deg. */
export const SERVO_MIN_US = 500, SERVO_MAX_US = 2500;
const NO_LOAD_DPS = 600; // SG90: 0.1 s / 60 deg at 4.8 V

export interface Servo22 {
  angle: number; target: number; valid: boolean; reason: string; stalled: boolean;
  /** Where the horn settled while the signal was last valid; noise is anchored here. */
  rest: number;
  pulseUs: number; freq: number; duty: number; speed: number; supplyV: number; moving: boolean;
}
const ST = new WeakMap<Mcu, Servo22>();

/** What the servo's control electronics decode from the signal pin. */
export function decode(m: Mcu, p: P22): Pick<Servo22, "valid" | "reason" | "pulseUs" | "freq" | "duty"> {
  const pw = m.pwmInfo(SERVO_PIN);
  if (!pw) return { valid: false, reason: m.level(SERVO_PIN) ? "Signal stuck high: no pulses" : "No pulses on D9", pulseUs: 0, freq: 0, duty: 0 };
  const pulseUs = (pw.duty / pw.freq) * 1e6;
  const base = { pulseUs, freq: pw.freq, duty: pw.duty };
  if (p.noGround) return { ...base, valid: false, reason: "No common ground: the servo cannot see the signal" };
  if (pw.freq > 330 || pw.freq < 30) return { ...base, valid: false, reason: `${pw.freq >= 1000 ? (pw.freq / 1000).toFixed(1) + " kHz" : pw.freq.toFixed(0) + " Hz"} PWM is not a servo frame (needs ~50 Hz)` };
  if (pulseUs < 300 || pulseUs > 2800) return { ...base, valid: false, reason: "Pulse width outside 0.3 - 2.8 ms" };
  return { ...base, valid: true, reason: "" };
}

export function servo(m: Mcu): Servo22 {
  return ST.get(m) ?? { angle: 90, target: 90, rest: 90, valid: false, reason: "Not running", stalled: false, pulseUs: 0, freq: 0, duty: 0, speed: NO_LOAD_DPS, supplyV: 5, moving: false };
}

export function world22(m: Mcu, dt: number, p: P22) {
  const prev = servo(m);
  const d = decode(m, p);
  const speed = NO_LOAD_DPS * (1 - 0.65 * p.load) * (p.weakSupply ? 0.4 : 1);
  let target = prev.target, stalled = false;
  if (d.valid) {
    const raw = ((d.pulseUs - SERVO_MIN_US) / (SERVO_MAX_US - SERVO_MIN_US)) * 180;
    target = Math.max(0, Math.min(180, raw));
    stalled = raw < -1 || raw > 181;
  }
  let angle = prev.angle, rest = prev.rest;
  if (p.noGround && d.pulseUs > 0) {
    angle = Math.max(0, Math.min(180, rest + 1.5 * Math.sin(m.now * 23) + 0.8 * Math.sin(m.now * 61)));
  } else if (d.valid) {
    const err = target - angle;
    const v = Math.min(speed, Math.abs(err) * 40 + 15);
    angle += Math.sign(err) * Math.min(Math.abs(err), v * dt);
    rest = angle;
  }
  const moving = d.valid && Math.abs(angle - prev.angle) > 1e-3;
  const supplyV = p.weakSupply ? (moving ? 4.05 : 4.45) : (moving ? 4.92 : 5.0);
  ST.set(m, { ...d, angle, target, rest, stalled, speed, supplyV, moving });
}

/** Angle requested by a given pulse on the servo side. */
export const usToAngle = (us: number) => ((us - SERVO_MIN_US) / (SERVO_MAX_US - SERVO_MIN_US)) * 180;
/** The library's write(angle) mapping for the attached range. */
export const angleToUs = (a: number, min: number, max: number) => Math.trunc((a * (max - min)) / 180 + min);

export function attached(m: Mcu) {
  for (const [name, s] of m.servos) return { name, ...s };
  return null;
}

export function positionName(a: number) {
  if (a < 2) return "Minimum position (full left)";
  if (a > 178) return "Maximum position (full right)";
  if (Math.abs(a - 90) < 1.5) return "Center position";
  return a < 90 ? "Left of center" : "Right of center";
}
