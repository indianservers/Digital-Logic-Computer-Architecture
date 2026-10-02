import { useState } from "react";

/** Number field that commits on Enter or blur and shows live state otherwise. */
export function NumIn({ value, min, max, step = 1, label, onCommit, width = 72, disabled = false }: { value: number; min: number; max: number; step?: number; label: string; onCommit: (v: number) => void; width?: number; disabled?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => { if (draft === null) return; const v = Number(draft); setDraft(null); if (Number.isFinite(v)) onCommit(Math.max(min, Math.min(max, v))); };
  return <input className="mcl-l21-num" style={{ width }} type="number" min={min} max={max} step={step} aria-label={label} value={draft ?? String(value)} disabled={disabled}
    onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setDraft(null); }} />;
}
