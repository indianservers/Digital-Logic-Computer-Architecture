import { useState } from "react";
import "./studioExperience.css";

/** Evaluates live simulator evidence; it never awards progress for opening a page. */
export function LabChallenge({ objective, passed, success, hint }: { objective: string; passed: boolean; success: string; hint: string }) {
  const [checked, setChecked] = useState(false);
  return <section className="studio-challenge" aria-label="Practical challenge">
    <div><span>TRY IT YOURSELF</span><h3>Practical challenge</h3><p>{objective}</p></div>
    <button type="button" onClick={() => setChecked(true)}>Check current result</button>
    {checked && <p className={passed ? "challenge-pass" : "challenge-hint"} role="status"><strong>{passed ? "Verified: " : "Keep experimenting: "}</strong>{passed ? success : hint}</p>}
  </section>;
}
