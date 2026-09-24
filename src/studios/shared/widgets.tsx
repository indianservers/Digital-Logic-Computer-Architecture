import { useEffect, useRef, useState } from "react";
import type { LogicBit, LogicVector } from "../../types/logic";
import { toHex, toSigned, toUnsigned } from "../../engines/digital/vector";
import { SEGMENT_NAMES } from "../../engines/digital/routing";

export function BitSwitch({ on, label, onChange }: { on: boolean; label: string; onChange: (next: boolean) => void }) {
  return (
    <button className={on ? "bit-switch on" : "bit-switch"} aria-label={label} aria-pressed={on} onClick={() => onChange(!on)}>
      <span className="bit-thumb">{on ? 1 : 0}</span>
      <small>{label}</small>
    </button>
  );
}

export function WordEditor({ bits, onChange, labels }: { bits: Array<0 | 1>; onChange: (next: Array<0 | 1>) => void; labels?: string[] }) {
  return (
    <div className="bits">
      {bits.map((bit, index) => (
        <BitSwitch key={index} on={bit === 1} label={labels?.[index] ?? String(bits.length - 1 - index)} onChange={(next) => {
          const copy = bits.slice();
          copy[index] = next ? 1 : 0;
          onChange(copy);
        }} />
      ))}
    </div>
  );
}

export function ValueReadout({ bits }: { bits: LogicVector }) {
  const unsigned = toUnsigned(bits);
  const signed = toSigned(bits);
  return (
    <div className="row">
      <span className="metric"><span>Binary</span><b className="mono">{bits.map((bit) => (bit === 0 || bit === 1 ? bit : bit)).join("")}</b></span>
      <span className="metric"><span>Unsigned</span><b>{unsigned ?? "X"}</b></span>
      <span className="metric"><span>Signed</span><b>{signed ?? "X"}</b></span>
      <span className="metric"><span>Hex</span><b>{toHex(bits)}</b></span>
    </div>
  );
}

export function Waveform({ traces, cursor, onCursor, onTrace }: {
  traces: Array<{ id: string; name: string; values: LogicBit[]; active?: boolean; color?: string }>;
  cursor?: number | null;
  onCursor?: (index: number) => void;
  onTrace?: (id: string) => void;
}) {
  const width = 640;
  const row = 36;
  const count = Math.max(1, traces[0]?.values.length ?? 1);
  const step = width / count;
  return (
    <svg className="wave" viewBox={`0 0 ${width + 48} ${traces.length * row + 16}`} role="img" aria-label="Timing diagram">
      {traces.map((trace, rowIndex) => {
        const y = rowIndex * row + 8;
        let d = "";
        trace.values.forEach((value, index) => {
          const x = 48 + index * step;
          const level = value === 1 ? y + 6 : value === 0 ? y + 24 : y + 15;
          d += index === 0 ? `M ${x} ${level}` : ` H ${x} V ${level} H ${x + step}`;
        });
        return (
          <g key={trace.id} onClick={() => onTrace?.(trace.id)} style={{ cursor: onTrace ? "pointer" : "default" }}>
            <text x="0" y={y + 18} fontSize="11" fontWeight={trace.active ? 800 : 600} fill={trace.color ?? (trace.active ? "#2F6FED" : "#667085")}>{trace.name}</text>
            <path d={d} fill="none" stroke={trace.color ?? (trace.active ? "#2F6FED" : "#34507a")} strokeWidth={trace.values.some((value) => value === "Z") ? 1.5 : 2} strokeDasharray={trace.values.includes("Z") ? "4 3" : undefined} />
            {trace.values.map((value, index) => value === "X" ? <text key={index} x={48 + index * step + 2} y={y + 18} fontSize="10" fill="#d92d20">X</text> : null)}
          </g>
        );
      })}
      {cursor !== null && cursor !== undefined ? <line x1={48 + cursor * step} x2={48 + cursor * step} y1="0" y2={traces.length * row} stroke="#2F6FED" strokeDasharray="3 3" /> : null}
      {onCursor ? (
        <rect x="48" y="0" width={width} height={traces.length * row} fill="transparent" onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - rect.left) / rect.width;
          onCursor(Math.min(count - 1, Math.max(0, Math.floor(ratio * count))));
        }} />
      ) : null}
    </svg>
  );
}

const SEG_PATH: Record<(typeof SEGMENT_NAMES)[number], string> = {
  a: "M18 8 H62 L58 14 H22 Z",
  b: "M66 12 L72 18 V48 L66 54 L60 48 V18 Z",
  c: "M66 58 L72 64 V94 L66 100 L60 94 V64 Z",
  d: "M18 104 H62 L58 98 H22 Z",
  e: "M14 58 L20 64 V94 L14 100 L8 94 V64 Z",
  f: "M14 12 L20 18 V48 L14 54 L8 48 V18 Z",
  g: "M18 56 H62 L58 62 H22 L18 56 L22 50 H58 Z",
};

export function SevenSeg({ segments, valid }: { segments: Array<0 | 1>; valid: boolean }) {
  return (
    <svg viewBox="0 0 80 112" width="88" height="120" role="img" aria-label={valid ? "Seven segment digit" : "Invalid BCD"}>
      {SEGMENT_NAMES.map((name, index) => (
        <path key={name} d={SEG_PATH[name]} fill={segments[index] === 1 ? "#2F6FED" : "#e6edf6"}>
          <title>{name} {segments[index] === 1 ? "on" : "off"}</title>
        </path>
      ))}
      {!valid ? <text x="40" y="64" textAnchor="middle" fontSize="12" fill="#d92d20">inv</text> : null}
    </svg>
  );
}

export function useTicker(playing: boolean, speed: number, onTick: () => void) {
  const tick = useRef(onTick);
  tick.current = onTick;
  useEffect(() => {
    if (!playing) return undefined;
    const id = window.setInterval(() => tick.current(), Math.max(80, 700 / speed));
    return () => window.clearInterval(id);
  }, [playing, speed]);
}

export function SpeedPicker({ speed, onChange }: { speed: number; onChange: (speed: number) => void }) {
  return (
    <div className="seg" role="radiogroup" aria-label="Visualization speed">
      {[0.25, 0.5, 1, 2, 4].map((value) => (
        <button key={value} role="radio" aria-checked={speed === value} className={speed === value ? "active" : ""} onClick={() => onChange(value)}>{value}×</button>
      ))}
    </div>
  );
}

export function useBinary(width: number, initial = 0): [Array<0 | 1>, (next: Array<0 | 1>) => void, (width: number) => void] {
  const [bits, setBits] = useState<Array<0 | 1>>(() => {
    const value = initial;
    return Array.from({ length: width }, (_, index) => ((value >> (width - 1 - index)) & 1) === 1 ? 1 : 0);
  });
  return [bits.slice(0, width).concat(Array.from({ length: Math.max(0, width - bits.length) }, () => 0 as 0 | 1)).slice(0, width), setBits, (nextWidth) => {
    setBits((prev) => {
      const padded = Array.from({ length: nextWidth }, (_, index) => prev[index - (nextWidth - prev.length)] ?? 0);
      return padded;
    });
  }];
}
