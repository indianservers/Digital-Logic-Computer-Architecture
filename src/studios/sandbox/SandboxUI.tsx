import { useId, useRef, type ReactNode } from "react";
import { useSandbox } from "./sandboxState";
import { partPorts, type PartKind } from "./sandboxModel";
export function SIcon({
  name = "circuit",
  size = 19,
}: {
  name?: string;
  size?: number;
}) {
  const paths: Record<string, string> = {
    circuit: "M5 6h6v6H5zM21 18h6v6h-6zM8 12v11h13M19 5v10M15 10h8",
    datapath: "M12 3h8v7h-8zM3 22h8v7H3zM21 22h8v7h-8zM16 10v7H7v5M16 17h9v5",
    memory:
      "M8 4h16v24H8zM12 9h8M12 14h8M12 19h8M12 24h8M3 8h5M3 14h5M3 20h5M24 8h5M24 14h5M24 20h5",
    cpu: "M7 7h18v18H7zM12 12h8v8h-8zM11 2v5M17 2v5M23 2v5M11 25v5M17 25v5M23 25v5M2 11h5M2 17h5M2 23h5M25 11h5M25 17h5M25 23h5",
    multicore:
      "M13 2h6v6h-6zM3 22h7v7H3zM22 22h7v7h-7zM12 13h8v7h-8zM16 8v5M12 17H6v5M20 17h6v5",
    components: "M4 4h9v9H4zM19 4h9v9h-9zM4 19h9v9H4zM19 19h9v9h-9z",
    probe: "M21 3l8 8-14 14-8-8zM7 25l-4 4M17 7l8 8",
    breakpoint: "M16 2a14 14 0 110 28 14 14 0 010-28zM13 9l9 7-9 7z",
    history: "M4 7v9h9M4 15A12 12 0 1113 28M16 9v8l5 3",
    templates: "M7 3h18v26H7zM11 8h10M11 13h10M11 18h10M11 23h7",
    wire: "M4 26l7-7M10 22l4 4 6-6-4-4M18 12l4 4 6-6-4-4z",
    select: "M7 3l19 14-10 2-5 10z",
    hand: "M10 15V6a2 2 0 014 0v9-11a2 2 0 014 0v11-9a2 2 0 014 0v10-7a2 2 0 014 0v12l-4 8H12L5 19a2 2 0 013-3l2 2",
    run: "M10 5l17 11-17 11z",
    pause: "M10 5v22M22 5v22",
    step: "M6 6l17 10L6 26zM26 6v20",
    reset: "M5 7v9h9M5 16A12 12 0 1120 28",
    undo: "M12 5L3 12l9 7M3 12h15q12 0 9 15",
    redo: "M20 5l9 7-9 7M29 12H14q-12 0-9 15",
    settings:
      "M12 2h8l1 6 5 3 5 2v7l-6 2-3 5-2 5h-8l-2-6-5-3-5-2v-7l6-2 3-5zM16 11a5 5 0 110 10 5 5 0 010-10",
    fit: "M3 11V3h8M21 3h8v8M29 21v8h-8M11 29H3v-8",
    target:
      "M16 3a13 13 0 110 26 13 13 0 010-26zM16 10a6 6 0 110 12 6 6 0 010-12zM16 1v8M16 23v8M1 16h8M23 16h8",
    trash: "M5 7h22M12 3h8M8 7l1 22h14l1-22M13 12v12M19 12v12",
    save: "M4 3h22l3 3v23H3V3zM9 3v10h14V3M9 20h14v9",
    clock: "M16 2a14 14 0 110 28 14 14 0 010-28zM16 7v10l7 4",
    led: "M16 5a11 11 0 110 22 11 11 0 010-22z",
    search: "M23 23l7 7M25 14a11 11 0 11-22 0 11 11 0 0122 0z",
    chevron: "M11 6l10 10-10 10",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d={paths[name] ?? paths.cpu}
        fill={name === "run" ? "currentColor" : "none"}
      />
    </svg>
  );
}
export function Surface({
  children,
  label,
  viewBox = "0 0 980 760",
  className = "",
  toolbar = true,
}: {
  children: ReactNode;
  label: string;
  viewBox?: string;
  className?: string;
  toolbar?: boolean;
}) {
  const s = useSandbox();
  const svgRef = useRef<SVGSVGElement>(null);
  return (
    <div
      className={`sb-surface ${className}`}
      onWheel={(e) => {
        if (e.ctrlKey) {
          e.preventDefault();
          s.setZoom((z) =>
            Math.max(40, Math.min(150, z + (e.deltaY < 0 ? 10 : -10))),
          );
        }
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const kind = e.dataTransfer.getData("sandbox-kind") as PartKind;
        if (!kind) return;
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const parts = viewBox.split(" ").map(Number);
        s.insertPart(
          kind,
          ((e.clientX - rect.left) / rect.width) * parts[2]! - s.pan.x,
          ((e.clientY - rect.top) / rect.height) * parts[3]! - s.pan.y,
        );
      }}
    >
      {toolbar && <CanvasToolbar />}
      <svg
        ref={svgRef}
        className="sb-svg"
        viewBox={viewBox}
        preserveAspectRatio="none"
        role="group"
        aria-label={label}
      >
        <defs>
          <pattern
            id="sb-grid"
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M22 0H0V22"
              fill="none"
              stroke="#234354"
              strokeWidth=".7"
            />
          </pattern>
          <linearGradient id="sb-block" x2="1" y2="1">
            <stop stopColor="#203347" />
            <stop offset=".5" stopColor="#0e2333" />
            <stop offset="1" stopColor="#061725" />
          </linearGradient>
          <linearGradient id="sb-selected" x2="1" y2="1">
            <stop stopColor="#213951" />
            <stop offset="1" stopColor="#091c32" />
          </linearGradient>
          <radialGradient id="sb-led-on" cx=".38" cy=".28">
            <stop stopColor="#edffcc" />
            <stop offset=".18" stopColor="#bdff9d" />
            <stop offset=".5" stopColor="#42f817" />
            <stop offset="1" stopColor="#079506" />
          </radialGradient>
          <radialGradient id="sb-led-off" cx=".38" cy=".28">
            <stop stopColor="#ffb2a4" />
            <stop offset=".2" stopColor="#9c2d2b" />
            <stop offset=".7" stopColor="#4f151b" />
            <stop offset="1" stopColor="#230b12" />
          </radialGradient>
          <radialGradient id="sb-led-unknown">
            <stop stopColor="#ffe493" />
            <stop offset="1" stopColor="#9b6400" />
          </radialGradient>
          <linearGradient id="sb-bezel" x2="1" y2="1">
            <stop stopColor="#c1d3df" />
            <stop offset=".3" stopColor="#3c5369" />
            <stop offset=".6" stopColor="#0c1c2a" />
            <stop offset="1" stopColor="#8b9dad" />
          </linearGradient>
          <filter id="sb-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <filter id="sb-shadow">
            <feDropShadow
              dx="2"
              dy="3"
              stdDeviation="3"
              floodColor="#000"
              floodOpacity=".6"
            />
          </filter>
        </defs>
        <rect width="2000" height="1300" fill="url(#sb-grid)" />
        <g
          transform={`translate(${s.pan.x},${s.pan.y}) scale(${s.zoom / 100})`}
        >
          {children}
        </g>
      </svg>
      {s.notice && (
        <div className="sb-canvas-notice" role="status">
          {s.notice}
          <button aria-label="Dismiss notice" onClick={() => s.setNotice("")}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
export function CanvasToolbar() {
  const s = useSandbox();
  return (
    <div className="sb-canvas-toolbar">
      <div>
        {["Select", "Wire", "Probe"].map((tool, i) => (
          <button
            className={s.tool === tool ? "active" : ""}
            key={tool}
            onClick={() => {
              s.setTool(tool);
              s.setConnection(null);
            }}
          >
            <SIcon name={["select", "wire", "probe"][i]} />
            <span>{tool}</span>
          </button>
        ))}
      </div>
      <small>
        Click to select • Drag to wire • Ctrl + scroll to zoom • Right-click for
        more options
      </small>
      <div className="sb-zoom">
        <button
          aria-label="Zoom out"
          onClick={() => s.setZoom(Math.max(40, s.zoom - 10))}
        >
          −
        </button>
        <span>{s.zoom}%</span>
        <button
          aria-label="Zoom in"
          onClick={() => s.setZoom(Math.min(150, s.zoom + 10))}
        >
          +
        </button>
      </div>
      <button
        aria-label="Fit view"
        onClick={() => {
          s.setZoom(100);
          s.setPan({ x: 0, y: 0 });
        }}
      >
        <SIcon name="fit" />
      </button>
      <button aria-label="Center view" onClick={() => s.setPan({ x: 0, y: 0 })}>
        <SIcon name="target" />
      </button>
    </div>
  );
}
export function Trace({
  d,
  color = "#20d9ef",
  on = true,
  width = 2.5,
  label,
  x,
  y,
  remove,
  role = "data",
}: {
  d: string;
  color?: string;
  on?: boolean | null;
  width?: number;
  label?: string;
  x?: number;
  y?: number;
  remove?: () => void;
  role?: string;
}) {
  return (
    <g
      className={`sb-trace ${on ? "high" : "low"}`}
      data-role={role}
      onContextMenu={(e) => {
        if (remove) {
          e.preventDefault();
          remove();
        }
      }}
    >
      {on && (
        <path
          d={d}
          stroke={color}
          strokeWidth={width + 4}
          opacity=".18"
          fill="none"
          filter="url(#sb-glow)"
        />
      )}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        opacity={on === null ? 0.3 : on ? 1 : 0.52}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {remove && (
        <path
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth="14"
          style={{ cursor: "context-menu" }}
        />
      )}
      {on &&
        [0, 1].map((i) => (
          <circle
            key={i}
            className="sb-flow-dot"
            r={i ? 2.3 : 3.5}
            fill={i ? "#dfffff" : color}
            style={{
              offsetPath: `path('${d}')`,
              animationDelay: `${-i * 0.7}s`,
              filter: `drop-shadow(0 0 3px ${color})`,
            }}
          />
        ))}
      {label && (
        <text x={x} y={y} textAnchor="middle" fill={color} fontSize="13">
          {label}
        </text>
      )}
    </g>
  );
}
export function Terminal({
  x,
  y,
  color = "#74d5ff",
  label,
  onClick,
  output = false,
}: {
  x: number;
  y: number;
  color?: string;
  label?: string;
  onClick?: () => void;
  output?: boolean;
}) {
  return (
    <g
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      style={{ cursor: onClick ? "crosshair" : "default" }}
    >
      <circle cx={x} cy={y} r="9" fill="transparent" />
      <circle
        cx={x}
        cy={y}
        r="3.5"
        fill={output ? color : "#f1f6ff"}
        stroke={color}
        strokeWidth="1.5"
      />
    </g>
  );
}
export function Led({
  x,
  y,
  value,
  label,
  onClick,
}: {
  x: number;
  y: number;
  value: number | null;
  label?: string;
  onClick?: () => void;
}) {
  return (
    <g
      className="sb-real-led"
      data-value={value ?? "X"}
      transform={`translate(${x},${y})`}
      role={onClick ? "button" : undefined}
      aria-label={
        label
          ? `${label}: ${value === null ? "unknown" : value ? "on" : "off"}`
          : undefined
      }
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick?.();
      }}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      {value === 1 && (
        <circle r="20" fill="#42ff24" opacity=".33" filter="url(#sb-glow)" />
      )}
      <circle
        r="15"
        fill="url(#sb-bezel)"
        stroke={value ? "#4aff2d" : "#bc3434"}
        strokeWidth="1.7"
      />
      <circle
        r="11.5"
        fill={
          value === null
            ? "url(#sb-led-unknown)"
            : value
              ? "url(#sb-led-on)"
              : "url(#sb-led-off)"
        }
        stroke={value ? "#74ff58" : "#530813"}
      />
      <ellipse
        cx="-3"
        cy="-4"
        rx="6"
        ry="3.6"
        fill="white"
        opacity={value ? 0.65 : 0.23}
      />
      {label && (
        <text x="0" y="-24" fill="#f0f5ff" fontSize="15" textAnchor="middle">
          {label}
        </text>
      )}
    </g>
  );
}
export function Switch({
  x,
  y,
  value,
  label,
  onToggle,
}: {
  x: number;
  y: number;
  value: number;
  label?: string;
  onToggle: () => void;
}) {
  return (
    <g
      transform={`translate(${x},${y})`}
      role="switch"
      aria-checked={!!value}
      aria-label={label}
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      style={{ cursor: "pointer" }}
    >
      <rect
        width="42"
        height="22"
        rx="11"
        fill={value ? "#0069dd" : "#425568"}
        stroke="#91a7ba"
        strokeOpacity=".65"
      />
      <circle cx={value ? 31 : 11} cy="11" r="8.4" fill="url(#sb-bezel)" />
      <circle cx={value ? 31 : 11} cy="11" r="7.2" fill="#e6eff6" />
      {value === 1 && (
        <circle
          cx="31"
          cy="11"
          r="10"
          fill="#3bafff"
          opacity=".35"
          filter="url(#sb-glow)"
        />
      )}
    </g>
  );
}
export function Block({
  x,
  y,
  w,
  h,
  title,
  subtitle,
  children,
  selected,
  onSelect,
  stroke = "#8bc3e9",
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  selected?: boolean;
  onSelect?: () => void;
  stroke?: string;
}) {
  return (
    <g onClick={onSelect} style={{ cursor: onSelect ? "pointer" : "default" }}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="4"
        fill={selected ? "url(#sb-selected)" : "url(#sb-block)"}
        stroke={selected ? "#12e3f0" : stroke}
        strokeWidth={selected ? 2 : 1.3}
        filter="url(#sb-shadow)"
      />
      <text
        x={x + w / 2}
        y={y + 23}
        fill="#edf4ff"
        textAnchor="middle"
        fontSize="15"
        fontWeight="600"
      >
        {title}
      </text>
      {subtitle && (
        <text
          x={x + w / 2}
          y={y + 43}
          fill="#bed8e9"
          textAnchor="middle"
          fontSize="13"
        >
          {subtitle}
        </text>
      )}
      {children}
    </g>
  );
}
export function ValueBox({
  x,
  y,
  w = 65,
  value,
  color = "#bceaff",
}: {
  x: number;
  y: number;
  w?: number;
  value: ReactNode;
  color?: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height="25"
        rx="3"
        fill="#081b2b"
        stroke="#496b88"
      />
      <text
        x={x + w / 2}
        y={y + 18}
        fill={color}
        textAnchor="middle"
        fontFamily="Consolas,monospace"
        fontSize="13"
      >
        {value}
      </text>
    </g>
  );
}
export function GateSymbol({
  kind,
  label,
  realistic = false,
}: {
  kind: string;
  label?: string;
  realistic?: boolean;
}) {
  const clipId = useId();
  const paths: Record<string, string> = {
    and: "M17 12H33A18 18 0 0133 48H17zM2 23H17M2 37H17M51 30H64",
    or: "M13 12Q30 30 13 48Q39 48 53 30Q39 12 13 12zM2 23H19M2 37H19M53 30H65",
    xor: "M8 12Q25 30 8 48M14 12Q32 30 14 48Q40 48 54 30Q40 12 14 12zM2 23H20M2 37H20M54 30H65",
    not: "M17 10L48 30 17 50zM2 30H17M54 30H65M54 30a3 3 0 11-6 0 3 3 0 016 0",
    fa: "M15 8h37v44H15zM2 18H15M2 30H15M2 42H15M52 22H65M52 40H65",
    register: "M16 8h36v44H16zM2 30H16M52 30H65",
    mux: "M22 8L48 18V42L22 52zM2 21H22M2 39H22M48 30H65",
    clock: "M5 39H15V15H31V39H47V15H59",
    constant: "M10 10h44v40H10z",
    led: "M32 17a13 13 0 110 26 13 13 0 010-26z",
  };
  if (kind === "led" && realistic)
    return (
      <svg viewBox="0 0 70 65" aria-hidden="true">
        <defs>
          <radialGradient id="sb-palette-led">
            <stop stopColor="#b8ffb0" />
            <stop offset=".4" stopColor="#24e24c" />
            <stop offset="1" stopColor="#057022" />
          </radialGradient>
        </defs>
        <circle
          cx="35"
          cy="31"
          r="16"
          fill="#6f8691"
          stroke="#152e3e"
          strokeWidth="2"
        />
        <circle cx="35" cy="31" r="13" fill="url(#sb-palette-led)" />
        <ellipse cx="31" cy="26" rx="6" ry="3" fill="white" opacity=".65" />
      </svg>
    );
  if (realistic && !["and", "or", "xor", "not", "fa"].includes(kind)) {
    const crops: Record<string, string> = {
      alu: "38 90 382 302",
      register: "462 90 363 302",
      mux: "869 90 365 302",
      memory: "22 480 442 316",
      decoder: "480 490 350 296",
      counter: "888 490 340 297",
      cpu: "18 838 430 370",
      clock: "499 885 327 310",
      constant: "952 790 260 424",
    };
    const [cx, cy, cw, ch] = (crops[kind] ?? crops.cpu!).split(" ").map(Number);
    return (
      <svg
        viewBox={crops[kind] ?? crops.cpu}
        aria-hidden="true"
        preserveAspectRatio="xMidYMid meet"
        style={{ overflow: "hidden" }}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={cx} y={cy} width={cw} height={ch} />
          </clipPath>
        </defs>
        <image
          clipPath={`url(#${clipId})`}
          href="/assets/sandbox/hardware-atlas.png"
          width="1254"
          height="1254"
        />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 70 65"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d={paths[kind] ?? paths.register} />
      {["fa", "register", "constant", "alu", "memory", "decoder"].includes(
        kind,
      ) && (
        <text
          x="34"
          y="34"
          fill="currentColor"
          stroke="none"
          textAnchor="middle"
          fontSize="10"
        >
          {kind === "fa" ? "FA" : (label ?? kind.slice(0, 3).toUpperCase())}
        </text>
      )}
    </svg>
  );
}
export function PartThumbnail({
  kind,
  label,
}: {
  kind: string;
  label?: string;
}) {
  return (
    <div className={`sb-part-thumbnail ${kind}`}>
      <GateSymbol kind={kind} label={label} realistic />
    </div>
  );
}
export function Panel({
  title,
  children,
  className = "",
  action,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`sb-panel ${className}`}>
      <h3>
        {title}
        {action}
      </h3>
      {children}
    </section>
  );
}
export function Tabs({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <nav className="sb-small-tabs">
      {items.map((item) => (
        <button
          className={item === value ? "active" : ""}
          key={item}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </nav>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="sb-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function MiniTable({
  headers,
  rows,
  className = "",
  selectedRow = -1,
}: {
  headers: string[];
  rows: ReactNode[][];
  className?: string;
  selectedRow?: number;
}) {
  return (
    <div className={`sb-table-wrap ${className}`}>
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={i === selectedRow ? "sb-current-vector" : undefined}
            >
              {row.map((v, j) => (
                <td key={j}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function DarkTable({
  x,
  y,
  w,
  title,
  headers,
  rows,
  highlight = -1,
}: {
  x: number;
  y: number;
  w: number;
  title: string;
  headers: string[];
  rows: (string | number)[][];
  highlight?: number;
}) {
  const h = 73 + rows.length * 27;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="5"
        fill="#071b27ee"
        stroke="#365b75"
      />
      <text x={x + 13} y={y + 26} fill="#e0f1ff" fontSize="16" fontWeight="600">
        {title}
      </text>
      <rect
        x={x + 12}
        y={y + 43}
        width={w - 24}
        height={h - 55}
        rx="3"
        fill="#0c202d"
        stroke="#325169"
      />
      {headers.map((v, i) => (
        <text
          key={v}
          x={x + 24 + (i * (w - 30)) / headers.length}
          y={y + 63}
          fill="#d7e7f4"
          fontSize="12"
        >
          {v}
        </text>
      ))}
      {rows.map((row, r) => (
        <g key={r}>
          {r === highlight && (
            <rect
              x={x + 12}
              y={y + 70 + r * 27}
              width={w - 24}
              height="27"
              fill="#ab790c66"
              stroke="#ffbf19"
              strokeWidth="2"
            />
          )}
          {row.map((v, c) => (
            <text
              key={c}
              x={x + 24 + (c * (w - 30)) / headers.length}
              y={y + 88 + r * 27}
              fill={c === 1 && v === 0 ? "#ed7878" : "#d7e7f4"}
              fontSize="12"
              fontFamily="Consolas,monospace"
            >
              {v}
            </text>
          ))}
        </g>
      ))}
    </g>
  );
}
export function PortNames({ kind }: { kind: PartKind }) {
  const ports = partPorts(kind);
  return (
    <>
      {ports.inputs.join(", ")} → {ports.outputs.join(", ")}
    </>
  );
}
