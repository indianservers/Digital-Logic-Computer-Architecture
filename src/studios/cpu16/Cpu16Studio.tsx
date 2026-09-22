import { useState } from "react";
import { useParams } from "react-router-dom";
import { assemble } from "../../engines/isa/assembler";
import { binaryWord, fieldsOf } from "../../engines/isa/spec";
import { loadProgram, runToHalt, signalsFor, stepStage, type CpuState } from "../../engines/isa/cpu";
import {
  compareWidths, load16, popReg, pushReg, requestIrq, returnFromInterrupt, serviceInterrupt, step16,
  type InterruptLab,
} from "../../engines/cpu16/cpu16";
import { ArchitectureFrame, ArchitectureLanding } from "../../layout/ArchitectureFrame";
import { RegisterView } from "../shared/RegisterView";
import { Button, Card, Metric } from "../../design-system/ui";

const SAMPLE = `ADDI R7, R0, 20
ADDI R1, R0, 5
ADDI R2, R0, 3
ADD R3, R1, R2
STORE R3, 8(R0)
CALL SUB
HALT
SUB:
ADDI R4, R3, 0
RET`;

const CALL_SAMPLE = `ADDI R7, R0, 20
ADDI R1, R0, 1
CALL SUB
HALT
SUB:
ADDI R2, R1, 7
RET`;

const BRANCH_SAMPLE = `ADDI R1, R0, 3
ADDI R2, R0, 3
BEQ R1, R2, OK
ADDI R3, R0, 9
OK:
HALT`;

function cpuFrom(source: string): CpuState | { error: string } {
  return loadProgram(source);
}

export function Cpu16Studio() {
  const { labId } = useParams();
  const lab = labId ?? "overview";
  const [source, setSource] = useState(SAMPLE);
  const [cpu, setCpu] = useState<CpuState | { error: string }>(() => cpuFrom(SAMPLE));
  const [msg, setMsg] = useState("");
  const [irq, setIrq] = useState<InterruptLab | { error: string }>(() => load16(SAMPLE));
  const [pushSel, setPushSel] = useState(1);

  const live = cpu && !("error" in cpu) ? cpu : null;
  const irqLive = irq && !("error" in irq) ? irq : null;
  const built = assemble(source);

  const loadSrc = (text: string) => {
    setSource(text);
    const next = cpuFrom(text);
    setCpu(next);
    setIrq(load16(text));
    setMsg("error" in next ? next.error : "Loaded.");
  };

  const workbench = (
    <div className="grid cards-2">
      <Card title="LogicLab-16">
        {live ? (
          <>
            <div className="cpu-grid">
              {live.regs.map((value, index) => <RegisterView key={index} name={index === 7 ? "R7 / SP" : `R${index}`} width={16} value={value} />)}
              <RegisterView name="PC" width={16} value={live.pc} />
              <RegisterView name="IR" width={16} value={live.ir} />
              <div className="cpu-block">FLAGS<small>Z{live.flags.z} C{live.flags.c} N{live.flags.n} V{live.flags.v}</small></div>
              <div className="cpu-block">Stage<small>{live.stage}</small></div>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <Button variant="primary" onClick={() => live && setCpu(stepStage(live))}>Step clock</Button>
              <Button onClick={() => {
                if (!live) return;
                let next = live;
                const start = next.retired;
                while (next.retired === start && !next.halted) next = stepStage(next);
                setCpu(next);
              }}>Step instruction</Button>
              <Button onClick={() => setCpu(runToHalt(source))}>Run</Button>
              <Button onClick={() => loadSrc(source)}>Reset</Button>
            </div>
            <p className="tiny">{live.trace[live.trace.length - 1]} · cycles {live.cycles}</p>
            {(() => {
              const sig = signalsFor(live.decoded, live.stage);
              return <p className="tiny">Controls: WE {sig.regWrite} MR {sig.memRead} MW {sig.memWrite} PCW {sig.pcWrite} ALU {sig.aluOp}</p>;
            })()}
          </>
        ) : <p className="status miss">{"error" in cpu ? cpu.error : "Load a program."}</p>}
      </Card>
      <Card title="Workspace">
        <textarea className="asm" aria-label="16-bit assembly" value={source} onChange={(event) => setSource(event.target.value)} />
        <div className="row">
          <Button onClick={() => loadSrc(source)}>Assemble & load</Button>
        </div>
        {msg ? <pre className="mono">{msg}</pre> : null}
        {!built.ok ? <pre className="mono">{built.errors.map((item) => `Line ${item.line}: ${item.message}`).join("\n")}</pre> : (
          <table className="data"><thead><tr><th>Addr</th><th>Word</th><th>Asm</th></tr></thead>
            <tbody>{built.listing.slice(0, 12).map((line) => <tr key={line.address}><td>{line.address}</td><td>{binaryWord(line.word)}</td><td>{line.text}</td></tr>)}</tbody>
          </table>
        )}
      </Card>
    </div>
  );

  return (
    <ArchitectureFrame studioId="cpu16" onReset={() => loadSrc(SAMPLE)}>
      {lab === "overview" ? <><ArchitectureLanding studioId="cpu16" />{workbench}</> : null}
      {lab === "datapath" || lab === "workspace" || lab === "debug" || lab === "isa" ? workbench : null}

      {lab === "regs" ? (
        <Card title="Register file">
          {live ? <div className="cpu-grid">{live.regs.map((value, index) => <RegisterView key={index} name={`R${index}`} width={16} value={value} />)}</div> : null}
          <Button onClick={() => live && setCpu(stepStage(live))}>Step</Button>
        </Card>
      ) : null}

      {lab === "alu" ? (
        <Card title="ALU & flags">
          {live ? (
            <div className="row">
              <Metric label="ALU" value={String(live.alu)} />
              <Metric label="Z" value={String(live.flags.z)} />
              <Metric label="C" value={String(live.flags.c)} />
              <Metric label="N" value={String(live.flags.n)} />
              <Metric label="V" value={String(live.flags.v)} />
            </div>
          ) : null}
          {workbench}
        </Card>
      ) : null}

      {lab === "formats" ? (
        <Card title="Instruction formats">
          {live?.decoded ? (
            <div className="bit-fields">
              {fieldsOf(live.decoded).map((field) => (
                <div key={field.name} className="bit-field on">
                  <span>{field.name} [{field.hi}:{field.lo}]</span>
                  <small>{field.meaning}</small>
                </div>
              ))}
            </div>
          ) : <p className="tiny">Step once to fill IR, then read the fields of the current instruction.</p>}
          <p className="tiny">R: opcode | rd | rs1 | rs2 | funct · I: opcode | rd | rs | imm[5:0] · J: opcode | offset[11:0]</p>
          {workbench}
        </Card>
      ) : null}

      {lab === "memory" ? (
        <Card title="LOAD / STORE">
          <p className="tiny">Register → address generation → memory → register. Use LOAD Rd, imm(Rs) and STORE Rs, imm(Rb).</p>
          {workbench}
          {live ? (
            <table className="data"><thead><tr><th>Addr</th><th>DMem</th></tr></thead>
              <tbody>{live.dmem.slice(0, 16).map((value, address) => <tr key={address} className={address === live.mar ? "active" : ""}><td>{address}</td><td>{value}</td></tr>)}</tbody>
            </table>
          ) : null}
        </Card>
      ) : null}

      {lab === "branch" ? (
        <Card title="Branching" action={<Button onClick={() => loadSrc(BRANCH_SAMPLE)}>Load BEQ sample</Button>}>
          {workbench}
        </Card>
      ) : null}

      {lab === "stack" ? (
        <Card title="Stack (R7)">
          <div className="row">
            <label className="field">Register
              <select value={pushSel} onChange={(event) => setPushSel(Number(event.target.value))}>
                {Array.from({ length: 8 }, (_, index) => <option key={index} value={index}>R{index}</option>)}
              </select>
            </label>
            <Button onClick={() => {
              if (!live) return;
              const next = pushReg(live, pushSel);
              if ("error" in next) setMsg(next.error);
              else setCpu(next);
            }}>PUSH</Button>
            <Button onClick={() => {
              if (!live) return;
              const next = popReg(live, pushSel);
              if ("error" in next) setMsg(next.error);
              else setCpu(next);
            }}>POP</Button>
          </div>
          {live ? <Metric label="SP (R7)" value={String(live.regs[7] ?? 0)} /> : null}
          {workbench}
        </Card>
      ) : null}

      {lab === "call" ? (
        <Card title="CALL / RET" action={<Button onClick={() => loadSrc(CALL_SAMPLE)}>Load CALL sample</Button>}>
          {workbench}
        </Card>
      ) : null}

      {lab === "irq" ? (
        <Card title="Educational interrupt">
          <p className="muted">Educational abstraction: IRQ is taken at an instruction boundary, PC is saved on the R7 stack, then the handler runs. This is not a specific SoC exception model.</p>
          {irqLive ? (
            <>
              <div className="row">
                <Metric label="PC" value={String(irqLive.cpu.pc)} />
                <Metric label="In handler" value={irqLive.inHandler ? "yes" : "no"} />
                <Metric label="Saved PC" value={String(irqLive.savedPc ?? "—")} />
              </div>
              <div className="row">
                <Button onClick={() => setIrq(step16(irqLive))}>Step</Button>
                <Button onClick={() => setIrq(requestIrq(irqLive))}>Raise IRQ</Button>
                <Button variant="primary" onClick={() => setIrq(serviceInterrupt(irqLive))}>Service</Button>
                <Button onClick={() => setIrq(returnFromInterrupt(irqLive))}>Return</Button>
              </div>
              <p className="tiny">{irqLive.note}</p>
            </>
          ) : <p className="status miss">{"error" in irq ? irq.error : ""}</p>}
        </Card>
      ) : null}

      {lab === "compare" ? (
        <Card title="8-bit vs 16-bit teaching CPUs">
          <table className="data">
            <thead><tr><th>Trait</th><th>8-bit</th><th>16-bit</th></tr></thead>
            <tbody>{compareWidths().map((row) => <tr key={row.trait}><td>{row.trait}</td><td>{row.eight}</td><td>{row.sixteen}</td></tr>)}</tbody>
          </table>
          <p className="muted">Width and the register file change what a program can express. Neither machine is simply better; they teach different datapaths.</p>
        </Card>
      ) : null}
    </ArchitectureFrame>
  );
}

export default Cpu16Studio;
