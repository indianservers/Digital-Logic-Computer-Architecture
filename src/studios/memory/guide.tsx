import type { ReactNode } from "react";
import { usePrefs } from "../../store/prefs";

export function LabGuide({
  aim, concept, change, steps, observe, formula,
}: {
  aim: string;
  concept: string;
  change: string[];
  steps: string[];
  observe: string[];
  formula: string;
}) {
  const { prefs } = usePrefs();
  return (
    <details className="memx-guide">
      <summary>Lab Guide{prefs.explain ? ` — ${aim}` : ""}</summary>
      <div>
        <p><b>Aim.</b> {aim}</p>
        <p><b>Concept.</b> {concept}</p>
        <p><b>What you can change.</b> {change.join(" · ")}</p>
        <ol>{steps.map((step) => <li key={step}>{step}</li>)}</ol>
        <p><b>What to observe.</b> {observe.join(" ")}</p>
        <p><b>Key formula.</b> {formula}</p>
      </div>
    </details>
  );
}

export function BitButton({ bit, label, onClick, title }: { bit: string; label: string; onClick?: () => void; title?: string }) {
  const on = bit === "1";
  return (
    <button type="button" className={on ? "memx-bit on" : "memx-bit"} aria-pressed={on} title={title} onClick={onClick}>
      <small>{label}</small>{bit}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="memx-field">{label}{children}</label>;
}
