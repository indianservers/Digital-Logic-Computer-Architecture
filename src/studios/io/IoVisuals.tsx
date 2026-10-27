import type { ReactNode } from "react";
export function IoIcon({
  name = "chip",
  size = 22,
}: {
  name?: string;
  size?: number;
}) {
  const paths: Record<string, string> = {
    chip: "M7 7h18v18H7zM11 11h10v10H11zM11 2v5M16 2v5M21 2v5M11 25v5M16 25v5M21 25v5M2 11h5M2 16h5M2 21h5M25 11h5M25 16h5M25 21h5",
    port: "M4 7h24v18H4zM9 12h3M20 12h3M10 19h12M16 9v6",
    poll: "M22 22l7 7M24 14a10 10 0 11-20 0 10 10 0 0120 0zM14 8v6l4 3",
    bell: "M7 23h18l-3-5v-6a6 6 0 00-12 0v6zM13 27h6",
    dma: "M8 3h16v26H8zM12 8h8M12 13h8M12 18h8M12 23h8",
    bus: "M13 3h6v6h-6zM3 23h6v6H3zM13 23h6v6h-6zM23 23h6v6h-6zM16 9v14M6 23v-7h20v7",
    target: "M25 6a12 12 0 11-7-4M22 10a7 7 0 11-6-2M16 16L29 3M22 3h7v7",
    reset: "M5 9v9h9M5 16A11 11 0 112 23",
    play: "M10 5l18 11-18 11z",
    step: "M7 6l15 10L7 26zM25 6v20",
    pause: "M10 6v20M22 6v20",
    keyboard:
      "M3 6h26v20H3zM7 11h2M12 11h2M17 11h2M22 11h2M7 16h2M12 16h2M17 16h2M22 16h2M9 21h14",
    book: "M16 7C12 3 5 4 3 5v23c5-2 9-2 13 0 4-2 8-2 13 0V5c-3-1-9-2-13 2zM16 7v21",
    zoom: "M22 22l7 7M24 14a10 10 0 11-20 0 10 10 0 0120 0zM8 14h12",
    send: "M3 13L29 3 19 29l-5-12zM14 17L29 3",
    code: "M11 8L3 16l8 8M21 8l8 8-8 8M18 4l-4 24",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.chip} />
    </svg>
  );
}
export function Board({
  children,
  label,
  viewBox = "0 0 960 600",
  className = "",
}: {
  children: ReactNode;
  label: string;
  viewBox?: string;
  className?: string;
}) {
  return (
    <svg
      className={`io-board-svg ${className}`}
      viewBox={viewBox}
      preserveAspectRatio={
        className.includes("io-dma") ? "none" : "xMidYMid meet"
      }
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id="io-chip" x2="1" y2="1">
          <stop stopColor="#394958" />
          <stop offset=".45" stopColor="#202d3b" />
          <stop offset="1" stopColor="#111a27" />
        </linearGradient>
        <linearGradient id="io-pin" x2="0" y2="1">
          <stop stopColor="#536173" />
          <stop offset=".4" stopColor="#edf0e7" />
          <stop offset=".65" stopColor="#8d9c9d" />
          <stop offset="1" stopColor="#333e4b" />
        </linearGradient>
        <linearGradient id="io-silver" x2="1" y2="1">
          <stop stopColor="#a6a5a3" />
          <stop offset=".35" stopColor="#595d62" />
          <stop offset=".7" stopColor="#41454b" />
          <stop offset="1" stopColor="#898a85" />
        </linearGradient>
        <radialGradient id="io-led">
          <stop stopColor="#dcffff" />
          <stop offset=".25" stopColor="#62ffff" />
          <stop offset=".65" stopColor="#00d8fc" />
          <stop offset="1" stopColor="#0068e7" />
        </radialGradient>
        <filter id="io-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow
            dx="3"
            dy="6"
            stdDeviation="5"
            floodColor="#000"
            floodOpacity=".8"
          />
        </filter>
        <filter id="io-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <pattern
          id="io-grid"
          width="30"
          height="30"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M30 0H0V30"
            fill="none"
            stroke="#1b4057"
            strokeWidth=".7"
            opacity=".55"
          />
        </pattern>
        <pattern
          id="io-dots"
          width="15"
          height="15"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="2" cy="2" r=".7" fill="#2c9dab" opacity=".55" />
        </pattern>
      </defs>
      <rect width="1600" height="1000" fill="url(#io-grid)" />
      {children}
    </svg>
  );
}
export function Chip({
  x,
  y,
  w = 140,
  h = 130,
  title,
  sub = [],
  glow,
  silver = false,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  title: string;
  sub?: string[];
  glow?: string;
  silver?: boolean;
}) {
  const memory = w > 190 && h < 150;
  const storage = title === "NVMe SSD";
  const crop = storage
    ? "80 65 530 890"
    : silver
      ? "676 85 530 535"
      : memory
        ? "60 778 720 335"
        : w < 125
          ? "815 751 376 380"
          : "52 79 588 560";
  const lines = title.split("|");
  return (
    <g
      className="io-physical-chip"
      data-component={title}
      transform={`translate(${x},${y})`}
    >
      {glow && (
        <rect
          x="-3"
          y="-3"
          width={w + 6}
          height={h + 6}
          rx="12"
          stroke={glow}
          strokeWidth="6"
          fill="none"
          filter="url(#io-glow)"
        />
      )}
      <svg
        x={storage ? 0 : -15}
        y={storage ? 0 : -15}
        width={storage ? w : w + 30}
        height={storage ? h : h + 30}
        viewBox={crop}
        preserveAspectRatio="none"
        overflow="hidden"
      >
        <image
          href={
            storage
              ? "/assets/io/device-atlas.png"
              : "/assets/io/component-atlas.png"
          }
          width={storage ? 1536 : 1254}
          height={storage ? 1024 : 1254}
        />
      </svg>
      {glow && (
        <rect
          x="2"
          y="2"
          width={w - 4}
          height={h - 4}
          rx="8"
          stroke={glow}
          strokeWidth="2"
          fill="none"
          opacity=".85"
        />
      )}
      <text
        x={storage ? w * 0.42 : w / 2}
        y={lines.length > 2 ? h * 0.28 : h * 0.43}
        textAnchor="middle"
        fill={silver ? "#f6f4f0" : "#eff4ff"}
        fontSize={storage ? 18 : w > 155 ? 27 : w < 110 ? 15 : 21}
        fontWeight="600"
        style={{
          paintOrder: "stroke",
          stroke: "#041221",
          strokeWidth: silver ? 0.35 : 0.8,
        }}
      >
        {lines.map((line, i) => (
          <tspan key={line} x={storage ? w * 0.42 : w / 2} dy={i ? 25 : 0}>
            {line}
          </tspan>
        ))}
      </text>
      {sub.map((line, i) => (
        <text
          key={i}
          x={storage ? w * 0.42 : w / 2}
          y={h * 0.43 + (title.includes("|") ? 47 : 28) + i * 18}
          textAnchor="middle"
          fill={silver ? "#e5e7e9" : "#b9d0e5"}
          fontSize={storage ? 11 : w < 110 ? 11 : 13}
        >
          {line}
        </text>
      ))}
    </g>
  );
}
export function Wire({
  d,
  color = "#22dfff",
  dashed = false,
  active = true,
  label,
  x,
  y,
}: {
  d: string;
  color?: string;
  dashed?: boolean;
  active?: boolean;
  label?: string;
  x?: number;
  y?: number;
}) {
  return (
    <g opacity={active ? 1 : 0.3}>
      {active && (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth="11"
          opacity=".65"
          filter="url(#io-glow)"
        />
      )}
      <path
        className={active ? "io-flow" : ""}
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={dashed ? "8 5" : undefined}
      />
      {active && (
        <path
          d={d}
          fill="none"
          stroke="#e5fcff"
          strokeWidth=".8"
          opacity=".7"
          strokeDasharray={dashed ? "8 5" : undefined}
        />
      )}{" "}
      {label && (
        <text
          x={x}
          y={y}
          textAnchor="middle"
          fill={color}
          fontSize="15"
          fontWeight="500"
        >
          {label}
        </text>
      )}
      {active &&
        [0, 1].map((packet) => (
          <circle
            key={packet}
            className="io-signal-packet"
            r={packet ? 2.7 : 4}
            fill={packet ? "#eaffff" : color}
            style={{
              offsetPath: `path('${d}')`,
              animationDelay: `${packet ? -0.8 : 0}s`,
              filter: `drop-shadow(0 0 4px ${color})`,
            }}
          />
        ))}
    </g>
  );
}
export function Arrow({
  x,
  y,
  color = "#29ddff",
  direction = "right",
}: {
  x: number;
  y: number;
  color?: string;
  direction?: "right" | "left" | "down" | "up";
}) {
  return (
    <path
      transform={`translate(${x} ${y}) rotate(${direction === "left" ? 180 : direction === "down" ? 90 : direction === "up" ? -90 : 0})`}
      d="M-8-7L4 0-8 7z"
      fill={color}
    />
  );
}
export function SvgBox({
  x,
  y,
  w,
  h,
  title,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  children?: ReactNode;
}) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect
        width={w}
        height={h}
        rx="10"
        fill="#041625"
        fillOpacity=".92"
        stroke="#305979"
      />
      <text x="14" y="25" fill="#e4edff" fontSize="15" fontWeight="600">
        {title}
      </text>
      {children}
    </g>
  );
}
export function Keyboard({
  x,
  y,
  onPress,
}: {
  x: number;
  y: number;
  onPress?: () => void;
}) {
  return (
    <g
      transform={`translate(${x},${y})`}
      role={onPress ? "button" : undefined}
      tabIndex={onPress ? 0 : undefined}
      aria-label={onPress ? "Press keyboard K key" : undefined}
      onClick={onPress}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPress?.();
        }
      }}
      style={{ cursor: onPress ? "pointer" : "default" }}
    >
      <svg
        width="145"
        height="96"
        viewBox="695 235 780 575"
        preserveAspectRatio="none"
      >
        <image href="/assets/io/device-atlas.png" width="1536" height="1024" />
      </svg>
    </g>
  );
}
