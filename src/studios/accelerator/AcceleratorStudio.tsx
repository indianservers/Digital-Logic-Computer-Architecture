import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ACCEL_LEVELS, NPU_BLOCKS, NPU_FLOW, NET_STAGES, dataflow, mac, macRepeat, matMulScalarSteps,
  matMulSystolicSteps, matMulVectorSteps, mixedPrecision, quantizeTensor, reuseTraffic, systolicCells, type DataflowKind,
  type NumericFormat, type Matrix,
} from "../../engines/accel/accelerator";
import { ArchitectureFrame, ArchitectureLanding } from "../../layout/ArchitectureFrame";
import { Button, Card, Metric, Segmented, SimControls, parseNumberInput } from "../../design-system/ui";

function parseMatrix(text: string): Matrix {
  return text.trim().split(/\n/).map((row) => row.trim().split(/[,\s]+/).filter(Boolean).map(Number));
}

function matrixText(matrix: Matrix): string {
  return matrix.map((row) => row.join(" ")).join("\n");
}

export function AcceleratorStudio() {
  const { labId } = useParams();
  const lab = labId ?? "overview";
  const [a, setA] = useState(3);
  const [b, setB] = useState(4);
  const [acc, setAcc] = useState(5);
  const [macLog, setMacLog] = useState<string[]>([]);
  const [grid, setGrid] = useState(4);
  const [cell, setCell] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [aText, setAText] = useState("1 2\n3 4");
  const [bText, setBText] = useState("5 6\n7 8");
  const [mode, setMode] = useState<"scalar" | "vector" | "systolic">("scalar");
  const [mmStep, setMmStep] = useState(0);
  const [sysCycle, setSysCycle] = useState(0);
  const [flow, setFlow] = useState<DataflowKind>("weight");
  const [reuse, setReuse] = useState(8);
  const [tensorText, setTensorText] = useState("0.15, -0.72, 1.24, 3.81");
  const [compute, setCompute] = useState<NumericFormat>("fp16");
  const [accum, setAccum] = useState<NumericFormat>("fp32");
  const [train, setTrain] = useState(false);
  const [npu, setNpu] = useState(0);
  const [net, setNet] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      if (lab === "array") setCell((value) => (value + 1) % (grid * grid));
      if (lab === "systolic") setSysCycle((value) => value + 1);
      if (lab === "npu") setNpu((value) => (value + 1) % NPU_FLOW.length);
      if (lab === "pipeline") setNet((value) => (value + 1) % NET_STAGES.length);
      if (lab === "matmul") setMmStep((value) => value + 1);
    }, Math.max(120, 700 / speed));
    return () => window.clearInterval(id);
  }, [playing, speed, lab, grid]);

  const A = parseMatrix(aText);
  const B = parseMatrix(bText);
  const mm = useMemo(() => {
    try {
      if (mode === "vector") return matMulVectorSteps(A, B);
      if (mode === "systolic") return matMulSystolicSteps(A, B);
      return matMulScalarSteps(A, B);
    } catch {
      return { result: [[0]], steps: [] };
    }
  }, [A, B, mode]);
  const visible = mm.steps.slice(0, Math.max(0, mmStep));
  const sys = systolicCells(A.length === B.length ? A : [[1, 2], [3, 4]], A.length === B.length ? B : [[5, 6], [7, 8]], sysCycle);
  const values = tensorText.split(/[,\s]+/).filter(Boolean).map(Number).filter((item) => Number.isFinite(item));
  const formats: NumericFormat[] = ["fp32", "fp16", "bf16", "int8"];

  return (
    <ArchitectureFrame studioId="accelerator" onReset={() => { setA(3); setB(4); setAcc(5); setMacLog([]); setCell(0); setMmStep(0); setSysCycle(0); setPlaying(false); }}>
      {lab === "overview" ? <ArchitectureLanding studioId="accelerator" /> : null}

      {lab === "mac" ? (
        <div className="grid cards-2">
          <Card title="MAC unit">
            <div className="row">
              <label className="field">A<input type="number" value={a} onChange={(event) => setA(parseNumberInput(event.target.value, a))} /></label>
              <label className="field">B<input type="number" value={b} onChange={(event) => setB(parseNumberInput(event.target.value, b))} /></label>
              <label className="field">Accumulator<input type="number" value={acc} onChange={(event) => setAcc(parseNumberInput(event.target.value, acc))} /></label>
            </div>
            <p className="expr">{a} × {b} + {acc} = {mac(a, b, acc)}</p>
            <div className="row">
              <Button variant="primary" onClick={() => {
                const next = mac(a, b, acc);
                setMacLog((log) => [`${a} × ${b} + ${acc} = ${next}`, ...log].slice(0, 8));
                setAcc(next);
              }}>Step</Button>
              <Button onClick={() => {
                const run = macRepeat(a, b, acc, 3);
                setAcc(run.acc);
                setMacLog(run.steps.map((step) => `${step.a} × ${step.b} + ${step.before} = ${step.after}`));
              }}>Repeat ×3</Button>
            </div>
          </Card>
          <Card title="History">
            <div className="row"><Metric label="Product" value={String(a * b)} /><Metric label="Previous ACC" value={String(acc)} /><Metric label="Updated" value={String(mac(a, b, acc))} /></div>
            <ol className="muted">{macLog.map((item) => <li key={item}>{item}</li>)}</ol>
          </Card>
        </div>
      ) : null}

      {lab === "array" ? (
        <Card title={`${grid} × ${grid} MAC array`} action={<Segmented options={["2", "4", "8"]} value={String(grid)} onChange={(value) => { setGrid(Number(value)); setCell(0); }} />}>
          <SimControls playing={playing} onPlay={() => setPlaying((value) => !value)} onStep={() => setCell((value) => (value + 1) % (grid * grid))} onReset={() => setCell(0)} speed={speed} onSpeed={setSpeed} />
          <div className="pe-grid" style={{ gridTemplateColumns: `repeat(${grid}, minmax(0, 1fr))` }}>
            {Array.from({ length: grid * grid }, (_, index) => (
              <div key={index} className={index === cell % (grid * grid) ? "pe-cell on" : "pe-cell"}>MAC {index}</div>
            ))}
          </div>
          <p className="tiny">Active cell is a conceptual MAC. Operation spreads as the clock steps. This is not transistor-level hardware.</p>
        </Card>
      ) : null}

      {lab === "matmul" ? (
        <div className="grid cards-2">
          <Card title="A × B = C">
            <div className="grid cards-2">
              <label className="field">Matrix A<textarea className="asm" value={aText} onChange={(event) => { setAText(event.target.value); setMmStep(0); }} /></label>
              <label className="field">Matrix B<textarea className="asm" value={bText} onChange={(event) => { setBText(event.target.value); setMmStep(0); }} /></label>
            </div>
            <Segmented options={["scalar", "vector", "systolic"]} value={mode} onChange={(value) => { setMode(value as typeof mode); setMmStep(0); }} />
            <SimControls playing={playing} onPlay={() => setPlaying((value) => !value)} onStep={() => setMmStep((value) => value + 1)} onReset={() => setMmStep(0)} speed={speed} onSpeed={setSpeed} />
          </Card>
          <Card title="Partial sums">
            <pre className="mono">{matrixText(mm.result)}</pre>
            <table className="data"><thead><tr><th>Cycle</th><th>i,j,k</th><th>a×b</th><th>acc</th></tr></thead>
              <tbody>{visible.slice(-8).map((step) => <tr key={`${step.cycle}-${step.i}-${step.j}-${step.k}`}><td>{step.cycle}</td><td>{step.i},{step.j},{step.k}</td><td>{step.product}</td><td>{step.acc}</td></tr>)}</tbody>
            </table>
            <p className="tiny">Scalar issues one MAC per cycle. Vector issues a whole inner-dimension strip. Systolic uses the same math with PE-neighbor timing. Timings are educational, not a vendor part.</p>
          </Card>
        </div>
      ) : null}

      {lab === "systolic" ? (
        <Card title={`Systolic array · cycle ${sysCycle}`} action={<Button onClick={() => { setAText("1 2\n3 4"); setBText("5 6\n7 8"); setSysCycle(0); }}>2×2 preset</Button>}>
          <SimControls playing={playing} onPlay={() => setPlaying((value) => !value)} onStep={() => setSysCycle((value) => value + 1)} onReset={() => setSysCycle(0)} speed={speed} onSpeed={setSpeed} />
          <div className="pe-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            {sys.cells.flat().map((pe) => (
              <div key={`${pe.i}-${pe.j}`} className={pe.product !== null ? "pe-cell on" : "pe-cell"}>
                PE[{pe.i},{pe.j}]
                <small>A {pe.a ?? "—"} · W {pe.b ?? "—"}</small>
                <small>Σ {pe.c}</small>
              </div>
            ))}
          </div>
          <p className="tiny">Weights and activations meet on a diagonal wave. Partial sums live in each PE. Complete: {sys.complete ? "yes" : "not yet"}.</p>
        </Card>
      ) : null}

      {lab === "dataflow" ? (
        <Card title="Dataflow comparison">
          <Segmented options={["weight", "output", "activation"]} value={flow} onChange={(value) => setFlow(value as DataflowKind)} />
          {(() => {
            const info = dataflow(flow);
            return (
              <div className="grid cards-3">
                <Metric label="Stays local" value={info.stays} />
                <Metric label="Moves" value={info.moves} />
                <Metric label="Relative traffic" value={String(info.traffic)} />
                <p className="muted" style={{ gridColumn: "1 / -1" }}>{info.reuse} {info.note}</p>
              </div>
            );
          })()}
        </Card>
      ) : null}

      {lab === "memory" ? (
        <div className="grid cards-2">
          <Card title="Accelerator memory">
            <div className="tree">
              {ACCEL_LEVELS.map((level, index) => (
                <div key={level.id}>
                  <div className="tree-node">{level.name}<small className="tiny"> latency {level.latency} · bandwidth ×{level.bandwidth}</small></div>
                  {index < ACCEL_LEVELS.length - 1 ? <div className="tiny">↓</div> : null}
                </div>
              ))}
            </div>
          </Card>
          <Card title="Reuse versus traffic">
            <label className="field">Reuse factor<input type="range" min={1} max={32} value={reuse} onChange={(event) => setReuse(Number(event.target.value))} /></label>
            {(() => {
              const traffic = reuseTraffic(16, reuse);
              return <div className="row"><Metric label="Loads" value={String(traffic.loads)} /><Metric label="MACs" value={String(traffic.compute)} /><Metric label="Intensity" value={traffic.intensity.toFixed(1)} /></div>;
            })()}
            <p className="tiny">Values are relative teaching units, not a datasheet.</p>
          </Card>
        </div>
      ) : null}

      {lab === "quant" ? (
        <Card title="Quantization">
          <label className="field">Tensor<textarea className="asm" value={tensorText} onChange={(event) => setTensorText(event.target.value)} /></label>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Format</th><th>Bytes</th><th>Stored</th><th>Recovered</th><th>Max error</th></tr></thead>
              <tbody>
                {formats.map((format) => {
                  const q = quantizeTensor(values, format);
                  return <tr key={format}><td>{format.toUpperCase()}</td><td>{q.bytes}</td><td>{q.stored.map((item) => Number(item.toFixed(3))).join(", ")}</td><td>{q.recovered.map((item) => Number(item.toFixed(3))).join(", ")}</td><td>{q.maxError.toFixed(4)}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {lab === "mixed" ? (
        <Card title="Mixed precision">
          <div className="row">
            <span className="tiny">Compute</span>
            <Segmented options={formats} value={compute} onChange={(value) => setCompute(value as NumericFormat)} />
            <span className="tiny">Accumulate</span>
            <Segmented options={formats} value={accum} onChange={(value) => setAccum(value as NumericFormat)} />
          </div>
          {(() => {
            const mix = mixedPrecision(compute, accum);
            return (
              <div className="row">
                <Metric label="Bytes / value" value={String(mix.storage)} />
                <Metric label="Density vs FP32" value={`${mix.density.toFixed(1)}×`} />
                <Metric label="Numeric view" value={mix.precision} />
                <p className="muted">{mix.use} Density is conceptual, not a commercial speedup.</p>
              </div>
            );
          })()}
        </Card>
      ) : null}

      {lab === "infer" ? (
        <Card title={train ? "Training" : "Inference"} action={<Button onClick={() => setTrain((value) => !value)}>{train ? "Show inference" : "Show training"}</Button>}>
          <div className="tree">
            {(train ? ["Forward pass", "Loss", "Backward pass", "Gradients", "Weight update"] : ["Weights already learned", "Forward pass", "Output writeback"]).map((item) => <div key={item} className="tree-node">{item}</div>)}
          </div>
          <p className="muted">{train ? "Training stores activations for the backward pass and spends more memory and compute." : "Inference emphasizes latency or throughput with a forward pass on frozen weights. Memory is often lower."}</p>
        </Card>
      ) : null}

      {lab === "npu" ? (
        <Card title="NPU blocks">
          <SimControls playing={playing} onPlay={() => setPlaying((value) => !value)} onStep={() => setNpu((value) => (value + 1) % NPU_FLOW.length)} onReset={() => setNpu(0)} speed={speed} onSpeed={setSpeed} />
          <div className="cpu-grid">
            {NPU_BLOCKS.map((block, index) => (
              <button key={block.id} className={NPU_FLOW[npu] === block.id ? "cpu-block on" : "cpu-block"} onClick={() => setNpu(index)}>
                {block.name}<small>{block.role}</small>
              </button>
            ))}
          </div>
          <p className="tiny">Inference request: {NPU_FLOW[npu]} is active.</p>
        </Card>
      ) : null}

      {lab === "pipeline" ? (
        <Card title="Neural execution pipeline">
          <SimControls playing={playing} onPlay={() => setPlaying((value) => !value)} onStep={() => setNet((value) => (value + 1) % NET_STAGES.length)} onReset={() => setNet(0)} />
          <div className="tree">
            {NET_STAGES.map((stage, index) => (
              <div key={stage.id} className={index === net ? "tree-node" : "tree-node"} style={index === net ? { outline: "2px solid var(--primary)" } : undefined}>
                {stage.name}{index === 1 ? " · weights loaded · MAC" : index === 2 ? " · activation function" : index === 4 ? " · writeback" : ""}
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </ArchitectureFrame>
  );
}

export default AcceleratorStudio;
