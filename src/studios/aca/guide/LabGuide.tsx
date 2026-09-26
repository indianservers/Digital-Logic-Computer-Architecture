import { useEffect, useId, useState } from "react";
import { LAB_GUIDES } from "./index";
import { useGuideFocus } from "./focus";
import type { LabWalkthrough } from "./types";

export function LabGuideButton({ labId }: { labId: string }) {
  const guide = LAB_GUIDES[labId];
  const [open, setOpen] = useState(false);
  const titleId = useId();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (!guide) return null;
  return (
    <>
      <button type="button" className="vl-guide-btn" onClick={() => setOpen(true)}>Lab Guide</button>
      {open ? (
        <>
          <button type="button" className="vl-guide-backdrop" aria-label="Close lab guide" onClick={() => setOpen(false)} />
          <aside className="vl-guide" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <header>
              <div>
                <p>Lab {guide.labNumber}</p>
                <h2 id={titleId}>{guide.title}</h2>
              </div>
              <button type="button" className="vl-guide-close" onClick={() => setOpen(false)}>Close</button>
            </header>
            <details open>
              <summary>Overview</summary>
              <h3>Aim</h3>
              <p>{guide.aim}</p>
              <h3>Purpose</h3>
              <p>{guide.purpose}</p>
              <h3>Learning objectives</h3>
              <ul>{guide.learningObjectives.map((item) => <li key={item}>{item}</li>)}</ul>
              <h3>Prerequisites</h3>
              <ul>{guide.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul>
            </details>
            <details>
              <summary>Theory</summary>
              {guide.theory.map((item) => <p key={item}>{item}</p>)}
              <h3>Key terms</h3>
              <ul>{guide.keyTerms.map((item) => <li key={item.term}><b>{item.term}.</b> {item.meaning}</li>)}</ul>
              <h3>Model assumptions</h3>
              <ul>{guide.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
              <h3>Formulas</h3>
              {guide.formulas.map((item) => (
                <div className="vl-guide-formula" key={item.name}>
                  <div>{item.name}</div>
                  <code>{item.expression}</code>
                  <p>{item.note}</p>
                </div>
              ))}
            </details>
            <details>
              <summary>Procedure</summary>
              <h3>Setup</h3>
              <ul>{guide.setup.map((item) => <li key={item}>{item}</li>)}</ul>
              <ol>{guide.procedure.map((item) => <li key={item}>{item}</li>)}</ol>
              <h3>Controls on this page</h3>
              <ul>{guide.controls.map((item) => <li key={item}>{item}</li>)}</ul>
            </details>
            <details>
              <summary>Observe and interpret</summary>
              <h3>Observations</h3>
              <ul>{guide.observations.map((item) => <li key={item}>{item}</li>)}</ul>
              <h3>Expected behavior</h3>
              <ul>{guide.expectedBehavior.map((item) => <li key={item}>{item}</li>)}</ul>
              <h3>Result interpretation</h3>
              {guide.resultInterpretation.map((item) => <p key={item}>{item}</p>)}
              <h3>Common misconceptions</h3>
              <ul>{guide.misconceptions.map((item) => <li key={item}>{item}</li>)}</ul>
            </details>
            <details>
              <summary>Extend</summary>
              <h3>Variations</h3>
              <ol>{guide.variations.map((item) => <li key={item}>{item}</li>)}</ol>
              <h3>Learning outcomes</h3>
              <ul>{guide.learningOutcomes.map((item) => <li key={item}>{item}</li>)}</ul>
              <h3>Takeaway</h3>
              <p>{guide.summary}</p>
            </details>
            <details>
              <summary>Viva and self-check</summary>
              {guide.viva.map((item) => (
                <details key={item.question}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
              <SelfCheck labId={labId} />
              <Notes labId={labId} />
            </details>
          </aside>
        </>
      ) : null}
    </>
  );
}

function SelfCheck({ labId }: { labId: string }) {
  const guide = LAB_GUIDES[labId];
  const [picked, setPicked] = useState<Record<number, number>>({});
  if (!guide) return null;
  return (
    <section>
      <h3>Self-check</h3>
      {guide.selfCheck.map((item, index) => (
        <div key={item.prompt}>
          <p>{index + 1}. {item.prompt}</p>
          {item.choices.map((choice, choiceIndex) => {
            const selected = picked[index];
            const shown = selected !== undefined;
            const mark = shown && choiceIndex === item.answer ? "on" : shown && choiceIndex === selected ? "off" : "";
            return (
              <button key={choice} type="button" className={`choice ${mark}`} onClick={() => setPicked((current) => ({ ...current, [index]: choiceIndex }))}>
                {choice}
              </button>
            );
          })}
          {picked[index] !== undefined ? <p>{picked[index] === item.answer ? "Correct. " : "Not this one. "}{item.why}</p> : null}
        </div>
      ))}
    </section>
  );
}

function Notes({ labId }: { labId: string }) {
  const storageKey = `aca-lab-notes:${labId}`;
  const [text, setText] = useState("");
  useEffect(() => {
    setText(window.localStorage.getItem(storageKey) ?? "");
  }, [storageKey]);
  return (
    <section>
      <h3>My observations</h3>
      <p>Saved in this browser only.</p>
      <textarea aria-label="My observations" value={text} onChange={(event) => {
        setText(event.target.value);
        window.localStorage.setItem(storageKey, event.target.value);
      }} />
    </section>
  );
}

export function QuickGuide({ labId, hint, reading }: { labId: string; hint?: string; reading?: string }) {
  const walk = LAB_GUIDES[labId]?.walkthrough;
  const { id, setId } = useGuideFocus();
  const storageKey = `aca-guide-progress:${labId}`;
  const runKey = `aca-guide-runs:${labId}`;
  const [done, setDone] = useState<boolean[]>([false, false, false, false]);
  const [runs, setRuns] = useState<{ a: string; b: string }>({ a: "", b: "" });
  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) {
      setDone([false, false, false, false]);
      return;
    }
    try {
      const parsed: unknown = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length === 4) setDone(parsed.map((item) => item === true));
    } catch {
      setDone([false, false, false, false]);
    }
  }, [storageKey]);
  useEffect(() => {
    const saved = window.sessionStorage.getItem(runKey);
    if (!saved) {
      setRuns({ a: "", b: "" });
      return;
    }
    try {
      const parsed: unknown = JSON.parse(saved);
      if (parsed && typeof parsed === "object" && "a" in parsed && "b" in parsed) {
        const row = parsed as { a: unknown; b: unknown };
        setRuns({ a: typeof row.a === "string" ? row.a : "", b: typeof row.b === "string" ? row.b : "" });
      }
    } catch {
      setRuns({ a: "", b: "" });
    }
  }, [runKey]);
  if (!walk) return null;
  const snapshot = reading || hint || "Step the lab, then record.";
  const record = (slot: "a" | "b") => {
    const next = { ...runs, [slot]: snapshot };
    setRuns(next);
    window.sessionStorage.setItem(runKey, JSON.stringify(next));
  };
  const addNote = () => {
    const line = reading || hint;
    if (!line) return;
    const key = `aca-lab-notes:${labId}`;
    const previous = window.localStorage.getItem(key) ?? "";
    const text = previous ? `${previous}\n${line}` : line;
    window.localStorage.setItem(key, text);
    window.dispatchEvent(new CustomEvent("aca-notes", { detail: { labId, text } }));
  };
  const toggle = (index: number) => {
    const next = done.map((item, itemIndex) => itemIndex === index ? !item : item);
    setDone(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  };
  return (
    <details className="aca-quick">
      <summary>Quick Guide {done.filter(Boolean).length}/4{hint ? <span className="aca-hint">{hint}</span> : null}</summary>
      <div className="aca-quick-body">
        {hint ? <p className="aca-hint">{hint}</p> : null}
        <details open>
          <summary>Start here</summary>
          <ol>{walk.howToUse.map((item) => <li key={item}>{item}</li>)}</ol>
        </details>
        <details>
          <summary>Watch these</summary>
          <ul>{walk.observe.map((item) => <li key={item}>{item}</li>)}</ul>
          <div className="aca-quick-links">
            {walk.links.map((link) => (
              <button key={link.id} type="button" className={id === link.id ? "on" : ""} aria-pressed={id === link.id} onClick={() => setId(id === link.id ? "" : link.id)}>{link.label}</button>
            ))}
          </div>
        </details>
        <details>
          <summary>Try this</summary>
          {walk.experiments.map((item, index) => (
            <div key={item.title}>
              <b>{index + 1}. {item.title}</b>
              <ol>{item.steps.map((step) => <li key={step}>{step}</li>)}</ol>
            </div>
          ))}
        </details>
        <details>
          <summary>What should happen</summary>
          <ul>{walk.expected.map((item) => <li key={item}>{item}</li>)}</ul>
          <h3>Why it happens</h3>
          {walk.why.map((item) => <p key={item}>{item}</p>)}
        </details>
        <details>
          <summary>Challenge</summary>
          <p>{walk.challenge}</p>
          <h3>Check yourself</h3>
          <ol>{walk.check.map((item) => <li key={item}>{item}</li>)}</ol>
        </details>
        <div className="aca-quick-runs">
          <button type="button" onClick={() => record("a")}>Record run A</button>
          <button type="button" onClick={() => record("b")}>Record run B</button>
          <button type="button" onClick={addNote}>Add observation to notes</button>
          {runs.a ? <p>Run A: {runs.a}</p> : null}
          {runs.b ? <p>Run B: {runs.b}</p> : null}
        </div>
        <fieldset>
          <legend>Progress on this device</legend>
          {walk.checklist.map((item, index) => (
            <label key={item}>
              <input type="checkbox" checked={done[index] ?? false} onChange={() => toggle(index)} />
              {item}
            </label>
          ))}
        </fieldset>
      </div>
    </details>
  );
}

export function WalkthroughDoc({ walk }: { walk: LabWalkthrough }) {
  return (
    <>
      <h2>How to use this lab</h2>
      <ol>{walk.howToUse.map((item) => <li key={item}>{item}</li>)}</ol>
      <h2>Watch these</h2>
      <ul>{walk.observe.map((item) => <li key={item}>{item}</li>)}</ul>
      <h2>Try this</h2>
      {walk.experiments.map((item, index) => (
        <div key={item.title}>
          <h3>{index + 1}. {item.title}</h3>
          <ol>{item.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        </div>
      ))}
      <h2>What should happen</h2>
      <ul>{walk.expected.map((item) => <li key={item}>{item}</li>)}</ul>
      <h2>Why it happens</h2>
      {walk.why.map((item) => <p key={item}>{item}</p>)}
      <h2>Challenge</h2>
      <p>{walk.challenge}</p>
      <h2>Check yourself</h2>
      <ol>{walk.check.map((item) => <li key={item}>{item}</li>)}</ol>
    </>
  );
}
