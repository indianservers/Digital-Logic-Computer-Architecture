import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { alu, type AluOp } from "../../engines/digital/arithmetic";
import { fromUnsigned, toUnsigned } from "../../engines/digital/vector";
import {
  HISTORY, OP8, RAM_SIZE, assemble8, decode8, encodeFields, instructionStep, load8, microStep, run8, snap8,
  type Cpu8Snap, type Cpu8State,
} from "../../engines/cpu8/cpu8";
import { ArchitectureFrame, ArchitectureLanding } from "../../layout/ArchitectureFrame";
import { RegisterView } from "../shared/RegisterView";
import { Button, Card, Metric, Segmented } from "../../design-system/ui";

const SAMPLE = `LDI A, 5
LDI B, 3
ADD A, B
STORE A, 20
HLT`;

const ISA = [
  "LDI A, imm", "LDI B, imm", "ADD A, B", "SUB A, B", "AND A, B", "OR A, B", "XOR A, B",
  "NOT A", "INC A", "DEC A", "CMP A, B", "LOAD A, addr", "STORE A, addr", "JMP addr", "JZ addr", "JC addr", "HLT",
];

function machineOrBlank(source: string): Cpu8State {
  const loaded = load8(source);
  if ("ok" in loaded) {
    const run = run8("HLT");
    run.error = loaded.error;
    return run;
  }
  return loaded;
}

export function Cpu8Studio() {
  const { labId } = useParams();
  const lab = labId ?? "overview";
  const [source, setSource] = useState(SAMPLE);
  const [cpu, setCpu] = useState<Cpu8State>(() => machineOrBlank(SAMPLE));
  const [history, setHistory] = useState<Cpu8Snap[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [aluOp, setAluOp] = useState<AluOp>("ADD");
  const [encOp, setEncOp] = useState<number>(OP8.LDI_A);
  const [encImm, setEncImm] = useState(5);
  const [asmMsg, setAsmMsg] = useState("");

  const apply = (next: Cpu8State) => {
    setHistory((list) => [...list, snap8(cpu)].slice(-HISTORY));
    setCursor(-1);
    setCpu(next);
  };

  const shown = (cursor >= 0 ? history[cursor] : snap8(cpu)) ?? snap8(cpu);
  const listing = useMemo(() => assemble8(source), [source]);
  const fields = encodeFields(encOp, encImm);
  const decoded = decode8(encOp);
  const aluRes = alu(fromUnsigned(cpu.a, 8), fromUnsigned(cpu.b, 8), aluOp);

  const workbench = (
    <div className="grid cards-2">
      <Card title="8-bit CPU">
        <div className="cpu-grid">
          <RegisterView name="A" width={8} value={cpu.a} changed={cpu.micro.includes("A")} />
          <RegisterView name="B" width={8} value={cpu.b} changed={cpu.micro.includes("B")} />
          <RegisterView name="PC" width={8} value={cpu.pc} />
          <RegisterView name="IR" width={8} value={cpu.ir} />
          <RegisterView name="MAR" width={8} value={cpu.mar} />
          <div className={cpu.signals.includes("ALU") ? "cpu-block on" : "cpu-block"}>ALU<small>{cpu.micro}</small></div>
          <div className="cpu-block">FLAGS<small>Z{cpu.flags.z} C{cpu.flags.c} N{cpu.flags.n} V{cpu.flags.v}</small></div>
          <div className={cpu.signals.length ? "cpu-block on" : "cpu-block"}>BUS<small>{cpu.bus}</small></div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <Button variant="primary" onClick={() => apply(microStep(cpu))}>Clock / micro-step</Button>
          <Button onClick={() => apply(instructionStep(cpu))}>Instruction step</Button>
          <Button onClick={() => { const next = run8(source); setCpu(next); setHistory([]); }}>Run</Button>
          <Button onClick={() => { setCpu(machineOrBlank(source)); setHistory([]); setCursor(-1); }}>Reset</Button>
        </div>
        <p className="tiny">Stage {cpu.stage} · cycle {cpu.cycles} · signals {cpu.signals.join(", ") || "none"}</p>
        {cpu.error ? <p className="status miss">{cpu.error}</p> : null}
      </Card>
      <Card title="Program">
        <textarea className="asm" aria-label="8-bit assembly" value={source} onChange={(event) => setSource(event.target.value)} />
        <div className="row">
          <Button onClick={() => {
            const built = assemble8(source);
            if (!built.ok) {
              setAsmMsg(built.errors.map((item) => `Line ${item.line}: ${item.message}`).join("\n"));
              return;
            }
            setAsmMsg("Assembled.");
            setCpu(machineOrBlank(source));
            setHistory([]);
          }}>Assemble & load</Button>
        </div>
        {asmMsg ? <pre className="mono">{asmMsg}</pre> : null}
        {!listing.ok ? <pre className="mono">{listing.errors.map((item) => `Line ${item.line}: ${item.message}`).join("\n")}</pre> : null}
      </Card>
    </div>
  );

  return (
    <ArchitectureFrame studioId="cpu8" onReset={() => { setSource(SAMPLE); setCpu(machineOrBlank(SAMPLE)); setHistory([]); setAsmMsg(""); }}>
      {lab === "overview" ? (
        <div>
          <ArchitectureLanding studioId="cpu8" />
          <Card title="Implemented teaching ISA">
            <p className="tiny">{ISA.join(" · ")}</p>
            {workbench}
          </Card>
        </div>
      ) : null}

      {lab === "arch" || lab === "visual" || lab === "fde" || lab === "control" || lab === "editor" ? workbench : null}

      {lab === "registers" ? (
        <Card title="Register view">
          <div className="cpu-grid">
            <RegisterView name="A" width={8} value={cpu.a} />
            <RegisterView name="B" width={8} value={cpu.b} />
            <RegisterView name="PC" width={8} value={cpu.pc} />
            <RegisterView name="IR" width={8} value={cpu.ir} />
            <RegisterView name="MAR" width={8} value={cpu.mar} />
          </div>
          <Button variant="primary" onClick={() => apply(microStep(cpu))}>Step</Button>
        </Card>
      ) : null}

      {lab === "alu" ? (
        <Card title="8-bit ALU">
          <Segmented options={["ADD", "SUB", "AND", "OR", "XOR", "NOT", "INC", "DEC", "CMP"]} value={aluOp} onChange={(value) => setAluOp(value as AluOp)} />
          <div className="row">
            <Metric label="Result" value={String(toUnsigned(aluRes.result.map((bit) => (bit === 1 ? 1 : 0)) as Array<0 | 1>) ?? 0)} />
            <Metric label="Z" value={String(aluRes.zero)} />
            <Metric label="C" value={String(aluRes.carry)} />
            <Metric label="N" value={String(aluRes.negative)} />
            <Metric label="V" value={String(aluRes.overflow)} />
          </div>
          <p className="tiny">Operands are the live A and B registers. CMP uses SUB flags without requiring a writeback in this view.</p>
        </Card>
      ) : null}

      {lab === "isa" ? (
        <Card title="Instruction families">
          <ul className="muted">{ISA.map((item) => <li key={item}>{item}</li>)}</ul>
        </Card>
      ) : null}

      {lab === "encoding" ? (
        <Card title="Instruction encoding">
          <div className="row">
            <label className="field">Opcode
              <select value={encOp} onChange={(event) => setEncOp(Number(event.target.value))}>
                {Object.entries(OP8).map(([name, value]) => <option key={name} value={value}>{name} ({value})</option>)}
              </select>
            </label>
            <label className="field">Operand byte<input type="number" min={0} max={255} value={encImm} onChange={(event) => setEncImm(Number(event.target.value))} /></label>
          </div>
          <div className="bit-fields">
            <div className="bit-field on"><span>{fields.opcodeBits}</span><small>Opcode</small></div>
            <div className="bit-field"><span>{fields.operandBits}</span><small>Operand</small></div>
          </div>
          <p>{decoded.mnemonic}. {decoded.explain} {decoded.twoByte ? "Two-byte instruction." : "One-byte instruction."}</p>
        </Card>
      ) : null}

      {lab === "memory" ? (
        <Card title="RAM (256 bytes)">
          <div className="table-wrap" style={{ maxHeight: 360 }}>
            <table className="data">
              <thead><tr><th>Addr</th><th>Byte</th><th>Role</th></tr></thead>
              <tbody>
                {cpu.ram.slice(0, 64).map((value, address) => (
                  <tr key={address} className={address === cpu.mar ? "active" : ""}>
                    <td>{address}</td>
                    <td>{value}</td>
                    <td>{address === cpu.mar ? (cpu.signals.includes("MEM_WRITE") ? "write" : "fetch/read") : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny">Showing the first 64 of {RAM_SIZE} bytes. MAR highlights the current access.</p>
        </Card>
      ) : null}

      {lab === "clock" ? (
        <Card title="Clock-by-clock debugger">
          <div className="row">
            <Button onClick={() => setCursor((value) => Math.max(0, (value < 0 ? history.length - 1 : value) - 1))}>Previous</Button>
            <Button variant="primary" onClick={() => apply(microStep(cpu))}>Next</Button>
            <Button onClick={() => { setCpu(machineOrBlank(source)); setHistory([]); setCursor(-1); }}>Restart</Button>
          </div>
          {shown ? (
            <div className="row">
              <Metric label="PC" value={String(shown.pc)} />
              <Metric label="IR" value={String(shown.ir)} />
              <Metric label="A" value={String(shown.a)} />
              <Metric label="B" value={String(shown.b)} />
              <Metric label="MAR" value={String(shown.mar)} />
              <Metric label="BUS" value={String(shown.bus)} />
              <Metric label="Flags" value={`Z${shown.flags.z} C${shown.flags.c} N${shown.flags.n} V${shown.flags.v}`} />
            </div>
          ) : null}
          <p className="tiny">{shown?.micro} · history {history.length}/{HISTORY}</p>
        </Card>
      ) : null}
    </ArchitectureFrame>
  );
}

export default Cpu8Studio;
