import type { ReactNode } from "react";

export const LED_COLORS = { red: "#ef4444", green: "#22c55e", yellow: "#facc15", blue: "#3b82f6", white: "#f8fafc", orange: "#fb923c" } as const;
export type LedColor = keyof typeof LED_COLORS;

/** Glow-ready SVG filter definitions; render once per <svg>. */
export function HwDefs({ id = "mcl" }: { id?: string }) {
  return (
    <defs>
      <filter id={`${id}-glow`} x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="3.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <linearGradient id={`${id}-pcb`} x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#f7f8f9" /><stop offset="1" stopColor="#dfe3e8" /></linearGradient>
      <linearGradient id={`${id}-pcb-blue`} x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#2563b8" /><stop offset="1" stopColor="#1b4d94" /></linearGradient>
      <linearGradient id={`${id}-rpi`} x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#3f9b4f" /><stop offset="1" stopColor="#2a7a3a" /></linearGradient>
      <linearGradient id={`${id}-chip`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2b2f36" /><stop offset="1" stopColor="#15181d" /></linearGradient>
      <linearGradient id={`${id}-metal`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#e9edf1" /><stop offset="1" stopColor="#9aa4ae" /></linearGradient>
      <radialGradient id={`${id}-led-off`}><stop offset="0" stopColor="#ffffff" stopOpacity=".55" /><stop offset="1" stopColor="#ffffff" stopOpacity="0" /></radialGradient>
    </defs>
  );
}

export function SvgLed({ x, y, on, color = "green", r = 6, label, id = "mcl", brightness = 1 }: { x: number; y: number; on: boolean; color?: LedColor | string; r?: number; label?: string; id?: string; brightness?: number }) {
  const c = (LED_COLORS as Record<string, string>)[color] ?? color;
  const b = on ? Math.max(0.15, Math.min(1, brightness)) : 0;
  return (
    <g className="mcl-svg-led">
      {b > 0 ? <circle cx={x} cy={y} r={r * 2.6} fill={c} opacity={0.32 * b} filter={`url(#${id}-glow)`} /> : null}
      <circle cx={x} cy={y} r={r} fill={c} opacity={b > 0 ? 0.45 + 0.55 * b : 0.32} stroke="#00000033" />
      <circle cx={x - r * 0.3} cy={y - r * 0.35} r={r * 0.38} fill="url(#mcl-led-off)" />
      {label ? <text x={x} y={y + r + 11} textAnchor="middle" className="mcl-svg-label">{label}</text> : null}
    </g>
  );
}

export function SvgButton({ x, y, pressed, onPress, color = "#1f2937", cap = "#2563eb", label, size = 16 }: { x: number; y: number; pressed: boolean; onPress?: (down: boolean) => void; color?: string; cap?: string; label?: string; size?: number }) {
  const handlers = onPress ? {
    onPointerDown: (e: React.PointerEvent) => { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); onPress(true); },
    onPointerUp: () => onPress(false),
    onPointerCancel: () => onPress(false),
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onPress(true); } },
    onKeyUp: (e: React.KeyboardEvent) => { if (e.key === " " || e.key === "Enter") onPress(false); },
  } : {};
  return (
    <g className={`mcl-svg-btn ${onPress ? "interactive" : ""}`} role={onPress ? "button" : undefined} tabIndex={onPress ? 0 : undefined} aria-pressed={pressed} aria-label={label ? `${label} button` : undefined} {...handlers}>
      <rect x={x - size / 2} y={y - size / 2} width={size} height={size} rx={2.5} fill={color} />
      <circle cx={x} cy={y + (pressed ? 0.8 : 0)} r={size * 0.32} fill={cap} stroke="#00000055" />
      {pressed ? <circle cx={x} cy={y + 0.8} r={size * 0.32} fill="#00000033" /> : null}
      {label ? <text x={x} y={y + size / 2 + 10} textAnchor="middle" className="mcl-svg-label">{label}</text> : null}
    </g>
  );
}

function Header({ x, y, n, vertical = true, pitch = 7.2, color = "#1c1f24" }: { x: number; y: number; n: number; vertical?: boolean; pitch?: number; color?: string }) {
  const w = vertical ? 2 * pitch : n * pitch, h = vertical ? n * pitch : 2 * pitch;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={1.2} fill={color} />
      {Array.from({ length: n * 2 }, (_, i) => {
        const a = Math.floor(i / 2), b = i % 2;
        const cx = vertical ? x + pitch * (b + 0.5) : x + pitch * (a + 0.5);
        const cy = vertical ? y + pitch * (a + 0.5) : y + pitch * (b + 0.5);
        return <rect key={i} x={cx - 1.4} y={cy - 1.4} width={2.8} height={2.8} fill="#d4af37" />;
      })}
    </g>
  );
}

export interface NucleoProps {
  x?: number; y?: number; scale?: number;
  ld2?: boolean | number;
  ld1?: boolean;
  power?: boolean;
  b1Pressed?: boolean;
  onB1?: (down: boolean) => void;
  onReset?: () => void;
  chipLabel?: string;
  model?: string;
  pinGlow?: Record<string, string>;
  id?: string;
  children?: ReactNode;
}

/** STM32 Nucleo-64 board, portrait orientation, 200×340 units before scaling. */
export function NucleoBoard({ x = 0, y = 0, scale = 1, ld2 = false, ld1 = true, power = true, b1Pressed = false, onB1, onReset, chipLabel = "STM32", model = "NUCLEO-F401RE", id = "mcl", children }: NucleoProps) {
  const ld2Level = typeof ld2 === "number" ? ld2 : ld2 ? 1 : 0;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} className="mcl-nucleo">
      <rect x={4} y={6} width={192} height={334} rx={6} fill="#00000022" />
      <rect x={0} y={0} width={192} height={334} rx={6} fill={`url(#${id}-pcb)`} stroke="#b9c0c8" />
      <rect x={20} y={0} width={152} height={92} fill="#eceff2" stroke="#c9d0d7" />
      <line x1={0} y1={92} x2={192} y2={92} stroke="#b0b8c1" strokeDasharray="4 3" />
      <rect x={78} y={-8} width={36} height={20} rx={2} fill={`url(#${id}-metal)`} stroke="#7d8790" />
      <rect x={86} y={30} width={28} height={28} rx={2} fill={`url(#${id}-chip)`} />
      <text x={100} y={74} textAnchor="middle" className="mcl-svg-silk">ST-LINK V2-1</text>
      <SvgLed x={38} y={22} r={3.6} on={ld1 && power} color="red" id={id} />
      <text x={38} y={35} textAnchor="middle" className="mcl-svg-silk">LD1</text>
      <SvgLed x={154} y={22} r={3.6} on={power} color="red" id={id} />
      <text x={154} y={35} textAnchor="middle" className="mcl-svg-silk">LD3</text>
      <Header x={2} y={100} n={19} />
      <Header x={175.6} y={100} n={19} />
      <Header x={22} y={118} n={8} pitch={6.6} color="#2a2d33" />
      <Header x={158} y={112} n={10} pitch={6.6} color="#2a2d33" />
      <rect x={62} y={170} width={68} height={68} rx={3} fill={`url(#${id}-chip)`} />
      {Array.from({ length: 16 }, (_, i) => <g key={i}><rect x={65 + i * 4} y={166} width={1.8} height={4} fill="#b8c0c8" /><rect x={65 + i * 4} y={238} width={1.8} height={4} fill="#b8c0c8" /><rect x={58} y={173 + i * 4} width={4} height={1.8} fill="#b8c0c8" /><rect x={130} y={173 + i * 4} width={4} height={1.8} fill="#b8c0c8" /></g>)}
      <circle cx={70} cy={178} r={2} fill="#3b4048" />
      <text x={96} y={200} textAnchor="middle" fill="#d6dbe1" fontSize="7" fontWeight="700">ST</text>
      <text x={96} y={212} textAnchor="middle" fill="#e5e9ee" fontSize="8.5" fontWeight="700">{chipLabel}</text>
      <text x={96} y={223} textAnchor="middle" fill="#9aa3ad" fontSize="5.5">ARM Cortex-M4</text>
      <text x={96} y={262} textAnchor="middle" className="mcl-svg-silk-strong">STM32</text>
      <text x={96} y={273} textAnchor="middle" className="mcl-svg-silk">Nucleo</text>
      <SvgLed x={66} y={146} r={4} on={ld2Level > 0} brightness={ld2Level} color="green" id={id} />
      <text x={66} y={159} textAnchor="middle" className="mcl-svg-silk">LD2</text>
      <SvgButton x={58} y={300} pressed={b1Pressed} onPress={onB1} cap="#2563eb" size={18} />
      <text x={58} y={322} textAnchor="middle" className="mcl-svg-silk">B1 USER</text>
      <SvgButton x={134} y={300} pressed={false} onPress={onReset ? (d) => { if (d) onReset(); } : undefined} cap="#111827" size={18} />
      <text x={134} y={322} textAnchor="middle" className="mcl-svg-silk">B2 RESET</text>
      <text x={96} y={333} textAnchor="middle" className="mcl-svg-silk">{model}</text>
      {children}
    </g>
  );
}

/** Arduino Uno R3, landscape, 270×200 units before scaling. `l` = on-board "L" LED (D13 / PB5). */
export function ArduinoUno({ x = 0, y = 0, scale = 1, l = false, tx = false, power = true, id = "mcl", onReset }: { x?: number; y?: number; scale?: number; l?: boolean | number; tx?: boolean; power?: boolean; id?: string; onReset?: () => void }) {
  const lv = typeof l === "number" ? l : l ? 1 : 0;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect x={4} y={6} width={266} height={196} rx={8} fill="#00000022" />
      <path d="M0 8a8 8 0 0 1 8-8h244l12 12v176l-12 12H8a8 8 0 0 1-8-8z" fill={`url(#${id}-pcb-blue)`} stroke="#123a70" />
      <rect x={-14} y={22} width={48} height={42} rx={2} fill={`url(#${id}-metal)`} stroke="#6b7580" />
      <rect x={-10} y={132} width={40} height={36} rx={3} fill="#1f2328" />
      <rect x={70} y={6} width={150} height={14} rx={1.5} fill="#1c1f24" />
      {Array.from({ length: 18 }, (_, i) => <rect key={i} x={74 + i * 8.2} y={10} width={3.4} height={6} fill="#d4af37" />)}
      <rect x={100} y={180} width={144} height={14} rx={1.5} fill="#1c1f24" />
      {Array.from({ length: 14 }, (_, i) => <rect key={i} x={104 + i * 10} y={184} width={3.4} height={6} fill="#d4af37" />)}
      <rect x={110} y={108} width={128} height={30} rx={2} fill={`url(#${id}-chip)`} />
      {Array.from({ length: 14 }, (_, i) => <g key={i}><rect x={114 + i * 8.8} y={104} width={3} height={4} fill="#c0c7cf" /><rect x={114 + i * 8.8} y={138} width={3} height={4} fill="#c0c7cf" /></g>)}
      <text x={174} y={127} textAnchor="middle" fill="#cfd5dc" fontSize="8" fontWeight="700">ATMEGA328P</text>
      <circle cx={196} cy={60} r={22} fill="#ffffff14" />
      <text x={196} y={56} textAnchor="middle" fill="#fff" fontSize="15" fontWeight="900">∞</text>
      <text x={196} y={72} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="800" letterSpacing="1">UNO</text>
      <text x={150} y={92} textAnchor="middle" fill="#e6eefb" fontSize="9" fontWeight="800">ARDUINO</text>
      <rect x={52} y={70} width={20} height={12} rx={2} fill="#c8ced6" />
      <SvgLed x={92} y={36} r={3.4} on={lv > 0} brightness={lv} color="orange" id={id} />
      <text x={92} y={48} textAnchor="middle" fill="#dbe7fb" fontSize="6">L</text>
      <SvgLed x={92} y={58} r={2.8} on={tx} color="orange" id={id} />
      <text x={102} y={60} fill="#dbe7fb" fontSize="5.5">TX</text>
      <SvgLed x={238} y={96} r={3} on={power} color="green" id={id} />
      <text x={238} y={108} textAnchor="middle" fill="#dbe7fb" fontSize="5.5">ON</text>
      <SvgButton x={22} y={92} pressed={false} onPress={onReset ? (d) => { if (d) onReset(); } : undefined} cap="#b91c1c" size={14} />
      <text x={22} y={110} textAnchor="middle" fill="#dbe7fb" fontSize="5.5">RESET</text>
    </g>
  );
}

/** TI MSP-EXP430G2 LaunchPad, landscape, 270×200 units before scaling. `led1` = red P1.0, `led2` = green P1.6. */
export function LaunchPad({ x = 0, y = 0, scale = 1, led1 = false, led2 = false, power = true, id = "mcl", onS2 }: { x?: number; y?: number; scale?: number; led1?: boolean | number; led2?: boolean | number; power?: boolean; id?: string; onS2?: (down: boolean) => void }) {
  const a = typeof led1 === "number" ? led1 : led1 ? 1 : 0, b = typeof led2 === "number" ? led2 : led2 ? 1 : 0;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect x={4} y={6} width={266} height={196} rx={6} fill="#00000022" />
      <rect x={0} y={0} width={266} height={196} rx={6} fill="#c8102e" stroke="#7d0a1d" />
      <rect x={0} y={0} width={266} height={56} rx={6} fill="#b00d28" />
      <line x1={0} y1={56} x2={266} y2={56} stroke="#ffffff55" strokeDasharray="4 3" />
      <rect x={112} y={-8} width={40} height={18} rx={2} fill={`url(#${id}-metal)`} stroke="#6b7580" />
      <rect x={60} y={20} width={22} height={22} rx={2} fill={`url(#${id}-chip)`} />
      <text x={190} y={36} textAnchor="middle" fill="#fde2e6" fontSize="7" fontWeight="700">eZ-FET emulation</text>
      <rect x={12} y={66} width={14} height={118} rx={1.5} fill="#1c1f24" />
      <rect x={240} y={66} width={14} height={118} rx={1.5} fill="#1c1f24" />
      {Array.from({ length: 10 }, (_, i) => <g key={i}><rect x={17} y={71 + i * 11.4} width={4} height={4} fill="#d4af37" /><rect x={245} y={71 + i * 11.4} width={4} height={4} fill="#d4af37" /></g>)}
      <rect x={96} y={86} width={74} height={50} rx={2} fill="#1c1f24" stroke="#555" />
      <rect x={104} y={94} width={58} height={34} rx={2} fill={`url(#${id}-chip)`} />
      <text x={133} y={110} textAnchor="middle" fill="#d1d5db" fontSize="6.5" fontWeight="700">MSP430</text>
      <text x={133} y={120} textAnchor="middle" fill="#9ca3af" fontSize="5.5">G2553</text>
      <text x={133} y={160} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="900" fontStyle="italic">LaunchPad</text>
      <text x={133} y={176} textAnchor="middle" fill="#fde2e6" fontSize="6.5">TEXAS INSTRUMENTS</text>
      <SvgLed x={52} y={150} r={4} on={a > 0} brightness={a} color="red" id={id} />
      <text x={52} y={164} textAnchor="middle" fill="#fde2e6" fontSize="5.5">LED1 P1.0</text>
      <SvgLed x={76} y={150} r={4} on={b > 0} brightness={b} color="green" id={id} />
      <text x={78} y={164} textAnchor="middle" fill="#fde2e6" fontSize="5.5">LED2 P1.6</text>
      <SvgButton x={212} y={150} pressed={false} onPress={onS2} cap="#111827" size={14} />
      <text x={212} y={168} textAnchor="middle" fill="#fde2e6" fontSize="5.5">S2 P1.3</text>
      <SvgLed x={212} y={74} r={2.6} on={power} color="green" id={id} />
    </g>
  );
}

/** Raspberry Pi 4 model B, landscape, 300×200 units before scaling. */
export function RaspberryPi({ x = 0, y = 0, scale = 1, activity = false, power = true, id = "mcl" }: { x?: number; y?: number; scale?: number; activity?: boolean; power?: boolean; id?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect x={4} y={6} width={300} height={200} rx={10} fill="#00000022" />
      <rect x={0} y={0} width={300} height={200} rx={10} fill={`url(#${id}-rpi)`} stroke="#1f5c2b" />
      {[[10, 10], [290, 10], [10, 190], [290, 190]].map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={5} fill="#e5e7eb" stroke="#9ca3af" />)}
      <rect x={24} y={6} width={180} height={18} rx={2} fill="#111" />
      {Array.from({ length: 40 }, (_, i) => <rect key={i} x={27 + (i % 20) * 8.8} y={8 + Math.floor(i / 20) * 8} width={3} height={3} fill="#d4af37" />)}
      <rect x={100} y={70} width={58} height={58} rx={3} fill={`url(#${id}-metal)`} stroke="#6b7280" />
      <text x={129} y={97} textAnchor="middle" fill="#374151" fontSize="7" fontWeight="700">BCM2711</text>
      <text x={129} y={108} textAnchor="middle" fill="#4b5563" fontSize="5.5">Cortex-A72</text>
      <rect x={180} y={76} width={44} height={44} rx={2} fill="#1f2328" />
      <text x={202} y={101} textAnchor="middle" fill="#9ca3af" fontSize="6">LPDDR4</text>
      <rect x={244} y={30} width={60} height={40} rx={2} fill={`url(#${id}-metal)`} stroke="#6b7280" />
      <rect x={244} y={80} width={60} height={40} rx={2} fill={`url(#${id}-metal)`} stroke="#6b7280" />
      <rect x={250} y={86} width={48} height={8} fill="#2563eb" /><rect x={250} y={36} width={48} height={8} fill="#2563eb" />
      <rect x={244} y={130} width={58} height={48} rx={2} fill={`url(#${id}-metal)`} stroke="#6b7280" />
      <text x={273} y={158} textAnchor="middle" fill="#374151" fontSize="7">ETH</text>
      {[40, 96].map((cx) => <rect key={cx} x={cx} y={186} width={30} height={16} rx={2} fill={`url(#${id}-metal)`} stroke="#6b7280" />)}
      <rect x={150} y={186} width={22} height={14} rx={2} fill={`url(#${id}-metal)`} />
      <rect x={-8} y={70} width={16} height={60} rx={2} fill="#222" />
      <text x={0} y={140} textAnchor="middle" fill="#d1fae5" fontSize="5">microSD</text>
      <SvgLed x={14} y={176} r={3} on={power} color="red" id={id} />
      <SvgLed x={24} y={176} r={3} on={activity} color="green" id={id} />
      <text x={70} y={160} fill="#e7f6ea" fontSize="10" fontWeight="700">Raspberry Pi 4</text>
    </g>
  );
}

export function Breadboard({ x, y, w, h, cols = 14, rows = 6 }: { x: number; y: number; w: number; h: number; cols?: number; rows?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} fill="#fbfbfa" stroke="#d5d8dc" />
      <line x1={x + 6} x2={x + w - 6} y1={y + 9} y2={y + 9} stroke="#ef4444" strokeWidth={1} opacity={0.6} />
      <line x1={x + 6} x2={x + w - 6} y1={y + h - 9} y2={y + h - 9} stroke="#3b82f6" strokeWidth={1} opacity={0.6} />
      {Array.from({ length: cols * rows }, (_, i) => {
        const c = i % cols, r = Math.floor(i / cols);
        return <circle key={i} cx={x + 14 + (c * (w - 28)) / (cols - 1)} cy={y + 22 + (r * (h - 44)) / Math.max(1, rows - 1)} r={1.6} fill="#c7cbd1" />;
      })}
    </g>
  );
}

export function Wire({ d, color, live = false, width = 2.6 }: { d: string; color: string; live?: boolean; width?: number }) {
  return <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" className={live ? "mcl-wire-live" : ""} />;
}

export function Resistor({ x, y, vertical = false, label }: { x: number; y: number; vertical?: boolean; label?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${vertical ? 90 : 0})`}>
      <line x1={-16} x2={16} y1={0} y2={0} stroke="#9ca3af" strokeWidth={1.6} />
      <rect x={-9} y={-3.5} width={18} height={7} rx={3} fill="#e8cfa2" stroke="#a88a5c" />
      {[-5, -1.5, 2, 5.5].map((dx, i) => <rect key={i} x={dx} y={-3.5} width={1.6} height={7} fill={["#8b5a2b", "#111", "#ef4444", "#d4af37"][i]} />)}
      {label ? <text x={0} y={-6} textAnchor="middle" className="mcl-svg-label">{label}</text> : null}
    </g>
  );
}

export function Potentiometer({ x, y, value, onChange, label, r = 16 }: { x: number; y: number; value: number; onChange?: (v: number) => void; label?: string; r?: number }) {
  const ang = -135 + value * 270;
  const set = (e: React.PointerEvent<SVGGElement>) => {
    if (!onChange || !(e.buttons & 1)) return;
    const svg = (e.currentTarget.ownerSVGElement)!;
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    let a = (Math.atan2(p.x - x, -(p.y - y)) * 180) / Math.PI;
    a = Math.max(-135, Math.min(135, a));
    onChange((a + 135) / 270);
  };
  return (
    <g className={onChange ? "mcl-svg-pot interactive" : "mcl-svg-pot"} onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); set(e); }} onPointerMove={set}
      role={onChange ? "slider" : undefined} tabIndex={onChange ? 0 : undefined} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-label={label}
      onKeyDown={(e) => { if (!onChange) return; if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange(Math.min(1, value + 0.02)); if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange(Math.max(0, value - 0.02)); }}>
      <rect x={x - r - 2} y={y - r - 2} width={2 * r + 4} height={2 * r + 4} rx={4} fill="#1d4ed8" />
      <circle cx={x} cy={y} r={r} fill="#e5e7eb" stroke="#6b7280" />
      <line x1={x} y1={y} x2={x + Math.sin((ang * Math.PI) / 180) * (r - 3)} y2={y - Math.cos((ang * Math.PI) / 180) * (r - 3)} stroke="#111827" strokeWidth={3} strokeLinecap="round" />
      {label ? <text x={x} y={y + r + 13} textAnchor="middle" className="mcl-svg-label">{label}</text> : null}
    </g>
  );
}

/** 30-pin ESP32 DevKit V1 headers, top (antenna end) to bottom (USB end). GPIO number or null for power/EN. */
export const ESP32_LEFT: Array<[string, number | null]> = [["EN", null], ["VP", 36], ["VN", 39], ["D34", 34], ["D35", 35], ["D32", 32], ["D33", 33], ["D25", 25], ["D26", 26], ["D27", 27], ["D14", 14], ["D12", 12], ["D13", 13], ["GND", null], ["VIN", null]];
export const ESP32_RIGHT: Array<[string, number | null]> = [["D23", 23], ["D22", 22], ["TX0", 1], ["RX0", 3], ["D21", 21], ["D19", 19], ["D18", 18], ["D5", 5], ["TX2", 17], ["RX2", 16], ["D4", 4], ["D2", 2], ["D15", 15], ["GND", null], ["3V3", null]];
const ESP_PIN_Y = (i: number) => 72 + i * 10;

/** Header pin position of a GPIO in ESP32 DevKit board units (120×232). */
export function esp32Pin(gpio: number): { x: number; y: number; side: "L" | "R" } | null {
  const l = ESP32_LEFT.findIndex(([, g]) => g === gpio);
  if (l >= 0) return { x: 9, y: ESP_PIN_Y(l), side: "L" };
  const r = ESP32_RIGHT.findIndex(([, g]) => g === gpio);
  return r >= 0 ? { x: 111, y: ESP_PIN_Y(r), side: "R" } : null;
}

/** ESP32 DevKit V1 (ESP32-WROOM-32), portrait, antenna up, 120×232 units before scaling. `led` = blue LED on GPIO2. */
export function Esp32DevKit({ x = 0, y = 0, scale = 1, led = false, power = true, id = "mcl", pinGlow = {}, onReset }: { x?: number; y?: number; scale?: number; led?: boolean | number; power?: boolean; id?: string; pinGlow?: Record<number, string>; onReset?: () => void }) {
  const lv = typeof led === "number" ? led : led ? 1 : 0;
  const pins = (list: Array<[string, number | null]>, px: number, anchor: "start" | "end") => list.map(([label, g], i) => {
    const cy = ESP_PIN_Y(i);
    const glow = g !== null ? pinGlow[g] : undefined;
    return (
      <g key={label + i}>
        {glow ? <circle cx={px} cy={cy} r={4.6} fill="none" stroke={glow} strokeWidth={1.6} /> : null}
        <rect x={px - 1.8} y={cy - 1.8} width={3.6} height={3.6} fill="#d4af37" />
        <text x={anchor === "start" ? px + 7 : px - 7} y={cy + 1.8} textAnchor={anchor} fontSize="5" fontWeight="600" fill={glow ?? "#e5e7eb"}>{label}</text>
      </g>
    );
  });
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} className="mcl-esp32">
      <rect x={3} y={5} width={120} height={232} rx={5} fill="#00000026" />
      <rect x={0} y={0} width={120} height={232} rx={5} fill="#17191d" stroke="#30353d" />
      <rect x={4} y={66} width={10} height={152} rx={1.2} fill="#0c0d10" />
      <rect x={106} y={66} width={10} height={152} rx={1.2} fill="#0c0d10" />
      <rect x={30} y={3} width={60} height={104} rx={2} fill="#22262c" stroke="#3a4048" />
      <path d="M36 9 h6 v12 h6 v-12 h6 v12 h6 v-12 h6 v12 h6 v-12 h6" fill="none" stroke="#c9a640" strokeWidth={1.4} />
      <rect x={32.5} y={28} width={55} height={76} rx={2} fill={`url(#${id}-metal)`} stroke="#7d8790" />
      <circle cx={60} cy={50} r={7} fill="none" stroke="#5b6570" strokeWidth={1.2} />
      <path d="M56 52 q4 -8 8 0" fill="none" stroke="#5b6570" strokeWidth={1.2} />
      <text x={60} y={70} textAnchor="middle" fontSize="6.2" fontWeight="800" fill="#2b323a">ESP32-WROOM-32</text>
      <text x={60} y={79} textAnchor="middle" fontSize="4.6" fill="#4b5563">Wi-Fi + Bluetooth</text>
      <text x={60} y={92} textAnchor="middle" fontSize="4.2" fill="#5b6570">ESPRESSIF</text>
      {pins(ESP32_LEFT, 9, "start")}
      {pins(ESP32_RIGHT, 111, "end")}
      <rect x={34} y={124} width={13} height={9} rx={1} fill={`url(#${id}-chip)`} />
      <text x={40.5} y={140} textAnchor="middle" fontSize="3.8" fill="#9aa3ad">AMS1117</text>
      <rect x={60} y={134} width={20} height={20} rx={1.5} fill={`url(#${id}-chip)`} />
      <text x={70} y={146} textAnchor="middle" fontSize="4" fontWeight="700" fill="#9aa3ad">CP2102</text>
      <text x={60} y={168} textAnchor="middle" fontSize="4.8" fontWeight="700" fill="#d1d5db">ESP32 DEVKIT V1</text>
      <SvgLed x={42} y={184} r={2.8} on={power} color="red" id={id} />
      <text x={42} y={193} textAnchor="middle" fontSize="4" fill="#cbd5e1">PWR</text>
      <SvgLed x={78} y={184} r={2.8} on={lv > 0} brightness={lv} color="blue" id={id} />
      <text x={78} y={193} textAnchor="middle" fontSize="4" fill="#cbd5e1">D2</text>
      <SvgButton x={32} y={206} pressed={false} onPress={onReset ? (d) => { if (d) onReset(); } : undefined} color="#2b2f36" cap="#e5e7eb" size={11} />
      <text x={32} y={218} textAnchor="middle" fontSize="4.2" fill="#cbd5e1">EN</text>
      <SvgButton x={88} y={206} pressed={false} color="#2b2f36" cap="#e5e7eb" size={11} />
      <text x={88} y={218} textAnchor="middle" fontSize="4.2" fill="#cbd5e1">BOOT</text>
      <rect x={47} y={218} width={26} height={16} rx={2} fill={`url(#${id}-metal)`} stroke="#6b7580" />
      <rect x={52} y={222} width={16} height={5} rx={1} fill="#4b5563" />
    </g>
  );
}

export function ChipBlock({ x, y, w, h, label, sub, active = false, color = "#2563eb", onClick, selected = false }: { x: number; y: number; w: number; h: number; label: string; sub?: string; active?: boolean; color?: string; onClick?: () => void; selected?: boolean }) {
  return (
    <g className={`mcl-block ${onClick ? "interactive" : ""} ${selected ? "selected" : ""}`} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={active ? color : "#ffffff"} stroke={selected ? "#f59e0b" : color} strokeWidth={selected ? 2.5 : 1.4} opacity={active ? 0.95 : 1} />
      <text x={x + w / 2} y={y + h / 2 + (sub ? -2 : 4)} textAnchor="middle" fill={active ? "#fff" : "#10284b"} fontSize="11" fontWeight="700">{label}</text>
      {sub ? <text x={x + w / 2} y={y + h / 2 + 11} textAnchor="middle" fill={active ? "#e0ecff" : "#5c7190"} fontSize="8.5">{sub}</text> : null}
    </g>
  );
}
