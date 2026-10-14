import { useState } from "react";
import type { IsaSpec } from "../../engines/builder/model";
import { assemble } from "../../engines/builder/isa";

type Block = { id: number; mnemonic: string; args: string[]; repeat: number; label?: string; raw?: string };
export function compileBlocks(blocks: Block[]): string {
  return blocks.flatMap(b => Array.from({ length: Math.max(1, Math.min(64, b.repeat)) }, (_,index) => `${index === 0 && b.label ? b.label + ": " : ""}${b.raw ?? b.mnemonic}${b.args.length ? " " + b.args.join(", ") : ""}`)).join("\n") + "\n";
}
export function BlockProgram({ isa, program, onApply }: { isa: IsaSpec; program: string; onApply: (program: string) => void }) {
  const [blocks, setBlocks] = useState<Block[]>(() => program.split("\n").map(line => line.replace(/;.*$/," ").trim()).filter(Boolean).map((line,id) => {
    const match=/^([A-Za-z_]\w*):\s*(.*)$/.exec(line);const label=match?.[1];const rest=match?.[2]??line;const [mnemonic="",...args]=rest.split(/\s+/);const known=isa.instructions.some(i=>i.mnemonic===mnemonic.toUpperCase());return {id,mnemonic:known?mnemonic.toUpperCase():"",args:known?args.join(" ").split(",").map(a=>a.trim()).filter(Boolean):[],repeat:1,label,raw:known?undefined:rest};
  }));
  const [category, setCategory] = useState("All");
  const code = compileBlocks(blocks);
  const result = assemble(isa, code);
  function add(mnemonic: string) {
    const instruction = isa.instructions.find(i => i.mnemonic === mnemonic);
    if (!instruction) return;
    setBlocks(list => [...list, { id: Date.now() + Math.random(), mnemonic, args: instruction.operands.map(o => o === "imm" ? "1" : "R0"), repeat: 1 }]);
  }
  function update(id: number, patch: Partial<Block>) { setBlocks(list => list.map(b => b.id === id ? { ...b, ...patch } : b)); }
  function move(index: number, direction: number) {
    setBlocks(list => { const next = [...list]; const target = index + direction; if (target < 0 || target >= next.length) return list; const current = next[index]; const other = next[target]; if (!current || !other) return list; next[index] = other; next[target] = current; return next; });
  }
  const color = (mnemonic: string) => { const i = isa.instructions.find(i => i.mnemonic === mnemonic); return i?.mem !== "none" ? "memory" : i?.pc !== "inc" ? "control" : "math"; };
  return <div className="cpu-blocks-layout">
    <aside className="card cpu-block-drawer"><h3>◈ Block Palette</h3><button className="ce-btn" onClick={()=>setBlocks(list=>[...list,{id:Date.now(),mnemonic:"",args:[],repeat:1,label:"label"+list.length}])}>＋ Label</button><p className="tiny">Click or drag an instruction into your program.</p><div className="cpu-categories">{["All", "math", "memory", "control"].map(c => <button key={c} className={category === c ? "active" : ""} onClick={() => setCategory(c)}>{c}</button>)}</div>{isa.instructions.filter(i => category === "All" || color(i.mnemonic) === category).map(i => <button className={`cpu-code-block ${color(i.mnemonic)}`} key={i.mnemonic} draggable onDragStart={e => e.dataTransfer.setData("instruction", i.mnemonic)} onClick={() => add(i.mnemonic)}>{i.mnemonic}<small>{i.operands.join(" · ") || "stop execution"}</small></button>)}</aside>
    <section className="cpu-block-workspace" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); add(e.dataTransfer.getData("instruction")); }}><div className="cpu-canvas-header"><strong>when CPU starts</strong><button onClick={() => setBlocks([])}>Clear blocks</button></div><div className="cpu-block-stack">{blocks.map((b, index) => <div className={`cpu-code-block ${color(b.mnemonic)}`} key={b.id}><span className="cpu-block-number">{index + 1}</span><strong>{b.raw || b.mnemonic || "Label"}</strong>{b.label !== undefined && <input aria-label={`Label block ${index+1}`} value={b.label} onChange={e=>update(b.id,{label:e.target.value})}/ >}{b.args.map((arg, a) => <input key={a} aria-label={`${b.mnemonic} operand ${a + 1}`} value={arg} onChange={e => update(b.id, { args: b.args.map((v, n) => n === a ? e.target.value : v) })} />)}<label className="cpu-repeat">repeat <input aria-label={`Repeat block ${index + 1}`} type="number" min="1" max="64" value={b.repeat} onChange={e => update(b.id, { repeat: Math.max(1, Math.min(64, Number(e.target.value) || 1)) })} /></label><div className="cpu-block-actions"><button disabled={index === 0} aria-label={`Move block ${index + 1} up`} onClick={() => move(index, -1)}>↑</button><button disabled={index === blocks.length - 1} aria-label={`Move block ${index + 1} down`} onClick={() => move(index, 1)}>↓</button><button aria-label={`Delete block ${index + 1}`} onClick={() => setBlocks(list => list.filter(v => v.id !== b.id))}>×</button></div></div>)}{!blocks.length && <p className="muted">Drop your first instruction here to build a program.</p>}</div></section>
    <aside className="card"><h3>Generated Assembly</h3><pre className="cpu-generated">{code || "; Add blocks to begin"}</pre>{!result.ok && result.errors.map(e => <p className="status miss" key={e.line}>Line {e.line}: {e.message}</p>)}<button className="btn-primary" disabled={!blocks.length || !result.ok} onClick={() => onApply(code)}>▷ Assemble & Load Blocks</button><p className="tiny">{result.ok ? `${result.words.length} machine words` : "Check operands"} · {isa.name}</p><p className="muted">Blocks follow your custom ISA. Load the program, then use Clock, Step, or Run to inspect your CPU.</p></aside>
  </div>;
}
