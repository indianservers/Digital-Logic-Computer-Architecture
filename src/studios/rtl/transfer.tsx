import { useSimulatorCapture } from "../../layout/SimulatorCapture";
import { useLabMotion } from "../../design-system/LabMotion";
import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { evalRtl, parseRtl } from "../../engines/isa/rtl";
import { mask16, previewRtl, RTL_PRESETS, stagesFor, type RtlStage } from "../../engines/isa/rtlLab";
import { reducedMotion } from "../aca/animation/acaMotion";
import { Mark } from "./ui";

const FRESH = [0, 5, 3, 0, 0, 0, 0, 0];

export function TransferPanel({ explain }: { explain: boolean }) {
  useSimulatorCapture("studios/rtl/transfer.tsx:TransferPanel", () => ({ root: root.current, line, regs, stage, committed, story, pulse, motionEnabled }), "63f9f98c0537");

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
  const {enabled:motionEnabled}=useLabMotion();
  useGSAP(() => {
    if(!motionEnabled)return;
    if (!pulse || reducedMotion()) return;
    gsap.fromTo(".rtx-hot", { scale: 1.05 }, { scale: 1, duration: 0.35, clearProps: "scale" });
  }, { scope: root, dependencies: [pulse, motionEnabled] , revertOnUpdate: true});

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
        <h2><Mark kind="book"/> Register Transfer Language (RTL)</h2>
        <p>RTL describes micro-operations between registers, the ALU, and the bus.</p>
        {show ? (
          <div className="rtx-chips" aria-label="RTL statement">
            <b className={`dest ${on(stage, "write", "done")}`}>{`R${show.dest}`}</b>
            <span>←</span>
            <b className={`src-a ${on(stage, "read-a", "alu", "drive", "write", "done")}`}>{`R${show.leftName}`}</b>
            {show.op !== "MOVE" ? <b className={`alu ${on(stage, "alu", "drive", "write", "done")}`}>{show.op === "ADD" ? "+" : show.op === "SUB" ? "−" : show.op === "AND" ? "&" : show.op === "OR" ? "|" : "^"}</b> : null}
            {show.rightName !== null ? <b className={`src-b ${on(stage, "read-b", "alu", "drive", "write", "done")}`}>{`R${show.rightName}`}</b> : null}
          </div>
        ) : <p className="rtx-error">{error}</p>}
        {show ? <div className="rtx-chip-labels"><span>Destination</span><span>Source A</span>{show.op !== "MOVE"&&<span>ALU</span>}{show.rightName !== null&&<span>Source B</span>}</div>:null}{explain && show ? <p className="rtx-note">Read the sources, operate in the ALU, and write the destination on the step edge. Stage: {stage}.</p> : null}
        <h3 className="rtx-sequence-title">Micro-operation sequence</h3><ol className="rtx-steps">
          {plan.map((item,index) => <li key={item} className={item === stage ? "on" : ""}><span>{index+1}</span><b>{item}</b><small>{item==="read-a"?`Place R${show?.leftName} on bus`:item==="read-b"?`Place R${show?.rightName} on bus`:item==="alu"?"Perform operation":item==="drive"?"Drive result":item==="write"?`Write to R${show?.dest}`:"Complete"}</small></li>)}
        </ol>
      </section>
      <section className="rtx-card">
        <h2><Mark kind="play" /> Try it yourself</h2><p>Choose an operation, set register values, and step through the transfer.</p>
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
            <label><span><Mark kind="chip"/> R{show.leftName} (Source A)</span><input aria-label={`Value of R${show.leftName}`} value={regs[show.leftName] ?? 0} onChange={(event) => edit(show.leftName, event.target.value)} /></label>
            {show.rightName !== null ? <label><span><Mark kind="chip"/> R{show.rightName} (Source B)</span><input aria-label={`Value of R${show.rightName}`} value={regs[show.rightName] ?? 0} onChange={(event) => { const index = show.rightName; if (index !== null) edit(index, event.target.value); }} /></label> : null}
            <label><span><Mark kind="chip"/> R{show.dest} (Destination)</span><input aria-label={`Value of R${show.dest}`} value={regs[show.dest] ?? 0} onChange={(event) => edit(show.dest, event.target.value)} /></label>
          </div>
        ) : null}
        <div className="rtx-actions">
          <button type="button" className="rtx-go" onClick={step}><Mark kind="play" /><span>Step<small>Execute next micro-operation</small></span></button>
          <button type="button" className="rtx-quiet" onClick={() => { setRegs(FRESH); setLine("R3 ← R1 + R2"); setStage("idle"); setCommitted(false); setStory("Ready to write 8 into R3. R1 and R2 stay unchanged."); }}><Mark kind="reset" /><span>Reset<small>Clear and start again</small></span></button>
        </div>
      </section>
      <section className="rtx-card">
        <h2><Mark kind="memory"/> Register file <small className="rtx-count">8 registers • R0 – R7</small></h2><p>8 general purpose registers. Values can be read, written, and used in operations.</p>
        <div className="rtx-file">
          {regs.map((value, index) => (
            <div key={index} className={cellClass(show, index, stage)} title={`R${index} = ${value}`}>
              <strong><Mark kind="chip"/> R{index}</strong>
              <input aria-label={`Register R${index}`} value={value} onChange={(event) => edit(index, event.target.value)} />{show && (index===show.leftName||index===show.rightName||index===show.dest)?<small>{index===show.dest?"Destination":index===show.leftName?"Source A":"Source B"}</small>:null}
            </div>
          ))}
        </div>
      </section>
      <section className="rtx-card rtx-result">
        <h2><Mark kind="chart"/> Execution result</h2><p>See the outcome after each step is executed.</p>
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
