import { useState } from "react";
import type { Mcu } from "../core/mcu";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Breadboard, HwDefs, SvgButton, SvgLed, Wire } from "../ui/Hardware";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Toggle } from "../ui/Panels";
import { Scope } from "../ui/Scope";
import { LabShell } from "../ui/Shell";
import { BenchChip } from "./Bench";

const REG = `#include "stm32f4xx.h"

int main(void)
{
    RCC->AHB1ENR |= (1 << 0);          // GPIOA clock on
    GPIOA->MODER |= (1 << 10);         // PA5 output  (red LED)
    GPIOA->MODER |= (1 << 12);         // PA6 output  (green LED)
    GPIOA->MODER |= (1 << 14);         // PA7 output  (yellow LED)
    GPIOA->PUPDR |= (2 << 0);          // PA0 input, pull-down (SW1 -> 3.3 V)
    GPIOA->PUPDR |= (1 << 2);          // PA1 input, pull-up   (SW2 -> GND)

    int ticks = 0;
    while (1)
    {
        if (GPIOA->IDR & (1 << 0))
            GPIOA->ODR |= (1 << 6);    // SW1 pressed: green on
        else
            GPIOA->ODR &= ~(1 << 6);

        if (GPIOA->IDR & (1 << 1))
            GPIOA->ODR &= ~(1 << 7);   // SW2 released reads 1 (pull-up)
        else
            GPIOA->ODR |= (1 << 7);    // SW2 pressed: yellow on

        if (++ticks >= 50)
        {
            ticks = 0;
            GPIOA->ODR ^= (1 << 5);    // blink PA5 every 500 ms
        }
        delay_ms(10);
    }
}
`;

const HAL = `#include "stm32f4xx_hal.h"

int main(void)
{
    HAL_Init();
    __HAL_RCC_GPIOA_CLK_ENABLE();

    GPIO_InitTypeDef out = {0};
    out.Pin = GPIO_PIN_5 | GPIO_PIN_6 | GPIO_PIN_7;
    out.Mode = GPIO_MODE_OUTPUT_PP;
    HAL_GPIO_Init(GPIOA, &out);

    GPIO_InitTypeDef sw1 = {0};
    sw1.Pin = GPIO_PIN_0;
    sw1.Mode = GPIO_MODE_INPUT;
    sw1.Pull = GPIO_PULLDOWN;          // try GPIO_NOPULL and watch PA0 float
    HAL_GPIO_Init(GPIOA, &sw1);

    GPIO_InitTypeDef sw2 = {0};
    sw2.Pin = GPIO_PIN_1;
    sw2.Mode = GPIO_MODE_INPUT;
    sw2.Pull = GPIO_PULLUP;
    HAL_GPIO_Init(GPIOA, &sw2);

    while (1)
    {
        HAL_GPIO_WritePin(GPIOA, GPIO_PIN_6, HAL_GPIO_ReadPin(GPIOA, GPIO_PIN_0));
        HAL_GPIO_WritePin(GPIOA, GPIO_PIN_7, !HAL_GPIO_ReadPin(GPIOA, GPIO_PIN_1));
        HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5);
        HAL_Delay(500);
    }
}
`;

type P = { sw1: boolean; sw2: boolean; halted: boolean; clockOff: boolean; brokenWire: boolean };
type PinN = 0 | 1 | 5 | 6 | 7;
const PINS: Array<{ n: PinN; role: string; color: string }> = [
  { n: 5, role: "Red LED", color: "#ef4444" },
  { n: 6, role: "Green LED", color: "#16a34a" },
  { n: 7, role: "Yellow LED", color: "#eab308" },
  { n: 0, role: "SW1 → 3.3 V", color: "#2563eb" },
  { n: 1, role: "SW2 → GND", color: "#7c3aed" },
];
const PULLS = ["Floating", "Pull-up", "Pull-down"] as const;

function pinInfo(m: Mcu, n: number) {
  const moder = (m.peek("GPIOA.MODER") >> (2 * n)) & 3;
  const pupd = (m.peek("GPIOA.PUPDR") >> (2 * n)) & 3;
  const odr = (m.peek("GPIOA.ODR") >> n) & 1;
  const key = `PA${n}`;
  const floating = m.isFloating(key);
  const level = floating ? -1 : m.pin(key).level;
  return { moder, pupd, odr, level, floating, mode: moder === 1 ? "Output" : moder === 0 ? "Input" : moder === 2 ? "Alternate" : "Analog" };
}
const noise = (t: number) => { const x = Math.sin(Math.floor(t * 900) * 12.9898) * 43758.5453; return x - Math.floor(x) > 0.5 ? 1 : 0; };

export default function L11({ meta }: { meta: LabMeta }) {
  const lab = useLab<P>({
    slug: meta.slug, code: REG, params: { sw1: false, sw2: false, halted: false, clockOff: false, brokenWire: false },
    rebuildOn: ["clockOff"],
    mcu: (p) => ({ ips: 120_000, strictClock: p.clockOff }),
    setup: (m, p) => { if (p.clockOff) m.gateStuck.add("GPIOA"); },
    world: (m, _dt, p) => {
      m.cpuHalted = p.halted;
      m.setInput("PA0", p.sw1 && !p.brokenWire ? 1 : null);
      m.setInput("PA1", p.sw2 ? 0 : null);
      if (p.clockOff) m.clockEnabled("GPIOA");
    },
  });
  const { mcu, params } = lab;
  const [sel, setSel] = useState<PinN>(5);
  const [seen, setSeen] = useState({ out: false, toggles: 0, in0: false, pulls: [] as number[] });
  const info = pinInfo(mcu, sel);
  const all = Object.fromEntries(PINS.map((p) => [p.n, pinInfo(mcu, p.n)])) as Record<PinN, ReturnType<typeof pinInfo>>;

  const dbg = (path: string, value: number) => { mcu.write(path, value >>> 0); lab.advance(0); };
  const setMode = (out: boolean) => {
    const v = mcu.peek("GPIOA.MODER") & ~(3 << (2 * sel));
    dbg("GPIOA.MODER", v | ((out ? 1 : 0) << (2 * sel)));
    if (out && sel === 5) setSeen((s) => ({ ...s, out: true }));
  };
  const setOut = (high: boolean) => {
    dbg("GPIOA.BSRR", high ? 1 << sel : 1 << (sel + 16));
    if (info.moder === 1) setSeen((s) => ({ ...s, toggles: s.toggles + 1 }));
  };
  const setPull = (k: number) => {
    const v = mcu.peek("GPIOA.PUPDR") & ~(3 << (2 * sel));
    dbg("GPIOA.PUPDR", v | (k << (2 * sel)));
    if (info.moder === 0) setSeen((s) => (s.pulls.includes(k) ? s : { ...s, pulls: [...s.pulls, k] }));
  };
  if (!seen.out && all[5].moder === 1 && mcu.time > 0.05) setSeen((s) => ({ ...s, out: true }));
  if (!seen.in0 && all[0].moder === 0 && all[0].level === 1) setSeen((s) => ({ ...s, in0: true }));

  const firmwareDrives = !params.halted && [5, 6, 7].includes(sel);
  const volts = (i: ReturnType<typeof pinInfo>) => (i.floating ? "floating" : i.level ? "3.30 V" : "0.00 V");
  const trace = info.floating
    ? { label: `PA${sel}`, color: "#f59e0b", sample: noise, min: -0.25, max: 1.25, step: true }
    : { label: `PA${sel}`, color: "#22c55e", edges: mcu.edges.get(`PA${sel}`) ?? [], initial: 0 };
  const wireY: Record<PinN, number> = { 5: 64, 6: 84, 7: 104, 0: 136, 1: 156 };
  const led = (n: PinN) => all[n].moder === 1 && all[n].level === 1;

  return (
    <LabShell meta={meta} lab={lab} subtitle="Configure pins as input/output, explore HIGH/LOW states, pull-up and pull-down behavior."
      components={["NUCLEO-F401RE (STM32F401RE)", "Red LED on PA5, green LED on PA6, yellow LED on PA7 (330 Ω each)", "SW1 push button from PA0 to 3.3 V", "SW2 push button from PA1 to GND", "Breadboard and jumper wires"]}>
      <div className="mcl-l11-grid">
        <Panel title="Interactive GPIO Workbench" icon="grid" className="mcl-sim mcl-l11-bench">
          <div className="mcl-g2-mat">
            <svg viewBox="0 0 470 220" className="mcl-svg" role="img" aria-label="STM32 wired to LEDs and buttons on a breadboard">
              <HwDefs id="l11" />
              <BenchChip note={params.halted ? "CPU HALTED (debugger)" : undefined} pins={PINS.map((p) => {
                const i = all[p.n];
                return { key: `PA${p.n}`, y: wireY[p.n], level: i.floating ? -1 : i.level, tag: i.moder === 1 ? "O" : i.moder === 0 ? "I" : "A", selected: sel === p.n, onSelect: () => setSel(p.n) };
              })} />
              <Breadboard x={290} y={34} w={168} h={146} cols={12} rows={7} />
              <Wire d={`M250 ${wireY[5]} C 270 ${wireY[5]}, 285 52, 316 52`} color="#ef4444" live={led(5)} />
              <Wire d={`M250 ${wireY[6]} C 272 ${wireY[6]}, 300 52, 350 52`} color="#16a34a" live={led(6)} />
              <Wire d={`M250 ${wireY[7]} C 275 ${wireY[7]}, 320 52, 384 52`} color="#eab308" live={led(7)} />
              <Wire d={`M250 ${wireY[0]} C 280 ${wireY[0]}, 300 150, 326 150`} color="#2563eb" live={params.sw1 && !params.brokenWire} />
              <Wire d={`M250 ${wireY[1]} C 280 ${wireY[1]}, 340 168, 372 160`} color="#7c3aed" live={params.sw2} />
              {params.brokenWire ? <g><line x1={286} y1={140} x2={296} y2={150} stroke="#b42318" strokeWidth={2} /><line x1={296} y1={140} x2={286} y2={150} stroke="#b42318" strokeWidth={2} /></g> : null}
              {([[5, 316, "red"], [6, 350, "green"], [7, 384, "yellow"]] as Array<[PinN, number, string]>).map(([n, x, col]) => (
                <g key={n} onClick={() => setSel(n)} className="mcl-l11-part">
                  <line x1={x - 3} y1={78} x2={x - 3} y2={98} stroke="#9ca3af" strokeWidth={1.6} />
                  <line x1={x + 3} y1={78} x2={x + 3} y2={102} stroke="#9ca3af" strokeWidth={1.6} />
                  <SvgLed x={x} y={70} r={8} on={led(n)} color={col} id="l11" />
                  <text x={x} y={114} textAnchor="middle" fontSize="8" fill="#4b6283">PA{n}</text>
                </g>
              ))}
              <SvgButton x={330} y={150} size={20} pressed={params.sw1} onPress={(d) => lab.setParam("sw1", d)} label="SW1" />
              <SvgButton x={376} y={150} size={20} pressed={params.sw2} onPress={(d) => lab.setParam("sw2", d)} label="SW2" />
              <text x={330} y={44} textAnchor="middle" fontSize="7.5" fill="#b42318">3V3 rail</text>
              <text x={420} y={176} textAnchor="middle" fontSize="7.5" fill="#1d4ed8">GND rail</text>
            </svg>
          </div>
          <table className="mcl-table mcl-l11-pins">
            <thead><tr><th>Pin</th><th>Connected to</th><th>Mode</th><th>Pull</th><th>ODR</th><th>IDR</th><th>Voltage</th></tr></thead>
            <tbody>
              {PINS.map((p) => {
                const i = all[p.n];
                return (
                  <tr key={p.n} className={sel === p.n ? "hl" : ""} onClick={() => setSel(p.n)}>
                    <td><i style={{ background: p.color }} />PA{p.n}</td><td>{p.role}</td><td>{i.mode}</td><td>{["None", "Up", "Down", "—"][i.pupd]}</td>
                    <td className="mcl-mono">{i.odr}</td><td className={`mcl-mono ${i.floating ? "warn" : ""}`}>{i.floating ? "?" : i.level}</td><td className={i.floating ? "warn" : ""}>{volts(i)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <Panel title="GPIO Controls" icon="sliders" className="mcl-l11-ctl">
          <div className="mcl-l11-row"><span>Selected Pin</span>
            <div className="mcl-l11-chips">{PINS.map((p) => <button key={p.n} type="button" className={sel === p.n ? "on" : ""} onClick={() => setSel(p.n)}>PA{p.n}</button>)}</div>
          </div>
          <div className="mcl-l11-row"><span>Mode</span>
            <div className="mcl-g2-btns"><button type="button" className={info.moder === 1 ? "on blue" : ""} onClick={() => setMode(true)}>Output</button><button type="button" className={info.moder === 0 ? "on blue" : ""} onClick={() => setMode(false)}>Input</button></div>
          </div>
          <div className="mcl-l11-row"><span>Output</span>
            <div className="mcl-g2-btns"><button type="button" disabled={info.moder !== 1} className={info.moder === 1 && !info.odr ? "on dark" : ""} onClick={() => setOut(false)}>LOW</button><button type="button" disabled={info.moder !== 1} className={info.moder === 1 && info.odr ? "on green" : ""} onClick={() => setOut(true)}>HIGH</button></div>
          </div>
          <div className="mcl-l11-row"><span>Pull</span>
            <div className="mcl-g2-btns three">{PULLS.map((l, k) => <button key={l} type="button" className={info.pupd === k ? "on blue" : ""} onClick={() => setPull(k)}>{l}</button>)}</div>
          </div>
          <div className="mcl-l11-read">
            <code>MODER{sel} = {info.moder.toString(2).padStart(2, "0")}</code><code>PUPDR{sel} = {info.pupd.toString(2).padStart(2, "0")}</code><code>ODR{sel} = {info.odr}</code><code>IDR{sel} = {info.floating ? "?" : info.level}</code>
            <b className={info.floating ? "warn" : info.level ? "hi" : ""}>{volts(info)}</b>
          </div>
          {firmwareDrives ? <p className="mcl-g2-hint"><Icon name="alert" size={14} />The firmware also writes PA{sel} in its loop. Halt the CPU to hold your value.</p> : null}
          {info.floating ? <p className="mcl-g2-hint warn"><Icon name="alert" size={14} />No pull resistor and nothing driving the pin: IDR reads random noise.</p> : null}
          <div className="mcl-g2-faults">
            <Toggle label="Halt CPU (debugger)" checked={params.halted} onChange={(v) => lab.setParam("halted", v)} hint="Peripherals keep running but the core stops executing, so register writes from these controls stick" />
            <b><Icon name="bug" size={14} />Fault injection</b>
            <Toggle label="GPIOA clock not enabled" checked={params.clockOff} onChange={(v) => lab.setParam("clockOff", v)} hint="RCC->AHB1ENR bit 0 stays 0, so every GPIOA register write is ignored" />
            <Toggle label="Broken wire to SW1" checked={params.brokenWire} onChange={(v) => lab.setParam("brokenWire", v)} hint="SW1 no longer reaches PA0; the pin only sees its pull resistor" />
          </div>
        </Panel>

        <Panel title="Live Logic Level" icon="wave" className="mcl-l11-scope" tools={<span className="mcl-chip">PA{sel} · {info.mode}</span>}>
          <Scope traces={[trace]} now={mcu.time} window={4} height={118} frame={lab.frame} ariaLabel={`Logic level of PA${sel}`} />
        </Panel>

        <CodeEditor lab={lab} className="mcl-l11-code" languages={[{ label: "C (registers)", code: REG }, { label: "C (HAL)", code: HAL }]} />

        <div className="mcl-l11-tasks"><LearningNotes variant="tasks" title="Learning Tasks" notes={{
          takeaways: [],
          observe: "Configure PA5 as output: the red LED blinks every 500 ms because the firmware toggles ODR5.",
          tryIt: "Halt the CPU, select PA5 and toggle HIGH / LOW from the controls.",
          measure: `PA0 reads ${all[0].floating ? "noise" : all[0].level} with ${["no pull", "pull-up", "pull-down", "?"][all[0].pupd]}; press SW1 and compare.`,
          modify: "Configure PA0 as input and switch between Floating, Pull-up and Pull-down while pressing SW1.",
          runAgain: "Change PUPDR in the code (or GPIO_NOPULL in the HAL version) and Run again.",
          challenge: "Why does SW1 need a pull-down while SW2 needs a pull-up? Rewire the logic so both buttons light their LED when pressed.",
          checks: [{ label: "PA5 configured as output", done: seen.out }, { label: "Toggled an output HIGH / LOW", done: seen.toggles >= 2 }, { label: "Read SW1 on PA0 as 1", done: seen.in0 }, { label: "Compared floating, pull-up and pull-down", done: seen.pulls.length >= 3 }],
        }} /></div>
      </div>
    </LabShell>
  );
}
