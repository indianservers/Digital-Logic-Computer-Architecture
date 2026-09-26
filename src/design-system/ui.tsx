import { useEffect, useRef, type ReactNode } from "react";
import type { MdSwitch } from "@material/web/switch/switch.js";
import type { LogicValue } from "../types/logic";
import { Icon } from "./icons";

export type SwitchTone = "primary" | "ok" | "danger" | "warn" | "neutral";

type AppButtonProps = {
  variant?: "primary" | "ghost" | "tonal" | "text";
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  "aria-label"?: string;
  title?: string;
};

export function Button({ variant = "ghost", children, className, disabled, onClick, type, ...props }: AppButtonProps) {
  const extra = { className, disabled: disabled || undefined, onClick, type, ...props };
  if (variant === "primary") return <md-filled-button {...extra}>{children}</md-filled-button>;
  if (variant === "tonal") return <md-filled-button className={`tonal ${className ?? ""}`} disabled={disabled || undefined} onClick={onClick} type={type} {...props}>{children}</md-filled-button>;
  if (variant === "text") return <md-text-button {...extra}>{children}</md-text-button>;
  return <md-outlined-button {...extra}>{children}</md-outlined-button>;
}

export function IconButton({ label, children, disabled, onClick, className }: { label: string; children?: ReactNode; disabled?: boolean; onClick?: () => void; className?: string }) {
  return <md-icon-button aria-label={label} title={label} disabled={disabled || undefined} onClick={onClick} className={className}>{children}</md-icon-button>;
}

export function Toggle({
  on, onChange, label, tone = "primary", showLabel = true,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
  tone?: SwitchTone;
  showLabel?: boolean;
}) {
  const ref = useRef<MdSwitch>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    const node = ref.current;
    if (node) node.selected = on;
  }, [on]);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const handle = () => onChangeRef.current(Boolean(node.selected));
    node.addEventListener("change", handle);
    return () => node.removeEventListener("change", handle);
  }, []);
  return (
    <label className={`switch-field tone-${tone}`}>
      {showLabel ? <span className="switch-copy">{label}</span> : null}
      <md-switch ref={ref} className={`tone-${tone}`} aria-label={label} />
    </label>
  );
}

export function Card({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      {title ? <div className="spread"><h3>{title}</h3>{action}</div> : null}
      {children}
    </section>
  );
}

export function Theory({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="callout" style={{ marginBottom: 12 }}>
      <strong>{title}</strong>
      <p className="muted" style={{ margin: 0 }}>{children}</p>
    </div>
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

export function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><b>{value}</b></div>;
}

export function Signal({ value }: { value: LogicValue | 0 | 1 }) {
  const text = value === "Z" ? "Z" : value === "X" ? "X" : String(value);
  const cls = value === 1 ? "bit-mark on" : value === "Z" ? "bit z" : value === "X" ? "bit bad" : "bit-mark";
  return <span className={cls} aria-label={`signal ${text}`}>{text}</span>;
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
      <Toggle on={playing} onChange={(next) => { if (next !== playing) onPlay(); }} label="Run" tone="ok" />
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
