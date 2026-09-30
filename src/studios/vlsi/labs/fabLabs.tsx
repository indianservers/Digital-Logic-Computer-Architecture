import { useState } from "react";
import {
  FAB_STEPS,
  MATERIALS,
  cmpSurface,
  etchProfile,
  fabStack,
  filmGrowth,
  implantProfile,
  resistPattern,
  wellFit,
  type MaterialId,
  type ProcessLayer,
} from "../processModel";
import { VlsiGrid } from "../shell";
import { Badge, Chart, Choice, Measure, Observe, PlayControls, Slider, useTicker } from "../widgets";

function CrossSection({ layers, label }: { layers: ProcessLayer[]; label: string }) {
  return (
    <svg className="vlsi-layout" viewBox="0 0 320 210" role="img" aria-label={label}>
      {layers.map((layer) => (
        <rect key={layer.id} x={layer.x} y={layer.y} width={layer.w} height={layer.h} fill={MATERIALS[layer.material].color} stroke="#0f172a" />
      ))}
      {layers.map((layer, index) => {
        const labelY = layer.y + Math.min(12, Math.max(8, layer.h - 2));
        const covered = layers.slice(index + 1).some((other) => other.x < layer.x + 64 && other.x + other.w > layer.x + 6 && other.y < labelY && other.y + other.h > layer.y + 2);
        if (covered || layer.w < 48 || layer.h < 10) return null;
        return <text key={`${layer.id}-label`} x={layer.x + 4} y={labelY} fill="#0f172a" fontSize="9">{layer.label}</text>;
      })}
    </svg>
  );
}

export function FabricationLab() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hide, setHide] = useState<MaterialId | "none">("none");
  const current = FAB_STEPS[step] ?? FAB_STEPS[0]!;
  const layers = fabStack(step).filter((layer) => layer.material !== hide);
  useTicker(playing, () => setStep((value) => (value >= FAB_STEPS.length - 1 ? 0 : value + 1)), 900);
  return (
    <VlsiGrid
      controls={
        <>
          <PlayControls playing={playing} onToggle={() => setPlaying((value) => !value)} onStep={() => setStep((value) => Math.min(FAB_STEPS.length - 1, value + 1))} />
          <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))}>Previous step</button>
          <button type="button" onClick={() => { setPlaying(false); setStep(0); }}>Restart</button>
          <Choice label="Hide a material" value={hide} options={[{ id: "none", label: "Show all" }, { id: "oxide", label: "Hide oxide" }, { id: "metal", label: "Hide metal" }, { id: "resist", label: "Hide resist" }]} onChange={setHide} />
        </>
      }
      stage={<CrossSection layers={layers} label={`CMOS fabrication step ${current.title}`} />}
      readouts={
        <>
          <Measure label="Step" value={`${step + 1} / ${FAB_STEPS.length}`} />
          <Measure label="Process" value={current.title} />
          <Measure label="Added" value={current.adds} />
          <Measure label="Removed" value={current.removes} />
          <Measure label="Mask" value={current.mask} />
          <Badge tone="info">{current.action}</Badge>
          <Observe change="Step or play from the bare wafer through passivation." see="Each step adds or removes a layer in the cross-section." why="This is a simplified CMOS sequence: oxide, pattern, well, gate, source and drain, then contacts and metal." experiment="Hide the oxide and find which steps still show silicon features." takeaway="Educational process model. It is not a foundry recipe." />
        </>
      }
    />
  );
}

export function LithographyLab() {
  const stages = ["Coat", "Soft bake", "Align", "Expose", "Develop", "Transfer"] as const;
  const [stage, setStage] = useState(4);
  const [kind, setKind] = useState<"positive" | "negative">("positive");
  const [dose, setDose] = useState(0.8);
  const [offset, setOffset] = useState(0);
  const [feature, setFeature] = useState(28);
  const mask = [false, true, true, false, true, false];
  const retained = resistPattern(kind, dose, mask);
  const name = stages[stage] ?? "Develop";
  return (
    <VlsiGrid
      controls={
        <>
          <Slider label="Stage" value={stage} min={0} max={stages.length - 1} step={1} text={name} onChange={setStage} />
          <Choice label="Resist" value={kind} options={[{ id: "positive", label: "Positive" }, { id: "negative", label: "Negative" }]} onChange={setKind} />
          <Slider label="Exposure dose" value={dose} min={0.1} max={1} step={0.05} text={dose.toFixed(2)} onChange={setDose} />
          <Slider label="Alignment offset" value={offset} min={-20} max={20} step={1} text={`${offset} nm`} onChange={setOffset} />
          <Slider label="Feature size" value={feature} min={12} max={48} step={2} text={`${feature} nm`} onChange={setFeature} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 320 180" role="img" aria-label="Mask, exposure, and developed resist">
          <rect x="20" y="130" width="280" height="22" fill={MATERIALS.silicon.color} />
          {stage >= 5 ? <rect x="20" y="118" width="280" height="12" fill={MATERIALS.oxide.color} /> : null}
          {stage < 4 ? <rect x={24 + offset * 0.4} y="96" width="270" height="22" fill={MATERIALS.resist.color} opacity={stage === 1 ? 0.7 : 1} /> : null}
          {stage >= 4 ? retained.map((stay, index) => (
            <rect key={index} x={24 + index * 46 + offset * 0.4} y="96" width={Math.max(8, feature * 0.7)} height="22" fill={stay ? MATERIALS.resist.color : "transparent"} stroke="#f472b6" />
          )) : null}
          {stage >= 5 ? retained.map((stay, index) => (
            stay ? null : <rect key={`etch-${index}`} x={28 + index * 46 + offset * 0.4} y="118" width={Math.max(6, feature * 0.45)} height="12" fill="#0f172a" />
          )) : null}
          {stage >= 2 ? mask.map((clear, index) => (
            <rect key={`mask-${index}`} x={24 + index * 46} y="36" width="36" height="16" fill={clear ? "#fef08a" : "#111827"} stroke="#e2e8f0" />
          )) : null}
          {stage === 3 ? mask.map((clear, index) => (
            clear && dose >= 0.35 ? <line key={`light-${index}`} x1={42 + index * 46} y1="52" x2={42 + index * 46 + offset * 0.4} y2="96" stroke="#fef08a" strokeWidth="2" /> : null
          )) : null}
          <text x="24" y="24" fill="#e2e8f0">{name}</text>
        </svg>
      }
      readouts={
        <>
          <Measure label="Stage" value={name} />
          <Measure label="Pattern kept" value={retained.map((stay) => (stay ? "1" : "0")).join(" ")} />
          <Measure label="Openings left" value={`${stage >= 4 ? retained.filter((stay) => !stay).length : 0}`} />
          <Measure label="Dose" value={dose >= 0.35 ? "Enough to develop" : "Underexposed"} />
          <Badge tone={Math.abs(offset) > 8 ? "warn" : "on"}>{Math.abs(offset) > 8 ? "Misaligned" : "Aligned"}</Badge>
          <Observe change="Advance the stage, flip the resist, then slide the alignment." see="Positive and negative resists keep opposite parts of the same mask. Offset slides the resist and the exposure relative to the mask." why="Positive resist leaves where it was not exposed. Negative resist leaves where it was exposed. Transfer etches the openings into oxide." experiment="Drop the dose below 0.35 and develop." takeaway="Feature size changes the drawn opening. This is not a scanner model." />
        </>
      }
    />
  );
}

export function ImplantLab() {
  const [dopant, setDopant] = useState<"n" | "p">("n");
  const [dose, setDose] = useState(1);
  const [energy, setEnergy] = useState(40);
  const [anneal, setAnneal] = useState(0.3);
  const profile = implantProfile(energy, dose, anneal);
  const peak = Math.max(...profile.points.map((point) => point.concentration), 0.01);
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Dopant" value={dopant} options={[{ id: "n", label: "N-type" }, { id: "p", label: "P-type" }]} onChange={setDopant} />
          <Slider label="Dose" value={dose} min={0.2} max={3} step={0.1} text={dose.toFixed(1)} onChange={setDose} />
          <Slider label="Implant energy" value={energy} min={10} max={120} step={5} text={`${energy} keV`} onChange={setEnergy} />
          <Slider label="Anneal" value={anneal} min={0} max={1} step={0.05} text={anneal.toFixed(2)} onChange={setAnneal} />
        </>
      }
      stage={
        <div className="vlsi-split">
          <svg className="vlsi-layout" viewBox="0 0 160 200" role="img" aria-label="Ions entering silicon">
            <rect x="16" y="70" width="120" height="100" fill={MATERIALS.silicon.color} />
            {Array.from({ length: 6 }, (_, index) => (
              <circle key={index} cx={40 + index * 14} r="3" fill={dopant === "n" ? MATERIALS.ndiff.color : MATERIALS.pdiff.color}>
                <animate attributeName="cy" values={`20;${80 + profile.depth * 40}`} dur={`${1.2 + index * 0.15}s`} repeatCount="indefinite" />
              </circle>
            ))}
          </svg>
          <Chart series={[{ name: dopant, color: dopant === "n" ? "#38bdf8" : "#f9a8d4", points: profile.points.map((point) => ({ x: point.depth, y: point.concentration })) }]} xMax={profile.points[profile.points.length - 1]?.depth ?? 1} yMax={peak} xLabel="Depth" yLabel="Conc." ariaLabel="Dopant concentration versus depth" />
        </div>
      }
      readouts={
        <>
          <Measure label="Projected range" value={`${profile.depth.toFixed(2)} µm`} />
          <Measure label="Peak" value={peak.toFixed(2)} />
          <Badge tone="info">{dopant === "n" ? "Donors" : "Acceptors"}</Badge>
          <Observe change="Raise implant energy, then raise the anneal." see="The peak moves deeper, and anneal spreads the Gaussian." why="The educational profile is a Gaussian whose range grows with energy and whose width grows with anneal." experiment="Swap N-type and P-type. The shape stays; the species changes." takeaway="Not a calibrated implant deck." />
        </>
      }
    />
  );
}

export function WellLab() {
  const [well, setWell] = useState<"n" | "p" | "twin">("n");
  const [depth, setDepth] = useState(1);
  const [dose, setDose] = useState(1);
  const [device, setDevice] = useState<"pmos" | "nmos">("pmos");
  const [region, setRegion] = useState<"well" | "substrate">("well");
  const fit = wellFit(well, device, region);
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Well" value={well} options={[{ id: "n", label: "N-well" }, { id: "p", label: "P-well" }, { id: "twin", label: "Twin-well" }]} onChange={setWell} />
          <Slider label="Drive-in depth" value={depth} min={0.4} max={2} step={0.1} text={`${depth.toFixed(1)} µm`} onChange={setDepth} />
          <Slider label="Dose" value={dose} min={0.2} max={2} step={0.1} text={dose.toFixed(1)} onChange={setDose} />
          <Choice label="Device" value={device} options={[{ id: "pmos", label: "PMOS" }, { id: "nmos", label: "NMOS" }]} onChange={setDevice} />
          <Choice label="Place in" value={region} options={[{ id: "well", label: "Well" }, { id: "substrate", label: "Substrate" }]} onChange={setRegion} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 320 180" role="img" aria-label="Well cross-section">
          <rect x="20" y="70" width="280" height="80" fill={MATERIALS.silicon.color} />
          {well !== "p" ? <rect x="160" y={150 - depth * 30} width="120" height={depth * 30} fill={MATERIALS.nwell.color} opacity={0.45 + dose * 0.2} /> : null}
          {well !== "n" ? <rect x="40" y={150 - depth * 30} width="110" height={depth * 30} fill={MATERIALS.pwell.color} opacity={0.45 + dose * 0.2} /> : null}
          <rect x={region === "substrate" ? (well === "p" ? 200 : 60) : well === "p" || (well === "twin" && device === "nmos") ? 70 : 190} y="48" width="36" height="22" fill={device === "pmos" ? MATERIALS.pdiff.color : MATERIALS.ndiff.color} />
          <text x="28" y="28" fill="#e2e8f0">{fit.note}</text>
        </svg>
      }
      readouts={
        <>
          <Badge tone={fit.ok ? "on" : "bad"}>{fit.ok ? "Legal placement" : "Wrong well"}</Badge>
          <Measure label="Well" value={well} />
          <Observe change="Put a PMOS in the substrate of an N-well flow." see="The badge turns to a warning and the note says the device is in the wrong well." why="PMOS needs an N-type body. NMOS needs a P-type body. Twin-well provides both." experiment="Switch to twin-well and place either device." takeaway="The N-well is the PMOS-compatible region in this educational flow." />
        </>
      }
    />
  );
}

export function OxidationLab() {
  const [method, setMethod] = useState<"oxidation" | "cvd" | "pvd">("oxidation");
  const [material, setMaterial] = useState<"oxide" | "nitride" | "poly" | "metal">("oxide");
  const [time, setTime] = useState(6);
  const [temp, setTemp] = useState(900);
  const film = filmGrowth(method, time, temp);
  const color = material === "oxide" ? MATERIALS.oxide.color : material === "nitride" ? MATERIALS.nitride.color : material === "poly" ? MATERIALS.poly.color : MATERIALS.metal.color;
  const grown = Math.min(70, film.thickness * 40);
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Method" value={method} options={[{ id: "oxidation", label: "Oxidation" }, { id: "cvd", label: "CVD" }, { id: "pvd", label: "PVD" }]} onChange={setMethod} />
          <Choice label="Material" value={material} options={[{ id: "oxide", label: "SiO2" }, { id: "nitride", label: "Si3N4" }, { id: "poly", label: "Poly" }, { id: "metal", label: "Metal" }]} onChange={setMaterial} />
          <Slider label="Time" value={time} min={1} max={20} step={1} text={`${time} min`} onChange={setTime} />
          <Slider label="Temperature" value={temp} min={400} max={1100} step={50} text={`${temp} °C`} onChange={setTemp} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 320 180" role="img" aria-label="Film growth on silicon">
          <rect x="40" y={120 + (method === "oxidation" ? film.consumed * 12 : 0)} width="240" height="40" fill={MATERIALS.silicon.color} />
          <rect x="40" y={120 - grown} width="240" height={grown} fill={color} />
          <text x="40" y="28" fill="#e2e8f0">{method === "oxidation" ? "Oxide consumes silicon" : "Film added on top"}</text>
        </svg>
      }
      readouts={
        <>
          <Measure label="Thickness" value={`${film.thickness.toFixed(2)} µm`} />
          <Measure label="Growth rate" value={`${film.rate.toFixed(3)} µm/min`} />
          <Measure label="Silicon consumed" value={`${film.consumed.toFixed(2)} µm`} />
          <Observe change="Increase time, and for oxidation raise temperature." see="The film gets thicker. Oxidation also eats into the silicon. CVD and PVD only add material." why="Thermal oxide grows by consuming silicon. Deposition stacks a film on the existing surface." experiment="Switch from oxidation to CVD at the same time." takeaway="Rates are normalized. They are not a Deal–Grove calibration." />
        </>
      }
    />
  );
}

export function EtchLab() {
  const [mode, setMode] = useState<"isotropic" | "anisotropic">("anisotropic");
  const [time, setTime] = useState(2);
  const [rate, setRate] = useState(0.35);
  const [opening, setOpening] = useState(40);
  const [selectivity, setSelectivity] = useState(1);
  const etch = etchProfile(mode, time, rate, selectivity, 1);
  const depth = Math.min(70, etch.vertical * 36);
  const side = Math.min(30, etch.undercut * 24);
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Etch" value={mode} options={[{ id: "anisotropic", label: "Anisotropic" }, { id: "isotropic", label: "Isotropic" }]} onChange={setMode} />
          <Slider label="Time" value={time} min={0.4} max={6} step={0.2} text={time.toFixed(1)} onChange={setTime} />
          <Slider label="Etch rate" value={rate} min={0.1} max={0.8} step={0.05} text={rate.toFixed(2)} onChange={setRate} />
          <Slider label="Mask opening" value={opening} min={16} max={80} step={2} text={`${opening}`} onChange={setOpening} />
          <Slider label="Selectivity" value={selectivity} min={0.3} max={1.4} step={0.1} text={selectivity.toFixed(1)} onChange={setSelectivity} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 320 180" role="img" aria-label="Etch profile under a mask">
          <rect x="40" y="50" width="240" height="90" fill={MATERIALS.oxide.color} />
          <rect x="70" y="30" width="70" height="20" fill={MATERIALS.resist.color} />
          <rect x={150 + opening * 0.2} y="30" width="70" height="20" fill={MATERIALS.resist.color} />
          <path d={`M${140 - side} 50 L${140 + opening * 0.15} 50 L${140 + opening * 0.15 + side} ${50 + depth} L${140 - side - side} ${50 + depth} Z`} fill="#0f172a" />
        </svg>
      }
      readouts={
        <>
          <Measure label="Vertical etch" value={etch.vertical.toFixed(2)} />
          <Measure label="Undercut" value={etch.undercut.toFixed(2)} />
          <Badge tone={etch.state === "target" ? "on" : "warn"}>{etch.state === "under" ? "Under-etch" : etch.state === "over" ? "Over-etch" : "Near target"}</Badge>
          <Observe change="Switch to isotropic and lengthen the etch." see="Isotropic etch undercuts the mask. Anisotropic etch stays mostly vertical. A long etch crosses into over-etch." why="Isotropic chemistry attacks sideways. A directional etch prefers the open floor." experiment="Lower selectivity and watch the vertical etch shrink." takeaway="Educational profile, not a plasma recipe." />
        </>
      }
    />
  );
}

export function CmpLab() {
  const [time, setTime] = useState(1.2);
  const [rate, setRate] = useState(0.45);
  const [selectivity, setSelectivity] = useState(1);
  const [roughness, setRoughness] = useState(1);
  const surface = cmpSurface(time, rate * selectivity, roughness);
  const yOf = (height: number) => 120 - height * 40;
  const line = (samples: number[]) => samples.map((height, index) => `${index === 0 ? "M" : "L"}${40 + index * 60},${yOf(height)}`).join(" ");
  return (
    <VlsiGrid
      controls={
        <>
          <Slider label="Polish time" value={time} min={0.2} max={5} step={0.2} text={time.toFixed(1)} onChange={setTime} />
          <Slider label="Removal rate" value={rate} min={0.1} max={1} step={0.05} text={rate.toFixed(2)} onChange={setRate} />
          <Slider label="Selectivity" value={selectivity} min={0.4} max={1.6} step={0.1} text={selectivity.toFixed(1)} onChange={setSelectivity} />
          <Slider label="Starting topography" value={roughness} min={0.3} max={1.6} step={0.1} text={roughness.toFixed(1)} onChange={setRoughness} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 320 180" role="img" aria-label="CMP before and after height">
          <path d={line(surface.before)} fill="none" stroke="#94a3b8" strokeWidth="3" />
          <path d={line(surface.after)} fill="none" stroke="#22d3ee" strokeWidth="3" />
          <rect x="30" y="132" width="250" height="10" fill="#78716c" />
          <text x="30" y="28" fill="#94a3b8">Before</text>
          <text x="100" y="28" fill="#22d3ee">After</text>
        </svg>
      }
      readouts={
        <>
          <Measure label="Height variation" value={surface.variation.toFixed(2)} />
          <Badge tone={surface.state === "target" ? "on" : "warn"}>{surface.state === "dish" ? "Dishing" : surface.state === "under" ? "Under-polish" : "Near target"}</Badge>
          <Observe change="Polish longer, then keep going past the tallest peak." see="Variation falls as peaks come down. Extra time dishes the low regions and the spread can grow again." why="High spots see more pad pressure in this model, so they polish faster until the surface is flat." experiment="Start with a rougher surface and a short polish." takeaway="Educational CMP. Not a slurry or pad model." />
        </>
      }
    />
  );
}
