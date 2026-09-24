import { useState } from "react";
import { useStudioTab } from "../../layout/useStudioTab";
import { Button, Card, ExplainBar, Metric } from "../../design-system/ui";
import { loadProgram, signalsFor, stepStage, type CpuState } from "../../engines/isa/cpu";
import { StudioFrame } from "../../layout/StudioFrame";
import { FDE_LESSONS, lessonOf } from "../../data/studioLessons";
import { usePrefs } from "../../store/prefs";

const PROGRAM = "ADDI R1, R0, 5\nADDI R2, R0, 3\nADD R3, R1, R2\nHALT\n";
const ORDER = ["IF", "ID", "EX", "MEM", "WB"];
const TABS = [
  { id: "cycle", label: "Cycle" },
  { id: "signals", label: "Control" },
  { id: "rtl", label: "Transfers" },
];

export function FdeStudio() {
  const [tab, setTab] = useStudioTab(TABS, "cycle");
  const [cpu, setCpu] = useState<CpuState | null>(null);
  const { prefs } = usePrefs();
  const signals = signalsFor(cpu?.decoded ?? null, cpu?.stage === "done" ? "WB" : cpu?.stage ?? "IF");
  const cpi = cpu && cpu.retired > 0 ? (cpu.cycles / cpu.retired).toFixed(2) : "—";
  const lesson = lessonOf(FDE_LESSONS, tab, "cycle");

  return (
    <StudioFrame icon="bolt" title="Fetch–Decode–Execute" description="Step the same CPU one cycle at a time. Fetch reads instruction memory, then decode, execute, memory, and write-back take their turns." tabs={TABS} tab={tab} onTab={setTab} guide={lesson.guide} takeaways={lesson.takeaways} theory={lesson.theory}>
      {prefs.explain ? <ExplainBar what={cpu?.trace.at(-1) ?? "Load the add program, then step a cycle."} why={cpu?.decoded?.explain ?? "The control signals come from the decoded opcode and the current stage."} notice={`CPI for this run is ${cpi}. That number belongs to this simulator, not to every CPU.`} /> : null}
      <div className="row">
        <Button variant="primary" onClick={() => { const next = loadProgram(PROGRAM); if (!("error" in next)) setCpu(next); }}>Load ADD</Button>
        <Button onClick={() => cpu && setCpu(stepStage(cpu))}>Step cycle</Button>
        <Button onClick={() => cpu && setCpu(finish(cpu))}>Step instruction</Button>
      </div>
      <div className="stage-row">
        {ORDER.map((stage) => <div key={stage} className={cpu && stageName(cpu) === stage ? "cpu-block on" : "cpu-block"}>{stage}</div>)}
      </div>
      {tab === "cycle" && cpu ? (
        <div className="grid cards-3">
          <Card title="Path">
            <p>PC {cpu.pc} · MAR {cpu.mar} · MDR {cpu.mdr}</p>
            <p>IR {cpu.ir.toString(2).padStart(16, "0")}</p>
            <p>{cpu.decoded ? `${cpu.decoded.mnemonic} rs1=R${cpu.decoded.rs1} rs2=R${cpu.decoded.rs2} rd=R${cpu.decoded.rd}` : "Waiting for fetch."}</p>
          </Card>
          <Card title="Registers">
            <div className="reg-row">{cpu.regs.map((value, index) => <div key={index} className="ff-cell">R{index}<small>{value}</small></div>)}</div>
          </Card>
          <Card title="Timing">
            <Metric label="Cycles" value={String(cpu.cycles)} />
            <Metric label="Retired" value={String(cpu.retired)} />
            <Metric label="CPI" value={cpi} />
          </Card>
        </div>
      ) : null}
      {tab === "signals" ? (
        <Card title="Signals for this stage">
          <p>RegWrite {signals.regWrite} · MemRead {signals.memRead} · MemWrite {signals.memWrite}</p>
          <p>ALUSrc {signals.aluSrc} · ALUOp {signals.aluOp} · PCWrite {signals.pcWrite}</p>
        </Card>
      ) : null}
      {tab === "rtl" ? (
        <Card title="Register transfers">
          <p>IF: MAR ← PC, MDR ← Mem[MAR], IR ← MDR, PC ← PC + 1</p>
          <p>EX: ALU ← register or register plus immediate</p>
          <p>MEM: load or store, or a branch writing PC</p>
          <p>WB: Rd ← ALU or Rd ← MDR</p>
        </Card>
      ) : null}
    </StudioFrame>
  );
}

function stageName(cpu: CpuState): string {
  if (cpu.cycles === 0) return "";
  if (cpu.stage === "ID") return "IF";
  if (cpu.stage === "EX") return "ID";
  if (cpu.stage === "MEM") return "EX";
  if (cpu.stage === "WB") return "MEM";
  return "WB";
}

function finish(cpu: CpuState): CpuState {
  let next = cpu;
  do next = stepStage(next);
  while (next.stage !== "IF" && next.stage !== "done");
  return next;
}
