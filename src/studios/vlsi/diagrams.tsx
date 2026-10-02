import type { CapState, MosRegion, Polarity } from "./engine";

export function MosSection({ polarity, channel, region, vgs, vds, vth, flowing }: {
  polarity: Polarity;
  channel: number;
  region: MosRegion;
  vgs: number;
  vds: number;
  vth: number;
  flowing: boolean;
}) {
  const n = polarity === "nmos";
  const body = n ? "#1e3a5f" : "#4a2030";
  const doped = n ? "#38bdf8" : "#fb7185";
  const carriers = n ? "#7dd3fc" : "#fda4af";
  const label = n ? "P-type body" : "N-type body";
  const well = n ? "n+" : "p+";
  return (
    <svg className="vlsi-device" viewBox="0 0 460 280" role="img" aria-label={`${polarity} cross-section, ${region}`}>
      <rect x="40" y="150" width="380" height="90" rx="8" fill={body} />
      <text x="230" y="228" textAnchor="middle" fill="#dbeafe" fontSize="13">{label}</text>
      <rect x="70" y="132" width="70" height="28" rx="3" fill={doped} />
      <rect x="320" y="132" width="70" height="28" rx="3" fill={doped} />
      <text x="105" y="150" textAnchor="middle" fontSize="12" fill="#082f49">{well}</text>
      <text x="355" y="150" textAnchor="middle" fontSize="12" fill="#082f49">{well}</text>
      <rect x="140" y="124" width="180" height="8" fill="#bae6fd" />
      <text x="230" y="118" textAnchor="middle" fontSize="11" fill="#e0f2fe">SiO₂</text>
      <rect x="150" y="78" width="160" height="42" rx="4" fill="#fbbf24" />
      <text x="230" y="103" textAnchor="middle" fontSize="13" fill="#451a03">Gate</text>
      <path d={`M 150 132 H 310`} stroke={n ? "#4ade80" : "#fb7185"} strokeWidth={4 + channel * 8} opacity={0.25 + channel * 0.75} fill="none" />
      {channel > 0.08 ? <text x="230" y="176" textAnchor="middle" fontSize="12" fill="#bbf7d0">{region === "saturation" ? "Pinched channel" : "Inversion channel"}</text> : <text x="230" y="176" textAnchor="middle" fontSize="12" fill="#94a3b8">No inversion channel</text>}
      <text x="105" y="128" textAnchor="middle" fontSize="12" fill="#e0f2fe">Source</text>
      <text x="355" y="128" textAnchor="middle" fontSize="12" fill="#e0f2fe">Drain</text>
      <text x="230" y="68" textAnchor="middle" fontSize="12" fill="#fde68a">VGS {vgs.toFixed(2)} V · VTH {vth.toFixed(2)} V</text>
      <text x="400" y="110" fontSize="12" fill="#86efac">VDS {vds.toFixed(2)} V</text>
      {flowing ? (
        <g className="vlsi-flow">
          {[0, 1, 2, 3, 4].map((item) => <circle key={item} r="3.2" fill={carriers}><animate attributeName="cx" from="120" to="340" dur="1.8s" begin={`${item * 0.28}s`} repeatCount="indefinite" /><animate attributeName="cy" values="146;140;146" dur="1.8s" begin={`${item * 0.28}s`} repeatCount="indefinite" /></circle>)}
        </g>
      ) : null}
    </svg>
  );
}

export function BandSketch({ bend, body }: { bend: number; body: "p" | "n" }) {
  const shift = bend * 28;
  const ec = `M 20 70 C 120 70, 180 ${70 + shift}, 300 ${70 + shift}`;
  const ev = `M 20 150 C 120 150, 180 ${150 + shift}, 300 ${150 + shift}`;
  return (
    <svg className="vlsi-device" viewBox="0 0 340 190" role="img" aria-label="Energy bands at the oxide interface">
      <text x="16" y="24" fill="#e2e8f0" fontSize="12">{body === "p" ? "P-type bulk" : "N-type bulk"} → surface</text>
      <path d={ec} fill="none" stroke="#38bdf8" strokeWidth="2" />
      <path d={ev} fill="none" stroke="#fb7185" strokeWidth="2" />
      <line x1="20" y1="110" x2="300" y2="110" stroke="#fbbf24" strokeDasharray="4 3" />
      <text x="304" y="74" fill="#7dd3fc" fontSize="11">Ec</text>
      <text x="304" y="114" fill="#fde68a" fontSize="11">Ef</text>
      <text x="304" y="154" fill="#fda4af" fontSize="11">Ev</text>
    </svg>
  );
}

export function CapSection({ state, depletion, body }: { state: CapState; depletion: number; body: "p" | "n" }) {
  const depth = Math.min(70, depletion / 4);
  return (
    <svg className="vlsi-device" viewBox="0 0 420 240" role="img" aria-label={`MOS capacitor in ${state}`}>
      <rect x="90" y="36" width="240" height="28" rx="3" fill="#fbbf24" />
      <text x="210" y="54" textAnchor="middle" fontSize="12" fill="#451a03">Gate</text>
      <rect x="90" y="66" width="240" height="10" fill="#bae6fd" />
      <text x="344" y="76" fontSize="11" fill="#e0f2fe">oxide</text>
      <rect x="70" y="78" width="280" height="130" rx="6" fill={body === "p" ? "#1e3a5f" : "#4a2030"} />
      {state === "depletion" || state === "inversion" ? <rect x="90" y="78" width="240" height={depth} fill="#0f172a" opacity="0.45" /> : null}
      {state === "inversion" ? <rect x="90" y="78" width="240" height="8" fill="#4ade80" /> : null}
      {state === "accumulation" ? <rect x="90" y="78" width="240" height="10" fill={body === "p" ? "#fb7185" : "#38bdf8"} /> : null}
      <text x="210" y="190" textAnchor="middle" fill="#dbeafe" fontSize="13">{state} · depletion {depletion.toFixed(0)} nm</text>
    </svg>
  );
}

export function InverterSchematic({ vdd, vin, vout, pmosOn, nmosOn, current, amps }: {
  vdd: number;
  vin: number;
  vout: number;
  pmosOn: boolean;
  nmosOn: boolean;
  current: boolean;
  amps?: number;
}) {
  const pColor = pmosOn ? "#fb7185" : "#64748b";
  const nColor = nmosOn ? "#38bdf8" : "#64748b";
  const out = vout > vdd / 2 ? "#4ade80" : "#94a3b8";
  const strength = amps && amps > 0 ? Math.min(1, Math.max(0, (Math.log10(amps) + 8) / 5)) : 0.4;
  const duration = (2.4 - strength * 1.9).toFixed(2);
  const dots = amps === undefined ? 1 : 2 + Math.round(strength * 4);
  return (
    <svg className="vlsi-device" viewBox="0 0 420 300" role="img" aria-label="CMOS inverter schematic">
      <text x="210" y="28" textAnchor="middle" fill="#fecaca" fontSize="13">VDD {vdd.toFixed(2)} V</text>
      <line x1="210" y1="36" x2="210" y2="70" stroke={pmosOn ? "#4ade80" : "#64748b"} strokeWidth={pmosOn ? 4 : 2} />
      <rect x="176" y="70" width="68" height="36" rx="6" fill="#1e293b" stroke={pColor} strokeWidth="3" />
      <text x="210" y="92" textAnchor="middle" fill={pColor} fontSize="12">PMOS {pmosOn ? "ON" : "OFF"}</text>
      <line x1="120" y1="88" x2="176" y2="88" stroke="#60a5fa" strokeWidth="3" />
      <text x="78" y="92" fill="#93c5fd" fontSize="12">Vin {vin.toFixed(2)}</text>
      <line x1="210" y1="106" x2="210" y2="150" stroke={current ? "#4ade80" : "#64748b"} strokeWidth={current ? 4 : 2} />
      <line x1="210" y1="128" x2="300" y2="128" stroke={out} strokeWidth="3" />
      <text x="308" y="132" fill="#6ee7b7" fontSize="12">Vout {vout.toFixed(2)}</text>
      <rect x="176" y="150" width="68" height="36" rx="6" fill="#1e293b" stroke={nColor} strokeWidth="3" />
      <text x="210" y="172" textAnchor="middle" fill={nColor} fontSize="12">NMOS {nmosOn ? "ON" : "OFF"}</text>
      <line x1="210" y1="186" x2="210" y2="230" stroke={nmosOn ? "#4ade80" : "#64748b"} strokeWidth={nmosOn ? 4 : 2} />
      <text x="210" y="250" textAnchor="middle" fill="#cbd5e1" fontSize="13">GND</text>
      {current ? (
        <g className="vlsi-flow">
          {Array.from({ length: dots }, (_, index) => (
            <circle key={index} cx="210" r={3 + strength * 1.5} fill="#86efac">
              <animate attributeName="cy" from={pmosOn && !nmosOn ? "220" : "40"} to={pmosOn && !nmosOn ? "40" : "220"} dur={`${duration}s`} begin={`${(index * Number(duration)) / dots}s`} repeatCount="indefinite" />
            </circle>
          ))}
        </g>
      ) : null}
      {amps !== undefined && current ? <text x="226" y="214" fill="#86efac" fontSize="11">I ≈ {amps < 1e-6 ? `${(amps * 1e9).toFixed(0)} nA` : amps < 1e-3 ? `${(amps * 1e6).toFixed(1)} µA` : `${(amps * 1e3).toFixed(2)} mA`}</text> : null}
    </svg>
  );
}

export function NetworkSchematic({ kind, a, b, devicesOn }: {
  kind: "nand" | "nor";
  a: 0 | 1;
  b: 0 | 1;
  devicesOn: { pa: boolean; pb: boolean; na: boolean; nb: boolean };
}) {
  const p = (on: boolean) => on ? "#fb7185" : "#64748b";
  const n = (on: boolean) => on ? "#38bdf8" : "#64748b";
  const up = kind === "nand" ? devicesOn.pa || devicesOn.pb : devicesOn.pa && devicesOn.pb;
  const down = kind === "nand" ? devicesOn.na && devicesOn.nb : devicesOn.na || devicesOn.nb;
  return (
    <svg className="vlsi-device" viewBox="0 0 440 300" role="img" aria-label={`${kind} transistor network`}>
      <text x="220" y="24" textAnchor="middle" fill="#fecaca" fontSize="13">VDD</text>
      <text x="40" y="90" fill="#fda4af" fontSize="12">PMOS {kind === "nand" ? "parallel" : "series"}</text>
      <rect x="120" y="48" width="70" height="32" rx="6" fill="#1e293b" stroke={p(devicesOn.pa)} strokeWidth="3" />
      <rect x="230" y="48" width="70" height="32" rx="6" fill="#1e293b" stroke={p(devicesOn.pb)} strokeWidth="3" />
      <text x="155" y="68" textAnchor="middle" fill={p(devicesOn.pa)} fontSize="11">A={a}</text>
      <text x="265" y="68" textAnchor="middle" fill={p(devicesOn.pb)} fontSize="11">B={b}</text>
      <line x1="190" y1="110" x2="250" y2="110" stroke={up ? "#4ade80" : "#475569"} strokeWidth={up ? 4 : 2} />
      <text x="360" y="114" fill="#6ee7b7" fontSize="13">Y = {down ? 0 : 1}</text>
      <text x="40" y="180" fill="#7dd3fc" fontSize="12">NMOS {kind === "nand" ? "series" : "parallel"}</text>
      <rect x="150" y="150" width="70" height="32" rx="6" fill="#1e293b" stroke={n(devicesOn.na)} strokeWidth="3" />
      <rect x={kind === "nand" ? 150 : 250} y={kind === "nand" ? 200 : 150} width="70" height="32" rx="6" fill="#1e293b" stroke={n(devicesOn.nb)} strokeWidth="3" />
      <text x="185" y="170" textAnchor="middle" fill={n(devicesOn.na)} fontSize="11">A</text>
      <text x={kind === "nand" ? 185 : 285} y={kind === "nand" ? 220 : 170} textAnchor="middle" fill={n(devicesOn.nb)} fontSize="11">B</text>
      <line x1="185" y1="240" x2="185" y2="270" stroke={down ? "#4ade80" : "#475569"} strokeWidth={down ? 4 : 2} />
      <text x="185" y="288" textAnchor="middle" fill="#cbd5e1" fontSize="12">GND</text>
    </svg>
  );
}
