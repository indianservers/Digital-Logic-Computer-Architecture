import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  MIPS_EXAMPLES, MIPS_LAYOUT, MIPS_REGS, aluMips, branchTarget, decodeMips, ea, fieldsMips, jumpTarget, mipsControls, mipsRoute, parseMipsAsm, toBin32, toHex32,
} from "../../engines/isaarch/mips";
import { ArchitectureFrame, ArchitectureLanding } from "../../layout/ArchitectureFrame";
import { BitFields, Datapath, IsaRegister } from "../shared/BitFields";
import { Button, Card, Metric, Segmented } from "../../design-system/ui";

const DP = [
  { id: "pc", label: "PC" }, { id: "imem", label: "I-Mem" }, { id: "decode", label: "Decode" }, { id: "regfile", label: "RegFile" },
  { id: "signext", label: "Sign-ext" }, { id: "alusrc", label: "ALUSrc" }, { id: "alu", label: "ALU" }, { id: "dmem", label: "D-Mem" },
  { id: "branch", label: "Branch" }, { id: "jump", label: "Jump" }, { id: "wb", label: "Writeback" }, { id: "pcnext", label: "PC next" },
];

const STAGES = ["IF", "ID", "EX", "MEM", "WB"];

export function MipsStudio() {
  const lab = useParams().labId ?? "overview";
  const [sel, setSel] = useState(8);
  const [regs, setRegs] = useState(() => {
    const values = Array.from({ length: 32 }, () => 0);
    values[9] = 11;
    values[10] = 7;
    values[8] = 0;
    return values;
  });
  const [asm, setAsm] = useState("add $t0, $t1, $t2");
  const [example, setExample] = useState(0);
  const [op, setOp] = useState("add");
  const [taken, setTaken] = useState(true);
  const [pc, setPc] = useState(0);
  const [mem, setMem] = useState(() => Array.from({ length: 16 }, (_, i) => i * 3));
  const [pipe, setPipe] = useState(0);
  const [walk, setWalk] = useState(0);

  const parsed = parseMipsAsm(asm);
  const decoded = "error" in parsed ? decodeMips(MIPS_EXAMPLES[example]?.word ?? 0) : parsed;
  const controls = mipsControls(decoded.mnemonic);
  const format: "R" | "I" | "J" = lab === "formats" ? (example % 3 === 1 ? "I" : example % 3 === 2 ? "J" : "R") : decoded.format;
  const formatWord = format === "R" ? MIPS_EXAMPLES[0]!.word : format === "I" ? MIPS_EXAMPLES[2]!.word : MIPS_EXAMPLES[5]!.word;
  const aluOut = aluMips(op, regs[9] ?? 0, regs[10] ?? 0);
  const loadAddr = ea(regs[9] ?? 0, 4);
  const nextPc = taken ? branchTarget(pc, 3) : pc + 4;
  const jmp = jumpTarget(pc, 0x10);
  const walkProg = [
    { text: "add $t0, $t1, $t2", run: (r: number[]) => { const n = r.slice(); n[8] = aluMips("add", n[9] ?? 0, n[10] ?? 0); return n; } },
    { text: "sw $t0, 0($zero)", run: (r: number[]) => r },
    { text: "lw $t0, 0($zero)", run: (r: number[]) => r },
  ];

  const fields = useMemo(() => fieldsMips(decoded.word), [decoded.word]);

  return (
    <ArchitectureFrame studioId="mips" onReset={() => { setAsm("add $t0, $t1, $t2"); setPc(0); setWalk(0); setPipe(0); }}>
      {lab === "overview" ? <ArchitectureLanding studioId="mips" /> : null}

      {lab === "overview" || lab === "registers" ? (
        <Card title="Educational register model">
          <p className="tiny">ABI names are labels. The ISA identifies registers by number.</p>
          <div className="cpu-grid">
            {MIPS_REGS.map((reg) => (
              <IsaRegister key={reg.n} name={reg.name} number={reg.n} value={regs[reg.n] ?? 0} note={reg.role} selected={sel === reg.n} onSelect={() => setSel(reg.n)} locked={reg.n === 0} />
            ))}
          </div>
        </Card>
      ) : null}

      {lab === "formats" ? (
        <Card title={`${format}-Type`}>
          <Segmented options={["R", "I", "J"]} value={format} onChange={(value) => setExample(value === "R" ? 0 : value === "I" ? 2 : 5)} />
          <p className="mono">{(MIPS_LAYOUT[format] ?? []).map((field) => field.name).join(" | ")}</p>
          <BitFields fields={fieldsMips(formatWord)} wordBits={toBin32(formatWord)} />
        </Card>
      ) : null}

      {lab === "decoder" || lab === "datapath" || lab === "control" ? (
        <div className="grid cards-2">
          <Card title="Decoder">
            <textarea className="asm" style={{ minHeight: 72 }} value={asm} onChange={(event) => setAsm(event.target.value)} aria-label="MIPS assembly" />
            <div className="row">{MIPS_EXAMPLES.map((item, index) => <Button key={item.asm} onClick={() => { setExample(index); setAsm(item.asm); }}>{item.asm}</Button>)}</div>
            {"error" in parsed ? <p className="status miss">{parsed.error}</p> : null}
            <p className="tiny">{decoded.text} · {decoded.format}-type · {toHex32(decoded.word)}</p>
            <BitFields fields={fields} wordBits={toBin32(decoded.word)} />
          </Card>
          <Card title={lab === "control" ? "Control signals" : "Datapath route"}>
            {lab === "control" ? (
              <div className="cpu-grid">
                {Object.entries(controls).map(([name, value]) => <Metric key={name} label={name} value={String(value)} />)}
              </div>
            ) : (
              <Datapath nodes={DP} active={mipsRoute(decoded.mnemonic)} />
            )}
            <p className="tiny">Class {decoded.format} · opcode {decoded.opcode} · funct {decoded.funct} · rs {decoded.rs} rt {decoded.rt} rd {decoded.rd}</p>
          </Card>
        </div>
      ) : null}

      {lab === "arith" ? (
        <Card title="ALU writeback">
          <Segmented options={["add", "sub", "and", "or", "slt"]} value={op} onChange={setOp} />
          <div className="row">
            <Metric label="$t1" value={String(regs[9])} />
            <Metric label="$t2" value={String(regs[10])} />
            <Metric label="ALU" value={String(aluOut)} />
            <Metric label="rd $t0" value={String(aluOut)} />
          </div>
          <Datapath nodes={DP} active={["pc", "imem", "decode", "regfile", "alusrc", "alu", "wb", "pcnext"]} />
          <Button variant="primary" onClick={() => setRegs((prev) => { const next = prev.slice(); next[8] = aluMips(op, next[9] ?? 0, next[10] ?? 0); return next; })}>Write $t0</Button>
        </Card>
      ) : null}

      {lab === "loadstore" ? (
        <Card title="lw / sw">
          <Segmented options={["lw", "sw"]} value={op === "sw" ? "sw" : "lw"} onChange={setOp} />
          <Datapath nodes={[{ id: "reg", label: "Register" }, { id: "alu", label: "ALU address" }, { id: "dmem", label: "Data memory" }, { id: "rf", label: "Register file" }]} active={["reg", "alu", "dmem", "rf"]} />
          <p className="tiny">EA = $t1 + 4 = {loadAddr}. Memory[{loadAddr}] = {mem[loadAddr] ?? 0}</p>
          <Button onClick={() => {
            if (op === "sw") setMem((prev) => { const next = prev.slice(); next[loadAddr] = regs[8] ?? 0; return next; });
            else setRegs((prev) => { const next = prev.slice(); next[8] = mem[loadAddr] ?? 0; return next; });
          }}>{op === "sw" ? "Store $t0" : "Load $t0"}</Button>
        </Card>
      ) : null}

      {lab === "branch" ? (
        <Card title="BEQ / J">
          <div className="row">
            <Button onClick={() => setTaken(true)}>BEQ taken</Button>
            <Button onClick={() => setTaken(false)}>BEQ not taken</Button>
            <Button onClick={() => setPc(jmp)}>Jump 0x10</Button>
          </div>
          <Metric label="PC" value={String(pc)} />
          <Metric label="Compare $t0==$t1" value={String((regs[8] ?? 0) === (regs[9] ?? 0))} />
          <Metric label="Branch target" value={String(branchTarget(pc, 3))} />
          <Metric label="Next PC" value={String(nextPc)} />
          <Metric label="Jump target" value={toHex32(jmp)} />
          <Datapath nodes={DP} active={taken ? mipsRoute("beq") : ["pc", "imem", "decode", "regfile", "alu", "pcnext"]} />
          <Button variant="primary" onClick={() => setPc(nextPc)}>Commit next PC</Button>
        </Card>
      ) : null}

      {lab === "pipeline" ? (
        <Card title="Five-stage overview">
          <div className="stage-row">
            {STAGES.map((stage, index) => <div key={stage} className={index === pipe % 5 ? "bit-field on" : "bit-field"}><span>{stage}</span><small>instr {(pipe + 4 - index) % 5}</small></div>)}
          </div>
          <Button variant="primary" onClick={() => setPipe((value) => value + 1)}>Advance pipeline</Button>
          <p className="tiny">Overview only. Full hazard timing lives in the RISC-V Processor Lab and the Pipeline Studio.</p>
        </Card>
      ) : null}

      {lab === "walkthrough" ? (
        <Card title="add, store, load">
          <p className="tiny">{walkProg[walk % walkProg.length]?.text} · PC {walk * 4}</p>
          <div className="cpu-grid">
            <IsaRegister name="$t0" number={8} value={regs[8] ?? 0} />
            <IsaRegister name="$t1" number={9} value={regs[9] ?? 0} />
            <IsaRegister name="$t2" number={10} value={regs[10] ?? 0} />
          </div>
          <Button variant="primary" onClick={() => {
            const step = walkProg[walk % walkProg.length];
            if (step) setRegs(step.run(regs));
            setWalk((value) => value + 1);
          }}>Step</Button>
        </Card>
      ) : null}
    </ArchitectureFrame>
  );
}

export default MipsStudio;
