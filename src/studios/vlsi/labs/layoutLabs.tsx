import { useMemo, useState } from "react";
import { VlsiGrid } from "../shell";
import { Badge, Choice, Measure, Observe, Slider } from "../widgets";
import {
  EDU_RULES,
  INVERTER_STEPS,
  LAYER_LABEL,
  cmosGateLayout,
  devicesFromLayout,
  drcDemo,
  inverterStepShapes,
  inverterTemplate,
  layoutStats,
  pmosInsideWell,
  runDrc,
  snap,
  type LayerId,
  type LayoutRect,
} from "../layoutModel";

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

function LayoutSvg({ rects, hidden, selected, onSelect, focus }: {
  rects: LayoutRect[];
  hidden: LayerId[];
  selected: string | null;
  onSelect: (id: string) => void;
  focus?: string | null;
}) {
  const shown = rects.filter((rect) => !hidden.includes(rect.layer));
  return (
    <svg className="vlsi-layout" viewBox="0 0 100 90" role="img" aria-label="CMOS layout">
      {shown.map((rect) => (
        <rect
          key={rect.id}
          x={rect.x}
          y={rect.y}
          width={rect.w}
          height={rect.h}
          fill={FILL[rect.layer]}
          stroke={rect.id === focus ? "#f87171" : rect.id === selected ? "#f8fafc" : "transparent"}
          strokeWidth={rect.id === selected || rect.id === focus ? 0.8 : 0}
          onClick={() => onSelect(rect.id)}
        />
      ))}
    </svg>
  );
}

function LayerToggles({ hidden, onToggle }: { hidden: LayerId[]; onToggle: (layer: LayerId) => void }) {
  const layers = Object.keys(LAYER_LABEL) as LayerId[];
  return (
    <div className="vlsi-choice" role="group" aria-label="Layer visibility">
      {layers.map((layer) => (
        <button key={layer} type="button" className={hidden.includes(layer) ? "" : "on"} aria-pressed={!hidden.includes(layer)} onClick={() => onToggle(layer)}>
          {LAYER_LABEL[layer]}
        </button>
      ))}
    </div>
  );
}

export function LayoutBasicsLab() {
  const rects = inverterTemplate();
  const [hidden, setHidden] = useState<LayerId[]>([]);
  const [selected, setSelected] = useState<string | null>("poly");
  const [ask, setAsk] = useState<LayerId>("poly");
  const shape = rects.find((rect) => rect.id === selected) ?? null;
  const correct = shape?.layer === ask;
  return (
    <>
      <VlsiGrid
        stage={
          <div className="vlsi-stage">
            <div className="vlsi-stage-head">
              <h2>Inverter layers</h2>
              <Badge tone={correct ? "on" : "warn"}>{correct ? "Layer identified" : `Find ${LAYER_LABEL[ask]}`}</Badge>
            </div>
            <LayoutSvg rects={rects} hidden={hidden} selected={selected} onSelect={setSelected} />
            <p className="vlsi-callout">Poly crossing diffusion is the channel. The N-well holds the PMOS. Contacts join diffusion or poly to metal. Metal1 carries VDD, GND, and the output.</p>
          </div>
        }
        controls={
          <>
            <LayerToggles hidden={hidden} onToggle={(layer) => setHidden((current) => current.includes(layer) ? current.filter((item) => item !== layer) : [...current, layer])} />
            <Choice label="Identify this layer" value={ask} options={[
              { id: "poly", label: "Poly" },
              { id: "pdiff", label: "P-diffusion" },
              { id: "ndiff", label: "N-diffusion" },
              { id: "nwell", label: "N-well" },
              { id: "metal1", label: "Metal1" },
              { id: "contact", label: "Contact" },
            ]} onChange={setAsk} />
          </>
        }
        readouts={
          shape ? (
            <>
              <Measure label="Layer" value={LAYER_LABEL[shape.layer]} />
              <Measure label="Purpose" value={shape.purpose} />
              <Measure label="Net" value={shape.net} />
              <Measure label="Size" value={`${shape.w} × ${shape.h}`} />
              <Measure label="PMOS in well" value={pmosInsideWell(rects) ? "Yes" : "No"} />
              <Measure label="Devices" value={String(devicesFromLayout(rects).length)} hint="Poly over diffusion" />
            </>
          ) : <p>Select a shape.</p>
        }
        footer={
          <Observe
            change="Hide metal, then click the vertical poly finger."
            see="The inspector names the layer, the net, and the size. The prompt checks whether that layer is the one you were asked to find."
            why="A transistor exists only where poly crosses active diffusion. The rest of the picture is routing and wells."
            experiment="Turn the N-well off and back on. The PMOS diffusion is still inside it when the well is visible."
            takeaway="Layout is a stack of layers with rules, not a picture of the schematic."
          />
        }
      />
    </>
  );
}

const STICK = [
  { id: "vdd", name: "VDD", schematic: "PMOS source", stick: "Top rail", layout: "m-vdd" },
  { id: "gnd", name: "GND", schematic: "NMOS source", stick: "Bottom rail", layout: "m-gnd" },
  { id: "poly", name: "Poly A", schematic: "Input", stick: "Gate line", layout: "poly" },
  { id: "out", name: "Output", schematic: "Drains tied", stick: "Output contact", layout: "m-out" },
  { id: "pdiff", name: "P-diffusion", schematic: "PMOS", stick: "P stick", layout: "pdiff" },
  { id: "ndiff", name: "N-diffusion", schematic: "NMOS", stick: "N stick", layout: "ndiff" },
];

export function StickDiagramLab() {
  const [selected, setSelected] = useState("poly");
  const [cell, setCell] = useState<"inv" | "nand">("inv");
  const item = STICK.find((entry) => entry.id === selected) ?? STICK[0]!;
  const rects = cell === "inv" ? inverterTemplate() : cmosGateLayout("nand", true);
  const focus = cell === "inv" ? item.layout : selected === "poly" ? "poly-a" : selected === "out" ? "pdiff" : null;
  return (
    <>
      <VlsiGrid
        stage={
          <div className="vlsi-stage">
            <div className="vlsi-stage-head">
              <h2>Schematic, stick, layout</h2>
              <Badge tone="info">{item.name}</Badge>
            </div>
            <div className="vlsi-triple">
              <section>
                <h3>Schematic</h3>
                <button type="button" className={selected === "poly" ? "on" : ""} onClick={() => setSelected("poly")}>Gate {cell === "nand" ? "A" : "A"}</button>
                <button type="button" className={selected === "out" ? "on" : ""} onClick={() => setSelected("out")}>Output</button>
                <button type="button" className={selected === "vdd" ? "on" : ""} onClick={() => setSelected("vdd")}>VDD</button>
                <button type="button" className={selected === "gnd" ? "on" : ""} onClick={() => setSelected("gnd")}>GND</button>
                <p>{item.schematic}</p>
              </section>
              <section>
                <h3>Stick</h3>
                <svg className="vlsi-layout" viewBox="0 0 160 180" role="img" aria-label="Stick diagram">
                  <line x1="16" y1="18" x2="144" y2="18" stroke={selected === "vdd" ? "#f8fafc" : "#38bdf8"} strokeWidth="6" onClick={() => setSelected("vdd")} />
                  <rect x="28" y="40" width="104" height="14" fill={selected === "pdiff" ? "#fecdd3" : "#be123c"} onClick={() => setSelected("pdiff")} />
                  <rect x="28" y="108" width="104" height="14" fill={selected === "ndiff" ? "#cffafe" : "#0e7490"} onClick={() => setSelected("ndiff")} />
                  <line x1="70" y1="28" x2="70" y2="150" stroke={selected === "poly" ? "#f8fafc" : "#d97706"} strokeWidth="6" onClick={() => setSelected("poly")} />
                  {cell === "nand" ? <line x1="108" y1="28" x2="108" y2="150" stroke="#d97706" strokeWidth="6" onClick={() => setSelected("poly")} /> : null}
                  <line x1="16" y1="162" x2="144" y2="162" stroke={selected === "gnd" ? "#f8fafc" : "#94a3b8"} strokeWidth="6" onClick={() => setSelected("gnd")} />
                  <circle cx="132" cy="78" r="7" fill={selected === "out" ? "#f8fafc" : "#e2e8f0"} onClick={() => setSelected("out")} />
                  <text x="18" y="14" className="vlsi-svg-label">VDD</text>
                  <text x="18" y="158" className="vlsi-svg-label">GND</text>
                  <text x="118" y="74" className="vlsi-svg-label">Y</text>
                </svg>
              </section>
              <section>
                <h3>Layout</h3>
                <LayoutSvg rects={rects} hidden={[]} selected={focus} onSelect={(id) => {
                  const match = STICK.find((entry) => entry.layout === id || id.startsWith(entry.id));
                  if (match) setSelected(match.id);
                }} focus={focus} />
              </section>
            </div>
          </div>
        }
        controls={
          <Choice label="Cell" value={cell} options={[{ id: "inv", label: "Inverter" }, { id: "nand", label: "NAND2" }]} onChange={setCell} />
        }
        readouts={
          <>
            <Measure label="Schematic" value={item.schematic} />
            <Measure label="Stick" value={item.stick} />
            <Measure label="Layout object" value={item.layout} />
            <p>Click poly on the stick and the gate plus the poly shape both highlight. Click output and the shared drain is the selected net.</p>
          </>
        }
        footer={
          <Observe
            change="Select the gate line on the stick, then the output."
            see="The same selection lights the schematic note and the layout shape."
            why="A stick diagram is a shorthand for the same nets the layout draws with layers."
            experiment="Switch to NAND2. Two poly fingers share the diffusion that the inverter used as one channel."
            takeaway="Schematic, stick, and layout are three drawings of one netlist."
          />
        }
      />
    </>
  );
}

export function InverterLayoutLab() {
  const [nudge, setNudge] = useState(0);
  const [history, setHistory] = useState<number[]>([0]);
  const step = history[history.length - 1] ?? 0;
  const rects = useMemo(() => inverterStepShapes(step).map((shape) => (
    shape.id === "poly" ? { ...shape, x: snap(shape.x + nudge) } : shape
  )), [step, nudge]);
  const devices = devicesFromLayout(rects);
  const validated = step >= 8;
  const connected = validated && devices.some((device) => device.kind === "pmos") && devices.some((device) => device.kind === "nmos") && pmosInsideWell(rects);
  const area = rects.reduce((sum, shape) => sum + shape.w * shape.h, 0);
  return (
    <>
      <VlsiGrid
        stage={
          <div className="vlsi-stage">
            <div className="vlsi-stage-head">
              <h2>{INVERTER_STEPS[Math.min(step, INVERTER_STEPS.length - 1)]}</h2>
              <Badge tone={!validated ? "info" : connected ? "on" : "bad"}>{!validated ? `Step ${step + 1} of 9` : connected ? "Layout valid" : "Check poly and well"}</Badge>
            </div>
            <LayoutSvg rects={rects} hidden={[]} selected="poly" onSelect={() => undefined} />
            <p className="vlsi-callout">Reference: input on poly, PMOS in the N-well, NMOS in the substrate, drains tied as the output.</p>
          </div>
        }
        controls={
          <>
            <div className="vlsi-play">
              <button type="button" onClick={() => {
                setHistory((current) => {
                  const last = current[current.length - 1] ?? 0;
                  if (last >= 8) return current;
                  return [...current, last + 1];
                });
              }}>Place next</button>
              <button type="button" onClick={() => setHistory((current) => (current.length <= 1 ? current : current.slice(0, -1)))}>Undo</button>
              <button type="button" onClick={() => { setNudge(0); setHistory([0]); }}>Reset layout</button>
            </div>
            <Slider label="Nudge poly" value={nudge} min={-20} max={20} step={2} text={`${snap(nudge)} grid`} onChange={setNudge} />
            <p>Hint: leave the poly nudge at 0 so the gate crosses both diffusions. Snapping is 2 grid units.</p>
          </>
        }
        readouts={
          <>
            <Measure label="Shapes" value={String(rects.length)} />
            <Measure label="PMOS" value={String(devices.filter((device) => device.kind === "pmos").length)} />
            <Measure label="NMOS" value={String(devices.filter((device) => device.kind === "nmos").length)} />
            <Measure label="PMOS in N-well" value={pmosInsideWell(rects) ? "Yes" : "Not yet"} />
            <Measure label="Area" value={area.toFixed(0)} hint="Sum of placed shape area" />
            <Measure label="Undo depth" value={String(history.length)} />
          </>
        }
        footer={
          <Observe
            change="Place each layer, then slide the poly off the diffusion and validate."
            see="The device count drops to zero when poly no longer crosses active area. Putting it back restores both transistors."
            why="The checker uses the same geometry model as the design-rule lab, not a separate picture."
            experiment="Undo twice and confirm the last two layers disappear."
            takeaway="An inverter layout is complete when both channels exist, the PMOS sits in the well, and input and output are routed."
          />
        }
      />
    </>
  );
}

export function NandNorLayoutLab() {
  const [gate, setGate] = useState<"nand" | "nor">("nand");
  const [shared, setShared] = useState(true);
  const rects = cmosGateLayout(gate, shared);
  const stats = layoutStats(rects);
  const nmos = stats.devices.filter((device) => device.kind === "nmos").length;
  const pmos = stats.devices.filter((device) => device.kind === "pmos").length;
  const expected = nmos === 2 && pmos === 2;
  const parasitic = stats.diffusionBreaks * 0.4 + stats.contacts * 0.15;
  return (
    <>
      <VlsiGrid
        stage={
          <div className="vlsi-stage">
            <div className="vlsi-stage-head">
              <h2>{gate === "nand" ? "NAND2" : "NOR2"} · {shared ? "Shared diffusion" : "Separate islands"}</h2>
              <Badge tone={expected ? "on" : "bad"}>{expected ? "Topology matches" : "Device count mismatch"}</Badge>
            </div>
            <LayoutSvg rects={rects} hidden={[]} selected={null} onSelect={() => undefined} />
            <p className="vlsi-callout">{gate === "nand" ? "NAND pulls down through series NMOS and pulls up through parallel PMOS." : "NOR pulls up through series PMOS and pulls down through parallel NMOS."} Sharing removes a diffusion break between the series devices.</p>
          </div>
        }
        controls={
          <>
            <Choice label="Gate" value={gate} options={[{ id: "nand", label: "NAND2" }, { id: "nor", label: "NOR2" }]} onChange={setGate} />
            <Choice label="Diffusion" value={shared ? "shared" : "naive"} options={[{ id: "shared", label: "Shared diffusion" }, { id: "naive", label: "Naive islands" }]} onChange={(value) => setShared(value === "shared")} />
          </>
        }
        readouts={
          <>
            <Measure label="Area" value={stats.area.toFixed(0)} />
            <Measure label="Diffusion breaks" value={String(stats.diffusionBreaks)} />
            <Measure label="Contacts" value={String(stats.contacts)} />
            <Measure label="Estimated parasitic" value={parasitic.toFixed(2)} hint="Breaks and contacts, educational units" />
            <Measure label="NMOS" value={String(nmos)} />
            <Measure label="PMOS" value={String(pmos)} />
            <Measure label="PMOS in well" value={stats.pInWell ? "Yes" : "No"} />
          </>
        }
        footer={
          <Observe
            change="Toggle naive islands, then switch from NAND to NOR."
            see="Area, breaks, and contacts rise when diffusion is split. NOR puts the series stack on the PMOS side."
            why="Series devices can share the node between them. Parallel devices can share a rail. A break needs contacts and metal to reconnect."
            experiment="Confirm both styles still report two NMOS and two PMOS."
            takeaway="Ordering transistors to share diffusion is the Euler-path idea, measured here as breaks and area."
          />
        }
      />
    </>
  );
}

export function DrcLab() {
  const [polyWidth, setPolyWidth] = useState(1);
  const [metalGap, setMetalGap] = useState(1);
  const [enclosure, setEnclosure] = useState(0);
  const [ran, setRan] = useState(true);
  const [focus, setFocus] = useState<string | null>(null);
  const rects = drcDemo(polyWidth, metalGap, enclosure);
  const violations = ran ? runDrc(rects) : [];
  const selected = violations.find((item) => item.id === focus || item.shapeId === focus) ?? violations[0] ?? null;
  return (
    <>
      <VlsiGrid
        stage={
          <div className="vlsi-stage">
            <div className="vlsi-stage-head">
              <h2>{EDU_RULES.label}</h2>
              <Badge tone={violations.length === 0 ? "on" : "bad"}>{violations.length === 0 ? "Pass" : `${violations.length} violations`}</Badge>
            </div>
            <LayoutSvg rects={rects} hidden={[]} selected={selected?.shapeId ?? null} onSelect={setFocus} focus={selected?.shapeId ?? null} />
            <ul className="vlsi-drc-list">
              {violations.map((item) => (
                <li key={item.id}>
                  <button type="button" className={item.id === selected?.id ? "on" : ""} onClick={() => setFocus(item.id)}>{item.rule}</button>
                </li>
              ))}
            </ul>
          </div>
        }
        controls={
          <>
            <div className="vlsi-play">
              <button type="button" onClick={() => setRan(true)}>Run DRC</button>
            </div>
            <Slider label="Poly width" value={polyWidth} min={1} max={6} step={1} text={`${polyWidth}`} onChange={(value) => { setPolyWidth(value); setRan(false); }} />
            <Slider label="Metal spacing" value={metalGap} min={0} max={6} step={1} text={`${metalGap}`} onChange={(value) => { setMetalGap(value); setRan(false); }} />
            <Slider label="Contact enclosure" value={enclosure} min={0} max={3} step={1} text={`${enclosure}`} onChange={(value) => { setEnclosure(value); setRan(false); }} />
            <p>Rules: poly width {EDU_RULES.polyWidth}, metal space {EDU_RULES.metalSpace}, contact enclosure {EDU_RULES.contactEnclose}. These are educational units, not a foundry deck.</p>
          </>
        }
        readouts={
          selected ? (
            <>
              <Measure label="Rule" value={selected.rule} />
              <Measure label="Measured" value={selected.measured.toFixed(1)} />
              <Measure label="Required" value={selected.required.toFixed(1)} />
              <Measure label="Result" value="Fail" />
              <p>{selected.suggestion}</p>
            </>
          ) : <Measure label="Result" value={ran ? "Pass" : "Not run"} />
        }
        footer={
          <Observe
            change="Widen poly, separate the metal, enclose the contact, then run DRC again."
            see="Each failing rule leaves the list when its measured value meets the requirement. The highlighted shape is the one you selected."
            why="Spacing is the gap between shapes on one layer. Enclosure is how far metal and diffusion extend past a contact."
            experiment="Set only the metal gap back to 1 and confirm a single spacing error returns."
            takeaway="DRC measures geometry. Layout versus schematic is a later lab."
          />
        }
      />
    </>
  );
}
