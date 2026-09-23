import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toBin32, toHex32 } from "../../engines/isaarch/bits";
import {
  ABI, RV_FORMATS, assemble, blankRv, datapathNodes, decode, fieldsOf, hazardTrace, immBits, loadRv, parseHexWord, stepRv, writeX, xName, type RvFormat, type RvState,
} from "../../engines/isaarch/riscv";
import { ArchitectureFrame, ArchitectureLanding } from "../../layout/ArchitectureFrame";
import { BitFields, Datapath, IsaRegister } from "../shared/BitFields";
import { Button, Card, Metric, Segmented, parseNumberInput } from "../../design-system/ui";

const DP = [
  { id: "pc", label: "PC" }, { id: "imem", label: "I-Mem" }, { id: "decode", label: "Decode" }, { id: "regs", label: "x0–x31" },
  { id: "immgen", label: "ImmGen" }, { id: "alu", label: "ALU" }, { id: "dmem", label: "D-Mem" }, { id: "branch", label: "Branch" },
  { id: "jump", label: "Jump" }, { id: "wb", label: "Writeback" }, { id: "pcnext", label: "PC next" },
];

const ADD = `addi x1, x0, 5
addi x2, x0, 7
add x3, x1, x2`;

const LOOP = `addi x1, x0, 0
addi x2, x0, 5
LOOP:
beq x2, x0, DONE
add x1, x1, x2
addi x2, x2, -1
jal x0, LOOP
DONE:
addi x3, x0, 1`;

const MEM = `addi x1, x0, 5
addi x2, x0, 7
add x3, x1, x2
sw x3, 0(x0)
lw x4, 0(x0)`;

const BR = `addi x1, x0, 1
beq x1, x1, SKIP
addi x2, x0, 9
SKIP:
addi x3, x0, 4`;

const CALL = `jal x1, SUB
addi x3, x0, 1
beq x0, x0, END
SUB:
addi x2, x0, 7
jalr x0, 0(x1)
END:
addi x4, x0, 1`;

const PRESETS: Record<string, string> = { add: ADD, loop: LOOP, memory: MEM, branch: BR, call: CALL };

function loaded(source: string): RvState {
  const next = loadRv(source);
  return "ok" in next ? { ...blankRv(), error: next.error, halted: true } : next;
}

export function RiscvStudio() {
  const lab = useParams().labId ?? "overview";
  const [sel, setSel] = useState(1);
  const [source, setSource] = useState(ADD);
  const [cpu, setCpu] = useState<RvState>(() => loaded(ADD));
  const [playing, setPlaying] = useState(false);
  const [hex, setHex] = useState("0x00500093");
  const [format, setFormat] = useState<RvFormat>("R");
  const [forward, setForward] = useState(true);
  const [multi, setMulti] = useState(0);
  const [rs1, setRs1] = useState(5);
  const [rs2, setRs2] = useState(7);
  const [rd, setRd] = useState(0);
  const [aluOp, setAluOp] = useState("add");
  const [pipeTick, setPipeTick] = useState(0);

  const built = assemble(source);
  const hexWord = parseHexWord(hex);
  const hexDecoded = hexWord === null ? null : decode(hexWord);
  const lineDecoded = built.ok ? decode(built.words[0] ?? 0) : decode(0x00500093);
  const formatWord = useMemo(() => {
    const first = (text: string) => {
      const result = assemble(text);
      return result.ok ? result.words[0] ?? 0 : 0;
    };
    if (format === "R") return 0x003100B3;
    if (format === "I") return 0x00500093;
    if (format === "S") return first("sw x3, 0(x0)");
    if (format === "B") return first("beq x1, x2, 8");
    if (format === "U") return first("lui x1, 1");
    return first("jal x1, 16");
  }, [format]);
  const hazards = hazardTrace(forward);
  const immMoves = immBits(format === "R" ? "I" : format, formatWord);
  const livePath = datapathNodes(cpu.decoded ?? lineDecoded);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setCpu((prev) => {
        if (prev.halted) {
          setPlaying(false);
          return prev;
        }
        return stepRv(prev);
      });
    }, 220);
    return () => window.clearInterval(id);
  }, [playing]);

  const loadSrc = (text: string) => {
    setSource(text);
    setCpu(loaded(text));
    setPlaying(false);
  };

  const aluResult = (() => {
    if (aluOp === "sub") return (rs1 - rs2) >>> 0;
    if (aluOp === "and") return rs1 & rs2;
    if (aluOp === "or") return rs1 | rs2;
    if (aluOp === "xor") return rs1 ^ rs2;
    if (aluOp === "sll") return (rs1 << (rs2 & 31)) >>> 0;
    if (aluOp === "srl") return rs1 >>> (rs2 & 31);
    if (aluOp === "sra") return (rs1 | 0) >> (rs2 & 31);
    if (aluOp === "slt") return (rs1 | 0) < (rs2 | 0) ? 1 : 0;
    return (rs1 + rs2) >>> 0;
  })();

  const workbench = (
    <div className="grid cards-2">
      <Card title="RV32I workspace">
        <textarea className="asm" aria-label="RISC-V assembly" value={source} onChange={(event) => setSource(event.target.value)} />
        <div className="row">
          <Button onClick={() => loadSrc(source)}>Assemble</Button>
          <Button onClick={() => loadSrc(source)}>Load</Button>
          <Button variant="primary" onClick={() => setPlaying(true)}>Run</Button>
          <Button onClick={() => setPlaying(false)}>Pause</Button>
          <Button onClick={() => setCpu((prev) => stepRv(prev))}>Step instruction</Button>
          <Button onClick={() => setCpu((prev) => stepRv(prev))}>Step cycle</Button>
          <Button onClick={() => loadSrc(source)}>Reset</Button>
        </div>
        {!built.ok ? <pre className="mono">{built.errors.map((item) => `Line ${item.line}: ${item.message}`).join("\n")}</pre> : null}
        {cpu.error ? <p className="status miss">{cpu.error}</p> : <p className="tiny">{cpu.decoded?.text ?? "—"} · PC {cpu.pc} · retired {cpu.retired}</p>}
      </Card>
      <Card title="Machine">
        <div className="row">
          <Metric label="PC" value={toHex32(cpu.pc)} />
          <Metric label="IR" value={toHex32(cpu.ir)} />
          <Metric label="x0" value="0" />
        </div>
        <div className="cpu-grid isa-regs">
          {cpu.regs.slice(0, 8).map((value, index) => (
            <IsaRegister key={index} name={xName(index)} number={index} value={value} note={ABI[index]} selected={sel === index} onSelect={() => setSel(index)} locked={index === 0} />
          ))}
        </div>
        <p className="tiny">Showing x0–x7. Open Register File for all 32. Memory[0]={cpu.mem[0]}</p>
      </Card>
    </div>
  );

  return (
    <ArchitectureFrame studioId="riscv" onReset={() => loadSrc(ADD)}>
      {lab === "overview" ? <ArchitectureLanding studioId="riscv" /> : null}
      {lab === "overview" || lab === "assembler" || lab === "program" ? (
        <>
          {lab === "program" ? (
            <div className="row" style={{ marginBottom: 10 }}>
              {Object.keys(PRESETS).map((id) => <Button key={id} onClick={() => loadSrc(PRESETS[id] ?? ADD)}>{id}</Button>)}
            </div>
          ) : null}
          {workbench}
        </>
      ) : null}

      {lab === "registers" ? (
        <Card title="x0–x31">
          <p className="tiny">Architectural IDs are x0–x31. ABI names are aliases. Writes to x0 are ignored.</p>
          <div className="cpu-grid isa-regs">
            {cpu.regs.map((value, index) => (
              <IsaRegister key={index} name={xName(index)} number={index} value={value} note={ABI[index]} selected={sel === index} locked={index === 0} onSelect={() => {
                setSel(index);
                setCpu((prev) => ({ ...prev, regs: writeX(prev.regs, index, 99) }));
              }} />
            ))}
          </div>
          <Button onClick={() => setCpu((prev) => ({ ...prev, regs: writeX(prev.regs, sel, 99) }))}>Try write 99 to selected</Button>
        </Card>
      ) : null}

      {lab === "formats" || lab === "immgen" ? (
        <Card title={lab === "immgen" ? "Immediate generator" : "RV32I layouts"}>
          <Segmented options={["R", "I", "S", "B", "U", "J"]} value={format} onChange={(value) => setFormat(value as RvFormat)} />
          <p className="mono">{RV_FORMATS[format].map((field) => `${field.name}[${field.hi}:${field.lo}]`).join("  ")}</p>
          <BitFields fields={fieldsOf(format, formatWord)} wordBits={toBin32(formatWord)} />
          {lab === "immgen" && format !== "R" ? (
            <div className="isa-bits">
              {immMoves.map((move) => (
                <div key={`${move.src}-${move.dst}`} className="isa-bit">
                  <span>{move.src} → {move.dst}</span>
                  <small>{move.value}</small>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}

      {lab === "encoding" ? (
        <div className="grid cards-2">
          <Card title="Assemble">
            <textarea className="asm" style={{ minHeight: 90 }} value={source} onChange={(event) => setSource(event.target.value)} />
            {built.ok ? <p className="tiny">{decode(built.words[0] ?? 0).text} · {toHex32(built.words[0] ?? 0)}</p> : <pre className="mono">{built.errors.map((e) => e.message).join("\n")}</pre>}
            {built.ok ? <BitFields fields={fieldsOf(decode(built.words[0] ?? 0).format, built.words[0] ?? 0)} /> : null}
          </Card>
          <Card title="Decode hex">
            <input aria-label="Hex instruction" value={hex} onChange={(event) => setHex(event.target.value)} />
            {hexDecoded && !hexDecoded.error ? (
              <>
                <p className="tiny">{hexDecoded.text} · {hexDecoded.format} · opcode {hexDecoded.opcode} funct3 {hexDecoded.funct3}</p>
                <BitFields fields={fieldsOf(hexDecoded.format, hexDecoded.word)} wordBits={toBin32(hexDecoded.word)} />
              </>
            ) : <p className="status miss">{hexDecoded?.error ?? "Enter a 32-bit hex word such as 0x00500093."}</p>}
          </Card>
        </div>
      ) : null}

      {lab === "arith" ? (
        <Card title="ALU">
          <Segmented options={["add", "sub", "and", "or", "xor", "sll", "srl", "sra", "slt"]} value={aluOp} onChange={setAluOp} />
          <label className="field">rs1<input type="number" value={rs1} onChange={(event) => setRs1(parseNumberInput(event.target.value, rs1))} /></label>
          <label className="field">rs2<input type="number" value={rs2} onChange={(event) => setRs2(parseNumberInput(event.target.value, rs2))} /></label>
          <Metric label="result" value={String(aluResult >>> 0)} />
          <Button variant="primary" onClick={() => setRd(aluResult >>> 0)}>Write rd</Button>
          <p className="tiny">rd = {rd}. SLT is signed; logical shifts are unsigned.</p>
        </Card>
      ) : null}

      {lab === "loadstore" ? (
        <Card title="lw / sw">
          <Datapath nodes={[{ id: "rs1", label: "rs1" }, { id: "imm", label: "+ imm" }, { id: "ea", label: "EA" }, { id: "mem", label: "Memory" }, { id: "rd", label: "rd / rs2" }]} active={["rs1", "imm", "ea", "mem", "rd"]} />
          <p className="tiny">EA = x0 + 0. sw writes x3; lw reads back to x4 in the memory preset.</p>
          {workbench}
        </Card>
      ) : null}

      {lab === "branches" ? (
        <Card title="BEQ / BNE">
          <p className="tiny">rs1={cpu.regs[1]} rs2={cpu.regs[1]} compare equal · target = PC + imm</p>
          {workbench}
          <Button onClick={() => loadSrc(BR)}>Load branch sample</Button>
        </Card>
      ) : null}

      {lab === "jal" ? (
        <Card title="JAL vs JALR">
          <p className="tiny">JAL: target = PC + imm, rd = PC+4. JALR: target = (rs1+imm)&~1, rd = PC+4.</p>
          <Button onClick={() => loadSrc(CALL)}>Load call sample</Button>
          {workbench}
        </Card>
      ) : null}

      {lab === "lui" ? (
        <Card title="LUI / AUIPC">
          <p className="tiny">lui x1, 1 writes 0x1000. auipc x1, 1 writes PC + 0x1000.</p>
          <div className="row">
            <Button onClick={() => loadSrc("lui x1, 1")}>LUI</Button>
            <Button onClick={() => loadSrc("auipc x1, 1")}>AUIPC</Button>
            <Button variant="primary" onClick={() => setCpu((prev) => stepRv(prev))}>Step</Button>
          </div>
          <IsaRegister name="x1" number={1} value={cpu.regs[1] ?? 0} />
        </Card>
      ) : null}

      {lab === "datapath" ? (
        <Card title="Single-cycle datapath">
          <Datapath nodes={DP} active={livePath} />
          {workbench}
        </Card>
      ) : null}

      {lab === "multicycle" ? (
        <Card title="Same hardware, several cycles">
          <div className="stage-row">
            {["Fetch", "Decode", "Execute", "Memory", "Writeback"].map((stage, index) => (
              <div key={stage} className={index === multi % 5 ? "bit-field on" : "bit-field"}><span>{stage}</span></div>
            ))}
          </div>
          <Button variant="primary" onClick={() => { setMulti((value) => value + 1); if ((multi + 1) % 5 === 0) setCpu((prev) => stepRv(prev)); }}>Step cycle</Button>
          <p className="tiny">Not a second CPU. The instruction retires after five educational clocks.</p>
        </Card>
      ) : null}

      {lab === "pipeline" || lab === "hazards" ? (
        <Card title={lab === "hazards" ? "Load-use RAW" : "IF ID EX MEM WB"}>
          {lab === "hazards" ? <Button onClick={() => setForward((value) => !value)}>Forwarding {forward ? "on" : "off"}</Button> : null}
          <table className="data">
            <thead><tr><th>Instr</th>{Array.from({ length: 8 }, (_, i) => <th key={i}>C{i}</th>)}</tr></thead>
            <tbody>
              {hazards.rows.map((row) => (
                <tr key={row.text}>
                  <td>{row.text}</td>
                  {row.cells.map((cell, index) => <td key={index} className={cell ? "mono" : undefined}>{index <= pipeTick ? cell : ""}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="tiny">Stalls {hazards.stalls} · forwards {hazards.forwards}. Load-use still stalls once with forwarding.</p>
          <Button variant="primary" onClick={() => setPipeTick((value) => value + 1)}>Advance cycle</Button>
        </Card>
      ) : null}
    </ArchitectureFrame>
  );
}

export default RiscvStudio;
