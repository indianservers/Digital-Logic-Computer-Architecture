import { Link } from "react-router-dom";
import "./studioExperience.css";

export function LabSequence({ items, current, onSelect }: {
  items: Array<{ id: string; label: string; to?: string }>;
  current: string;
  onSelect?: (id: string) => void;
}) {
  const index = items.findIndex((item) => item.id === current);
  const selected = items[index];
  if (!selected) return null;
  const previous = items[index - 1];
  const next = items[index + 1];
  const control = (item: typeof selected | undefined, direction: "Previous" | "Next") => {
    const text = direction === "Previous" ? "← Previous" : "Next →";
    const label = item ? `${direction}: ${item.label}` : `${direction} lab unavailable`;
    return item?.to ? <Link to={item.to} aria-label={label}>{text}</Link> : <button type="button" disabled={!item} aria-label={label} onClick={() => item && onSelect?.(item.id)}>{text}</button>;
  };
  return <nav className="studio-sequence" aria-label="Lab sequence">
    <div><span>TOPIC {index + 1} OF {items.length}</span><strong>{selected.label}</strong></div>
    <div className="studio-sequence-actions">{control(previous, "Previous")}{control(next, "Next")}</div>
  </nav>;
}
