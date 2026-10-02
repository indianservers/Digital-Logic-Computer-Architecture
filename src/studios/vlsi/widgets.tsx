import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon } from "../../design-system/icons";
import { FORMULAS, UNIT_HELP } from "./content";
import { engineering } from "./engine";
import { downloadSvg, downloadText, toCsv } from "./exporting";
import { useLabRuntime, useRuntimeState } from "./runtime";
import { setLabComplete, useVlsiProgress } from "./store";
import { linkTerms } from "./terms";
import { VIcon } from "./vlsiIcons";

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

export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const decimals = (step: number) => {
  const text = String(step);
  return text.includes("e-") ? Number(text.split("e-")[1]) : (text.split(".")[1] ?? "").length;
};
const fmt = (value: number) => engineering(value, "").replace(/\s+/g, "");
const fileName = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "chart";

function unitOf(text: string): string | undefined {
  const match = text.trim().match(/([a-zA-Zµ°Ω%]+)$/);
  return match ? UNIT_HELP[match[1] ?? ""] : undefined;
}

export function Slider({ label, value, min, max, step, text, onChange, marks }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  text: string;
  onChange: (value: number) => void;
  marks?: Array<{ value: number; label: string }>;
}) {
  const id = useId();
  const runtime = useLabRuntime();
  useRuntimeState();
  const [initial] = useState(value);
  const [editing, setEditing] = useState<string | null>(null);
  const keyRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const live = useRef({ value, onChange, min, max, step });
  live.current = { value, onChange, min, max, step };

  useEffect(() => {
    if (!runtime) return undefined;
    const { key, unregister } = runtime.register({ label, kind: "range", initial, min: live.current.min, max: live.current.max, get: () => live.current.value, set: (next) => live.current.onChange(Number(next)) });
    keyRef.current = key;
    return () => {
      keyRef.current = null;
      unregister();
    };
  }, [runtime, label, initial]);

  useEffect(() => {
    if (runtime && keyRef.current) runtime.update(keyRef.current, { label, kind: "range", initial, min, max, get: () => live.current.value, set: (next) => live.current.onChange(Number(next)) });
  }, [runtime, label, initial, min, max]);

  useEffect(() => {
    runtime?.touch();
  }, [runtime, value]);

  const emit = (next: number) => {
    const { min: lo, max: hi, step: grain } = live.current;
    const snapped = Number(clamp(next, lo, hi).toFixed(Math.min(12, decimals(grain) + 2)));
    if (runtime && keyRef.current) runtime.emit(keyRef.current, snapped);
    else live.current.onChange(snapped);
  };
  const emitRef = useRef(emit);
  emitRef.current = emit;

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return undefined;
    const onWheel = (event: WheelEvent) => {
      if (document.activeElement !== input) return;
      event.preventDefault();
      const direction = event.deltaY < 0 ? 1 : -1;
      emitRef.current(live.current.value + direction * live.current.step * (event.shiftKey ? 10 : 1));
    };
    input.addEventListener("wheel", onWheel, { passive: false });
    return () => input.removeEventListener("wheel", onWheel);
  }, []);

  const resetOne = () => {
    if (runtime && keyRef.current) runtime.resetControl(keyRef.current);
    else onChange(initial);
  };
  const commit = (raw: string) => {
    setEditing(null);
    const parsed = Number.parseFloat(raw.replace(/,/g, ""));
    if (Number.isFinite(parsed)) emit(parsed);
  };
  const span = Math.max(max - min, 1e-12);
  const pct = (at: number) => `${clamp((at - min) / span, 0, 1) * 100}%`;
  const changed = Math.abs(value - initial) > Math.max(1e-12, Math.abs(initial) * 1e-9);
  const linked = runtime && keyRef.current ? runtime.linked.has(keyRef.current) : false;
  const unit = unitOf(text);

  return (
    <div className={`vlsi-slider${changed ? " changed" : ""}${linked ? " linked" : ""}`}>
      <span className="vlsi-slider-label" onDoubleClick={resetOne} title="Double-click to reset this control">
        {linkTerms(label)}
      </span>
      <span className="vlsi-slider-tools">
        {runtime ? (
          <button type="button" className="vlsi-link-btn" aria-pressed={linked} aria-label={`Link ${label} so linked sliders scale together`} title="Link: linked sliders scale together" onClick={() => keyRef.current && runtime.toggleLink(keyRef.current)}>
            <VIcon name="link" size={12} />
          </button>
        ) : null}
        {editing !== null ? (
          <input
            className="vlsi-slider-edit"
            autoFocus
            defaultValue={editing}
            aria-label={`Type a value for ${label}, between ${min} and ${max}`}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit(event.currentTarget.value);
              if (event.key === "Escape") setEditing(null);
            }}
            onBlur={(event) => commit(event.currentTarget.value)}
          />
        ) : (
          <button type="button" className="vlsi-slider-value" title={`${unit ? `${unit} · ` : ""}Click to type an exact value (${min} to ${max})`} onClick={() => setEditing(String(Number(value.toPrecision(6))))}>
            {text}
          </button>
        )}
      </span>
      <span className="vlsi-range">
        <input
          ref={inputRef}
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          aria-valuetext={text}
          onChange={(event) => emit(Number(event.target.value))}
          onKeyDown={(event) => {
            if (!event.shiftKey) return;
            const direction = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
            if (!direction) return;
            event.preventDefault();
            emit(value + direction * step * 10);
          }}
        />
        <i className="vlsi-default-tick" style={{ left: pct(initial) }} title={`Default ${Number(initial.toPrecision(4))}`} />
        {marks?.map((mark) => <i key={mark.label} className="vlsi-mark-tick" style={{ left: pct(mark.value) }} title={mark.label} data-label={mark.label} />)}
      </span>
    </div>
  );
}

export function ControlGroup({ title, children, open = true }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="vlsi-group" open={open}>
      <summary>{title}</summary>
      <div>{children}</div>
    </details>
  );
}

export function Choice<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (value: T) => void;
}) {
  const runtime = useLabRuntime();
  const [initial] = useState(value);
  const keyRef = useRef<string | null>(null);
  const live = useRef({ value, onChange, options });
  live.current = { value, onChange, options };
  useEffect(() => {
    if (!runtime) return undefined;
    const { key, unregister } = runtime.register({
      label,
      kind: "choice",
      initial,
      options: live.current.options.map((option) => option.id),
      get: () => live.current.value,
      set: (next) => {
        const match = live.current.options.find((option) => option.id === String(next));
        if (match) live.current.onChange(match.id);
      },
    });
    keyRef.current = key;
    return () => {
      keyRef.current = null;
      unregister();
    };
  }, [runtime, label, initial]);
  useEffect(() => {
    runtime?.touch();
  }, [runtime, value]);
  const pick = (id: T) => {
    if (runtime && keyRef.current) runtime.emit(keyRef.current, id);
    else onChange(id);
  };
  return (
    <div className="vlsi-choice" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.id} type="button" className={value === option.id ? "on" : ""} aria-pressed={value === option.id} onClick={() => pick(option.id)}>{option.label}</button>
      ))}
    </div>
  );
}

function useReducedMotion(): boolean {
  return useMedia("(prefers-reduced-motion: reduce)");
}

export function PlayControls({ playing, onToggle, onStep }: { playing: boolean; onToggle: () => void; onStep: () => void }) {
  const runtime = useLabRuntime();
  const reduced = useReducedMotion();
  const live = useRef({ playing, onToggle, onStep });
  live.current = { playing, onToggle, onStep };
  useEffect(() => {
    if (!runtime) return undefined;
    return runtime.addPlayer({ isPlaying: () => live.current.playing, toggle: () => live.current.onToggle(), step: () => live.current.onStep() });
  }, [runtime]);
  useEffect(() => {
    runtime?.touch();
  }, [runtime, playing]);
  return (
    <div className="vlsi-play-wrap">
      <div className="vlsi-play">
        <button type="button" onClick={onToggle} aria-label={playing ? "Pause simulation" : "Play simulation"} title={runtime ? "Space" : undefined} disabled={reduced}>
          <Icon name={playing ? "pause" : "play"} size={14} />
          {playing ? "Pause" : "Play"}
        </button>
        <button type="button" onClick={onStep} aria-label="Step simulation" title={runtime ? "Period key" : undefined}><Icon name="step" size={14} />Step</button>
      </div>
      {reduced ? <p className="vlsi-motion-note">Auto-play is off because your system asks for reduced motion. Step still advances the simulation one tick at a time.</p> : null}
    </div>
  );
}

export function Measure({ label, value, unit, hint, formula }: { label: string; value: number | string; unit?: string; hint?: string; formula?: string }) {
  const text = typeof value === "number" ? engineering(value, unit ?? "") : value;
  const runtime = useLabRuntime();
  const [flash, setFlash] = useState(0);
  const [open, setOpen] = useState(false);
  const shown = useRef(text);
  useEffect(() => {
    if (shown.current !== text) {
      shown.current = text;
      setFlash((count) => count + 1);
    }
    runtime?.reportMeasure(label, text);
  }, [runtime, label, text]);
  const explanation = formula ?? FORMULAS[label];
  return (
    <div className="vlsi-measure">
      <span className="vlsi-measure-label">
        {linkTerms(label)}
        {explanation ? (
          <button type="button" className="vlsi-explain-btn" aria-expanded={open} aria-label={`How ${label} is calculated`} onClick={() => setOpen((value) => !value)}>?</button>
        ) : null}
      </span>
      <b key={flash} className={flash ? "flash" : undefined}>{text}</b>
      {hint ? <small>{hint}</small> : null}
      {open && explanation ? <small className="vlsi-formula">{explanation}</small> : null}
    </div>
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
  const runtime = useLabRuntime();
  const state = useRuntimeState();
  const progress = useVlsiProgress();
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const slug = runtime?.slug;
  useEffect(() => {
    if (runtime) runtime.takeaway = takeaway;
  }, [runtime, takeaway]);
  const done = slug ? progress.completed.includes(slug) : false;
  const steps = [
    { id: "change", title: "Change", text: change, auto: state.interacted, className: "" },
    { id: "see", title: "See", text: see, auto: state.interacted, className: "", why },
    { id: "experiment", title: "Experiment", text: experiment, auto: false, className: "vlsi-experiment" },
    { id: "takeaway", title: "Takeaway", text: takeaway, auto: done, className: "vlsi-take" },
  ];
  const isChecked = (step: (typeof steps)[number]) => step.auto || Boolean(manual[step.id]);
  const count = steps.filter(isChecked).length;
  return (
    <section className="vlsi-observe">
      <div className="vlsi-observe-head">
        <h3>What to observe</h3>
        <span className="vlsi-observe-count" aria-label={`${count} of ${steps.length} steps done`}>{count}/{steps.length}</span>
      </div>
      <ol>
        {steps.map((step, index) => (
          <li key={step.id} className={`${step.className}${isChecked(step) ? " done" : ""}`}>
            <label>
              <input
                type="checkbox"
                checked={isChecked(step)}
                onChange={(event) => {
                  if (step.id === "takeaway" && slug) setLabComplete(slug, event.target.checked);
                  else setManual((current) => ({ ...current, [step.id]: event.target.checked }));
                }}
              />
              <b>{index + 1}. {step.title}.</b>
            </label>{" "}
            <span>{linkTerms(step.text)}</span>
            {step.why ? <p className="vlsi-why"><b>Why. </b>{linkTerms(step.why)}</p> : null}
          </li>
        ))}
      </ol>
      {slug ? (
        <button type="button" className={`vlsi-complete${done ? " on" : ""}`} aria-pressed={done} onClick={() => setLabComplete(slug, !done)}>
          <VIcon name="check" />{done ? "Lab completed" : "Mark lab complete"}
        </button>
      ) : null}
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

export interface ChartBand {
  x0: number;
  x1: number;
  label?: string;
  color?: string;
}

export interface ChartLine {
  x: number;
  label?: string;
  color?: string;
}

const DASHES = ["", "7 4", "2 4", "10 4 2 4"];

export function Chart({ series, xMin = 0, xMax, yMax, xLabel, yLabel, marker, onPick, ariaLabel, bands, vlines }: {
  series: Series[];
  xMin?: number;
  xMax: number;
  yMax: number;
  xLabel: string;
  yLabel: string;
  marker?: { x: number; y: number; label: string };
  onPick?: (x: number, y: number) => void;
  ariaLabel: string;
  bands?: ChartBand[];
  vlines?: ChartLine[];
}) {
  const ref = useRef<SVGSVGElement>(null);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [hidden, setHidden] = useState<string[]>([]);
  const [pins, setPins] = useState<Series[]>([]);
  const [pinBatch, setPinBatch] = useState(0);
  const [zoom, setZoom] = useState<[number, number] | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ startX: number; startPx: number; nowX: number; pan: boolean; base: [number, number] } | null>(null);
  const width = 360;
  const height = 214;
  const left = 46;
  const top = 14;
  const plotW = 300;
  const plotH = 160;
  const validZoom = zoom && zoom[0] >= xMin - 1e-12 && zoom[1] <= xMax + 1e-12 && zoom[1] > zoom[0] ? zoom : null;
  const lo = validZoom ? validZoom[0] : xMin;
  const hi = validZoom ? validZoom[1] : xMax;
  const xSpan = Math.max(hi - lo, 1e-12);
  const yTop = Math.max(yMax, 1e-12);
  const xOf = (x: number) => left + ((x - lo) / xSpan) * plotW;
  const yOf = (y: number) => top + (1 - y / yTop) * plotH;
  const visible = series.filter((item) => !hidden.includes(item.name));
  const visiblePins = pins.filter((item) => !hidden.includes(item.name));

  const toData = (clientX: number, clientY: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return { x: lo, y: 0 };
    const px = ((clientX - rect.left) / rect.width) * width;
    const py = ((clientY - rect.top) / rect.height) * height;
    return { x: clamp(lo + ((px - left) / plotW) * xSpan, lo, hi), y: clamp((1 - (py - top) / plotH) * yTop, 0, yTop) };
  };

  const readings = hoverX === null || drag ? [] : visible.flatMap((item) => {
    let best = item.points[0];
    for (const point of item.points) if (best && Math.abs(point.x - hoverX) < Math.abs(best.x - hoverX)) best = point;
    return best ? [{ item, point: best }] : [];
  });

  const summary = series.map((item) => {
    const first = item.points[0];
    const last = item.points[item.points.length - 1];
    if (!first || !last) return `${item.name}: no data`;
    const ys = item.points.map((point) => point.y);
    return `${item.name} runs from x ${fmt(first.x)} to ${fmt(last.x)}, with y between ${fmt(Math.min(...ys))} and ${fmt(Math.max(...ys))}`;
  }).join("; ") + (marker ? `. Marker at x ${fmt(marker.x)}, y ${fmt(marker.y)}: ${marker.label}.` : ".");

  const legend = [...series, ...pins];
  const tooltipW = 118;
  const tooltipX = hoverX !== null && xOf(hoverX) > left + plotW / 2 ? xOf(hoverX) - tooltipW - 8 : (hoverX !== null ? xOf(hoverX) + 8 : 0);

  return (
    <div className="vlsi-chart-wrap">
      <svg
        ref={ref}
        className="vlsi-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        aria-describedby={`${uid}-desc`}
        onPointerDown={(event) => {
          if (event.button !== 0 || !ref.current) return;
          const point = toData(event.clientX, event.clientY);
          ref.current.setPointerCapture(event.pointerId);
          setDrag({ startX: point.x, startPx: event.clientX, nowX: point.x, pan: event.shiftKey && Boolean(validZoom), base: [lo, hi] });
        }}
        onPointerMove={(event) => {
          const point = toData(event.clientX, event.clientY);
          setHoverX(point.x);
          if (!drag) return;
          if (drag.pan) {
            const rect = ref.current?.getBoundingClientRect();
            if (!rect) return;
            const baseSpan = drag.base[1] - drag.base[0];
            const shift = -((event.clientX - drag.startPx) / rect.width) * (width / plotW) * baseSpan;
            const start = clamp(drag.base[0] + shift, xMin, xMax - baseSpan);
            setZoom([start, start + baseSpan]);
          } else {
            setDrag({ ...drag, nowX: point.x });
          }
        }}
        onPointerUp={(event) => {
          if (!drag) return;
          const moved = Math.abs(event.clientX - drag.startPx);
          if (!drag.pan) {
            if (moved > 6) {
              const a = Math.min(drag.startX, drag.nowX);
              const b = Math.max(drag.startX, drag.nowX);
              if (b - a > (xMax - xMin) * 0.01) setZoom([a, b]);
            } else if (onPick) {
              const point = toData(event.clientX, event.clientY);
              onPick(point.x, point.y);
            }
          }
          setDrag(null);
        }}
        onPointerLeave={() => setHoverX(null)}
        onDoubleClick={() => setZoom(null)}
      >
        <desc id={`${uid}-desc`}>{summary}</desc>
        <defs>
          <clipPath id={`${uid}-clip`}><rect x={left} y={top - 4} width={plotW} height={plotH + 8} /></clipPath>
        </defs>
        <rect x={left} y={top} width={plotW} height={plotH} className="vlsi-plot-bg" />
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
          <g key={`y-${fraction}`}>
            <line x1={left} x2={left + plotW} y1={yOf(yTop * fraction)} y2={yOf(yTop * fraction)} className={fraction === 0 ? "vlsi-gridline" : "vlsi-gridline faint"} />
            <text x={left - 6} y={yOf(yTop * fraction) + 3} textAnchor="end" className="vlsi-axis">{fmt(yTop * fraction)}</text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const x = lo + fraction * xSpan;
          return (
            <g key={`x-${fraction}`}>
              <line x1={xOf(x)} x2={xOf(x)} y1={top} y2={top + plotH} className="vlsi-gridline faint" />
              <line x1={xOf(x)} x2={xOf(x)} y1={top + plotH} y2={top + plotH + 4} className="vlsi-gridline" />
              <text x={xOf(x)} y={top + plotH + 14} textAnchor={fraction === 0 ? "start" : fraction === 1 ? "end" : "middle"} className="vlsi-axis">{fmt(x)}</text>
            </g>
          );
        })}
        <text x={left + plotW / 2} y={height - 4} textAnchor="middle" className="vlsi-axis">{xLabel}{validZoom ? " · zoomed" : ""}</text>
        <text x={12} y={top + plotH / 2} className="vlsi-axis vlsi-ylab" transform={`rotate(-90 12 ${top + plotH / 2})`}>{yLabel}</text>
        <g clipPath={`url(#${uid}-clip)`}>
          {bands?.map((band, index) => (
            <g key={`band-${index}`}>
              <rect x={xOf(Math.min(band.x0, band.x1))} y={top} width={Math.abs(xOf(band.x1) - xOf(band.x0))} height={plotH} fill={band.color ?? "#fbbf24"} opacity={0.14} />
              {band.label ? <text x={(xOf(band.x0) + xOf(band.x1)) / 2} y={top + 11} textAnchor="middle" className="vlsi-annot">{band.label}</text> : null}
            </g>
          ))}
          {vlines?.map((line, index) => (
            <g key={`v-${index}`}>
              <line x1={xOf(line.x)} x2={xOf(line.x)} y1={top} y2={top + plotH} stroke={line.color ?? "#94a3b8"} strokeDasharray="3 3" strokeWidth={1.2} />
              {line.label ? (() => {
                const leftmost = vlines.every((other) => other.x >= line.x);
                return (
                  <text x={xOf(line.x) + (leftmost && vlines.length > 1 ? -3 : 3)} y={top + plotH - 4 - (index % 3) * 13} textAnchor={leftmost && vlines.length > 1 ? "end" : "start"} className="vlsi-annot">{line.label}</text>
                );
              })() : null}
            </g>
          ))}
          {visiblePins.map((item) => (
            <polyline key={item.name} fill="none" stroke={item.color} strokeWidth="1.6" strokeDasharray="3 3" opacity={0.5} points={item.points.map((point) => `${xOf(point.x)},${yOf(point.y)}`).join(" ")} />
          ))}
          {series.map((item, index) => hidden.includes(item.name) ? null : (
            <polyline key={item.name} fill="none" stroke={item.color} strokeWidth="2.2" strokeDasharray={DASHES[index % DASHES.length]} points={item.points.map((point) => `${xOf(point.x)},${yOf(point.y)}`).join(" ")} />
          ))}
          {marker ? (
            <g>
              <circle cx={xOf(marker.x)} cy={yOf(marker.y)} r="5" className="vlsi-marker" />
              <text x={xOf(marker.x) + 8} y={yOf(marker.y) - 8} className="vlsi-marker-label">{marker.label}</text>
            </g>
          ) : null}
        </g>
        {drag && !drag.pan && Math.abs(xOf(drag.nowX) - xOf(drag.startX)) > 2 ? (
          <rect className="vlsi-brush" x={Math.min(xOf(drag.startX), xOf(drag.nowX))} y={top} width={Math.abs(xOf(drag.nowX) - xOf(drag.startX))} height={plotH} />
        ) : null}
        {hoverX !== null && !drag ? (
          <g className="vlsi-crosshair" pointerEvents="none">
            <line x1={xOf(hoverX)} x2={xOf(hoverX)} y1={top} y2={top + plotH} />
            {readings.map(({ item, point }) => <circle key={item.name} cx={xOf(point.x)} cy={yOf(point.y)} r="3.5" fill={item.color} />)}
            <rect x={tooltipX} y={top + 4} width={tooltipW} height={16 + readings.length * 12} rx="5" className="vlsi-tip" />
            <text x={tooltipX + 7} y={top + 16} className="vlsi-tip-text">x = {fmt(hoverX)}</text>
            {readings.map(({ item, point }, index) => (
              <text key={item.name} x={tooltipX + 7} y={top + 28 + index * 12} className="vlsi-tip-text" fill={item.color}>{item.name}: {fmt(point.y)}</text>
            ))}
          </g>
        ) : null}
      </svg>
      <div className="vlsi-chart-tools">
        {legend.length > 1 ? (
          <span className="vlsi-legend" role="group" aria-label="Series">
            {legend.map((item, index) => {
              const isPin = index >= series.length;
              return (
                <button key={item.name} type="button" aria-pressed={!hidden.includes(item.name)} className={hidden.includes(item.name) ? "off" : "on"} onClick={() => setHidden((current) => current.includes(item.name) ? current.filter((name) => name !== item.name) : [...current, item.name])}>
                  <svg width="18" height="8" aria-hidden="true"><line x1="0" x2="18" y1="4" y2="4" stroke={item.color} strokeWidth="2.4" strokeDasharray={isPin ? "3 3" : DASHES[index % DASHES.length]} /></svg>
                  {item.name}
                </button>
              );
            })}
          </span>
        ) : null}
        <span className="vlsi-chart-actions">
          <button type="button" title="Freeze the current curves as dashed ghosts so you can compare after changing a control" onClick={() => {
            const batch = pinBatch + 1;
            setPinBatch(batch);
            setPins((current) => [...current, ...visible.map((item) => ({ ...item, name: `${item.name} · pin ${batch}` }))].slice(-6));
          }}><VIcon name="pin" />Pin</button>
          {pins.length ? <button type="button" onClick={() => { setPins([]); setPinBatch(0); }}>Clear pins</button> : null}
          {validZoom ? <button type="button" onClick={() => setZoom(null)}><VIcon name="zoomOut" />Reset zoom</button> : null}
          <button type="button" title="Download the plotted data as CSV" onClick={() => downloadText(toCsv([["series", "x", "y"], ...[...series, ...pins].flatMap((item) => item.points.map((point) => [item.name, point.x, point.y]))]), `${fileName(ariaLabel)}.csv`, "text/csv")}><VIcon name="download" />CSV</button>
          <button type="button" title="Download the chart as SVG" onClick={() => ref.current && downloadSvg(ref.current, `${fileName(ariaLabel)}.svg`)}><VIcon name="image" />SVG</button>
        </span>
        <span className="vlsi-chart-hint">Hover to read · drag to zoom{validZoom ? " · Shift-drag to pan" : ""} · double-click to reset</span>
      </div>
    </div>
  );
}

export interface WaveSpan {
  from: number;
  to: number;
  label: string;
  color?: string;
}

export function Wave({ traces, dt, unit = "s", spans }: {
  traces: Array<{ name: string; color: string; values: number[]; min: number; max: number }>;
  dt?: number;
  unit?: string;
  spans?: WaveSpan[];
}) {
  const ref = useRef<SVGSVGElement>(null);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [cursors, setCursors] = useState<[number, number] | null>(null);
  const [dragging, setDragging] = useState<0 | 1 | null>(null);
  const width = 320;
  const row = 46;
  const x0 = 36;
  const plot = 270;
  const n = Math.max(2, ...traces.map((trace) => trace.values.length));
  const bodyH = traces.length * row + 8;
  const height = bodyH + 22;
  const xOf = (sample: number) => x0 + (sample / (n - 1)) * plot;
  const sampleOf = (time: number) => (dt ? time / dt : time);
  const label = (sample: number) => (dt ? engineering(sample * dt, unit) : `${Math.round(sample * 10) / 10}`);
  const toSample = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return 0;
    const px = ((clientX - rect.left) / rect.width) * width;
    return clamp(((px - x0) / plot) * (n - 1), 0, n - 1);
  };
  const valueAt = (values: number[], sample: number) => {
    const low = Math.floor(sample);
    const high = Math.min(values.length - 1, low + 1);
    const a = values[low] ?? 0;
    const b = values[high] ?? a;
    return a + (b - a) * (sample - low);
  };
  const summary = traces.map((trace) => `${trace.name} between ${fmt(Math.min(...trace.values))} and ${fmt(Math.max(...trace.values))}`).join("; ");
  return (
    <div className="vlsi-wave-wrap">
      <svg
        ref={ref}
        className={`vlsi-wave${cursors ? " has-cursors" : ""}`}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Voltage waveforms"
        aria-describedby={`${uid}-desc`}
        onPointerDown={(event) => {
          if (!cursors || !ref.current) return;
          const sample = toSample(event.clientX);
          const which: 0 | 1 = Math.abs(sample - cursors[0]) <= Math.abs(sample - cursors[1]) ? 0 : 1;
          ref.current.setPointerCapture(event.pointerId);
          setDragging(which);
          setCursors(which === 0 ? [sample, cursors[1]] : [cursors[0], sample]);
        }}
        onPointerMove={(event) => {
          if (dragging === null || !cursors) return;
          const sample = toSample(event.clientX);
          setCursors(dragging === 0 ? [sample, cursors[1]] : [cursors[0], sample]);
        }}
        onPointerUp={() => setDragging(null)}
      >
        <desc id={`${uid}-desc`}>{summary}</desc>
        {spans?.map((span, index) => {
          const a = xOf(clamp(sampleOf(span.from), 0, n - 1));
          const b = xOf(clamp(sampleOf(span.to), 0, n - 1));
          return (
            <g key={`${span.label}-${index}`}>
              <rect x={Math.min(a, b)} y={2} width={Math.max(1, Math.abs(b - a))} height={bodyH - 2} fill={span.color ?? "#fbbf24"} opacity={0.16} />
              <line x1={a} x2={a} y1={2} y2={bodyH} stroke={span.color ?? "#fbbf24"} strokeWidth={0.8} opacity={0.7} />
              <line x1={b} x2={b} y1={2} y2={bodyH} stroke={span.color ?? "#fbbf24"} strokeWidth={0.8} opacity={0.7} />
              <text x={(a + b) / 2} y={10 + index * 10} textAnchor="middle" className="vlsi-annot" fill={span.color ?? "#fbbf24"}>{span.label}</text>
            </g>
          );
        })}
        {traces.map((trace, index) => {
          const top = index * row + 8;
          const span = Math.max(1e-9, trace.max - trace.min);
          const points = trace.values.map((value, sample) => {
            const x = x0 + (sample / Math.max(1, trace.values.length - 1)) * plot;
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
        <line x1={x0} x2={x0 + plot} y1={bodyH + 2} y2={bodyH + 2} className="vlsi-gridline" />
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const sample = fraction * (n - 1);
          return (
            <g key={fraction}>
              <line x1={xOf(sample)} x2={xOf(sample)} y1={bodyH + 2} y2={bodyH + 6} className="vlsi-gridline" />
              <text x={xOf(sample)} y={bodyH + 16} textAnchor={fraction === 0 ? "start" : fraction === 1 ? "end" : "middle"} className="vlsi-axis">{label(sample)}</text>
            </g>
          );
        })}
        <text x="0" y={bodyH + 16} className="vlsi-axis">{dt ? "t" : "sample"}</text>
        {cursors ? cursors.map((sample, index) => (
          <g key={index} className="vlsi-wave-cursor">
            <line x1={xOf(sample)} x2={xOf(sample)} y1={0} y2={bodyH + 2} />
            <text x={xOf(sample) + 3} y={bodyH - 2}>{index === 0 ? "A" : "B"}</text>
          </g>
        )) : null}
      </svg>
      <div className="vlsi-chart-tools">
        <span className="vlsi-chart-actions">
          <button type="button" aria-pressed={Boolean(cursors)} onClick={() => setCursors((current) => current ? null : [(n - 1) * 0.3, (n - 1) * 0.7])}><VIcon name="cursor" />Cursors</button>
        </span>
        {cursors ? (
          <span className="vlsi-wave-read" aria-live="polite">
            A {label(cursors[0])} · B {label(cursors[1])} · Δ {dt ? engineering(Math.abs(cursors[1] - cursors[0]) * dt, unit) : `${Math.abs(cursors[1] - cursors[0]).toFixed(1)} samples`}
            {" · at A: "}{traces.map((trace) => `${trace.name} ${fmt(valueAt(trace.values, cursors[0]))}`).join(", ")}
          </span>
        ) : <span className="vlsi-chart-hint">Turn on cursors and drag them to measure time differences.</span>}
      </div>
    </div>
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
  const runtime = useLabRuntime();
  const [initial] = useState(value);
  const keyRef = useRef<string | null>(null);
  const live = useRef({ value, onChange });
  live.current = { value, onChange };
  useEffect(() => {
    if (!runtime) return undefined;
    const { key, unregister } = runtime.register({ label, kind: "bit", initial, get: () => live.current.value, set: (next) => live.current.onChange(Number(next) >= 0.5 ? 1 : 0) });
    keyRef.current = key;
    return () => {
      keyRef.current = null;
      unregister();
    };
  }, [runtime, label, initial]);
  useEffect(() => {
    runtime?.touch();
  }, [runtime, value]);
  const pick = (next: 0 | 1) => {
    if (runtime && keyRef.current) runtime.emit(keyRef.current, next);
    else onChange(next);
  };
  return (
    <div className="vlsi-bits" role="group" aria-label={label}>
      <span>{label}</span>
      <button type="button" className={value === 0 ? "on" : ""} aria-pressed={value === 0} onClick={() => pick(0)}>0</button>
      <button type="button" className={value === 1 ? "on" : ""} aria-pressed={value === 1} onClick={() => pick(1)}>1</button>
    </div>
  );
}
