import { useState } from "react";
import { useParams } from "react-router-dom";
import { ECOSYSTEM, ENCODING_NOTES, MEMORY_MODELS, REG_MODELS, TASKS } from "../../engines/isaarch/compare";
import { fieldsOf } from "../../engines/isaarch/riscv";
import { ArchitectureFrame, ArchitectureLanding } from "../../layout/ArchitectureFrame";
import { BitFields, Datapath } from "../shared/BitFields";
import { Button, Card, Segmented } from "../../design-system/ui";

export function CompareStudio() {
  const lab = useParams().labId ?? "overview";
  const [task, setTask] = useState<"add" | "loadaddstore">("add");
  const selected = TASKS[task]!;

  return (
    <ArchitectureFrame studioId="compare" onReset={() => setTask("add")}>
      {lab === "overview" ? <ArchitectureLanding studioId="compare" /> : null}
      {lab === "overview" ? <p className="tiny">Neutral architectural comparison. Examples are teaching sequences, not compiler output or a ranking.</p> : null}

      {lab === "overview" || lab === "same" ? (
        <Card title={selected.title}>
          <Segmented options={["add", "loadaddstore"]} value={task} onChange={(value) => setTask(value as "add" | "loadaddstore")} />
          <div className="grid cards-3">
            {selected.steps.map((step) => (
              <div key={step.isa} className="card">
                <h3>{step.isa}</h3>
                <pre className="mono">{step.lines.join("\n")}</pre>
                <p className="tiny">{step.note}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {lab === "registers" ? (
        <Card title="Register models">
          {REG_MODELS.map((item) => <p key={item.isa}><strong>{item.isa}</strong> — {item.count}. {item.note}</p>)}
        </Card>
      ) : null}

      {lab === "encoding" || lab === "length" || lab === "decode" ? (
        <Card title="Encoding shape">
          {ENCODING_NOTES.map((item) => <p key={item.isa}><strong>{item.isa}</strong> · {item.length}. {item.shape}</p>)}
          <p className="tiny">RISC-V example addi x1, x0, 5:</p>
          <BitFields fields={fieldsOf("I", 0x00500093)} />
          {lab === "length" ? <p>RISC-V and this AArch64 view are 32-bit examples. x86 length varies with optional fields.</p> : null}
          {lab === "decode" ? <p>Fixed fields simplify parallel decode in a teaching view. Optional prefixes add decode work. Neither is ranked here.</p> : null}
        </Card>
      ) : null}

      {lab === "memory" ? (
        <Card title="Memory access">
          {MEMORY_MODELS.map((item) => <p key={item.isa}><strong>{item.isa}</strong> · {item.style}. {item.note}</p>)}
          <Button onClick={() => setTask("loadaddstore")}>Show load/add/store sequences</Button>
        </Card>
      ) : null}

      {lab === "addressing" ? (
        <Card title="Effective address (selected examples)">
          <Datapath nodes={[{ id: "rv", label: "RISC-V rs1+imm" }, { id: "arm", label: "ARM Xn+#imm" }, { id: "x86", label: "x86 base+index×scale+disp" }]} active={["rv", "arm", "x86"]} />
          <p className="tiny">Complexity is a menu of modes, not a score.</p>
        </Card>
      ) : null}

      {lab === "ecosystem" ? (
        <Card title="Ecosystem roles">
          {ECOSYSTEM.map((item) => <p key={item.isa}><strong>{item.isa}</strong> — {item.role}</p>)}
          <p className="tiny">Descriptive only. Market presence is not architectural superiority.</p>
        </Card>
      ) : null}
    </ArchitectureFrame>
  );
}

export default CompareStudio;
