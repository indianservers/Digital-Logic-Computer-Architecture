import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Card, ExplainBar, Metric, Segmented } from "../../design-system/ui";
import { FLYNN, issueCycles, renameOps, smtIssue, speculate, stepRob, vectorAdd, type MiniOp, type RobEntry } from "../../engines/arch/parallel";
import { StudioFrame } from "../../layout/StudioFrame";
import { usePrefs } from "../../store/prefs";

const OPS: MiniOp[] = [
  { text: "ADD R1, R2, R3", dest: "R1", sources: ["R2", "R3"] },
  { text: "SUB R4, R5, R6", dest: "R4", sources: ["R5", "R6"] },
  { text: "AND R7, R1, R4", dest: "R7", sources: ["R1", "R4"] },
];

export function ParallelStudio() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "flynn";
  const [width, setWidth] = useState("2");
  const [rob, setRob] = useState<RobEntry[]>(OPS.map((op) => ({ text: op.text, status: "wait" })));
  const [predicted, setPredicted] = useState(false);
  const { prefs } = usePrefs();
  const cycles = issueCycles(OPS, Number(width));
  const renamed = renameOps([
    { text: "ADD R1, R2, R3", dest: "R1", sources: ["R2", "R3"] },
    { text: "SUB R1, R1, R4", dest: "R1", sources: ["R1", "R4"] },
  ]);
  const lanes = vectorAdd([1, 2, 3, 4], [10, 20, 30, 40]);
  const threads = smtIssue(Number(width), 4, 4);
  const speculation = speculate(predicted, false, 2);
  const span = Math.max(...cycles) + 1;

  return (
    <StudioFrame icon="gate" title="Parallel Processing" description="Issue width is a limit, not a guarantee. Dependencies, the reorder buffer, and a wrong branch still set the pace." tabs={[{ id: "flynn", label: "Flynn" }, { id: "ilp", label: "ILP" }, { id: "rename", label: "Rename" }, { id: "rob", label: "ROB" }, { id: "simd", label: "SIMD" }, { id: "smt", label: "SMT" }]} tab={tab} onTab={(id) => setParams({ tab: id })} guide={["Independent instructions can share a cycle up to the issue width.", "Renaming gives a later write of R1 a new physical register.", "The reorder buffer retires the oldest completed instruction first."]} takeaways={["A 4-wide machine does not retire four instructions every cycle.", "SIMD applies one operation to each lane.", "SMT shares one core's issue slots between threads."]}>
      {prefs.explain ? <ExplainBar what={`Issue width ${width} finishes this bundle in ${span} cycles.`} why="AND waits for R1 and R4, so it cannot share cycle 0 with ADD." notice="Out-of-order completion is allowed. Architectural retirement stays in program order." /> : null}
      <Segmented options={["1", "2", "4"]} value={width} onChange={setWidth} />
      {tab === "flynn" ? (
        <div className="grid cards-2">
          {FLYNN.map((item) => <Card key={item.id} title={item.id}><p>{item.title}</p><p className="tiny">{item.example}</p></Card>)}
        </div>
      ) : null}
      {tab === "ilp" ? (
        <Card title="Issue cycles">
          {OPS.map((op, index) => <div key={op.text} className="spread"><span>{op.text}</span><strong>cycle {cycles[index]}</strong></div>)}
          <Metric label="Cycles for 3 instructions" value={String(span)} />
        </Card>
      ) : null}
      {tab === "rename" ? (
        <Card title="R1 is written twice">
          <p>First destination {renamed[0]?.dest}. Second reads {renamed[1]?.sources.join(", ")} and writes {renamed[1]?.dest}.</p>
          <p className="tiny">The second R1 does not overwrite the physical register the second instruction still needs as a source.</p>
        </Card>
      ) : null}
      {tab === "rob" ? (
        <Card title="Retire the head">
          {rob.map((entry) => <div key={entry.text} className="spread"><span>{entry.text}</span><span>{entry.status}</span></div>)}
          <Button variant="primary" onClick={() => setRob(stepRob(rob))}>Step ROB</Button>
          <Button onClick={() => setRob(OPS.map((op) => ({ text: op.text, status: "wait" })))}>Reset</Button>
        </Card>
      ) : null}
      {tab === "simd" ? (
        <Card title="Four lanes">
          <p>[1, 2, 3, 4] + [10, 20, 30, 40] = [{lanes.join(", ")}]</p>
          <p className="tiny">A scalar ALU would perform four adds. The vector ALU performs them as one instruction across lanes.</p>
        </Card>
      ) : null}
      {tab === "smt" ? (
        <Card title="Two threads, shared issue">
          <p>Four instructions on each thread use {threads.cycles} cycles and issue {threads.issued}.</p>
          <Metric label="Utilization" value={threads.utilization.toFixed(2)} />
          <Button onClick={() => setPredicted((value) => !value)}>Prediction {predicted ? "taken" : "not taken"}</Button>
          <p>{speculation.correct ? "The predicted path commits." : `Flush ${speculation.flushed} wrong-path instructions.`}</p>
        </Card>
      ) : null}
    </StudioFrame>
  );
}
