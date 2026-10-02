import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { VLSI_LABS, vlsiLabBySlug, vlsiRoute, type VlsiLabMeta } from "../../data/vlsiLabs";
import { CATEGORY_COLOR, LEARNING_PATHS, PREDICTS, QUIZZES, RELATED, type Question } from "./content";
import type { LabRuntime } from "./runtime";
import { labStatus, setLabComplete, useVlsiProgress } from "./store";
import { VIcon } from "./vlsiIcons";

export function pathRoute(slug: string, pathId: string): string {
  return `${vlsiRoute(slug)}?path=${encodeURIComponent(pathId)}`;
}

export function PathBar({ pathId, slug }: { pathId: string | null; slug: string }) {
  const progress = useVlsiProgress();
  const path = LEARNING_PATHS.find((item) => item.id === pathId);
  if (!path || !pathId) return null;
  const index = path.slugs.indexOf(slug);
  if (index < 0) return null;
  const nextSlug = path.slugs[index + 1];
  const next = nextSlug ? vlsiLabBySlug(nextSlug) : undefined;
  return (
    <nav className="vlsi-pathbar" aria-label={`Learning path: ${path.title}`}>
      <span><b>Path · {path.title}</b> · step {index + 1} of {path.slugs.length}</span>
      <ol>
        {path.slugs.map((item, step) => {
          const lab = vlsiLabBySlug(item);
          return (
            <li key={item}>
              <Link to={pathRoute(item, pathId)} className={`${labStatus(progress, item)}${item === slug ? " here" : ""}`} aria-current={item === slug ? "step" : undefined} title={lab?.title}>
                {step + 1}
              </Link>
            </li>
          );
        })}
      </ol>
      {next ? <Link className="vlsi-pathnext" to={pathRoute(next.slug, pathId)}>Next in path: {next.title} →</Link> : <span className="vlsi-pathnext">Last step of this path</span>}
    </nav>
  );
}

export function PredictCard({ slug }: { slug: string }) {
  const question = PREDICTS[slug];
  const [choice, setChoice] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  if (!question || dismissed) return null;
  const correct = choice === question.answer;
  return (
    <section className="vlsi-predict" aria-label="Predict before you experiment">
      <div className="vlsi-predict-head">
        <b>Predict first</b>
        <button type="button" className="vlsi-icon-btn" aria-label="Dismiss prediction" onClick={() => setDismissed(true)}><VIcon name="close" /></button>
      </div>
      <p>{question.prompt}</p>
      <div className="vlsi-predict-options" role="group" aria-label="Your prediction">
        {question.options.map((option, index) => (
          <button
            key={option}
            type="button"
            aria-pressed={choice === index}
            className={choice === null ? "" : index === question.answer ? "right" : choice === index ? "wrong" : ""}
            disabled={choice !== null}
            onClick={() => setChoice(index)}
          >
            {option}
          </button>
        ))}
      </div>
      {choice !== null ? (
        <p className={`vlsi-predict-result ${correct ? "ok" : "no"}`} aria-live="polite">
          {correct ? "Good prediction. " : `Not quite: the answer is “${question.options[question.answer]}”. `}
          {question.explain} Now check it with the controls below.
        </p>
      ) : null}
    </section>
  );
}

function QuizItem({ question, index, picked, onPick }: { question: Question; index: number; picked: number | undefined; onPick: (value: number) => void }) {
  return (
    <fieldset className="vlsi-quiz-q">
      <legend>{index + 1}. {question.prompt}</legend>
      <div className="vlsi-predict-options">
        {question.options.map((option, optionIndex) => (
          <button
            key={option}
            type="button"
            aria-pressed={picked === optionIndex}
            disabled={picked !== undefined}
            className={picked === undefined ? "" : optionIndex === question.answer ? "right" : picked === optionIndex ? "wrong" : ""}
            onClick={() => onPick(optionIndex)}
          >
            {option}
          </button>
        ))}
      </div>
      {picked !== undefined ? <p className={`vlsi-predict-result ${picked === question.answer ? "ok" : "no"}`}>{picked === question.answer ? "Correct. " : "Not quite. "}{question.explain}</p> : null}
    </fieldset>
  );
}

export function LabCheck({ slug, runtime }: { slug: string; runtime: LabRuntime }) {
  const questions = QUIZZES[slug];
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState("");
  const [revealed, setRevealed] = useState(false);
  const answered = Object.keys(answers).length;
  const score = questions ? questions.filter((question, index) => answers[index] === question.answer).length : 0;
  useEffect(() => {
    if (questions && answered === questions.length) setLabComplete(slug, true);
  }, [answered, questions, slug]);

  if (!questions) {
    return (
      <details className="vlsi-panel vlsi-check">
        <summary>Explain it back</summary>
        <p>Write in one or two sentences what this lab shows, then compare it with the takeaway.</p>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} aria-label="Your explanation" placeholder="This lab shows that…" />
        <div className="vlsi-check-actions">
          <button type="button" onClick={() => setRevealed(true)} disabled={revealed}>Compare with the takeaway</button>
          {revealed ? <button type="button" onClick={() => setLabComplete(slug, true)}><VIcon name="check" />Mark lab complete</button> : null}
        </div>
        {revealed ? <p className="vlsi-take"><b>Takeaway. </b>{runtime.takeaway || "This lab has no written takeaway yet; compare with the What to observe panel."}</p> : null}
      </details>
    );
  }
  return (
    <details className="vlsi-panel vlsi-check" open={answered > 0 || undefined}>
      <summary>Check your understanding · {answered}/{questions.length}{answered === questions.length ? ` · ${score} correct` : ""}</summary>
      {questions.map((question, index) => (
        <QuizItem key={question.prompt} question={question} index={index} picked={answers[index]} onPick={(value) => setAnswers((current) => ({ ...current, [index]: value }))} />
      ))}
      {answered === questions.length ? (
        <div className="vlsi-check-actions">
          <span>{score === questions.length ? "All correct. Lab marked complete." : `${score} of ${questions.length} correct. Lab marked complete; retry to improve.`}</span>
          <button type="button" onClick={() => setAnswers({})}>Try again</button>
        </div>
      ) : null}
    </details>
  );
}

export function RelatedLinks({ lab }: { lab: VlsiLabMeta }) {
  const external = RELATED[lab.slug] ?? [];
  const siblings = VLSI_LABS
    .filter((item) => item.implemented && item.category === lab.category && item.slug !== lab.slug)
    .sort((a, b) => Math.abs(a.number - lab.number) - Math.abs(b.number - lab.number))
    .slice(0, 4)
    .sort((a, b) => a.number - b.number);
  if (external.length === 0 && siblings.length === 0) return null;
  return (
    <nav className="vlsi-panel vlsi-related" aria-label="Related">
      <h2>Related</h2>
      <div>
        {siblings.map((item) => (
          <Link key={item.slug} to={vlsiRoute(item.slug)} style={{ ["--cat" as string]: CATEGORY_COLOR[item.category] }}>
            <small>Lab {item.number}</small>{item.title}
          </Link>
        ))}
        {external.map((item) => (
          <Link key={item.to} to={item.to} className="ext"><small>Elsewhere in the app</small>{item.label}</Link>
        ))}
      </div>
    </nav>
  );
}
