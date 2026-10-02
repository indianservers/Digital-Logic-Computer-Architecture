import { useId, type ReactNode } from "react";
import { GLOSSARY, type GlossaryEntry } from "./content";

const BY_LOWER = new Map(GLOSSARY.map((entry) => [entry.term.toLowerCase(), entry]));
const isAcronym = (term: string) => !/[a-z]/.test(term);
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PATTERN = new RegExp(
  `(?<![A-Za-z0-9])(${[...GLOSSARY].sort((a, b) => b.term.length - a.term.length).map((entry) => escape(entry.term)).join("|")})(?![A-Za-z0-9])`,
  "gi",
);

export function Term({ entry, children }: { entry: GlossaryEntry; children: ReactNode }) {
  const id = useId();
  return (
    <span className="vlsi-term">
      <button type="button" aria-describedby={id} onClick={(event) => event.stopPropagation()}>{children}</button>
      <span role="tooltip" id={id}><b>{entry.term}</b> {entry.def}</span>
    </span>
  );
}

export function linkTerms(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const seen = new Set<string>();
  let last = 0;
  for (const match of text.matchAll(PATTERN)) {
    const word = match[0];
    const entry = BY_LOWER.get(word.toLowerCase());
    const start = match.index ?? 0;
    if (!entry || seen.has(entry.term) || (isAcronym(entry.term) && word !== entry.term)) continue;
    seen.add(entry.term);
    if (start > last) parts.push(text.slice(last, start));
    parts.push(<Term key={`${entry.term}-${start}`} entry={entry}>{word}</Term>);
    last = start + word.length;
  }
  if (parts.length === 0) return text;
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
