import { useMemo, useState } from "react";
import { inverterTemplate, type LayerId, type LayoutRect } from "../layoutModel";
import { VlsiGrid } from "../shell";
import { Badge, Choice, Measure, Observe, Slider } from "../widgets";
import {
  applyFault,
  compareGraphs,
  extractFromLayout,
  extractParasitics,
  inverterSchematic,
  nandLayout,
  nandSchematic,
  type LvsFault,
  type ParasiticNet,
} from "../verifyModel";

const FILL: Record<LayerId, string> = {
  nwell: "rgba(167, 139, 250, 0.35)",
  pwell: "rgba(15, 118, 110, 0.28)",
  ndiff: "#0e7490",
  pdiff: "#be123c",
  poly: "#d97706",
  contact: "#f8fafc",
  metal1: "#38bdf8",
  via: "#cbd5e1",
  metal2: "#a78bfa",
};

function LayoutSvg({ rects, hot, onSelect }: { rects: LayoutRect[]; hot: string[]; onSelect: (id: string) => void }) {
  return (
    <svg className="vlsi-layout" viewBox="0 0 100 90" role="img" aria-label="Layout geometry">
      {rects.map((rect) => (
        <rect
          key={rect.id}
          x={rect.x}
          y={rect.y}
          width={Math.max(rect.w, 0.4)}
          height={Math.max(rect.h, 0.4)}
          fill={FILL[rect.layer]}
          stroke={hot.includes(rect.id) ? "#f87171" : "transparent"}
          strokeWidth={hot.includes(rect.id) ? 1.2 : 0}
          onClick={() => onSelect(rect.id)}
        />
      ))}
    </svg>
  );
}

function scaleMetals(rects: LayoutRect[], length: number, width: number): LayoutRect[] {
  return rects.map((rect) => {
    if (rect.layer !== "metal1" && rect.layer !== "metal2") return rect;
    const long = Math.max(rect.w, rect.h);
    const short = Math.min(rect.w, rect.h);
    const nextLong = long * length;
    const nextShort = short * width;
    if (rect.w >= rect.h) return { ...rect, w: nextLong, h: nextShort };
    return { ...rect, w: nextShort, h: nextLong };
  });
}

export function LvsLab() {
  const [cell, setCell] = useState<"inverter" | "nand">("inverter");
  const [fault, setFault] = useState<LvsFault>("none");
  const [pick, setPick] = useState<string | null>(null);
  const rects = cell === "inverter" ? inverterTemplate() : nandLayout();
  const schematic = cell === "inverter" ? inverterSchematic() : nandSchematic();
  const extracted = useMemo(() => applyFault(extractFromLayout(rects), fault), [rects, fault]);
  const result = useMemo(() => compareGraphs(schematic, extracted), [schematic, extracted]);
  const selected = result.mismatches.find((item) => item.id === pick) ?? result.mismatches[0] ?? null;
  const hotIds = selected?.layoutIds ?? [];
  const hotNet = selected?.net ?? "";
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Cell" value={cell} options={[{ id: "inverter", label: "Inverter" }, { id: "nand", label: "NAND2" }]} onChange={(value) => { setCell(value); setPick(null); setFault("none"); }} />
          <Choice
            label="Layout fault"
            value={fault}
            options={[
              { id: "none", label: "Match" },
              { id: "missing-pmos", label: "Missing PMOS" },
              { id: "extra-nmos", label: "Extra NMOS" },
              { id: "output-short", label: "Output short" },
              { id: "wrong-gate", label: "Wrong gate" },
            ]}
            onChange={(value) => { setFault(value); setPick(null); }}
          />
          <Observe
            change="Inject a missing device, an extra device, a shorted output, or a gate on the wrong input."
            see="The comparison lists that mismatch, and the same device lights up in layout, schematic, and the extracted netlist."
            why="LVS compares terminal graphs. Source and drain are unordered, so a mirrored transistor still matches."
            experiment="Start from Match on the inverter, then choose Output short."
            takeaway="A layout can look complete and still fail once a terminal lands on the wrong net."
          />
        </>
      }
      stage={
        <>
          <div className="vlsi-stage-head">
            <h2>Layout, schematic, and extract</h2>
            <Badge tone={result.pass ? "on" : "bad"}>{result.pass ? "PASS" : "FAIL"}</Badge>
          </div>
          <div className="vlsi-triple">
            <section>
              <h3>Layout</h3>
              <LayoutSvg rects={rects} hot={hotIds} onSelect={(id) => setPick(result.mismatches.find((item) => item.layoutIds.includes(id))?.id ?? pick)} />
            </section>
            <section>
              <h3>Schematic</h3>
              <ul className="vlsi-drc-list">
                {schematic.devices.map((device) => (
                  <li key={device.id}>
                    <button type="button" className={selected?.deviceId === device.id || device.gate === hotNet || device.drain === hotNet ? "on" : ""} onClick={() => setPick(result.mismatches.find((item) => item.deviceId === device.id)?.id ?? pick)}>
                      {device.kind.toUpperCase()} {device.id} · G {device.gate} · S {device.source} · D {device.drain}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3>Extracted netlist</h3>
              <ul className="vlsi-drc-list">
                {extracted.devices.map((device) => (
                  <li key={device.id}>
                    <button type="button" className={selected?.layoutIds.some((id) => device.layoutIds.includes(id)) || device.gate === hotNet || device.drain === hotNet ? "on" : ""} onClick={() => setPick(result.mismatches.find((item) => item.layoutIds.some((id) => device.layoutIds.includes(id)))?.id ?? pick)}>
                      {device.kind.toUpperCase()} {device.id} · G {device.gate} · S {device.source} · D {device.drain}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      }
      readouts={
        <>
          <Measure label="Schematic devices" value={String(schematic.devices.length)} />
          <Measure label="Extracted devices" value={String(extracted.devices.length)} />
          <Measure label="Mismatches" value={String(result.mismatches.length)} />
          <h3>Comparison</h3>
          {result.pass ? <p>Layout matches schematic.</p> : (
            <ul className="vlsi-drc-list">
              {result.mismatches.map((item) => (
                <li key={item.id}>
                  <button type="button" className={selected?.id === item.id ? "on" : ""} onClick={() => setPick(item.id)}>{item.message}</button>
                </li>
              ))}
            </ul>
          )}
        </>
      }
    />
  );
}

export function ExtractionLab() {
  const [rPerSquare, setR] = useState(0.08);
  const [cPerArea, setC] = useState(0.02);
  const [coupling, setCoupling] = useState(true);
  const [length, setLength] = useState(1);
  const [width, setWidth] = useState(1);
  const [net, setNet] = useState("OUT");
  const rects = useMemo(() => scaleMetals(inverterTemplate(), length, width), [length, width]);
  const model = { rPerSquare, cPerArea, coupling, contactOhm: 12 };
  const nets = useMemo(() => extractParasitics(rects, model), [rects, rPerSquare, cPerArea, coupling]);
  const baseline = useMemo(() => extractParasitics(inverterTemplate(), { rPerSquare: 0.08, cPerArea: 0.02, coupling: false, contactOhm: 12 }), []);
  const selected = nets.find((item) => item.net === net) ?? nets[0];
  const before = baseline.find((item) => item.net === selected?.net);
  const hot = selected?.shapeIds ?? [];
  return (
    <VlsiGrid
      controls={
        <>
          <Slider label="Metal resistance" value={rPerSquare} min={0.02} max={0.2} step={0.01} text={`${rPerSquare.toFixed(2)} Ω/sq`} onChange={setR} />
          <Slider label="Capacitance model" value={cPerArea} min={0.005} max={0.08} step={0.005} text={`${cPerArea.toFixed(3)} fF/area`} onChange={setC} />
          <Slider label="Wire length scale" value={length} min={0.6} max={2.4} step={0.1} text={`${length.toFixed(1)}×`} onChange={setLength} />
          <Slider label="Wire width scale" value={width} min={0.5} max={2.2} step={0.1} text={`${width.toFixed(1)}×`} onChange={setWidth} />
          <Choice label="Coupling" value={coupling ? "on" : "off"} options={[{ id: "on", label: "Include coupling" }, { id: "off", label: "Grounded cap only" }]} onChange={(value) => setCoupling(value === "on")} />
          <Observe
            change="Lengthen the output metal, or widen it."
            see="Resistance follows length over width. Coupling adds capacitance only while it is enabled."
            why="The extractor sums the metal rectangles of each net from the inverter layout."
            experiment="Set length to 2× and compare OUT against the baseline column."
            takeaway="Parasitics here are layout geometry, then a compact RC delay."
          />
        </>
      }
      stage={
        <>
          <div className="vlsi-stage-head">
            <h2>Extracted RC from the inverter layout</h2>
            <Badge tone="info">{selected?.net ?? "net"}</Badge>
          </div>
          <LayoutSvg rects={rects} hot={hot} onSelect={(id) => {
            const found = nets.find((item) => item.shapeIds.includes(id));
            if (found) setNet(found.net);
          }} />
          <p className="vlsi-callout">Click a metal rectangle to select its net. The RC row uses that net’s shapes.</p>
        </>
      }
      readouts={
        <>
          {selected ? <NetReadout net={selected} before={before} /> : null}
          <h3>Extracted netlist</h3>
          <ul className="vlsi-drc-list">
            {nets.map((item) => (
              <li key={item.net}>
                <button type="button" className={item.net === selected?.net ? "on" : ""} onClick={() => setNet(item.net)}>
                  {item.net} · L {item.length.toFixed(1)} · R {item.resistance.toFixed(2)} · C {item.capacitance.toFixed(2)}
                </button>
              </li>
            ))}
          </ul>
        </>
      }
      footer={
        <div>
          <h3>RC network</h3>
          {selected ? (
            <p className="vlsi-callout">
              {selected.net}: contact R {selected.contactResistance.toFixed(1)} Ω in series with wire R {selected.resistance.toFixed(2)} Ω, then C {selected.capacitance.toFixed(2)} including coupling {selected.coupling.toFixed(3)}. Shapes {selected.shapeIds.join(", ")}.
            </p>
          ) : null}
        </div>
      }
    />
  );
}

function NetReadout({ net, before }: { net: ParasiticNet; before: ParasiticNet | undefined }) {
  return (
    <>
      <Measure label="Length" value={net.length.toFixed(1)} />
      <Measure label="Mean width" value={net.width.toFixed(2)} />
      <Measure label="Resistance" value={`${net.resistance.toFixed(2)} Ω`} hint={before ? `baseline ${before.resistance.toFixed(2)} Ω` : undefined} />
      <Measure label="Capacitance" value={`${net.capacitance.toFixed(2)} fF`} hint={before ? `baseline ${before.capacitance.toFixed(2)} fF` : undefined} />
      <Measure label="RC delay estimate" value={`${net.delay.toFixed(2)}`} hint="0.69 · (R + Rcontact) · C" />
    </>
  );
}
