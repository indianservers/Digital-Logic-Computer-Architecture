import { useState } from "react";
import { useStudioTab } from "../../layout/useStudioTab";
import { Button, Card, ExplainBar, Metric, Segmented } from "../../design-system/ui";
import { nonPipelinedCycles, runPipe, speedup, stepPipe, type PipeState } from "../../engines/isa/pipeline";
import { StudioFrame } from "../../layout/StudioFrame";
import { usePrefs } from "../../store/prefs";

const PROGRAM = "ADDI R1, R0, 5\nADDI R2, R0, 3\nADD R3, R1, R2\nHALT\n";
const TABS = [
  { id: "pipe", label: "Pipeline" },
  { id: "regs", label: "Pipeline Registers" },
  { id: "metrics", label: "Throughput" },
];

export function PipelineStudio() {
  const [tab, setTab] = useStudioTab(TABS, "pipe");
  const [forwarding, setForwarding] = useState("On");
  const [pipe, setPipe] = useState<PipeState | null>(null);
  const { prefs } = usePrefs();
  const ideal = pipe ? nonPipelinedCycles(Math.max(pipe.retired, 1)) : 0;

  return (
    <StudioFrame icon="step" title="CPU Pipeline" description="Five stages hold different instructions on the same clock. Ideal overlap is not a guaranteed five-times speedup." tabs={TABS} tab={tab} onTab={setTab} guide={["IF fetches the word at the PC.", "ID reads the register file.", "EX runs the ALU. MEM touches data memory. WB writes a register."]} takeaways={["Latency of one instruction is still about five cycles.", "Throughput rises after the pipeline fills.", "Speedup uses this program's cycle counts."]}>
      {prefs.explain ? <ExplainBar what={pipe?.log.at(-1) ?? "Step a cycle to move every stage."} why="An instruction card shows the stage it occupies. ST means that stage is held." notice="Bubbles are labeled BUBBLE, not only drawn in a different color." /> : null}
      <div className="row">
        <Segmented options={["On", "Off"]} value={forwarding} onChange={(value) => { setForwarding(value); setPipe((current) => current ? { ...current, forwarding: value === "On" } : current); }} />
        <Button variant="primary" onClick={() => {
          const created = runPipe(PROGRAM, { forwarding: forwarding === "On" }, 0);
          setPipe(created);
        }}>Load</Button>
        <Button onClick={() => pipe && setPipe(stepPipe(pipe))}>Step cycle</Button>
        <Button onClick={() => setPipe(runPipe(PROGRAM, { forwarding: forwarding === "On" }))}>Run</Button>
      </div>
      {pipe ? (
        <>
          <div className="stage-row">
            {(["IF", "ID", "EX", "MEM", "WB"] as const).map((name) => <div key={name} className="cpu-block">{name}<small>{pipe[name].text || "—"}</small></div>)}
          </div>
          {tab === "regs" ? (
            <Card title="ID/EX snapshot">
              <p>PC {pipe.EX.pc} · v1 {pipe.EX.v1} · v2 {pipe.EX.v2} · alu {pipe.EX.alu} · mark {pipe.EX.mark || "—"}</p>
              <p>MEM loaded {pipe.MEM.loaded} · WB {pipe.WB.text || "—"}</p>
            </Card>
          ) : null}
          {tab === "metrics" ? (
            <div className="grid cards-3">
              <Metric label="Cycles" value={String(pipe.cycles)} />
              <Metric label="Retired" value={String(pipe.retired)} />
              <Metric label="Speedup" value={speedup(ideal, pipe.cycles).toFixed(2)} />
            </div>
          ) : null}
          <Card title="Timeline">
            <table className="data">
              <tbody>
                {pipe.rows.map((row) => <tr key={row.text}><td>{row.text}</td>{row.cells.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}
              </tbody>
            </table>
          </Card>
        </>
      ) : null}
    </StudioFrame>
  );
}
