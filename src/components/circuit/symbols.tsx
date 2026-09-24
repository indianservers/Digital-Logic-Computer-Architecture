import type { Bit } from "./types";

/** Shared vector symbols for the palette and the canvas. Coordinates are local to width × height. */

const DISPLAYS = new Set(["bulb", "buzzer", "bicolor", "rgb", "bar", "hex", "seg7", "traffic", "lights", "motor", "relay"]);

export function ComponentBody({ type, width, height, stroke, fill, sw }: { type: string; width: number; height: number; stroke: string; fill: string; sw: number }) {
  const line = { fill: "none" as const, stroke, strokeWidth: sw, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const bubble = type === "nand" || type === "nor" || type === "xnor" || type === "not" || type === "tri";
  if (type === "buf") {
    return (
      <g>
        <path d={`M0 0 L${width - 4} ${height / 2} L0 ${height} Z`} fill={fill} stroke={stroke} strokeWidth={sw} />
      </g>
    );
  }
  if (type === "and" || type === "nand") {
    return (
      <g>
        <path d={`M0 0 h${width * 0.42} c${width * 0.34} 0 ${width * 0.48} ${height * 0.28} ${width * 0.48} ${height / 2} s-${width * 0.14} ${height / 2} -${width * 0.48} ${height / 2} h-${width * 0.42} z`} fill={fill} stroke={stroke} strokeWidth={sw} />
        {type === "nand" ? <circle cx={width - 5} cy={height / 2} r={4} fill={fill} stroke={stroke} strokeWidth={sw} /> : null}
      </g>
    );
  }
  if (type === "or" || type === "nor" || type === "xor" || type === "xnor") {
    return (
      <g>
        {type === "xor" || type === "xnor" ? <path d={`M6 0 c8 ${height * 0.35} 8 ${height * 0.65} 0 ${height}`} {...line} /> : null}
        <path d={`M0 0 c${width * 0.28} 0 ${width * 0.55} ${height * 0.18} ${width * 0.72} ${height / 2} c-${width * 0.17} ${height * 0.32} -${width * 0.44} ${height / 2} -${width * 0.72} ${height / 2} c${width * 0.18} -${height * 0.28} ${width * 0.18} -${height * 0.72} 0 -${height} z`} fill={fill} stroke={stroke} strokeWidth={sw} />
        {type === "nor" || type === "xnor" ? <circle cx={width - 4} cy={height / 2} r={4} fill={fill} stroke={stroke} strokeWidth={sw} /> : null}
      </g>
    );
  }
  if (type === "not") {
    return (
      <g>
        <path d={`M0 0 L${width - 12} ${height / 2} L0 ${height} Z`} fill={fill} stroke={stroke} strokeWidth={sw} />
        <circle cx={width - 6} cy={height / 2} r={4.5} fill={fill} stroke={stroke} strokeWidth={sw} />
      </g>
    );
  }
  if (type === "tri") {
    return (
      <g>
        <path d={`M0 0 L${width - 14} ${height / 2} L0 ${height} Z`} fill={fill} stroke={stroke} strokeWidth={sw} />
        <circle cx={width - 6} cy={height / 2} r={4} fill={fill} stroke={stroke} strokeWidth={sw} />
        <path d={`M4 ${height * 0.72} h${width * 0.28}`} {...line} />
      </g>
    );
  }
  if (type === "input" || type === "button") {
    return (
      <g>
        <rect x={2} y={2} width={width - 8} height={height - 4} rx={height / 2} fill={fill} stroke={stroke} strokeWidth={sw} />
        <circle cx={type === "button" ? width * 0.62 : width * 0.32} cy={height / 2} r={Math.min(6, height * 0.22)} fill={stroke} />
      </g>
    );
  }
  if (type === "high" || type === "low" || type === "const") {
    return (
      <g>
        <rect x={2} y={2} width={width - 8} height={height - 4} rx={4} fill={fill} stroke={stroke} strokeWidth={sw} />
        <text x={width / 2 - 2} y={height / 2 + 4} textAnchor="middle" fontSize={Math.min(12, height * 0.45)} fontWeight="800" fill={stroke}>{type === "low" ? "0" : "1"}</text>
      </g>
    );
  }
  if (type === "clock") {
    return (
      <g>
        <path d={`M2 ${height * 0.7} V${height * 0.3} H${width * 0.35} V${height * 0.7} H${width * 0.65} V${height * 0.3} H${width - 4}`} {...line} />
      </g>
    );
  }
  if (DISPLAYS.has(type)) return <DisplayGlyph type={type} width={width} height={height} stroke={stroke} sw={sw} />;
  if (type === "led") {
    return (
      <g>
        <circle cx={width / 2} cy={height * 0.4} r={Math.min(7, height * 0.28)} fill="#fecaca" stroke="#9f1239" strokeWidth={sw} />
        <path d={`M${width * 0.3} ${height * 0.78} h${width * 0.4} M${width * 0.38} ${height * 0.92} h${width * 0.24}`} stroke="#64748b" strokeWidth={sw} />
      </g>
    );
  }
  if (type === "output") {
    return (
      <g>
        <rect x={2} y={2} width={width - 8} height={height - 4} rx={4} fill={fill} stroke={stroke} strokeWidth={sw} />
        <text x={width / 2 - 2} y={height / 2 + 4} textAnchor="middle" fontSize={Math.min(11, height * 0.4)} fontWeight="800" fill={stroke}>Y</text>
      </g>
    );
  }
  if (type === "probe") {
    return (
      <g>
        <circle cx={width * 0.38} cy={height * 0.55} r={Math.min(7, height * 0.28)} fill={fill} stroke={stroke} strokeWidth={sw} />
        <path d={`M${width * 0.52} ${height * 0.4} L${width - 4} 2`} {...line} />
      </g>
    );
  }
  if (type === "mux2" || type === "dec2") {
    const trap = type === "mux2";
    return (
      <g>
        {trap ? <path d={`M4 0 L${width - 8} ${height * 0.18} L${width - 8} ${height * 0.82} L4 ${height} Z`} fill={fill} stroke={stroke} strokeWidth={sw} /> : <rect x={2} y={1} width={width - 14} height={height - 2} rx={3} fill={fill} stroke={stroke} strokeWidth={sw} />}
        {trap ? null : [0.22, 0.42, 0.62, 0.82].map((t) => <path key={t} d={`M${width - 12} ${height * t} h8`} {...line} />)}
      </g>
    );
  }
  if (type === "ha" || type === "fa" || type === "hsub" || type === "fsub") {
    return (
      <g>
        <rect x={2} y={1} width={width - 6} height={height - 2} rx={4} fill={fill} stroke={stroke} strokeWidth={sw} />
        <text x={width / 2} y={height / 2 + 4} textAnchor="middle" fontSize={Math.min(13, height * 0.34)} fontWeight="800" fill={stroke}>{type === "hsub" || type === "fsub" ? "−" : "+"}</text>
      </g>
    );
  }
  if (type === "sr" || type === "dlatch" || type === "dff" || type === "jkff" || type === "tff") {
    return (
      <g>
        <rect x={4} y={1} width={width - 10} height={height - 2} rx={3} fill={fill} stroke={stroke} strokeWidth={sw} />
        <path d={`M4 ${height * 0.62} l6 -5 6 5`} {...line} />
        <text x={width * 0.55} y={height * 0.42} textAnchor="middle" fontSize={Math.min(9, height * 0.24)} fontWeight="800" fill={stroke}>{type === "sr" ? "SR" : type === "jkff" ? "JK" : type === "tff" ? "T" : "D"}</text>
      </g>
    );
  }
  if (type === "delay") {
    return (
      <g>
        <rect x={2} y={2} width={width - 6} height={height - 4} rx={height / 2} fill={fill} stroke={stroke} strokeWidth={sw} />
        <path d={`M${width * 0.28} ${height / 2} h${width * 0.4}`} {...line} />
      </g>
    );
  }
  return (
    <g>
      <rect x={2} y={1} width={width - 6} height={height - 2} rx={4} fill={fill} stroke={stroke} strokeWidth={sw} />
      {bubble ? <circle cx={width - 6} cy={height / 2} r={3.5} fill={fill} stroke={stroke} /> : null}
    </g>
  );
}

function DisplayGlyph({ type, width, height, stroke, sw }: { type: string; width: number; height: number; stroke: string; sw: number }) {
  const line = { fill: "none" as const, stroke, strokeWidth: sw, strokeLinecap: "round" as const };
  if (type === "hex") return <text x={width / 2} y={height * 0.72} textAnchor="middle" fontSize={height * 0.7} fontWeight="800" fill={stroke}>F</text>;
  if (type === "seg7") return <path d={`M4 4 H${width - 8} M4 ${height / 2} H${width - 8} M4 ${height - 4} H${width - 8} M4 4 V${height - 4} M${width - 8} 4 V${height - 4}`} {...line} />;
  if (type === "bar") return <g>{[0.2, 0.4, 0.6, 0.8].map((t) => <circle key={t} cx={width * t} cy={height / 2} r={3} fill="none" stroke={stroke} strokeWidth={sw} />)}</g>;
  if (type === "traffic" || type === "lights") return <g>{[0.25, 0.5, 0.75].map((t) => <circle key={t} cx={type === "lights" ? width * 0.35 : width / 2} cy={height * t} r={3} fill="none" stroke={stroke} strokeWidth={sw} />)}{type === "lights" ? [0.25, 0.5, 0.75].map((t) => <circle key={`e${t}`} cx={width * 0.7} cy={height * t} r={3} fill="none" stroke={stroke} strokeWidth={sw} />) : null}</g>;
  if (type === "motor") return <g><circle cx={width / 2} cy={height / 2} r={Math.min(width, height) * 0.32} fill="none" stroke={stroke} strokeWidth={sw} /><text x={width / 2} y={height / 2 + 3} textAnchor="middle" fontSize="8" fontWeight="800" fill={stroke}>M</text></g>;
  if (type === "relay") return <path d={`M2 ${height * 0.7} H${width * 0.4} L${width * 0.7} ${height * 0.35} M${width * 0.75} ${height * 0.7} H${width - 2}`} {...line} />;
  if (type === "buzzer") return <path d={`M4 ${height * 0.35} h8 l8 -6 v${height * 0.7} l-8 -6 h-8 z`} fill="none" stroke={stroke} strokeWidth={sw} />;
  return <circle cx={width / 2} cy={height / 2} r={Math.min(width, height) * 0.28} fill="none" stroke={stroke} strokeWidth={sw} />;
}

export function isDisplay(type: string): boolean {
  return DISPLAYS.has(type);
}

export function DisplayView({ type, x, y, width, height, bits }: { type: string; x: number; y: number; width: number; height: number; bits: Record<string, Bit> }) {
  const on = (id: string) => bits[id] === 1;
  const unknown = (id: string) => bits[id] !== 0 && bits[id] !== 1;
  if (type === "bulb") return <Bulb x={x} y={y} width={width} height={height} on={on("A")} unknown={unknown("A")} />;
  if (type === "buzzer") return <Buzzer x={x} y={y} width={width} height={height} on={on("A")} />;
  if (type === "bicolor") return <ColorLed x={x} y={y} width={width} height={height} fill={mixColor(on("R"), on("G"), false, unknown("R") || unknown("G"))} />;
  if (type === "rgb") return <RgbLamp x={x} y={y} width={width} height={height} red={bits.R} green={bits.G} blue={bits.B} />;
  if (type === "bar") return <LampRow x={x} y={y} width={width} height={height} ids={Object.keys(bits)} bits={bits} />;
  if (type === "hex") return <HexFace x={x} y={y} width={width} height={height} bits={bits} />;
  if (type === "seg7") return <SevenSeg x={x} y={y} width={width} height={height} bits={bits} />;
  if (type === "traffic") return <SignalHead x={x} y={y} width={width} height={height} lamps={[["R", "#ef4444"], ["Y", "#facc15"], ["G", "#22c55e"]]} bits={bits} />;
  if (type === "lights") return <Junction x={x} y={y} width={width} height={height} bits={bits} />;
  if (type === "motor") return <Motor x={x} y={y} width={width} height={height} on={on("A")} />;
  return <Relay x={x} y={y} width={width} height={height} on={on("A")} />;
}

function Bulb({ x, y, width, height, on, unknown }: { x: number; y: number; width: number; height: number; on: boolean; unknown: boolean }) {
  const cx = x + width / 2;
  const cy = y + height * 0.38;
  return (
    <g>
      <circle cx={cx} cy={cy} r={Math.min(16, width * 0.28)} fill={on ? "#fde68a" : unknown ? "#fcd34d" : "#e2e8f0"} stroke={on ? "#d97706" : "#64748b"} strokeWidth="1.4" />
      <path d={`M${cx - 6} ${cy + 12} h12 M${cx - 5} ${y + height - 8} h10 M${cx - 7} ${y + height - 4} h14`} stroke="#64748b" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

function Buzzer({ x, y, width, height, on }: { x: number; y: number; width: number; height: number; on: boolean }) {
  const cy = y + height / 2;
  return (
    <g className={on ? "cwb-buzzer on" : "cwb-buzzer"}>
      <path d={`M${x + 10} ${cy - 8} h10 l12 -10 v36 l-12 -10 h-10 z`} fill={on ? "#fee2e2" : "#f8fafc"} stroke="#122033" strokeWidth="1.4" />
      <path className="cwb-wave" d={`M${x + width - 18} ${cy - 8} q8 8 0 16 M${x + width - 12} ${cy - 12} q12 12 0 24`} fill="none" stroke={on ? "#ef4444" : "#94a3b8"} strokeWidth="1.4" />
    </g>
  );
}

function ColorLed({ x, y, width, height, fill }: { x: number; y: number; width: number; height: number; fill: string }) {
  return <circle cx={x + width / 2} cy={y + height / 2} r={Math.min(16, height * 0.28)} fill={fill} stroke="#122033" strokeWidth="1.4" />;
}

function mixColor(red: boolean, green: boolean, _blue: boolean, unknown: boolean): string {
  if (unknown) return "#fcd34d";
  if (red && green) return "#facc15";
  if (red) return "#ef4444";
  if (green) return "#22c55e";
  return "#e2e8f0";
}

function channel(value: Bit | undefined): number {
  return value === 1 ? 255 : 0;
}

function RgbLamp({ x, y, width, height, red, green, blue }: { x: number; y: number; width: number; height: number; red: Bit | undefined; green: Bit | undefined; blue: Bit | undefined }) {
  const r = channel(red);
  const g = channel(green);
  const b = channel(blue);
  const lit = r + g + b > 0;
  const unknown = [red, green, blue].some((value) => value !== 0 && value !== 1);
  const fill = lit ? `rgb(${r} ${g} ${b})` : unknown ? "#fcd34d" : "#1e293b";
  const cx = x + width / 2;
  const cy = y + height / 2;
  const radius = Math.min(width, height) * 0.34;
  return (
    <g>
      {lit ? <circle cx={cx} cy={cy} r={radius + 6} fill={fill} opacity={0.35} /> : null}
      <circle cx={cx} cy={cy} r={radius} fill={fill} stroke={lit ? fill : "#334155"} strokeWidth="2" />
      <circle cx={cx - radius * 0.28} cy={cy - radius * 0.32} r={radius * 0.22} fill="#fff" opacity={lit ? 0.55 : 0.2} />
    </g>
  );
}

function LampRow({ x, y, width, height, ids, bits }: { x: number; y: number; width: number; height: number; ids: string[]; bits: Record<string, Bit> }) {
  return (
    <g>
      {ids.map((id, index) => {
        const cy = y + ((index + 1) / (ids.length + 1)) * height;
        const lit = bits[id] === 1;
        return <circle key={id} cx={x + width * 0.62} cy={cy} r={7} fill={lit ? "#ef4444" : bits[id] === 0 ? "#e2e8f0" : "#fcd34d"} stroke="#122033" strokeWidth="1.2" />;
      })}
    </g>
  );
}

function HexFace({ x, y, width, height, bits }: { x: number; y: number; width: number; height: number; bits: Record<string, Bit> }) {
  const text = ["D3", "D2", "D1", "D0"].some((id) => bits[id] !== 0 && bits[id] !== 1) ? "X" : nibble(bits);
  return (
    <g>
      <rect x={x + 8} y={y + 8} width={width - 16} height={height - 16} rx={8} fill="#0f172a" stroke="#334155" />
      <text x={x + width / 2} y={y + height / 2 + 8} textAnchor="middle" fontSize="28" fontWeight="800" fill={text === "X" ? "#fcd34d" : "#4ade80"}>{text}</text>
    </g>
  );
}

function nibble(bits: Record<string, Bit>): string {
  const n = ["D3", "D2", "D1", "D0"].reduce((acc, id, index) => acc + (bits[id] === 1 ? 2 ** (3 - index) : 0), 0);
  return n.toString(16).toUpperCase();
}

function SevenSeg({ x, y, width, height, bits }: { x: number; y: number; width: number; height: number; bits: Record<string, Bit> }) {
  const lit = (id: string) => bits[id] === 1;
  const left = x + width * 0.28;
  const right = x + width * 0.78;
  const top = y + 16;
  const mid = y + height * 0.48;
  const bot = y + height - 28;
  const seg = (id: string, d: string) => <path key={id} d={d} stroke={lit(id) ? "#ef4444" : "#cbd5e1"} strokeWidth="5" strokeLinecap="round" fill="none" />;
  return (
    <g>
      {seg("a", `M${left + 8} ${top} H${right - 8}`)}
      {seg("b", `M${right} ${top + 6} V${mid - 6}`)}
      {seg("c", `M${right} ${mid + 6} V${bot - 6}`)}
      {seg("d", `M${left + 8} ${bot} H${right - 8}`)}
      {seg("e", `M${left} ${mid + 6} V${bot - 6}`)}
      {seg("f", `M${left} ${top + 6} V${mid - 6}`)}
      {seg("g", `M${left + 8} ${mid} H${right - 8}`)}
      <circle cx={right + 8} cy={bot} r={3.5} fill={lit("dp") ? "#ef4444" : "#cbd5e1"} />
    </g>
  );
}

function SignalHead({ x, y, width, height, lamps, bits }: { x: number; y: number; width: number; height: number; lamps: Array<[string, string]>; bits: Record<string, Bit> }) {
  return (
    <g>
      <rect x={x + width * 0.35} y={y + 6} width={width * 0.4} height={height - 12} rx={10} fill="#111827" />
      {lamps.map(([id, color], index) => {
        const cy = y + ((index + 1) / (lamps.length + 1)) * height;
        return <circle key={id} cx={x + width * 0.55} cy={cy} r={8} fill={bits[id] === 1 ? color : "#1f2937"} stroke={bits[id] !== 0 && bits[id] !== 1 ? "#fcd34d" : "#374151"} />;
      })}
    </g>
  );
}

function Junction({ x, y, width, height, bits }: { x: number; y: number; width: number; height: number; bits: Record<string, Bit> }) {
  const heads: Array<{ label: string; lamps: Array<[string, string]> }> = [
    { label: "NS", lamps: [["NSR", "#ef4444"], ["NSY", "#facc15"], ["NSG", "#22c55e"]] },
    { label: "EW", lamps: [["EWR", "#ef4444"], ["EWY", "#facc15"], ["EWG", "#22c55e"]] },
  ];
  return (
    <g>
      {heads.map((head, index) => {
        const left = x + 28 + index * ((width - 36) / 2);
        return (
          <g key={head.label}>
            <text x={left + 16} y={y + 12} textAnchor="middle" fontSize="9" fontWeight="800" fill="#667085">{head.label}</text>
            <SignalHead x={left - width * 0.15} y={y + 10} width={70} height={height - 16} lamps={head.lamps} bits={bits} />
          </g>
        );
      })}
    </g>
  );
}

function Motor({ x, y, width, height, on }: { x: number; y: number; width: number; height: number; on: boolean }) {
  const cx = x + width / 2;
  const cy = y + height / 2;
  return (
    <g className={on ? "cwb-motor on" : "cwb-motor"}>
      <circle cx={cx} cy={cy} r={18} fill={on ? "#dbeafe" : "#f8fafc"} stroke="#122033" strokeWidth="1.4" />
      <g className="cwb-spin">
        <path d={`M${cx} ${cy} l12 -6`} stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" />
      </g>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize="9" fontWeight="800" fill="#122033">M</text>
    </g>
  );
}

function Relay({ x, y, width, height, on }: { x: number; y: number; width: number; height: number; on: boolean }) {
  const y0 = y + height * 0.62;
  return (
    <g>
      <rect x={x + 8} y={y + 8} width={22} height={height - 20} rx={4} fill="#f8fafc" stroke="#122033" />
      <path d={`M${x + 36} ${y0} H${x + 52}`} stroke="#122033" strokeWidth="1.6" />
      <path d={`M${x + width - 18} ${y0} H${x + width - 8}`} stroke="#122033" strokeWidth="1.6" />
      <path d={`M${x + 52} ${y0} L${x + width - 18} ${on ? y0 : y0 - 14}`} stroke={on ? "#16a34a" : "#122033"} strokeWidth="1.8" />
    </g>
  );
}

export function ComponentGlyph({ type }: { type: string }) {
  return (
    <svg className="cwb-glyph" width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
      <g transform="translate(4 8)">
        <ComponentBody type={type} width={28} height={20} stroke="currentColor" fill="none" sw={1.45} />
      </g>
    </svg>
  );
}
