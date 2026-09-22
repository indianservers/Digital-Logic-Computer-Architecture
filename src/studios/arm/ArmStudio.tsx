import { useState } from "react";
import { useParams } from "react-router-dom";
import { ARM_REGS, ARM_SOC_BLOCKS, EL_LEVELS, blankArm, neonAdd, stepArm, type ArmMnemonic } from "../../engines/isaarch/arm";
import { ArchitectureFrame, ArchitectureLanding } from "../../layout/ArchitectureFrame";
import { Datapath, IsaRegister } from "../shared/BitFields";
import { Button, Card, Metric, Segmented } from "../../design-system/ui";

export function ArmStudio() {
  const lab = useParams().labId ?? "overview";
  const [cpu, setCpu] = useState(blankArm);
  const [sel, setSel] = useState(0);
  const [el, setEl] = useState(0);
  const [sp, setSp] = useState(0x100);
  const [stack, setStack] = useState<number[]>([]);
  const [lanes] = useState([1, 2, 3, 4]);
  const [right] = useState([10, 20, 30, 40]);

  const run = (op: ArmMnemonic, rd: number, rn: number, rm: number, imm = 0) => setCpu((prev) => stepArm(prev, op, rd, rn, rm, imm));

  return (
    <ArchitectureFrame studioId="arm" onReset={() => { setCpu(blankArm()); setStack([]); setSp(0x100); }}>
      {lab === "overview" ? <ArchitectureLanding studioId="arm" /> : null}
      {lab === "overview" ? <p className="tiny">Educational AArch64-oriented subset: ADD/SUB, LDR/STR, B/BL/RET, NZCV. Not a full ARM emulator.</p> : null}

      {lab === "overview" || lab === "registers" || lab === "aarch64" ? (
        <Card title="Teaching register model">
          <div className="cpu-grid isa-regs">
            {ARM_REGS.slice(0, 8).map((reg, index) => (
              <IsaRegister key={reg.id} name={reg.id} number={index} value={cpu.x[index] ?? 0} note={reg.role} selected={sel === index} onSelect={() => setSel(index)} />
            ))}
          </div>
          <div className="row">
            <Metric label="SP" value={String(cpu.sp)} />
            <Metric label="PC" value={String(cpu.pc)} />
            <Metric label="LR/X30" value={String(cpu.x[30])} />
            <Metric label="NZCV" value={`${cpu.flags.n}${cpu.flags.z}${cpu.flags.c}${cpu.flags.v}`} />
          </div>
        </Card>
      ) : null}

      {lab === "loadstore" ? (
        <Card title="Load/store architecture">
          <Datapath nodes={[{ id: "reg", label: "Register" }, { id: "ea", label: "EA = Xn+#imm" }, { id: "mem", label: "Memory" }]} active={["reg", "ea", "mem"]} />
          <div className="row">
            <Button onClick={() => { const next = blankArm(); next.x[1] = 4; next.mem[4] = 42; setCpu(stepArm(next, "LDR", 0, 1, -1, 0)); }}>LDR X0, [X1]</Button>
            <Button onClick={() => run("STR", 0, 1, -1, 0)}>STR X0, [X1]</Button>
          </div>
          <p className="tiny">X0={cpu.x[0]} · mem[4]={cpu.mem[4]} · {cpu.trace[cpu.trace.length - 1]}</p>
        </Card>
      ) : null}

      {lab === "arith" || lab === "flags" ? (
        <Card title="ADD / SUB and NZCV">
          <Button onClick={() => { const next = blankArm(); next.x[1] = 5; next.x[2] = 3; setCpu(stepArm(next, "ADD", 0, 1, 2)); }}>ADD X0, X1, X2</Button>
          <Button onClick={() => { const next = blankArm(); next.x[1] = 5; setCpu(stepArm(next, "SUB", 0, 1, 1)); }}>SUB X0, X1, X1</Button>
          <div className="row">
            <Metric label="N" value={String(cpu.flags.n)} />
            <Metric label="Z" value={String(cpu.flags.z)} />
            <Metric label="C" value={String(cpu.flags.c)} />
            <Metric label="V" value={String(cpu.flags.v)} />
            <Metric label="X0" value={String(cpu.x[0])} />
          </div>
        </Card>
      ) : null}

      {lab === "branches" || lab === "calls" ? (
        <Card title="BL / RET">
          <Datapath nodes={[{ id: "caller", label: "Caller" }, { id: "bl", label: "BL target" }, { id: "fn", label: "Function" }, { id: "ret", label: "RET" }, { id: "back", label: "Caller" }]} active={cpu.trace.some((t) => t.startsWith("RET")) ? ["caller", "bl", "fn", "ret", "back"] : cpu.lr ? ["caller", "bl", "fn"] : ["caller"]} />
          <Button onClick={() => run("BL", 0, 0, 0, 40)}>BL 40</Button>
          <Button onClick={() => run("RET", 0, 0, 0)}>RET</Button>
          <p className="tiny">PC {cpu.pc} · LR {cpu.lr} · {cpu.trace[cpu.trace.length - 1]}</p>
        </Card>
      ) : null}

      {lab === "stack" ? (
        <Card title="Conceptual stack frame">
          <p className="tiny">Not a specific compiler ABI. SP moves, values are saved and restored.</p>
          <Metric label="SP" value={String(sp)} />
          <div className="row">
            <Button onClick={() => { setSp((value) => value - 8); setStack((prev) => [cpu.x[sel] ?? 0, ...prev]); }}>Save selected</Button>
            <Button onClick={() => { setStack((prev) => prev.slice(1)); setSp((value) => value + 8); }}>Restore</Button>
          </div>
          <p className="tiny">Frame: [{stack.join(", ")}]</p>
        </Card>
      ) : null}

      {lab === "neon" ? (
        <Card title="Conceptual NEON-style SIMD">
          <p className="tiny">Packed lanes reuse the vector engine. Not a complete NEON emulator.</p>
          <p className="mono">{lanes.join(" ")} + {right.join(" ")} = {neonAdd(lanes, right).join(" ")}</p>
        </Card>
      ) : null}

      {lab === "exceptions" ? (
        <Card title="Exception levels">
          <Segmented options={EL_LEVELS.map((item) => item.id)} value={EL_LEVELS[el]?.id ?? "EL0"} onChange={(value) => setEl(EL_LEVELS.findIndex((item) => item.id === value))} />
          <p>{EL_LEVELS[el]?.title}: {EL_LEVELS[el]?.note}</p>
        </Card>
      ) : null}

      {lab === "soc" ? (
        <Card title="CPU cluster on a mobile SoC">
          <div className="soc-die">
            {ARM_SOC_BLOCKS.map((item) => <div key={item} className={item === "CPU cluster" ? "soc-tile on" : "soc-tile"}>{item}</div>)}
          </div>
          <p className="tiny">The cluster is one block. Open Modern Mobile SoC for the generic floorplan.</p>
        </Card>
      ) : null}
    </ArchitectureFrame>
  );
}

export default ArmStudio;
