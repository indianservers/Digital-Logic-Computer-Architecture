import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { theoryForRoute } from "../theory/catalogue";
import { focusedArticle } from "../theory/focus";
import { lessonPlan } from "../theory/lessonPlans";
import type { TheoryArticle } from "../theory/types";
import { plannedLabBySlug } from "../studios/microcontroller/labs/registry";
import { emptyExperiment, experimentReport, experimentStorageKey, parseExperiment, type ExperimentRecord } from "./experimentRecord";
import { experimentSearch } from "./experimentContext";
import "./experiment.css";
import { useCaptureSimulator, useSimulatorSourceCount } from "./SimulatorCapture";
import { compareEvidence } from "./experimentEvidence";

export function ExperimentNotebook({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pathname, search } = useLocation();
  const article = useMemo(() => {
    if (["/studios/microcontroller", "/studios/how-devices-work", "/studios/vlsi", "/studios/advanced-computer-architecture"].includes(pathname)) return undefined;
    if (pathname.startsWith("/studios/microcontroller/lab/") && plannedLabBySlug(pathname.split("/").pop() ?? "")) return undefined;
    const source = theoryForRoute(pathname, experimentSearch(pathname, search));
    // Do not attach a parent lesson's experiment to an unavailable or unknown route.
    return source && source.route.split("?")[0] === pathname ? focusedArticle(source) : undefined;
  }, [pathname, search]);
  return article ? <Notebook key={article.route} article={article} open={open} onClose={onClose} /> : <aside id="experiment-notebook" className="experiment-notebook experiment-drawer" hidden={!open} aria-label="Experiment notebook"><div className="experiment-content"><button type="button" onClick={onClose}>Close notebook</button><h2>Choose an experiment</h2><p>Open a lab from this studio to capture its simulator state and compare runs.</p></div></aside>;
}

function Notebook({ article, open, onClose }: { article: TheoryArticle; open: boolean; onClose: () => void }) {
  const captureSimulator = useCaptureSimulator();
  const sourceCount = useSimulatorSourceCount();
  const plan = useMemo(() => lessonPlan(article), [article]);
  const steps = article.guide.length ? article.guide : plan.examples[0]?.steps ?? [];
  const expected = article.takeaways.length ? article.takeaways : plan.concepts.slice(0, 3).map(([title, body]) => `${title}: ${body}`);
  const question = plan.questions[0];
  const storageKey = experimentStorageKey(article.route);
  const [record, setRecord] = useState<ExperimentRecord>(() => {
    try { return parseExperiment(localStorage.getItem(storageKey)); } catch { return emptyExperiment(); }
  });
  const [edited, setEdited] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Notes stay on this device");
  const [showAnswer, setShowAnswer] = useState(false);
  const [notice, setNotice] = useState("");

  const reviewedCount = steps.filter((step) => record.reviewed.includes(step)).length;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.querySelector<HTMLButtonElement>("#experiment-notebook button")?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { onClose(); previous?.focus(); } };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open, onClose]);

  useEffect(() => {
    if (!edited) return;
    try { localStorage.setItem(storageKey, JSON.stringify(record)); setSaveStatus("Saved on this device"); }
    catch { setSaveStatus("Local save unavailable — export to keep your notes"); }
  }, [record, storageKey, edited]);

  function update(patch: Partial<ExperimentRecord>) {
    setEdited(true);
    setRecord((current) => ({ ...current, ...patch }));
    setNotice("");
  }

  function capture() {
    const evidence = captureSimulator(article.route);
    if (!evidence.sources.length) { setNotice("No simulator model is mounted. Wait for loading to finish or open an interactive experiment."); return; }
    const configuration = evidence.controls.map(c => c.label + " = " + c.value).join("\n");
    const runs = [...record.runs, {
      configuration: [configuration, record.configuration ? "Setup notes: " + record.configuration : ""].filter(Boolean).join("\n") || "Captured engine state",
      observation: record.observation || "See captured simulator state and readouts.",
      capturedAt: evidence.capturedAt, evidence,
    }].slice(-6);
    update({ runs });
    setNotice("Simulator snapshot saved. " + runs.length + " of 6 comparison slots used." + (evidence.truncated ? " Large traces are bounded; the snapshot is marked truncated." : ""));
  }
  const baseline = record.runs[0]?.evidence;
  const latest = record.runs.at(-1)?.evidence;
  const differences = baseline && latest && baseline !== latest ? compareEvidence(baseline, latest) : [];

  function download() {
    const report = experimentReport(article.title, article.route, record, steps, expected, question?.question);
    const url = URL.createObjectURL(new Blob([report], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${article.id.replace(/[^a-z0-9-]/gi, "-")}-experiment.md`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Experiment report exported.");
  }
  function downloadSnapshots() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, title: article.title, route: article.route, runs: record.runs }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = article.id.replace(/[^a-z0-9-]/gi, "-") + "-snapshots.json"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Simulator snapshots exported.");
  }

  return <aside id="experiment-notebook" className="experiment-notebook experiment-drawer" hidden={!open} aria-label="Experiment notebook">
    <div className="experiment-content">
      <header className="experiment-heading"><div><span className="experiment-eyebrow">GUIDED EXPERIMENT</span><h2>{article.title}</h2><p>Capture live state, compare runs, and explain the result.</p></div><button type="button" onClick={onClose}>Close notebook</button></header>
      <div className="experiment-columns">
        <section className="experiment-plan"><h3><span>1</span> Predict & prepare</h3>
          <label>My prediction<textarea maxLength={12000} value={record.prediction} onChange={(event) => update({ prediction: event.target.value })} placeholder="What should happen, and why?" /></label>
          <div className="experiment-step-heading"><h4>Experiment steps</h4><span>{reviewedCount}/{steps.length} reviewed</span></div>
          <ol className="experiment-checklist">{steps.map((step, index) => <li key={`${index}-${step}`}><label><input type="checkbox" checked={record.reviewed.includes(step)} onChange={(event) => update({ reviewed: event.target.checked ? [...record.reviewed, step] : record.reviewed.filter((item) => item !== step) })} /><span>{step}</span></label></li>)}</ol>
          <small>Check steps as you review them; simulator results are not graded by this checklist.</small>
          <details className="experiment-expected"><summary>Expected behavior & key ideas</summary><ul>{expected.map((item, index) => <li key={index}>{item}</li>)}</ul></details>
        </section>
        <section><h3><span>2</span> Run & observe</h3><p className="experiment-hint">Run or step the simulator, then capture its configuration, engine state, and displayed results. Your notes are saved alongside the snapshot.</p>
          <label>Additional setup notes (optional)<textarea maxLength={12000} value={record.configuration} onChange={(event) => update({ configuration: event.target.value })} placeholder="Inputs and state are captured automatically. Add any extra setup notes…" /></label>
          <label>My observation (optional)<textarea maxLength={12000} value={record.observation} onChange={(event) => update({ observation: event.target.value })} placeholder="Measurements and readouts are captured automatically. Explain what you noticed…" /></label>
          <button type="button" className="experiment-primary" disabled={!sourceCount} onClick={capture}>Capture simulator state</button>
          <p role="status">{notice || (record.runs.length ? record.runs.length + " snapshots saved. Compare them below." : "Ready to capture the current simulator.")}</p>
          {!sourceCount && <p role="status">No simulator model is mounted. Open an interactive experiment, or wait for loading to finish.</p>}
          <small>Keeps the latest 6 snapshots, with route, capture time, model source version, inputs and state. Capture pauses neither execution nor the clock.</small>
        </section>
        <section><h3><span>3</span> Explain & check</h3>
          <label>My conclusion<textarea maxLength={12000} value={record.conclusion} onChange={(event) => update({ conclusion: event.target.value })} placeholder="Did the result match your prediction? Explain the mechanism and any discrepancy." /></label>
          {question && <div className="experiment-self-check"><h4>Self-check</h4><p>{question.question}</p><label>My answer<textarea maxLength={12000} value={record.answer} onChange={(event) => update({ answer: event.target.value })} placeholder="Reason through your answer before revealing the explanation." /></label><button type="button" aria-expanded={showAnswer} onClick={() => setShowAnswer((value) => !value)}>{showAnswer ? "Hide explanation" : "Compare with explanation"}</button>{showAnswer && <p className="experiment-answer">{question.answer}</p>}</div>}
          <Link className="experiment-theory-link" to={`${article.route}${article.route.includes("?") ? "&" : "?"}view=theory`}>Read this lab’s theory →</Link>
        </section>
      </div>
      {!!record.runs.length && <section className="experiment-runs"><h3>Compare recorded runs</h3><div className="experiment-table-scroll"><table><thead><tr><th scope="col">Run</th><th scope="col">Configuration</th><th scope="col">Observation</th></tr></thead><tbody>{record.runs.map((run, index) => <tr key={`${run.capturedAt}-${index}`}><th scope="row">{index + 1}</th><td>{run.configuration}</td><td>{run.observation}{run.evidence && <details><summary>Simulator evidence: {run.evidence.sources.length} sources{run.evidence.truncated ? " (truncated)" : ""}</summary><pre>{JSON.stringify(run.evidence, null, 2)}</pre></details>}</td></tr>)}</tbody></table></div></section>}
      {baseline && latest && baseline !== latest && <section className="experiment-runs"><h3>Baseline to latest state changes</h3>{differences.length ? <table><thead><tr><th>Field</th><th>Baseline</th><th>Latest</th></tr></thead><tbody>{differences.map(d => <tr key={d.field}><th>{d.field}</th><td>{d.before}</td><td>{d.after}</td></tr>)}</tbody></table> : <p>No changes in captured configuration or engine state.</p>}</section>}
      {differences.length > 0 && <small>Showing up to 100 changed fields. Export snapshots for the complete captured data.</small>}
      <footer className="experiment-footer"><span>{saveStatus}</span><button type="button" onClick={download}>Export experiment report</button><button type="button" onClick={downloadSnapshots} disabled={!record.runs.some(run => run.evidence)}>Export snapshots JSON</button></footer>
    </div>
  </aside>;
}
