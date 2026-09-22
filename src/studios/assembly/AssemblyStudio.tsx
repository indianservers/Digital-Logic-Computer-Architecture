import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Card, ExplainBar } from "../../design-system/ui";
import { assemble } from "../../engines/isa/assembler";
import { loadProgram, stepStage, type CpuState } from "../../engines/isa/cpu";
import { formatInstruction } from "../../engines/isa/assembler";
import { StudioFrame } from "../../layout/StudioFrame";
import { usePrefs } from "../../store/prefs";
import { saveRecord } from "../../store/projects";

const PROGRAM = `ADDI R1, R0, 5
ADDI R2, R0, 3
ADD R3, R1, R2
STORE R3, 8(R0)
HALT
`;

const TABS = [
  { id: "run", label: "Execute" },
  { id: "memory", label: "Program Memory" },
];

export function AssemblyStudio() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "run";
  const [source, setSource] = useState(PROGRAM);
  const [cpu, setCpu] = useState<CpuState | null>(null);
  const [error, setError] = useState("");
  const { prefs } = usePrefs();
  const built = assemble(source);

  function load() {
    const next = loadProgram(source);
    if ("error" in next) {
      setError(next.error);
      setCpu(null);
      return;
    }
    setError("");
    setCpu(next);
  }

  function instruction() {
    if (!cpu) return;
    let next = cpu;
    do next = stepStage(next);
    while (next.stage !== "IF" && next.stage !== "done");
    setCpu(next);
  }

  return (
    <StudioFrame icon="table" title="Assembly Execution" description="Assemble LogicLab-16, then step one instruction at a time. Changed registers are listed after each instruction." tabs={TABS} tab={tab} onTab={(id) => setParams({ tab: id })} guide={["Labels may be used before they are defined.", "R0 starts at 0. Write it only if the program means to.", "HALT leaves the PC on the halt instruction."]} takeaways={["The listing is the machine word beside the source.", "A bad register or a missing label names the source line.", "Instruction stepping hides the five internal cycles."]}>
      {prefs.explain && cpu ? <ExplainBar what={cpu.trace.at(-1) ?? "Load the program to begin."} why={cpu.diff.join(" · ") || "Nothing architectural changed on the last internal cycle."} notice="Use Fetch–Decode–Execute when you want each cycle." /> : null}
      <div className="builder">
        <Card title="Program">
          <textarea className="text-input asm" aria-label="Assembly program" value={source} onChange={(event) => setSource(event.target.value)} rows={12} />
          <div className="row">
            <Button variant="primary" onClick={load}>Assemble</Button>
            <Button onClick={instruction} disabled={!cpu}>Step instruction</Button>
            <Button onClick={() => void saveRecord({ id: "asm-lab", kind: "cpu", name: "Assembly", data: source, updated: Date.now() })}>Save</Button>
          </div>
          {!built.ok ? built.errors.map((item) => <p key={`${item.line}-${item.message}`}>Line {item.line}: {item.message}</p>) : null}
          {error ? <p>{error}</p> : null}
        </Card>
        <Card title="Machine">
          {cpu ? (
            <>
              <p>PC {cpu.pc} · stage {cpu.stage} · flags Z{cpu.flags.z} N{cpu.flags.n} C{cpu.flags.c} V{cpu.flags.v}</p>
              <div className="reg-row">{cpu.regs.map((value, index) => <div key={index} className="ff-cell">R{index}<small>{value}</small></div>)}</div>
              {cpu.diff.map((line) => <p key={line}>{line}</p>)}
              <p className="tiny">{cpu.trace.slice(-4).join(" ")}</p>
            </>
          ) : <p className="muted">Assemble to load instruction memory.</p>}
        </Card>
      </div>
      {tab === "memory" && built.ok ? (
        <Card title="Instruction memory">
          <table className="data">
            <thead><tr><th>Address</th><th>Word</th><th>Assembly</th></tr></thead>
            <tbody>
              {built.listing.map((row) => (
                <tr key={row.address} className={cpu?.instPc === row.address ? "active" : ""}>
                  <td>{row.address}</td><td className="mono">{row.word.toString(16).padStart(4, "0")}</td><td>{formatInstruction(row.decoded)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </StudioFrame>
  );
}
