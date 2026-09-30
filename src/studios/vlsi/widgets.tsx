import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "../../design-system/icons";
import { engineering } from "./engine";

export function useTicker(playing: boolean, onTick: () => void, ms = 420) {
  const tick = useRef(onTick);
  tick.current = onTick;
  useEffect(() => {
    if (!playing) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const id = window.setInterval(() => tick.current(), ms);
    return () => window.clearInterval(id);
  }, [playing, ms]);
}

export function Slider({ label, value, min, max, step, text, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  text: string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <label className="vlsi-slider" htmlFor={id}>
      <span>{label}</span>
      <strong>{text}</strong>
      <input id={id} type="range" min={min} max={max} step={step} value={value} aria-label={label} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

export function Choice<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="vlsi-choice" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.id} type="button" className={value === option.id ? "on" : ""} aria-pressed={value === option.id} onClick={() => onChange(option.id)}>{option.label}</button>
      ))}
    </div>
  );
}

export function PlayControls({ playing, onToggle, onStep }: { playing: boolean; onToggle: () => void; onStep: () => void }) {
  return (
    <div className="vlsi-play">
      <button type="button" onClick={onToggle} aria-label={playing ? "Pause simulation" : "Play simulation"}>
        <Icon name={playing ? "pause" : "play"} size={14} />
        {playing ? "Pause" : "Play"}
      </button>
      <button type="button" onClick={onStep} aria-label="Step simulation"><Icon name="step" size={14} />Step</button>
    </div>
  );
}

export function Measure({ label, value, unit, hint }: { label: string; value: number | string; unit?: string; hint?: string }) {
  const text = typeof value === "number" ? engineering(value, unit ?? "") : value;
  return (
    <p className="vlsi-measure">
      <span>{label}</span>
      <b>{text}</b>
      {hint ? <small>{hint}</small> : null}
    </p>
  );
}

export function Badge({ tone, children }: { tone: "nmos" | "pmos" | "on" | "off" | "warn" | "bad" | "info"; children: ReactNode }) {
  return <span className={`vlsi-badge ${tone}`}>{children}</span>;
}

export function Observe({ change, see, why, experiment, takeaway }: {
  change: string;
  see: string;
  why: string;
  experiment: string;
  takeaway: string;
}) {
  return (
    <section className="vlsi-observe">
      <h3>What to observe</h3>
      <p><b>Change. </b>{change}</p>
      <p><b>See. </b>{see}</p>
      <p><b>Why. </b>{why}</p>
      <p className="vlsi-experiment"><b>Experiment. </b>{experiment}</p>
      <p className="vlsi-take"><b>Takeaway. </b>{takeaway}</p>
    </section>
  );
}

export function Theory({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="vlsi-theory">
      <summary>{title}</summary>
      <div>{children}</div>
    </details>
  );
}

export interface Series {
  name: string;
  color: string;
  points: Array<{ x: number; y: number }>;
}

export function Chart({ series, xMin = 0, xMax, yMax, xLabel, yLabel, marker, onPick, ariaLabel }: {
  series: Series[];
  xMin?: number;
  xMax: number;
  yMax: number;
  xLabel: string;
  yLabel: string;
  marker?: { x: number; y: number; label: string };
  onPick?: (x: number, y: number) => void;
  ariaLabel: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const width = 360;
  const height = 210;
  const left = 46;
  const top = 14;
  const plotW = 300;
  const plotH = 160;
  const xSpan = Math.max(xMax - xMin, 1e-12);
  const xOf = (x: number) => left + ((x - xMin) / xSpan) * plotW;
  const yOf = (y: number) => top + (1 - y / Math.max(yMax, 1e-12)) * plotH;
  return (
    <svg ref={ref} className="vlsi-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} onClick={(event) => {
      if (!onPick || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const px = ((event.clientX - rect.left) / rect.width) * width;
      const py = ((event.clientY - rect.top) / rect.height) * height;
      onPick(Math.max(xMin, Math.min(xMax, xMin + ((px - left) / plotW) * xSpan)), Math.max(0, Math.min(yMax, (1 - (py - top) / plotH) * yMax)));
    }}>
      <rect x={left} y={top} width={plotW} height={plotH} className="vlsi-plot-bg" />
      {[0, 0.5, 1].map((fraction) => (
        <g key={fraction}>
          <line x1={left} x2={left + plotW} y1={yOf(yMax * fraction)} y2={yOf(yMax * fraction)} className="vlsi-gridline" />
          <text x={left - 6} y={yOf(yMax * fraction) + 3} textAnchor="end" className="vlsi-axis">{engineering(yMax * fraction, "").replace(" ", "")}</text>
        </g>
      ))}
      <text x={left + plotW / 2} y={204} textAnchor="middle" className="vlsi-axis">{xLabel}</text>
      <text x={12} y={top + plotH / 2} className="vlsi-axis vlsi-ylab" transform={`rotate(-90 12 ${top + plotH / 2})`}>{yLabel}</text>
      {series.map((item) => (
        <polyline key={item.name} fill="none" stroke={item.color} strokeWidth="2.2" points={item.points.map((point) => `${xOf(point.x)},${yOf(point.y)}`).join(" ")} />
      ))}
      {marker ? (
        <g>
          <circle cx={xOf(marker.x)} cy={yOf(marker.y)} r="5" className="vlsi-marker" />
          <text x={xOf(marker.x) + 8} y={yOf(marker.y) - 8} className="vlsi-marker-label">{marker.label}</text>
        </g>
      ) : null}
    </svg>
  );
}

export function Wave({ traces }: { traces: Array<{ name: string; color: string; values: number[]; min: number; max: number }> }) {
  const width = 320;
  const row = 46;
  return (
    <svg className="vlsi-wave" viewBox={`0 0 ${width} ${traces.length * row + 8}`} role="img" aria-label="Voltage waveforms">
      {traces.map((trace, index) => {
        const top = index * row + 8;
        const span = Math.max(1e-9, trace.max - trace.min);
        const points = trace.values.map((value, sample) => {
          const x = 36 + (sample / Math.max(1, trace.values.length - 1)) * 270;
          const y = top + 28 - ((value - trace.min) / span) * 24;
          return `${sample === 0 ? "M" : "L"}${x},${y}`;
        }).join(" ");
        return (
          <g key={trace.name}>
            <text x="0" y={top + 18} className="vlsi-axis">{trace.name}</text>
            <path d={points} fill="none" stroke={trace.color} strokeWidth="2" />
          </g>
        );
      })}
    </svg>
  );
}

export function Truth({ headers, rows, active }: { headers: string[]; rows: string[][]; active: number }) {
  return (
    <table className="vlsi-truth">
      <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.join("-")} className={index === active ? "on" : ""}>
            {row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BitPair({ label, value, onChange }: { label: string; value: 0 | 1; onChange: (value: 0 | 1) => void }) {
  return (
    <div className="vlsi-bits" role="group" aria-label={label}>
      <span>{label}</span>
      <button type="button" className={value === 0 ? "on" : ""} aria-pressed={value === 0} onClick={() => onChange(0)}>0</button>
      <button type="button" className={value === 1 ? "on" : ""} aria-pressed={value === 1} onClick={() => onChange(1)}>1</button>
    </div>
  );
}
