import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { RINGS, X86_EXAMPLES, X86_REGS, effectiveAddress, microOps, ooeDemo, parseExample, x86Simd } from "../../engines/isaarch/x86";
import { ArchitectureFrame, ArchitectureLanding } from "../../layout/ArchitectureFrame";
import { Datapath, IsaRegister } from "../shared/BitFields";
import { Card, Metric, Segmented } from "../../design-system/ui";

export function X86Studio() {
  const lab = useParams().labId ?? "overview";
  const [id, setId] = useState("add-reg");
  const example = parseExample(id) ?? X86_EXAMPLES[0]!;
  const [base, setBase] = useState(0x100);
  const [index, setIndex] = useState(3);
  const [scale, setScale] = useState(4);
  const [disp, setDisp] = useState(8);
  const ea = effectiveAddress(base, index, scale, disp);
  const ooo = useMemo(() => ooeDemo(), []);
  const [sel, setSel] = useState(0);

  return (
    <ArchitectureFrame studioId="x86" onReset={() => setId("add-reg")}>
      {lab === "overview" ? <ArchitectureLanding studioId="x86" /> : null}
      {lab === "overview" ? <p className="tiny">Illustrative decoding only. Internal micro-op decomposition varies by implementation.</p> : null}

      {lab === "overview" || lab === "registers" || lab === "x64" ? (
        <Card title="x86-64 GPR concept">
          <div className="cpu-grid">
            {X86_REGS.map((reg, i) => (
              <IsaRegister key={reg.full} name={reg.full} value={i === 0 ? 0x100 : 0} note={`${reg.parts} · ${reg.role}`} selected={sel === i} onSelect={() => setSel(i)} />
            ))}
          </div>
          <p className="tiny">Full register and lower-width views overlay the same architectural register.</p>
        </Card>
      ) : null}

      {lab === "variable" || lab === "decoder" || lab === "microops" || lab === "frontend" || lab === "memory" ? (
        <div className="grid cards-2">
          <Card title="Curated instruction">
            <Segmented options={X86_EXAMPLES.map((item) => item.id)} value={id} onChange={setId} />
            <p className="mono">{example.asm}</p>
            <p className="tiny">{example.bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ")}</p>
            <div className="isa-bits">
              {example.fields.map((field) => (
                <div key={field.name} className="isa-bit">
                  <span>{field.name}</span>
                  <small>{field.bytes} · {field.note}</small>
                </div>
              ))}
            </div>
            <p className="tiny">{example.note}</p>
          </Card>
          <Card title={lab === "memory" ? "Memory operand" : "Front end → micro-ops"}>
            <Datapath
              nodes={[{ id: "arch", label: "Architectural instruction" }, { id: "dec", label: "Decode" }, { id: "uop", label: "Internal ops" }, { id: "sched", label: "Scheduler" }, { id: "ex", label: "Execution units" }]}
              active={["arch", "dec", "uop", "sched", "ex"]}
            />
            <ul>{microOps(id).map((item) => <li key={item}>{item}</li>)}</ul>
            <p className="tiny">Internal micro-op decomposition varies by implementation. This is not a commercial CPU.</p>
            {lab === "memory" ? <p>Load/store ISAs would split a memory ALU op into load, operate, store. x86 may name the memory operand directly.</p> : null}
          </Card>
        </div>
      ) : null}

      {lab === "addressing" ? (
        <Card title="Base + Index × Scale + Displacement">
          <label className="field">Base<input type="number" value={base} onChange={(e) => setBase(Number(e.target.value))} /></label>
          <label className="field">Index<input type="number" value={index} onChange={(e) => setIndex(Number(e.target.value))} /></label>
          <label className="field">Scale<input type="number" value={scale} onChange={(e) => setScale(Number(e.target.value))} /></label>
          <label className="field">Disp<input type="number" value={disp} onChange={(e) => setDisp(Number(e.target.value))} /></label>
          <Metric label="EA" value={`0x${ea.toString(16)}`} />
          <Datapath nodes={[{ id: "b", label: "Base" }, { id: "i", label: "Index×Scale" }, { id: "d", label: "Disp" }, { id: "ea", label: "Effective address" }]} active={["b", "i", "d", "ea"]} />
        </Card>
      ) : null}

      {lab === "ooo" ? (
        <Card title="Out-of-order backend (reused engine)">
          <p className="tiny">Rename, scheduler, execute, ROB, retire — same parallel primitives as the Modern CPU core labs.</p>
          <table className="data">
            <thead><tr><th>Op</th><th>P-dest</th><th>Sources</th></tr></thead>
            <tbody>{ooo.renamed.map((op, index) => <tr key={index}><td>{["add eax, ebx", "mov ecx, [rax]", "add edx, ecx"][index]}</td><td>{op.dest}</td><td>{op.sources.join(", ")}</td></tr>)}</tbody>
          </table>
          <ul>{ooo.rob.map((entry) => <li key={entry.text}>{entry.text} · {entry.status}</li>)}</ul>
        </Card>
      ) : null}

      {lab === "simd" ? (
        <Card title="SIMD family concept">
          <p className="tiny">Not exhaustive SSE/AVX emulation. Packed add shows the idea.</p>
          <p className="mono">{x86Simd([1, 2, 3, 4], [5, 6, 7, 8]).join(" ")}</p>
        </Card>
      ) : null}

      {lab === "privilege" ? (
        <Card title="Privilege (high level)">
          {RINGS.map((ring) => <div key={ring.id} className="tree-node"><strong>{ring.title}</strong><p className="tiny">{ring.note}</p></div>)}
          <p className="tiny">OS internals are out of scope. This is a high-level user versus privileged split.</p>
        </Card>
      ) : null}
    </ArchitectureFrame>
  );
}

export default X86Studio;
