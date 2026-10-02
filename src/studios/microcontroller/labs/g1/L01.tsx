import { useState } from "react";
import type { Mcu } from "../core/mcu";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { HwDefs, NucleoBoard, RaspberryPi, SvgLed } from "../ui/Hardware";
import { Icon, type IconName } from "../ui/Icon";
import { LearningNotes, Metric, Panel, Seg } from "../ui/Panels";
import { LabShell as Shell } from "../ui/Shell";
import { fmtSec, measureEdges, type Edge } from "../ui/Scope";

const HAL = `/* Core Lab 1 - Microcontroller Fundamentals */
#include "stm32f4xx_hal.h"

int main(void) {
    HAL_Init();
    SystemClock_Config();  // Configure system clock
    MX_GPIO_Init();        // Initialize GPIO (on-board LED)

    while (1) {
        HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5);  // Toggle LED
        HAL_Delay(500);                          // Wait 500 ms
    }
}
`;
const REGS = `/* Core Lab 1 - same blink using registers */
#include "stm32f4xx.h"

int main(void) {
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;   // clock GPIOA
    GPIOA->MODER &= ~(3U << (5 * 2));
    GPIOA->MODER |=  (1U << (5 * 2));      // PA5 = output

    while (1) {
        GPIOA->ODR ^= (1U << 5);           // toggle LD2
        HAL_Delay(500);
    }
}
`;
const BUTTON = `/* Core Lab 1 - react to the user button (B1 on PC13) */
#include "stm32f4xx_hal.h"

int main(void) {
    HAL_Init();
    MX_GPIO_Init();
    while (1) {
        if (HAL_GPIO_ReadPin(GPIOC, GPIO_PIN_13) == GPIO_PIN_RESET)
            HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_SET);   // pressed
        else
            HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_RESET);
    }
}
`;

type P = { clockMHz: number; linuxLoad: number };

interface MpuModel { level: number; next: number; edges: Edge[]; seed: number }
const MPU = new WeakMap<Mcu, MpuModel>();
const mpu = (mcu: Mcu) => { let m = MPU.get(mcu); if (!m) { m = { level: 0, next: 0.5, edges: [], seed: 0x9e3779b9 }; MPU.set(mcu, m); } return m; };
const rand = (m: MpuModel) => { m.seed ^= m.seed << 13; m.seed ^= m.seed >>> 17; m.seed ^= m.seed << 5; return ((m.seed >>> 0) % 1_000_000) / 1_000_000; };

/** Last LED toggle interval of the MCU firmware, used as the set-point for the ported Linux program. */
function mcuHalfPeriod(mcu: Mcu) {
  const e = mcu.edges.get("PA5");
  if (!e || e.length < 2) return 0.5;
  return Math.max(0.001, e[e.length - 1]![0] - e[e.length - 2]![0]);
}

function world(mcu: Mcu, _dt: number, p: P) {
  const m = mpu(mcu);
  if (mcu.time < m.next) return;
  m.level ^= 1;
  m.edges.push([mcu.time, m.level]);
  if (m.edges.length > 4000) m.edges.splice(0, 1000);
  const load = p.linuxLoad / 100;
  let latency = 40e-6 + -Math.log(1 - rand(m) * 0.999) * (25e-6 + load * 160e-6);
  if (rand(m) < 0.02 + load * 0.12) latency += 1e-3 + rand(m) * (2e-3 + load * 14e-3);
  m.next = mcu.time + mcuHalfPeriod(mcu) + latency;
}

function jitter(edges: Edge[] | undefined, t0: number) {
  const xs: number[] = [];
  const e = (edges ?? []).filter(([t]) => t >= t0);
  for (let i = 1; i < e.length; i++) xs.push(e[i]![0] - e[i - 1]![0]);
  if (xs.length < 2) return { mean: 0, pp: 0, n: xs.length };
  return { mean: xs.reduce((a, b) => a + b, 0) / xs.length, pp: Math.max(...xs) - Math.min(...xs), n: xs.length };
}

function Callout({ x, y, w, h, title, lines, icon, tone = "#1769e0", lx, ly }: { x: number; y: number; w: number; h: number; title: string; lines: string[]; icon?: string; tone?: string; lx: number; ly: number }) {
  const ax = lx < x ? x : x + w;
  return (
    <g>
      <line x1={ax} y1={y + h / 2} x2={lx} y2={ly} stroke={tone} strokeWidth={1.2} strokeDasharray="3 2" />
      <circle cx={lx} cy={ly} r={2.6} fill={tone} />
      <rect x={x} y={y} width={w} height={h} rx={7} fill="#ffffff" stroke="#cfdcec" />
      {icon ? <text x={x + 9} y={y + 15} fontSize="10" fill={tone}>{icon}</text> : null}
      <text x={x + (icon ? 22 : 9)} y={y + 15} fontSize="10.5" fontWeight="800" fill="#0f2547">{title}</text>
      {lines.map((l, i) => <text key={i} x={x + 9} y={y + 28 + i * 11} fontSize="9" fill="#3d5577">{l}</text>)}
    </g>
  );
}

const AREAS: Array<{ id: string; label: string; icon: IconName; color: string; pick: string }> = [
  { id: "home", label: "Smart Home Automation", icon: "home", color: "#1769e0", pick: "MCU in every switch, sensor and plug; an MPU only in the hub that runs the app and dashboard." },
  { id: "auto", label: "Automotive Systems", icon: "gauge", color: "#f97316", pick: "Dozens of MCUs handle engine, ABS and airbags with hard real-time deadlines; MPUs drive infotainment." },
  { id: "robot", label: "Robotics & Drones", icon: "target", color: "#7c3aed", pick: "MCU closes motor and IMU loops at kHz rates; an MPU runs vision and path planning." },
  { id: "wear", label: "Wearables & Health Tech", icon: "clock", color: "#0ea5e9", pick: "Ultra-low-power MCU sleeps most of the time to run for days on a coin cell." },
  { id: "ind", label: "Industrial Control", icon: "sliders", color: "#475569", pick: "PLC-style MCUs give deterministic I/O timing and survive harsh environments." },
  { id: "env", label: "Environmental Monitoring", icon: "wave", color: "#16a34a", pick: "Battery MCU samples sensors, sleeps, and wakes to transmit — milliwatts on average." },
];

export default function L01({ meta }: { meta: LabMeta }) {
  const lab = useLab<P>({
    slug: meta.slug, code: HAL, params: { clockMHz: 84, linuxLoad: 25 },
    mcu: (p) => ({ clock: p.clockMHz * 1e6, cube: { gpio: [{ pin: "PA5", mode: "out" }, { pin: "PC13", mode: "in", pull: "up" }] } }),
    setup: (m) => m.setInput("PC13", 1),
    world, rebuildOn: ["clockMHz"],
  });
  const { mcu, params } = lab;
  const [b1, setB1] = useState(false);
  const [view3d, setView3d] = useState(false);
  const [snap, setSnap] = useState<"mcu" | "mpu">("mcu");
  const [hwTab, setHwTab] = useState<"mcu" | "mpu">("mcu");
  const [area, setArea] = useState("home");

  const led = mcu.level("PA5");
  const m = mpu(mcu);
  const t0 = Math.max(0, mcu.time - 10);
  const jm = jitter(mcu.edges.get("PA5"), t0);
  const jp = jitter(m.edges, t0);
  const blink = measureEdges(mcu.edges.get("PA5"), t0, mcu.time);
  const mcuPower = 3.3 * (params.clockMHz * 0.137 + 1.8 + (led ? 2.0 : 0)) * (mcu.sleep === "run" ? 1 : 0.12);
  const mpuPower = 2.7 + 3.7 * (params.linuxLoad / 100);
  const ramUsed = (mcu.fw?.globalsList() ?? []).length * 4 + 1024;
  const press = (down: boolean) => { setB1(down); mcu.setInput("PC13", down ? 0 : 1); };
  const pinRow = (key: string) => mcu.pins.has(key) ? (mcu.level(key) ? "HIGH" : "LOW") : "—";

  return (
    <Shell meta={meta} lab={lab} subtitle="Understand the difference between MCUs and MPUs, explore embedded systems, and learn about common applications."
      components={["STM32 NUCLEO-F401RE (ARM Cortex-M4)", "Raspberry Pi 4 Model B (ARM Cortex-A72)", "On-board LED LD2 (PA5)", "User button B1 (PC13)"]}>
      <div className="mcl-grid mcl-top3">
        <Panel title="Simulation / Explorer" icon="cube" className="mcl-sim" tools={<>
          <span className={`mcl-chip ${lab.status === "running" ? "mcl-chip-live" : ""}`}>{lab.status === "running" ? "Interactive Simulation" : `Simulation ${lab.status}`}</span>
          <button type="button" className={`mcl-small-btn ${view3d ? "on" : ""}`} aria-pressed={view3d} onClick={() => setView3d((v) => !v)}><Icon name="cube" size={13} /> 3D</button>
        </>}>
          <div className={`mcl-l01-stage ${view3d ? "is-3d" : ""}`}>
            <svg viewBox="0 0 820 410" className="mcl-svg" role="img" aria-label="STM32 Nucleo microcontroller board next to a Raspberry Pi microprocessor board">
              <HwDefs />
              <rect x="0" y="0" width="820" height="410" fill="#f3f6fa" />
              <rect x="0" y="330" width="820" height="80" fill="#e4e9ef" />
              <line x1="410" y1="12" x2="410" y2="398" stroke="#cbd5e1" strokeDasharray="5 4" />
              <rect x="125" y="10" width="160" height="40" rx="9" fill="#1769e0" />
              <text x="205" y="29" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="800">Microcontroller (MCU)</text>
              <text x="205" y="43" textAnchor="middle" fill="#dbeafe" fontSize="8.5">Single-chip solution for embedded control</text>
              <rect x="535" y="10" width="160" height="40" rx="9" fill="#16a34a" />
              <text x="615" y="29" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="800">Microprocessor (MPU)</text>
              <text x="615" y="43" textAnchor="middle" fill="#dcfce7" fontSize="8.5">General-purpose processor for complex apps</text>
              <NucleoBoard x={150} y={66} scale={0.78} ld2={led === 1} b1Pressed={b1} onB1={press} onReset={lab.resetSim} power={!!mcu.fw} />
              <Callout x={14} y={70} w={110} h={46} title="CPU" lines={["Cortex-M4", `${params.clockMHz} MHz`]} lx={205} ly={225} />
              <Callout x={14} y={124} w={110} h={46} title="Flash" lines={["512 KB", "(on-chip)"]} lx={198} ly={205} />
              <Callout x={14} y={178} w={110} h={46} title="RAM" lines={["128 KB", `(on-chip) · ~${(ramUsed / 1024).toFixed(1)} KB used`]} lx={198} ly={240} />
              <Callout x={14} y={232} w={110} h={46} title="GPIO" lines={["50 I/O pins", `LD2 (PA5) ${led ? "HIGH" : "LOW"}`]} lx={202} ly={180} />
              <Callout x={294} y={70} w={108} h={46} title="Low Power" lines={[`≈ ${mcuPower.toFixed(0)} mW (live)`, mcu.sleep === "run" ? "core active" : `${mcu.sleep} mode`]} tone="#16a34a" lx={262} ly={140} />
              <Callout x={294} y={124} w={108} h={46} title="Real-time" lines={["No OS required", `jitter ${fmtSec(jm.pp)}`]} tone="#16a34a" lx={262} ly={200} />
              <Callout x={294} y={178} w={108} h={57} title="Built-in" lines={["Peripherals", "Timers, ADC,", "UART, I2C, etc."]} tone="#16a34a" lx={262} ly={260} />
              <rect x="128" y="340" width="154" height="34" rx="7" fill="#fff" stroke="#cfdcec" />
              <text x="205" y="355" textAnchor="middle" fontSize="10" fontWeight="800" fill="#0f2547">STM32 NUCLEO-F401RE</text>
              <text x="205" y="367" textAnchor="middle" fontSize="8.5" fill="#4b6283">(ARM Cortex-M4)</text>

              <g transform="translate(680 90) rotate(90)">
                <RaspberryPi x={0} y={0} scale={0.76} activity={m.level === 1} />
              </g>
              <SvgLed x={560} y={300} on={m.level === 1} color="green" r={7} label="LED on GPIO17 (Linux)" />
              <Callout x={424} y={70} w={104} h={46} title="CPU" lines={["Quad-core ARM", "1.5 GHz"]} tone="#16a34a" lx={560} ly={170} />
              <Callout x={424} y={124} w={104} h={46} title="Memory" lines={["1 GB LPDDR4", "(external)"]} tone="#16a34a" lx={565} ly={205} />
              <Callout x={424} y={178} w={104} h={46} title="Storage" lines={["microSD", "(boot OS)"]} tone="#16a34a" lx={600} ly={92} />
              <Callout x={424} y={232} w={104} h={46} title="USB / Ethernet" lines={["High-speed I/O"]} tone="#16a34a" lx={540} ly={300} />
              <Callout x={700} y={70} w={110} h={46} title="Higher Power" lines={[`≈ ${mpuPower.toFixed(1)} W (live)`, `${params.linuxLoad}% CPU load`]} tone="#ea580c" lx={668} ly={140} />
              <Callout x={700} y={124} w={110} h={46} title="Runs OS" lines={["Linux, scheduler", `jitter ${fmtSec(jp.pp)}`]} tone="#ea580c" lx={668} ly={200} />
              <Callout x={700} y={178} w={110} h={57} title="Designed for" lines={["complex apps", "(multitasking, UI,", "networking)"]} tone="#ea580c" lx={668} ly={260} />
              <rect x="538" y="340" width="154" height="34" rx="7" fill="#fff" stroke="#cfdcec" />
              <text x="615" y="355" textAnchor="middle" fontSize="10" fontWeight="800" fill="#0f2547">Raspberry Pi 4 Model B</text>
              <text x="615" y="367" textAnchor="middle" fontSize="8.5" fill="#4b6283">(ARM Cortex-A72)</text>
            </svg>
          </div>
          <div className="mcl-l01-strip">
            <span><b>MCU LED period</b> {blink.period ? fmtSec(blink.period) : "—"} · jitter <b>{fmtSec(jm.pp)}</b></span>
            <span><b>MPU LED period</b> {jp.n ? fmtSec(jp.mean * 2) : "—"} · jitter <b className={jp.pp > 1e-3 ? "mcl-warn-text" : ""}>{fmtSec(jp.pp)}</b></span>
            <label className="mcl-l01-load">Linux background load <input type="range" min={0} max={100} value={params.linuxLoad} onChange={(e) => lab.setParam("linuxLoad", Number(e.target.value))} /> <b>{params.linuxLoad}%</b></label>
          </div>
        </Panel>

        <div className="mcl-col">
          <Panel title="MCU vs MPU Comparison" icon="table">
            <table className="mcl-table mcl-l01-cmp">
              <thead><tr><th>Feature</th><th className="mcu">Microcontroller (MCU)</th><th className="mpu">Microprocessor (MPU)</th></tr></thead>
              <tbody>
                <tr><td>Primary purpose</td><td>Embedded control (specific tasks)</td><td>General-purpose (complex apps)</td></tr>
                <tr><td>CPU</td><td>Cortex-M4 (e.g., M4)</td><td>Cortex-A (e.g., A72)</td></tr>
                <tr><td>Clock speed</td><td>10 – 200 MHz</td><td>500 MHz – 2+ GHz</td></tr>
                <tr><td>Memory</td><td>On-chip Flash &amp; RAM</td><td>External RAM, SD/eMMC</td></tr>
                <tr><td>Operating system</td><td>No OS (bare-metal) or RTOS</td><td>Full OS (Linux, etc.)</td></tr>
                <tr><td>Power consumption</td><td>Low (mW) — <b>{mcuPower.toFixed(0)} mW</b></td><td>Higher (W) — <b>{mpuPower.toFixed(1)} W</b></td></tr>
                <tr className="hl"><td>Toggle jitter (measured)</td><td><b>{fmtSec(jm.pp)}</b></td><td><b>{fmtSec(jp.pp)}</b></td></tr>
                <tr><td>Typical applications</td><td>Sensors, control, IoT, real-time systems</td><td>Multimedia, networking, human interface</td></tr>
              </tbody>
            </table>
          </Panel>
          <Panel title="System Snapshot" icon="gauge" tools={<Seg size="sm" value={snap} onChange={setSnap} options={[{ value: "mcu", label: "MCU (STM32F4)" }, { value: "mpu", label: "MPU (RPi)" }]} />}>
            {snap === "mcu" ? (
              <div className="mcl-metrics mcl-l01-snap">
                <Metric icon="bolt" tone="amber" label="Power" value={mcuPower.toFixed(0)} unit="mW" sub="(live)" />
                <Metric icon="clock" label="Clock" value={<select className="mcl-l01-clock" value={params.clockMHz} aria-label="MCU core clock" onChange={(e) => lab.setParam("clockMHz", Number(e.target.value))}>{[16, 48, 84].map((c) => <option key={c} value={c}>{c} MHz</option>)}</select>} />
                <Metric icon="memory" tone="green" label="RAM" value="96" unit="KB" sub={`~${(ramUsed / 1024).toFixed(1)} KB used`} />
                <Metric icon="chip" tone="violet" label="Flash" value="512" unit="KB" />
                <Metric icon="grid" label="GPIO Pins" value="50" sub="(available)" />
              </div>
            ) : (
              <div className="mcl-metrics mcl-l01-snap">
                <Metric icon="bolt" tone="amber" label="Power" value={mpuPower.toFixed(1)} unit="W" sub="(live)" />
                <Metric icon="clock" label="Clock" value="1.5" unit="GHz" />
                <Metric icon="memory" tone="green" label="RAM" value="1" unit="GB" />
                <Metric icon="chip" tone="violet" label="Storage" value="microSD" />
                <Metric icon="grid" label="GPIO Pins" value="28" sub="(header)" />
              </div>
            )}
          </Panel>
        </div>

        <div className="mcl-col">
          <Panel title="Application Areas" icon="apps">
            <div className="mcl-l01-areas">
              {AREAS.map((a) => (
                <button key={a.id} type="button" className={area === a.id ? "on" : ""} onClick={() => setArea(a.id)} aria-pressed={area === a.id}>
                  <Icon name={a.icon} size={30} className="mcl-l01-area-icon" />
                  <span style={{ color: a.color }} />
                  {a.label}
                </button>
              ))}
            </div>
            <p className="mcl-l01-pick">{AREAS.find((a) => a.id === area)?.pick}</p>
          </Panel>
          <Panel title="Quick Facts" icon="bulb">
            <p className="mcl-l01-fact">Microcontrollers are ideal for real-time, low-power control tasks, while microprocessors are designed for high-performance computing with rich operating system support.</p>
            <p className="mcl-l01-fact">In this simulation the MCU toggles LD2 with <b>{fmtSec(jm.pp)}</b> of jitter while the Linux board shows <b>{fmtSec(jp.pp)}</b> — raise the background load to see why OS scheduling breaks hard deadlines.</p>
          </Panel>
        </div>
      </div>

      <div className="mcl-grid mcl-bot3">
        <CodeEditor lab={lab} languages={[{ label: "C (STM32 HAL)", code: HAL }, { label: "C (Registers)", code: REGS }, { label: "C (Button input)", code: BUTTON }]} />
        <Panel title="Hardware & GPIO Mapping" icon="link" tools={<Seg size="sm" value={hwTab} onChange={setHwTab} options={[{ value: "mcu", label: "Nucleo (MCU)" }, { value: "mpu", label: "RPi (MPU)" }]} />}>
          {hwTab === "mcu" ? (
            <div className="mcl-l01-map">
              <div className="mcl-l01-map-left">
                <button type="button" className={`mcl-l01-pinbox ${b1 ? "on" : ""}`} onPointerDown={() => press(true)} onPointerUp={() => press(false)} onPointerLeave={() => b1 && press(false)}>
                  <b>User Button (B1)</b><span>PC13 · {pinRow("PC13")}</span>
                </button>
                <div className={`mcl-l01-pinbox ${led ? "led" : ""}`}><b>LED (LD2)</b><span>PA5 · {led ? "HIGH" : "LOW"}</span></div>
                <div className="mcl-l01-pinbox"><b>ST-Link</b><span>(Programming) · {mcu.fw ? "flashed" : "idle"}</span></div>
              </div>
              <svg viewBox="0 0 160 250" className="mcl-svg mcl-l01-mini" aria-hidden="true">
                <HwDefs id="m1" />
                <NucleoBoard id="m1" x={8} y={4} scale={0.62} ld2={led === 1} b1Pressed={b1} />
                <path d="M2 70 H30" stroke="#1769e0" strokeWidth="2" /><path d="M2 120 H30" stroke="#16a34a" strokeWidth="2" /><path d="M2 175 H30" stroke="#64748b" strokeWidth="2" />
                <path d="M130 45 H158" stroke="#2563eb" strokeWidth="2" /><path d="M130 95 H158" stroke="#f59e0b" strokeWidth="2" /><path d="M130 145 H158" stroke="#7c3aed" strokeWidth="2" /><path d="M130 200 H158" stroke="#16a34a" strokeWidth="2" />
              </svg>
              <div className="mcl-l01-map-right">
                <div><b>UART</b><span>PA2 (TX) {pinRow("PA2")}<br />PA3 (RX) {pinRow("PA3")}</span></div>
                <div><b>I2C</b><span>PB8 (SCL)<br />PB9 (SDA)</span></div>
                <div><b>SPI</b><span>PA5 (SCK) · PA6 (MISO) · PA7 (MOSI)</span></div>
                <div><b>Analog In</b><span>PA0 (ADC1) · {mcu.analog[0]!.toFixed(2)} V</span></div>
              </div>
            </div>
          ) : (
            <table className="mcl-table">
              <thead><tr><th>Header pin</th><th>Function</th><th>State</th></tr></thead>
              <tbody>
                <tr><td>GPIO17 (pin 11)</td><td>LED (Linux sysfs / libgpiod)</td><td>{m.level ? "HIGH" : "LOW"}</td></tr>
                <tr><td>GPIO2 / GPIO3</td><td>I2C1 SDA / SCL</td><td>idle</td></tr>
                <tr><td>GPIO14 / GPIO15</td><td>UART TX / RX</td><td>idle</td></tr>
                <tr><td>GPIO10 / 9 / 11</td><td>SPI0 MOSI / MISO / SCLK</td><td>idle</td></tr>
                <tr><td>—</td><td>No on-chip ADC (needs external chip)</td><td>n/a</td></tr>
              </tbody>
            </table>
          )}
        </Panel>
        <LearningNotes notes={{
          takeaways: [
            "A microcontroller (MCU) integrates CPU, memory, and peripherals on a single chip.",
            "A microprocessor (MPU) requires external memory and is designed for general-purpose computing.",
            "MCUs are optimized for low power and real-time control.",
            "MPUs run operating systems like Linux and are used for complex, high-level applications.",
            "Embedded systems are everywhere — from home devices to industrial machines.",
          ],
          observe: "Watch LD2 on the Nucleo and the Linux LED blink with the same set-point.",
          tryIt: "Change HAL_Delay(500) to HAL_Delay(100) and press Run.",
          measure: "Compare the measured period and jitter of both boards in the strip under the scene.",
          modify: "Raise the Linux background load slider and lower the MCU clock in System Snapshot.",
          runAgain: "Press Reset — the MCU jitter stays at zero while the MPU jitter grows with load.",
          challenge: "Make LD2 follow the user button B1 (use the 'C (Button input)' variant or write it yourself).",
          question: "Look around you! Can you identify 3 devices that use a microcontroller? 3 devices that use a microprocessor?",
          checks: [
            { label: "Firmware running on the MCU", done: lab.status === "running" },
            { label: "Blink period changed from 1 s", done: blink.period > 0 && Math.abs(blink.period - 1) > 0.05 },
            { label: "MPU jitter above 1 ms observed", done: jp.pp > 1e-3 },
            { label: "LD2 follows the B1 button", done: lab.compiledCode.includes("GPIO_PIN_13") && b1 && led === 1 },
          ],
        }} />
      </div>
    </Shell>
  );
}
