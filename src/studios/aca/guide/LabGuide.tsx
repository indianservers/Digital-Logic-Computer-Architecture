import { useEffect, useId, useState } from "react";
import { LAB_GUIDES } from "./index";

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
