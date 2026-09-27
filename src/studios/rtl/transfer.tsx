import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { evalRtl, parseRtl } from "../../engines/isa/rtl";
import { mask16, previewRtl, RTL_PRESETS, stagesFor, type RtlStage } from "../../engines/isa/rtlLab";
import { reducedMotion } from "../aca/animation/acaMotion";
import { Mark } from "./ui";

const FRESH = [0, 5, 3, 0, 0, 0, 0, 0];

export function TransferPanel({ explain }: { explain: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [line, setLine] = useState("R3 ← R1 + R2");
  const [regs, setRegs] = useState(FRESH);
  const [stage, setStage] = useState<RtlStage>("idle");
  const [committed, setCommitted] = useState(false);
  const [story, setStory] = useState("Ready to write 8 into R3. R1 and R2 stay unchanged.");
  const [pulse, setPulse] = useState(0);
  const parsed = parseRtl(line);
  const preview = previewRtl(regs, line);
  const error = "error" in parsed ? parsed.error : null;
  const plan = "error" in parsed ? [] : stagesFor(parsed.op);
  useGSAP(() => {
    if (!pulse || reducedMotion()) return;
    gsap.fromTo(".rtx-hot", { scale: 1.05 }, { scale: 1, duration: 0.35, clearProps: "scale" });
  }, { scope: root, dependencies: [pulse] });

  function edit(index: number, text: string) {
    if (text.trim() === "" || !Number.isFinite(Number(text))) return;
    setRegs((current) => current.map((value, at) => at === index ? mask16(Number(text)) : value));
    setCommitted(false);
    setStage("idle");
    setStory("Values changed. Step again to run the transfer.");
  }

  function step() {
    if (error || "error" in preview) return;
    const order = plan;
    const at = order.indexOf(stage);
    const next = order[at + 1] ?? order[0] ?? "done";
    if (stage === "done") {
      setCommitted(false);
      setStage("read-a");
      setPulse((value) => value + 1);
      return;
    }
    setStage(next);
    setPulse((value) => value + 1);
    if (next === "write" && !committed && show) {
      const result = evalRtl(regs, line);
      if (!result.error) {
        setStory(show.explain);
        setRegs(result.regs);
        setCommitted(true);
      }
    }
  }

  const show = "error" in preview ? null : preview;
  return (
    <div className="rtx-transfer" ref={root} onKeyDown={(event) => { if (event.key === "Escape") setStage("idle"); }}>
      <section className="rtx-card">
        <h2>Register Transfer Language (RTL)</h2>
        <p>RTL describes micro-operations between registers, the ALU, and the bus.</p>
        {show ? (
          <div className="rtx-chips" aria-label="RTL statement">
            <b className={on(stage, "write", "done")}>{`R${show.dest}`}</b>
            <span>←</span>
            <b className={`src-a ${on(stage, "read-a", "alu", "drive", "write", "done")}`}>{`R${show.leftName}`}</b>
            {show.op !== "MOVE" ? <b className={`alu ${on(stage, "alu", "drive", "write", "done")}`}>{show.op === "ADD" ? "+" : show.op === "SUB" ? "−" : show.op === "AND" ? "&" : show.op === "OR" ? "|" : "^"}</b> : null}
            {show.rightName !== null ? <b className={`src-b ${on(stage, "read-b", "alu", "drive", "write", "done")}`}>{`R${show.rightName}`}</b> : null}
          </div>
        ) : <p className="rtx-error">{error}</p>}
        {explain && show ? <p className="rtx-note">Read the sources, operate in the ALU, and write the destination on the step edge. Stage: {stage}.</p> : null}
        <ol className="rtx-steps">
          {plan.map((item) => <li key={item} className={item === stage ? "on" : ""}>{item}</li>)}
        </ol>
      </section>
      <section className="rtx-card">
        <h2><Mark kind="play" /> Try it yourself</h2>
        <label>Operation
          <select aria-label="Operation" value={line} onChange={(event) => { setLine(event.target.value); setStage("idle"); setCommitted(false); }}>
            {RTL_PRESETS.map((item) => <option key={item}>{item}</option>)}
            {(RTL_PRESETS as readonly string[]).includes(line) ? null : <option value={line}>{line}</option>}
          </select>
        </label>
        <input aria-label="RTL expression" value={line} onChange={(event) => { setLine(event.target.value); setStage("idle"); setCommitted(false); }} onKeyDown={(event) => { if (event.key === "Enter") step(); }} />
        {error ? <p className="rtx-error">{error}</p> : null}
        {show ? (
          <div className="rtx-trio">
            <label>R{show.leftName}<input aria-label={`Value of R${show.leftName}`} value={regs[show.leftName] ?? 0} onChange={(event) => edit(show.leftName, event.target.value)} /></label>
            {show.rightName !== null ? <label>R{show.rightName}<input aria-label={`Value of R${show.rightName}`} value={regs[show.rightName] ?? 0} onChange={(event) => { const index = show.rightName; if (index !== null) edit(index, event.target.value); }} /></label> : null}
            <label>R{show.dest} destination<input aria-label={`Value of R${show.dest}`} value={regs[show.dest] ?? 0} onChange={(event) => edit(show.dest, event.target.value)} /></label>
          </div>
        ) : null}
        <div className="rtx-actions">
          <button type="button" className="rtx-go" onClick={step}><Mark kind="play" /> Step</button>
          <button type="button" className="rtx-quiet" onClick={() => { setRegs(FRESH); setLine("R3 ← R1 + R2"); setStage("idle"); setCommitted(false); setStory("Ready to write 8 into R3. R1 and R2 stay unchanged."); }}><Mark kind="reset" /> Reset</button>
        </div>
      </section>
      <section className="rtx-card">
        <h2>Register file</h2>
        <div className="rtx-file">
          {regs.map((value, index) => (
            <div key={index} className={cellClass(show, index, stage)} title={`R${index} = ${value}`}>
              <strong>R{index}</strong>
              <input aria-label={`Register R${index}`} value={value} onChange={(event) => edit(index, event.target.value)} />
            </div>
          ))}
        </div>
      </section>
      <section className="rtx-card rtx-result">
        <h2>Execution result</h2>
        {show ? (
          <>
            <p className={`rtx-big ${pulse ? "rtx-hot" : ""}`}><Mark kind="ok" /> R{show.dest} = {committed ? (regs[show.dest] ?? 0) : show.after}</p>
            <p className="mono">{show.op === "MOVE" ? `R${show.dest} ← R${show.leftName} (${show.left})` : `R${show.leftName} (${show.left}) ${show.op} R${show.rightName} (${show.right}) = ${show.after}`}</p>
            {explain ? <div className="rtx-changed"><h3>What changed?</h3><p>{committed ? story : `Ready to write ${show.after} into R${show.dest}. Sources stay unchanged.`}</p></div> : null}
          </>
        ) : <p className="rtx-error">Fix the expression before stepping.</p>}
      </section>
    </div>
  );
}

function on(stage: RtlStage, ...names: RtlStage[]): string {
  return names.includes(stage) ? "on" : "";
}

function cellClass(show: { leftName: number; rightName: number | null; dest: number } | null, index: number, stage: RtlStage): string {
  if (!show) return "";
  if (index === show.leftName) return `src-a ${on(stage, "read-a", "alu", "drive", "write", "done")}`;
  if (index === show.rightName) return `src-b ${on(stage, "read-b", "alu", "drive", "write", "done")}`;
  if (index === show.dest) return `dest ${on(stage, "write", "done")}`;
  return "";
}
