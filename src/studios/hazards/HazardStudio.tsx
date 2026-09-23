import { useState } from "react";
import { useStudioTab } from "../../layout/useStudioTab";
import { Button, Card, ExplainBar, Metric, Segmented } from "../../design-system/ui";
import { predictorName, runPipe, stepPipe, type PipeState, type Policy } from "../../engines/isa/pipeline";
import { StudioFrame } from "../../layout/StudioFrame";
import { usePrefs } from "../../store/prefs";

const PRESETS: Record<string, { source: string; note: string; data?: Record<number, number> }> = {
  Independent: { source: "ADDI R1, R0, 1\nADDI R2, R0, 2\nADDI R3, R0, 3\nHALT\n", note: "No register is both written and then read by the next instruction." },
  RAW: { source: "ADDI R1, R0, 5\nADD R2, R1, R0\nHALT\n", note: "ADD reads R1 before a pipeline without forwarding has written it back." },
  "Load-use": { source: "LOAD R1, 4(R0)\nADD R2, R1, R0\nHALT\n", note: "Even with forwarding, the loaded word is not ready when ADD would enter EX.", data: { 4: 7 } },
  Structural: { source: "LOAD R1, 12(R0)\nHALT\n", note: "Unified memory makes fetch and the load compete for one memory.", data: { 12: 3 } },
  Branch: { source: "ADDI R1, R0, 1\nBEQ R1, R0, END\nADDI R2, R0, 4\nEND:\nHALT\n", note: "Not-taken is the correct direction. Always-taken fetches the wrong path." },
};

const TABS = [
  { id: "detect", label: "Hazards" },
  { id: "predict", label: "Prediction" },
];

export function HazardStudio() {
  const [tab, setTab] = useStudioTab(TABS, "detect");
  const [preset, setPreset] = useState("RAW");
  const [policy, setPolicy] = useState<Policy>("not-taken");
  const [forwarding, setForwarding] = useState(true);
  const [unified, setUnified] = useState(false);
  const [pipe, setPipe] = useState<PipeState | null>(null);
  const { prefs } = usePrefs();
  const chosen = PRESETS[preset] ?? PRESETS.RAW;

  function load(limit = 0) {
    if (!chosen) return;
    setPipe(runPipe(chosen.source, { forwarding, unified, policy, data: chosen.data }, limit));
  }

  return (
    <StudioFrame icon="map" title="Pipeline Hazards" description="Hazards are detected from register reads and writes in the live pipeline. WAR and WAW do not arise in this in-order model." tabs={TABS} tab={tab} onTab={setTab} guide={["RAW means a later instruction reads a register an earlier one writes.", "Forwarding copies an ALU result from EX/MEM or MEM/WB.", "A wrong branch prediction flushes the instructions already fetched."]} takeaways={["This pipeline writes only in WB and reads in ID, so WAR and WAW do not occur.", "A load-use still inserts one stall when forwarding is on.", "The 2-bit counter moves one step toward the resolved direction."]}>
      {prefs.explain ? <ExplainBar what={pipe?.log.at(-1) ?? chosen?.note ?? ""} why="Stall, forward, and flush marks come from the detector, not from a canned timeline." notice="Separate instruction and data memories remove the structural conflict shown in the unified preset." /> : null}
      <Segmented options={Object.keys(PRESETS)} value={preset} onChange={(value) => { setPreset(value); if (value === "Structural") setUnified(true); }} />
      <div className="row">
        <Button onClick={() => { setForwarding((value) => !value); setPipe((current) => current ? { ...current, forwarding: !forwarding } : current); }}>{forwarding ? "Forwarding on" : "Forwarding off"}</Button>
        <Button onClick={() => { setUnified((value) => !value); setPipe((current) => current ? { ...current, unified: !unified } : current); }}>{unified ? "Unified memory" : "Split memory"}</Button>
        <Button variant="primary" onClick={() => load(0)}>Load</Button>
        <Button onClick={() => pipe && setPipe(stepPipe(pipe))}>Step</Button>
        <Button onClick={() => load(400)}>Run</Button>
      </div>
      {pipe ? (
        <>
          <div className="stage-row">
            {(["IF", "ID", "EX", "MEM", "WB"] as const).map((name) => <div key={name} className="cpu-block">{name}<small>{pipe[name].mark || pipe[name].text || "—"}</small></div>)}
          </div>
          <div className="grid cards-4">
            <Metric label="Stalls" value={String(pipe.stalls)} />
            <Metric label="Forwards" value={String(pipe.forwards)} />
            <Metric label="Flushes" value={String(pipe.flushes)} />
            <Metric label="Mispredicts" value={String(pipe.mispredicts)} />
          </div>
          <Card title="Timeline">
            <table className="data">
              <tbody>{pipe.rows.map((row) => <tr key={row.text}><td>{row.text}</td>{row.cells.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody>
            </table>
          </Card>
        </>
      ) : <p>{chosen?.note}</p>}
      {tab === "predict" ? (
        <Card title="Branch history">
          <Segmented options={["not-taken", "taken", "btfnt", "one-bit", "two-bit"]} value={policy} onChange={(value) => { const next = value as Policy; setPolicy(next); setPipe((current) => current ? { ...current, policy: next } : current); }} />
          <div className="reg-row">
            {(pipe?.bht ?? [1, 1, 1, 1, 1, 1, 1, 1]).map((state, index) => <div key={index} className="ff-cell">{index}<small>{predictorName(state, policy)}</small></div>)}
          </div>
          <p className="tiny">Always not taken, always taken, and backward-taken / forward-not-taken ignore the table. The 1-bit and 2-bit counters update when a branch resolves.</p>
        </Card>
      ) : null}
    </StudioFrame>
  );
}
