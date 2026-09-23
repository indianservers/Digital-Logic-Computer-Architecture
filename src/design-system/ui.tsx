import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LogicValue } from "../types/logic";
import { Icon } from "./icons";

export function Button({ variant = "ghost", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  return <button className={variant === "primary" ? "btn-primary" : "btn-ghost"} {...props}>{children}</button>;
}

export function IconButton({ label, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button className="icon-btn" aria-label={label} title={label} {...props}>{children}</button>;
}

export function Card({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      {title ? <div className="spread"><h3>{title}</h3>{action}</div> : null}
      {children}
    </section>
  );
}

export function Tabs({ tabs, value, onChange }: { tabs: Array<{ id: string; label: string }>; value: string; onChange: (id: string) => void }) {
  return (
    <div className="tabrow" role="tablist">
      {tabs.map((tab) => (
        <button key={tab.id} role="tab" aria-selected={tab.id === value} className={tab.id === value ? "tab active" : "tab"} onClick={() => onChange(tab.id)}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function Segmented({ options, value, onChange }: { options: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((option) => (
        <button key={option} role="radio" aria-checked={option === value} className={option === value ? "active" : ""} onClick={() => onChange(option)}>{option}</button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (next: boolean) => void; label: string }) {
  return <button className={on ? "toggle on" : "toggle"} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}><i /></button>;
}

export function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><b>{value}</b></div>;
}

export function Signal({ value }: { value: LogicValue | 0 | 1 }) {
  const text = value === "Z" ? "Z" : value === "X" ? "X" : String(value);
  const cls = value === 1 ? "bit on" : value === "Z" ? "bit z" : value === "X" ? "bit bad" : "bit";
  return <span className={cls} aria-label={`signal ${text}`} style={{ width: 28, height: 28, display: "inline-grid", placeItems: "center" }}>{text}</span>;
}

export function ExplainBar({ what, why, notice }: { what: string; why: string; notice: string }) {
  return (
    <div className="callout" style={{ marginBottom: 12 }}>
      <strong>What changed</strong>
      <div>{what}</div>
      <strong style={{ marginTop: 6 }}>Why</strong>
      <div>{why}</div>
      <strong style={{ marginTop: 6 }}>Notice</strong>
      <div>{notice}</div>
    </div>
  );
}

export function SimControls({ playing, onPlay, onStep, onReset, speed, onSpeed }: {
  playing: boolean;
  onPlay: () => void;
  onStep: () => void;
  onReset: () => void;
  speed?: number;
  onSpeed?: (speed: number) => void;
}) {
  return (
    <div className="row">
      <Button variant="primary" onClick={onPlay}><Icon name={playing ? "pause" : "play"} size={14} />{playing ? "Pause" : "Play"}</Button>
      <Button onClick={onStep}><Icon name="step" size={14} />Step</Button>
      <Button onClick={onReset}><Icon name="reset" size={14} />Reset</Button>
      {onSpeed ? (
        <label className="row tiny">Speed
          <input aria-label="Simulation speed" type="range" min={0.5} max={4} step={0.5} value={speed ?? 1} onChange={(event) => onSpeed(parseNumberInput(event.target.value, speed ?? 1))} />
        </label>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="card"><h3>{title}</h3><p className="muted">{body}</p></div>;
}

export function parseNumberInput(raw: string, fallback: number): number {
  if (raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
