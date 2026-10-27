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

export function ExperimentNotebook() {
  const { pathname, search } = useLocation();
  const article = useMemo(() => {
    if (["/studios/microcontroller", "/studios/how-devices-work", "/studios/vlsi", "/studios/advanced-computer-architecture"].includes(pathname)) return undefined;
    if (pathname.startsWith("/studios/microcontroller/lab/") && plannedLabBySlug(pathname.split("/").pop() ?? "")) return undefined;
    const source = theoryForRoute(pathname, experimentSearch(pathname, search));
    // Do not attach a parent lesson's experiment to an unavailable or unknown route.
    return source && source.route.split("?")[0] === pathname ? focusedArticle(source) : undefined;
  }, [pathname, search]);
  return article ? <Notebook key={article.route} article={article} /> : null;
}

function Notebook({ article }: { article: TheoryArticle }) {
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
  const [open, setOpen] = useState(false);
  const reviewedCount = steps.filter((step) => record.reviewed.includes(step)).length;

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
    if (!record.configuration.trim() || !record.observation.trim()) return;
    const runs = [...record.runs, { configuration: record.configuration, observation: record.observation, capturedAt: new Date().toISOString() }].slice(-6);
    update({ runs });
    setNotice(`Run captured. ${runs.length} of 6 comparison slots used.${record.runs.length === 6 ? " The oldest run was replaced." : ""}`);
  }

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

  return <details className="experiment-notebook" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary><span className="experiment-mark" aria-hidden="true">▤</span><span><strong>Experiment notebook</strong><small>{article.title} · Predict → Run → Observe → Explain</small></span><span className="experiment-summary-status">{record.runs.length ? `${record.runs.length} recorded runs` : "Open guide & record"}</span></summary>
    {open && <div className="experiment-content">
      <header className="experiment-heading"><div><span className="experiment-eyebrow">GUIDED EXPERIMENT</span><h2>{article.title}</h2><p>{article.introduction}</p></div><button type="button" onClick={() => setOpen(false)}>Return to simulator ↓</button></header>
      <div className="experiment-columns">
        <section className="experiment-plan"><h3><span>1</span> Predict & prepare</h3>
          <label>My prediction<textarea maxLength={12000} value={record.prediction} onChange={(event) => update({ prediction: event.target.value })} placeholder="What should happen, and why?" /></label>
          <div className="experiment-step-heading"><h4>Experiment steps</h4><span>{reviewedCount}/{steps.length} reviewed</span></div>
          <ol className="experiment-checklist">{steps.map((step, index) => <li key={`${index}-${step}`}><label><input type="checkbox" checked={record.reviewed.includes(step)} onChange={(event) => update({ reviewed: event.target.checked ? [...record.reviewed, step] : record.reviewed.filter((item) => item !== step) })} /><span>{step}</span></label></li>)}</ol>
          <small>Check steps as you review them; simulator results are not graded by this checklist.</small>
          <details className="experiment-expected"><summary>Expected behavior & key ideas</summary><ul>{expected.map((item, index) => <li key={index}>{item}</li>)}</ul></details>
        </section>
        <section><h3><span>2</span> Run & observe</h3><p className="experiment-hint">Use the simulator below. Record inputs and outputs with units. Change one variable, run again, and capture both results.</p>
          <label>Inputs & configuration<textarea maxLength={12000} value={record.configuration} onChange={(event) => update({ configuration: event.target.value })} placeholder="Inputs, settings, initial state, clock or cycle…" /></label>
          <label>Observed result<textarea maxLength={12000} value={record.observation} onChange={(event) => update({ observation: event.target.value })} placeholder="Output values, waveform changes, timing, errors…" /></label>
          <button type="button" className="experiment-primary" disabled={!record.configuration.trim() || !record.observation.trim()} onClick={capture}>Capture comparison run</button>
          <small>Records your notes, not simulator state. Keeps the latest 6 runs.</small>
        </section>
        <section><h3><span>3</span> Explain & check</h3>
          <label>My conclusion<textarea maxLength={12000} value={record.conclusion} onChange={(event) => update({ conclusion: event.target.value })} placeholder="Did the result match your prediction? Explain the mechanism and any discrepancy." /></label>
          {question && <div className="experiment-self-check"><h4>Self-check</h4><p>{question.question}</p><label>My answer<textarea maxLength={12000} value={record.answer} onChange={(event) => update({ answer: event.target.value })} placeholder="Reason through your answer before revealing the explanation." /></label><button type="button" aria-expanded={showAnswer} onClick={() => setShowAnswer((value) => !value)}>{showAnswer ? "Hide explanation" : "Compare with explanation"}</button>{showAnswer && <p className="experiment-answer">{question.answer}</p>}</div>}
          <Link className="experiment-theory-link" to={`${article.route}${article.route.includes("?") ? "&" : "?"}view=theory`}>Read this lab’s theory →</Link>
        </section>
      </div>
      {!!record.runs.length && <section className="experiment-runs"><h3>Compare recorded runs</h3><div className="experiment-table-scroll"><table><thead><tr><th scope="col">Run</th><th scope="col">Configuration</th><th scope="col">Observation</th></tr></thead><tbody>{record.runs.map((run, index) => <tr key={`${run.capturedAt}-${index}`}><th scope="row">{index + 1}</th><td>{run.configuration}</td><td>{run.observation}</td></tr>)}</tbody></table></div></section>}
      <footer className="experiment-footer"><span>{saveStatus}</span><span role="status">{notice}</span><button type="button" onClick={download}>Export experiment report</button></footer>
    </div>}
  </details>;
}
