import { useState } from "react";
import { finfetMetrics, gaaMetrics, MATERIALS, planarMetrics, SCALE_NODES, scalingNode } from "../processModel";
import { VlsiGrid } from "../shell";
import { Badge, Choice, Measure, Observe, Slider } from "../widgets";

export function FinfetLab() {
  const [kind, setKind] = useState<"planar" | "finfet">("finfet");
  const [height, setHeight] = useState(40);
  const [width, setWidth] = useState(8);
  const [fins, setFins] = useState(2);
  const [vgs, setVgs] = useState(0.8);
  const [vds, setVds] = useState(0.6);
  const metrics = kind === "finfet" ? finfetMetrics(fins, height, width) : planarMetrics(width * 4);
  const on = vgs >= 0.45;
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Device" value={kind} options={[{ id: "planar", label: "Planar" }, { id: "finfet", label: "FinFET" }]} onChange={setKind} />
          <Slider label="Fin height" value={height} min={16} max={70} step={2} text={`${height} nm`} onChange={setHeight} />
          <Slider label="Fin width" value={width} min={4} max={20} step={1} text={`${width} nm`} onChange={setWidth} />
          <Slider label="Fins" value={fins} min={1} max={5} step={1} text={`${fins}`} onChange={setFins} />
          <Slider label="Gate voltage" value={vgs} min={0} max={1} step={0.05} text={`${vgs.toFixed(2)} V`} onChange={setVgs} />
          <Slider label="Drain voltage" value={vds} min={0} max={1} step={0.05} text={`${vds.toFixed(2)} V`} onChange={setVds} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 320 200" role="img" aria-label={kind === "finfet" ? "FinFET with a wrapped gate" : "Planar MOSFET"}>
          <rect x="20" y="150" width="280" height="30" fill={MATERIALS.silicon.color} />
          <text x="28" y="170" fill="#e2e8f0">Substrate</text>
          {kind === "planar" ? (
            <>
              <rect x="70" y="128" width="40" height="22" fill={MATERIALS.ndiff.color} />
              <rect x="210" y="128" width="40" height="22" fill={MATERIALS.ndiff.color} />
              <text x="74" y="143" fill="#0f172a" fontSize="10">Source</text>
              <text x="216" y="143" fill="#0f172a" fontSize="10">Drain</text>
              <rect x="116" y="124" width="88" height="6" fill={MATERIALS.oxide.color} />
              <rect x="116" y="104" width="88" height="20" fill={MATERIALS.poly.color} />
              <text x="140" y="118" fill="#0f172a" fontSize="10">Gate</text>
              <rect x="120" y="132" width="80" height="8" fill={on ? "#22d3ee" : "#1e293b"} />
            </>
          ) : (
            <>
              <rect x="36" y="132" width="36" height="18" fill={MATERIALS.ndiff.color} />
              <rect x="248" y="132" width="36" height="18" fill={MATERIALS.ndiff.color} />
              <text x="38" y="126" fill="#e2e8f0" fontSize="10">Source</text>
              <text x="250" y="126" fill="#e2e8f0" fontSize="10">Drain</text>
              {Array.from({ length: fins }, (_, index) => {
                const x = 86 + index * 32;
                const finH = Math.min(78, height * 0.9);
                const finW = Math.max(8, width * 0.7);
                const y = 150 - finH;
                return (
                  <g key={index}>
                    <rect x={x - 6} y={y + 8} width={finW + 12} height={finH * 0.55} fill={MATERIALS.poly.color} />
                    <rect x={x - 3} y={y + 12} width={finW + 6} height={finH * 0.42} fill={MATERIALS.oxide.color} />
                    <rect x={x} y={y} width={finW} height={finH} fill={MATERIALS.silicon.color} stroke="#e2e8f0" />
                    <rect x={x + 1} y={y + 16} width={Math.max(4, finW - 2)} height="7" fill={on ? "#22d3ee" : "#0f172a"} />
                  </g>
                );
              })}
            </>
          )}
          <text x="28" y="28" fill="#e2e8f0">{on ? "Channel on" : "Channel off"} · VDS {vds.toFixed(2)} V</text>
        </svg>
      }
      readouts={
        <>
          <Measure label="Effective width" value={`${metrics.weff.toFixed(0)} nm`} />
          <Measure label="Relative drive" value={metrics.drive.toFixed(0)} />
          <Measure label="Leakage trend" value={metrics.leak.toFixed(2)} />
          <Badge tone={on ? "on" : "off"}>{kind === "finfet" ? "Gate wraps the fin" : "Gate covers one surface"}</Badge>
          <Observe change="Switch from planar to FinFET, then add fins." see="Effective width and relative drive rise with each fin." why="A planar gate controls the top surface. A FinFET gate controls the sides and the top, so Weff is about 2H + W per fin." experiment="Make the fin taller and narrower and watch the leakage trend fall." takeaway="Numbers here are normalized educational metrics, not a foundry model." />
        </>
      }
    />
  );
}

export function GaafetLab() {
  const [view, setView] = useState<"section" | "perspective" | "exploded">("section");
  const [sheets, setSheets] = useState(3);
  const [width, setWidth] = useState(24);
  const [thickness, setThickness] = useState(6);
  const [spacing, setSpacing] = useState(10);
  const [vgs, setVgs] = useState(0.7);
  const metrics = gaaMetrics(sheets, width, thickness);
  const on = vgs >= 0.4;
  const gap = view === "exploded" ? spacing + 14 : spacing;
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="View" value={view} options={[{ id: "section", label: "Section" }, { id: "perspective", label: "Perspective" }, { id: "exploded", label: "Exploded" }]} onChange={setView} />
          <Slider label="Nanosheets" value={sheets} min={1} max={4} step={1} text={`${sheets}`} onChange={setSheets} />
          <Slider label="Sheet width" value={width} min={12} max={40} step={1} text={`${width} nm`} onChange={setWidth} />
          <Slider label="Sheet thickness" value={thickness} min={3} max={12} step={1} text={`${thickness} nm`} onChange={setThickness} />
          <Slider label="Stack spacing" value={spacing} min={6} max={18} step={1} text={`${spacing} nm`} onChange={setSpacing} />
          <Slider label="Gate voltage" value={vgs} min={0} max={1} step={0.05} text={`${vgs.toFixed(2)} V`} onChange={setVgs} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 320 210" role="img" aria-label="Nanosheet gate-all-around transistor">
          {Array.from({ length: sheets }, (_, index) => {
            const pitch = Math.min(thickness + gap, 150 / sheets);
            const y = 32 + index * pitch;
            const shift = view === "perspective" ? index * 8 : 0;
            const thick = Math.min(thickness, Math.max(4, pitch - 6));
            return (
              <g key={index}>
                <rect x={70 + shift} y={y - 3} width={width + 70} height={thick + 6} rx="6" fill={MATERIALS.poly.color} />
                <rect x={88 + shift} y={y} width={width + 34} height={thick} rx="3" fill={on ? "#22d3ee" : MATERIALS.silicon.color} />
                {on ? <animate attributeName="opacity" values="0.55;1;0.55" dur="1.6s" repeatCount="indefinite" /> : null}
              </g>
            );
          })}
          <text x="16" y="24" fill="#e2e8f0">Gate surrounds each sheet</text>
        </svg>
      }
      readouts={
        <>
          <Measure label="Effective width" value={`${metrics.weff.toFixed(0)} nm`} />
          <Measure label="Relative drive" value={metrics.drive.toFixed(0)} />
          <Measure label="Leakage trend" value={metrics.leak.toFixed(2)} />
          <Badge tone={on ? "on" : "off"}>{on ? "Sheets conducting" : "Sheets off"}</Badge>
          <Observe change="Add a nanosheet or raise the gate." see="Each sheet adds a full perimeter, so effective width climbs and the sheets light when the gate is high." why="The gate wraps every sheet, which is stronger electrostatic control than a fin's three sides." experiment="Explode the stack, then return to the section view." takeaway="Compare this with the FinFET lab. Both metrics are educational, not a process qualification." />
        </>
      }
    />
  );
}

export function ScalingLab() {
  const [index, setIndex] = useState(7);
  const node = scalingNode(SCALE_NODES[index]?.id ?? "16");
  const maxDensity = SCALE_NODES[SCALE_NODES.length - 1]?.density ?? 1;
  return (
    <VlsiGrid
      controls={
        <>
          <Slider label="Technology node" value={index} min={0} max={SCALE_NODES.length - 1} step={1} text={node.label} onChange={setIndex} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 340 200" role="img" aria-label="Technology scaling timeline">
          {SCALE_NODES.map((item, itemIndex) => (
            <g key={item.id}>
              <circle cx={18 + itemIndex * 25} cy={36} r={itemIndex === index ? 7 : 4} fill={item.device === "gaa" ? "#22d3ee" : item.device === "finfet" ? "#fbbf24" : "#94a3b8"} />
              {itemIndex < SCALE_NODES.length - 1 ? <line x1={22 + itemIndex * 25} y1="36" x2={36 + itemIndex * 25} y2="36" stroke="#334155" /> : null}
            </g>
          ))}
          <rect x="40" y="78" width={(node.density / maxDensity) * 250} height="16" fill="#22d3ee" />
          <text x="40" y="74" fill="#e2e8f0">Relative density</text>
          <rect x="40" y="118" width={(node.wire / 1.6) * 220} height="16" fill="#fbbf24" />
          <text x="40" y="114" fill="#e2e8f0">Interconnect challenge</text>
          <text x="40" y="168" fill="#e2e8f0">{node.device === "planar" ? "Planar MOS" : node.device === "finfet" ? "FinFET" : "GAAFET / nanosheet"}</text>
          {node.device === "planar" ? (
            <g>
              <rect x="250" y="150" width="70" height="14" fill={MATERIALS.silicon.color} />
              <rect x="268" y="140" width="34" height="10" fill={MATERIALS.poly.color} />
            </g>
          ) : null}
          {node.device === "finfet" ? (
            <g>
              <rect x="250" y="158" width="70" height="10" fill={MATERIALS.silicon.color} />
              {[0, 1, 2].map((fin) => <rect key={fin} x={258 + fin * 18} y="138" width="8" height="20" fill={MATERIALS.silicon.color} stroke={MATERIALS.poly.color} />)}
            </g>
          ) : null}
          {node.device === "gaa" ? (
            <g>
              {[0, 1, 2].map((sheet) => (
                <g key={sheet}>
                  <rect x="258" y={136 + sheet * 12} width="54" height="8" rx="3" fill={MATERIALS.poly.color} />
                  <rect x="268" y={138 + sheet * 12} width="34" height="4" fill="#22d3ee" />
                </g>
              ))}
            </g>
          ) : null}
        </svg>
      }
      readouts={
        <>
          <Measure label="Device" value={node.device === "gaa" ? "GAAFET" : node.device === "finfet" ? "FinFET" : "Planar"} />
          <Measure label="Relative VDD" value={`${node.vdd.toFixed(2)} V`} />
          <Measure label="Leakage challenge" value={node.leak.toFixed(2)} />
          <Measure label="Power-density challenge" value={node.power.toFixed(2)} />
          <Badge tone="info">{node.label}</Badge>
          <Observe change="Scrub from 180 nm toward the 2 nm conceptual node." see="The device family changes from planar to FinFET to nanosheet, and the density bar grows." why="Shorter gates made planar leakage hard to control. Fins, then full wrap-around sheets, restored gate control while wires became a larger share of delay." experiment="Stop on 22/20 nm, then on 16/14 nm." takeaway="These are normalized teaching trends, not a foundry roadmap." />
        </>
      }
    />
  );
}
