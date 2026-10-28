import { useSimulatorCapture } from "../../layout/SimulatorCapture";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useStudioTab } from "../../layout/useStudioTab";
import {
  Arrow,
  Board,
  Chip,
  IoIcon,
  Keyboard,
  SvgBox,
  Wire,
} from "./IoVisuals";
import {
  decodeAddress,
  dmaBurst,
  FIFO,
  hex,
  nextBus,
  parseHex,
  pollState,
  type BusState,
  type Master,
} from "./ioModel";
import "./io.css";
const TABS = [
  { id: "mapped", label: "MMIO", icon: "chip", sub: "Memory Mapped I/O" },
  {
    id: "isolated",
    label: "Port I/O",
    icon: "port",
    sub: "Isolated I/O Ports",
  },
  { id: "poll", label: "Polling", icon: "poll", sub: "Checking device status" },
  {
    id: "interrupts",
    label: "Interrupts",
    icon: "bell",
    sub: "Event driven I/O",
  },
  { id: "dma", label: "DMA", icon: "dma", sub: "Direct Memory Access" },
  {
    id: "bus",
    label: "Bus Control",
    icon: "bus",
    sub: "Arbitration and sharing",
  },
];
function Panel({
  title,
  icon,
  children,
  action,
  className = "",
}: {
  title: string;
  icon?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`io-panel ${className}`}>
      <h3>
        {icon && <IoIcon name={icon} />}
        <span>{title}</span>
        {action}
      </h3>
      {children}
    </section>
  );
}
function StatRows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <div className="io-statrows">
      {rows.map(([a, b]) => (
        <div key={a}>
          <span>{a}</span>
          <strong>{b}</strong>
        </div>
      ))}
    </div>
  );
}
function Hint({ children }: { children: ReactNode }) {
  return (
    <div className="io-hint">
      <b>♧　Hint</b>
      <div>{children}</div>
    </div>
  );
}
function Badge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`io-badge ${tone}`}>{children}</span>;
}
function HexField({
  label,
  value,
  onChange,
  max = 65535,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  max?: number;
}) {
  const valid = parseHex(value, max) !== null;
  return (
    <label className="io-field">
      {label}
      <input
        aria-label={label}
        aria-invalid={!valid}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {!valid && (
        <small className="io-error">
          Enter a hex value from 0x0 to {hex(max)}.
        </small>
      )}
    </label>
  );
}
function NumberField({
  label,
  value,
  onChange,
  min = 1,
  max = 32,
  unit,
  slider = false,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  unit?: string;
  slider?: boolean;
}) {
  return (
    <div className="io-number-field">
      <label>
        {label}
        <span>
          <input
            aria-label={label}
            type="number"
            min={min}
            max={max}
            value={value}
            onChange={(e) =>
              onChange(
                Math.max(min, Math.min(max, Number(e.target.value) || min)),
              )
            }
          />
          {unit && <small>{unit}</small>}
        </span>
      </label>
      {slider && (
        <>
          <input
            aria-label={`${label} slider`}
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(+e.target.value)}
          />
          <div className="io-range-labels">
            <span>{min}</span>
            <span>{Math.round(max / 4)}</span>
            <span>{Math.round(max / 2)}</span>
            <span>{max}</span>
          </div>
        </>
      )}
    </div>
  );
}
function LedBank({
  value,
  onChange,
  compact = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  compact?: boolean;
}) {
  return (
    <div className={`io-led-bank ${compact ? "compact" : ""}`}>
      {Array.from({ length: 8 }, (_, i) => 7 - i).map((bit) => (
        <button
          key={bit}
          aria-label={`LED ${bit}: ${(value >> bit) & 1 ? "on" : "off"}`}
          title={`Toggle bit ${bit}`}
          onClick={() => onChange?.(value ^ (1 << bit))}
          disabled={!onChange}
        >
          <small>{bit}</small>
          <span className={(value >> bit) & 1 ? "lit" : ""} />
        </button>
      ))}
    </div>
  );
}
function usePlayback(step: () => void, running: boolean, speed: number) {
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(step, 750 / speed);
    return () => window.clearInterval(timer);
  }, [step, running, speed]);
}
function Transport({
  running,
  onPlay,
  onStep,
  onReset,
  speed,
  setSpeed,
  zoom,
  setZoom,
  extra,
  compact = false,
}: {
  running: boolean;
  onPlay: () => void;
  onStep: () => void;
  onReset: () => void;
  speed: number;
  setSpeed: (v: number) => void;
  zoom: number;
  setZoom: (v: number) => void;
  extra?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`io-transport ${compact ? "compact" : ""}`}
      data-running={running}
    >
      <button className="io-primary" onClick={onPlay}>
        <IoIcon name={running ? "pause" : "play"} size={19} />
        {running ? "Pause" : "Play"}
      </button>
      <button onClick={onStep}>
        <IoIcon name="step" size={18} />
        Step
      </button>
      <button onClick={onReset}>
        <IoIcon name="reset" size={19} />
        Reset
      </button>
      <div className="io-speed">
        <span>{compact ? "Speed" : "Simulation Speed"}</span>
        <input
          aria-label="Simulation speed"
          type="range"
          min={0.25}
          max={4}
          step={0.25}
          value={speed}
          onChange={(e) => setSpeed(+e.target.value)}
        />
        <small>{speed}×</small>
      </div>
      <div className="io-zoom">
        <span>Zoom</span>
        <button
          aria-label="Zoom out"
          onClick={() => setZoom(Math.max(60, zoom - 10))}
        >
          −
        </button>
        <span>{zoom}%</span>
        <button
          aria-label="Zoom in"
          onClick={() => setZoom(Math.min(160, zoom + 10))}
        >
          +
        </button>
      </div>
      {extra}
    </div>
  );
}
function Title({
  title,
  description,
  icon,
  aside,
}: {
  title: string;
  description: string;
  icon?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="io-title">
      <div>
        {icon && (
          <span className="io-title-icon">
            <IoIcon name={icon} size={30} />
          </span>
        )}
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      {aside}
    </div>
  );
}
function ChallengeSteps({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <ol className="io-challenge-steps">
      {steps.map((s, i) => (
        <li
          className={i < current ? "done" : i === current ? "current" : ""}
          key={s}
        >
          <span>{i < current ? "✓" : i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}
export function IoStudio() {
  useSimulatorCapture("studios/io/IoStudio.tsx:IoStudio", () => ({ raw, search }), "8939271442ed");

  const [raw, setTab] = useStudioTab([...TABS, { id: "devices" }], "mapped");
  const tab = raw === "devices" ? "mapped" : raw;
  const [search, setSearch] = useState("");
  const current = TABS.findIndex((t) => t.id === tab);
  return (
    <div className={`io-app io-${tab}`}>
      <header className="io-header">
        <Link to="/" className="io-brand">
          <svg viewBox="0 0 32 32" width="30" height="32" aria-hidden="true">
            <path
              d="M4 26L16 5l12 21M11 24l5-9 5 9"
              fill="none"
              stroke="#3c9be8"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d="M16 5l12 21"
              stroke="#70a9e3"
              strokeWidth="7"
              strokeLinecap="round"
            />
          </svg>
          <span>
            <b>AIMER</b> Digital
          </span>
        </Link>
        <div className="io-breadcrumb">
          <Link to="/studios">Studios</Link>
          <span>›</span>
          <b>I/O Architecture</b>
        </div>
        <form
          className="io-search"
          onSubmit={(e) => {
            e.preventDefault();
            const q = search.trim().toLowerCase();
            const hit = TABS.find((t) =>
              `${t.label} ${t.sub}`.toLowerCase().includes(q),
            );
            if (q && hit) {
              setTab(hit.id);
              setSearch("");
            }
          }}
        >
          <span>⌕</span>
          <input
            aria-label="Search I/O lessons"
            placeholder={
              tab === "mapped"
                ? "Search lessons, e.g. “DMA”"
                : "Search topics, components, or simulations..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <kbd>⌘ K</kbd>
        </form>
        <div className="io-progress">
          <small>{tab === "bus" ? "Studio" : "Learning"} Progress</small>
          <div>
            <span style={{ width: `${tab === "mapped" ? 42 : 68}%` }} />
          </div>
          <b>{tab === "mapped" ? 42 : 68}%</b>
        </div>
        <Link
          to="?view=theory"
          className="io-book"
          aria-label="Read I/O textbook"
        >
          <IoIcon name="book" />
        </Link>
        <span className="io-avatar">JD</span>
      </header>
      <nav className="io-tabs" aria-label="I/O architecture labs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "selected" : ""}
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => setTab(t.id)}
          >
            <IoIcon name={t.icon} size={23} />
            <span>
              {t.label}
              {tab === "dma" && <small>{t.sub}</small>}
            </span>
          </button>
        ))}
      </nav>
      <div key={tab} className="io-lab">
        {tab === "mapped" ? (
          <MmioLab />
        ) : tab === "isolated" ? (
          <PortLab />
        ) : tab === "poll" ? (
          <PollingLab />
        ) : tab === "interrupts" ? (
          <InterruptLab />
        ) : tab === "dma" ? (
          <DmaLab />
        ) : (
          <BusLab />
        )}
      </div>
      <span className="io-sr-only" aria-live="polite">
        Lab {current + 1} of 6
      </span>
    </div>
  );
}
function MmioLab() {
  useSimulatorCapture("studios/io/IoStudio.tsx:MmioLab", () => ({ address, data, operation, value, direction, readback, ram, stage, running, speed, zoom, message }), "8939271442ed");

  const [address, setAddress] = useState("0x8000"),
    [data, setData] = useState("0xA5"),
    [operation, setOperation] = useState("write"),
    [value, setValue] = useState(0xa5),
    [direction, setDirection] = useState(255),
    [readback, setReadback] = useState(0xa5),
    [ram, setRam] = useState<Record<number, number>>({}),
    [stage, setStage] = useState(4),
    [running, setRunning] = useState(false),
    [speed, setSpeed] = useState(1),
    [zoom, setZoom] = useState(100),
    [message, setMessage] = useState(
      "Address decoded → GPIO selected → Data written",
    );
  const addr = parseHex(address, 65535),
    byte = parseHex(data, 255),
    selected = addr === null ? "Unmapped" : decodeAddress(addr);
  function access() {
    if (addr === null || byte === null) return;
    setStage(0);
    setRunning(true);
    setMessage("CPU places address on the bus");
  }
  function step() {
    if (stage >= 4) {
      setRunning(false);
      return;
    }
    const next = stage + 1;
    setStage(next);
    if (next === 1) setMessage(`Address decoded → ${selected} selected`);
    if (next === 2) {
      if (selected === "Unmapped") {
        setMessage("Unmapped address — no device selected");
        setReadback(0);
      } else if (operation === "write") {
        if (selected === "RAM") setRam((r) => ({ ...r, [addr!]: byte! }));
        else if (addr === 0x8000) setValue(byte!);
        else if (addr === 0x8001) setDirection(byte!);
        setReadback(byte!);
        setMessage(`${hex(byte!)} written to ${selected}`);
      } else {
        const result =
          selected === "RAM"
            ? (ram[addr!] ?? 0)
            : addr === 0x8000
              ? value
              : addr === 0x8001
                ? direction
                : 0;
        setReadback(result);
        setData(hex(result));
        setMessage(`${selected} register read → ${hex(result)}`);
      }
    }
    if (next === 4) {
      setRunning(false);
      setMessage(
        selected === "Unmapped"
          ? "Bus error: no device at this address"
          : `Address decoded → ${selected} selected → ${operation === "write" ? "Data written" : "Data read"}`,
      );
    }
  }
  usePlayback(step, running, speed);
  const bits = (v: number) => setData(hex(v));
  const out = value & direction;
  return (
    <>
      <Title
        title="Memory-Mapped I/O"
        description="Interact with a memory-mapped peripheral by writing to its registers and see the hardware respond in real time."
      />
      <div
        className="io-mmio-grid"
        style={
          {
            "--io-zoom": zoom / 100,
            "--io-animation-duration": `${1.6 / speed}s`,
          } as CSSProperties
        }
      >
        <Panel title="Bus Access Controls" className="io-access">
          <HexField
            label="Address (16-bit)"
            value={address}
            onChange={setAddress}
          />
          <HexField
            label="Data (8-bit)"
            value={data}
            onChange={setData}
            max={255}
          />
          <fieldset>
            <legend>Operation</legend>
            <label>
              <input
                type="radio"
                name="mmio-operation"
                checked={operation === "read"}
                onChange={() => setOperation("read")}
              />
              Read
            </label>
            <label>
              <input
                type="radio"
                name="mmio-operation"
                checked={operation === "write"}
                onChange={() => setOperation("write")}
              />
              Write
            </label>
          </fieldset>
          <button
            className="io-primary io-full"
            disabled={addr === null || byte === null}
            onClick={access}
          >
            <IoIcon name="play" size={17} />
            Execute Access
          </button>
        </Panel>
        <section className="io-mmio-board io-dark">
          <div className="io-access-banner" role="status">
            <span>✓</span>
            {message}
          </div>
          <div className="io-mmio-circuit">
            <Board
              label="CPU address decoder connected to RAM and GPIO"
              viewBox="0 0 730 390"
            >
              <Wire
                d="M155 167H390"
                color="#187aff"
                label="Address Bus (16-bit)"
                x={270}
                y={153}
              />
              <Arrow x={382} y={167} color="#5abaff" />
              <Wire
                d="M155 219H390"
                color="#ffbd16"
                label="Data Bus (8-bit)"
                x={270}
                y={205}
              />
              <Arrow x={164} y={219} color="#ffcd23" direction="left" />
              <Arrow x={382} y={219} color="#ffcd23" />
              <Wire
                d="M155 263H390"
                color="#ab6aff"
                label="Control Bus"
                x={270}
                y={288}
              />
              <Arrow x={382} y={263} color="#bf7aff" />
              <Wire
                d="M495 182H522V93H565"
                color="#177aff"
                active={selected === "RAM"}
              />
              <Wire
                d="M495 198H535V120H565"
                color="#815fff"
                active={selected === "RAM"}
              />
              <Wire
                d="M495 219H540V278H565"
                color="#ffb311"
                active={selected === "GPIO"}
              />
              <Wire
                d="M495 236H527V298H565"
                color="#00e5b2"
                active={selected === "GPIO"}
              />
              <Chip
                x={24}
                y={151}
                w={128}
                h={145}
                title="CPU"
                sub={["AIMER32", "RISC-V"]}
              />
              <Chip x={400} y={170} w={96} h={104} title="Address|Decoder" />
              <Chip
                x={572}
                y={72}
                w={133}
                h={112}
                title="RAM"
                sub={["0x0000 – 0x7FFF", "32 KB"]}
                glow={selected === "RAM" ? "#268bff" : undefined}
              />
              <Chip
                x={572}
                y={253}
                w={133}
                h={120}
                title="GPIO"
                sub={["0x8000 – 0x800F", "8-bit"]}
                glow={selected === "GPIO" ? "#00e8ae" : undefined}
              />
              <g fill="#bcc8ff" fontSize="12">
                <text x="204" y="314">
                  RD
                </text>
                <text x="246" y="314">
                  WR
                </text>
                <text x="286" y="314">
                  CS
                </text>
              </g>
            </Board>
          </div>
          <div className="io-address-map">
            <h3>
              Address Map <small>(16-bit)</small>
            </h3>
            <div className={selected === "RAM" ? "active-ram" : ""}>
              <span>0x0000 – 0x7FFF</span>
              <b>RAM</b>
              <small>32 KB</small>
            </div>
            <div className={selected === "GPIO" ? "active-gpio" : ""}>
              <span>0x8000 – 0x800F</span>
              <b>GPIO</b>
              <small>16 bytes</small>
            </div>
            <table>
              <tbody>
                {Array.from({ length: 8 }, (_, i) => (i === 7 ? 15 : i)).map(
                  (i) => (
                    <tr
                      key={i}
                      className={addr === 0x8000 + i ? "selected" : ""}
                    >
                      <td>{hex(0x8000 + i, 4)}</td>
                      <td>
                        {i === 0 ? "DATA" : i === 1 ? "DIR" : "(reserved)"}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          <div className="io-gpio-register">
            <div>
              <h4>
                GPIO DATA Register <span>(0x8000)</span>
              </h4>
              <p>
                Data:{" "}
                <strong key={value} className="io-value-flash">
                  {hex(value)}
                </strong>
              </p>
              <div className="io-bits">
                {Array.from({ length: 8 }, (_, i) => 7 - i).map((b) => (
                  <button
                    className={(value >> b) & 1 ? "on" : ""}
                    key={b}
                    aria-label={`Toggle DATA bit ${b}`}
                    onClick={() => {
                      const next = value ^ (1 << b);
                      setValue(next);
                      setReadback(next);
                      bits(next);
                    }}
                  >
                    <small>{b}</small>
                    {(value >> b) & 1}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h4>
                GPIO Output LEDs <span>(from DATA register)</span>
              </h4>
              <LedBank
                value={out}
                onChange={(v) => {
                  setValue(v);
                  setData(hex(v));
                  setReadback(v);
                }}
              />
            </div>
          </div>
        </section>
        <aside className="io-mmio-right">
          <Panel
            title="Guided Challenge"
            icon="target"
            action={<Badge tone="gray">MMIO-1</Badge>}
          >
            <h4>Light LEDs 7, 5, 2 and 0</h4>
            <p>
              Write a value to the GPIO DATA register so that LEDs 7, 5, 2 and 0
              are ON (and the others are OFF).
            </p>
            <Hint>
              Set the corresponding bits to 1.
              <br />
              The correct value is <b>0xA5</b>.
            </Hint>
            {out === 0xa5 && stage === 4 && (
              <span className="io-sr-only" role="status">
                Challenge complete
              </span>
            )}
          </Panel>
          <Panel title="Register Inspector" icon="chip">
            <StatRows
              rows={[
                ["DATA　(0x8000)", <Badge>{hex(value)}</Badge>],
                ["DIR　 (0x8001)", <Badge tone="gray">{hex(direction)}</Badge>],
                ["Readback (DATA)", <Badge>{hex(readback)}</Badge>],
              ]}
            />
          </Panel>
          <Panel
            title="GPIO Device View"
            icon="port"
            action={<Badge>Active</Badge>}
          >
            <LedBank value={out} compact />
          </Panel>
        </aside>
      </div>
      <div className="io-mmio-bottom">
        <Panel title="Transaction Timeline">
          <div className="io-transactions">
            {[
              ["Address", `CPU places ${address} on address bus`],
              ["Decode", `Address decoded → ${selected} selected`],
              [
                operation === "read" ? "Read" : "Write",
                `Data ${data} ${operation === "read" ? "read from" : "written to"} ${selected}`,
              ],
              [
                "Complete",
                `${operation === "read" ? "Read" : "Write"} cycle complete`,
              ],
            ].map(([a, b], i) => (
              <div className={stage >= i + 1 ? "done" : ""} key={a}>
                <span>{i + 1}</span>
                <div>
                  <b>{a}</b>
                  <small>{b}</small>
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Simulation Controls">
          <Transport
            running={running}
            onPlay={() => {
              if (stage >= 4) access();
              else setRunning(!running);
            }}
            onStep={() => {
              setRunning(false);
              if (stage >= 4) setStage(0);
              else step();
            }}
            onReset={() => {
              setRunning(false);
              setStage(0);
              setValue(0);
              setReadback(0);
              setMessage("Ready for a bus access");
            }}
            speed={speed}
            setSpeed={setSpeed}
            zoom={zoom}
            setZoom={setZoom}
            compact
          />
        </Panel>
      </div>
    </>
  );
}
function PortLab() {
  useSimulatorCapture("studios/io/IoStudio.tsx:PortLab", () => ({ port, byte, instruction, terminal, buffer, cycle, running, speed, zoom, al, trace }), "8939271442ed");

  const [port, setPort] = useState("0x20"),
    [byte, setByte] = useState("0x41"),
    [instruction, setInstruction] = useState("OUT"),
    [terminal, setTerminal] = useState("A"),
    [buffer, setBuffer] = useState<number[]>([65]),
    [cycle, setCycle] = useState(4),
    [running, setRunning] = useState(false),
    [speed, setSpeed] = useState(1),
    [zoom, setZoom] = useState(100),
    [al, setAl] = useState(65),
    [trace, setTrace] = useState<string[]>([
      "Fetch|OUT 0x20, AL",
      "Decode|I/O write cycle",
      "Set address|A = 0x0020",
      "Set data|D = 0x41",
      "Assert IOW#|IOW# = 0 (active)",
      "Device write|UART_TX = 0x41",
      "Complete|IOW# = 1",
      "UART|Byte queued (0x41)",
      "Terminal|Character 'A' displayed",
    ]),
    [notice, setNotice] = useState("");
  const address = parseHex(port, 255),
    data = parseHex(byte, 255),
    valid = address !== null && data !== null;
  function step() {
    if (!valid) return;
    const next = (cycle + 1) % 9;
    setCycle(next);
    let entry = "";
    if (next === 0) entry = `Fetch|${instruction} ${port}, AL`;
    if (next === 1)
      entry = `Decode|I/O ${instruction === "OUT" ? "write" : "read"} cycle`;
    if (next === 2) entry = `Set address|A = ${hex(address, 4)}`;
    if (next === 3) {
      if (instruction === "OUT") setAl(data);
      entry = `Set data|D = ${hex(data)}`;
    }
    if (next === 4)
      entry = `Assert ${instruction === "OUT" ? "IOW" : "IOR"}#|Active (0)`;
    if (next === 5) {
      if (address === 0x20 && instruction === "OUT") {
        setBuffer((b) => [...b.slice(-4), data]);
        entry = `Device write|UART_TX = ${hex(data)}`;
      } else if (instruction === "IN" && address === 0x21) {
        setAl(0x60);
        entry = "Device read|UART ready = 0x60";
        setNotice("IN read UART status: AL = 0x60");
      } else {
        entry = "Unmapped port|No device responds";
        setNotice("Choose UART TX (0x20) for OUT or status (0x21) for IN.");
      }
    }
    if (next === 6) entry = "Complete|Bus strobe released";
    if (next === 7) entry = `UART|Byte queued (${hex(al)})`;
    if (next === 8) {
      if (address === 0x20 && instruction === "OUT") {
        const char = String.fromCharCode(data);
        setTerminal((t) => (t + char).slice(-18));
        setNotice(`Transmitted '${char}' (${hex(data)})`);
        entry = `Terminal|Character '${char}' displayed`;
      }
      setRunning(false);
    }
    setTrace((t) => [...t.slice(-15), entry]);
  }
  usePlayback(step, running, speed);
  function reset() {
    setRunning(false);
    setCycle(0);
    setTrace([]);
    setTerminal("");
    setBuffer([]);
    setNotice("");
    setAl(65);
  }
  return (
    <>
      <div
        className="io-port-grid"
        style={
          {
            "--io-zoom": zoom / 100,
            "--io-animation-duration": `${1.6 / speed}s`,
          } as CSSProperties
        }
      >
        <aside className="io-port-left">
          <Panel title="Program & I/O Controls" icon="chip">
            <div className="io-code-heading">
              <b>Assembly Code</b>
              <button onClick={reset}>⟲ Reset</button>
            </div>
            <Code
              lines={[
                "; Send a character to UART",
                "MOV  AL, 0x41       ; 'A'",
                `${instruction}  ${port}, AL     ; TX port`,
                "IN   AL, 0x21       ; Read status",
                "; …",
              ]}
              active={cycle < 2 ? 1 : 2}
            />
            <label className="io-field">Instruction</label>
            <div className="io-segment">
              <button
                className={instruction === "OUT" ? "io-primary" : ""}
                onClick={() => {
                  setInstruction("OUT");
                  setPort("0x20");
                  setCycle(0);
                }}
              >
                OUT (Write to port)
              </button>
              <button
                className={instruction === "IN" ? "io-primary" : ""}
                onClick={() => {
                  setInstruction("IN");
                  setPort("0x21");
                  setCycle(0);
                }}
              >
                IN (Read from port)
              </button>
            </div>
            <HexField
              label="Port address (hex)"
              value={port}
              onChange={setPort}
              max={255}
            />
            <label className="io-field">Data byte (hex)</label>
            <div className="io-byte-presets">
              <input
                aria-label="Port data byte"
                aria-invalid={data === null}
                value={byte}
                onChange={(e) => {
                  setByte(e.target.value);
                  setCycle(0);
                }}
              />
              {[65, 66, 67, 68].map((b) => (
                <button
                  className={data === b ? "io-primary" : ""}
                  key={b}
                  onClick={() => {
                    setByte(hex(b));
                    setAl(b);
                    setCycle(0);
                  }}
                >
                  '{String.fromCharCode(b)}'
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Address Maps" icon="bus">
            <div className="io-map-section memory">
              <b>Memory address space</b>
              <small>(RAM, ROM, memory-mapped devices)</small>
            </div>
            <div className="io-map-lines">
              <span>0x0000_0000 – 0x000F_FFFF　 System ROM</span>
              <span>0x0010_0000 – 0x00FF_FFFF　 RAM</span>
              <span>0xF000_0000 – 0xFFFF_FFFF　 MMIO (devices)</span>
            </div>
            <div className="io-map-section ports">
              <b>I/O address space</b>
              <small>(Port-mapped I/O devices)</small>
            </div>
            <div className="io-map-lines">
              <span>0x00 – 0x1F　　 System ports</span>
              <span className="selected">0x20 – 0x21　　 UART (COM1)</span>
              <span>0x22 – 0x3F　　 Other I/O devices</span>
              <span>0x40 – 0xFF　　 Expansion / reserved</span>
            </div>
          </Panel>
        </aside>
        <section className="io-port-main">
          <Title
            title="Port-Mapped I/O"
            description="The CPU uses a separate I/O address space to communicate with devices via IN and OUT instructions."
          />
          <div className="io-port-board io-dark">
            <Board
              label="Port mapped I/O: Intel processor, memory, UART controller and serial terminal"
              viewBox="0 0 840 700"
            >
              <rect width="840" height="700" fill="url(#io-dots)" />
              <Wire
                d="M375 215V320Q375 332 361 332H155Q140 332 140 350V405"
                color="#35ffb5"
                label="Memory space"
                x={160}
                y={285}
              />
              <Wire
                d="M395 215V337Q395 350 379 350H175Q160 350 160 367V405"
                color="#63ffc8"
              />
              <Arrow x={140} y={385} color="#45ffb7" direction="down" />
              <Wire
                d="M417 215V320Q417 332 431 332H497Q511 332 511 347V405"
                color="#ab36ff"
                label="I/O space"
                x={500}
                y={285}
              />
              <Wire
                d="M437 215V305Q437 317 451 317H515Q531 317 531 332V405"
                color="#c979ff"
              />
              <Arrow x={417} y={243} color="#c46aff" direction="up" />
              <Chip
                x={320}
                y={48}
                w={190}
                h={177}
                title="intel.|i486|DX2™"
                silver
              />
              <Chip
                x={42}
                y={425}
                w={228}
                h={124}
                title="SAMSUNG"
                sub={["K4S561632D-TC75", "446"]}
              />
              <Chip
                x={410}
                y={425}
                w={140}
                h={132}
                title="FTDI"
                sub={["FT232RL", "2410-C", "G1ASQ.1"]}
              />
              <Wire
                d="M562 490H667"
                color="#00d8ff"
                label="TX (serial data)"
                x={614}
                y={462}
              />
              <Arrow x={635} y={490} />
              <SvgBox
                x={24}
                y={25}
                w={231}
                h={178}
                title="Bus Signals (current cycle)"
              >
                <g className="io-svg-mono" fontSize="14" fill="#d3e7f9">
                  {[
                    [
                      "IOR#",
                      instruction === "IN" && cycle === 4
                        ? "0  (active)"
                        : "1  (inactive)",
                    ],
                    [
                      "IOW#",
                      instruction === "OUT" && cycle === 4
                        ? "0  (active)"
                        : "1  (inactive)",
                    ],
                    ["MEM#", "1  (inactive)"],
                    ["A[15:0]", hex(address ?? 0, 4)],
                    ["D[7:0]", hex(data ?? 0)],
                  ].map(([a, b], i) => (
                    <text
                      key={a}
                      x="14"
                      y={55 + i * 26}
                      fill={
                        i === (instruction === "IN" ? 0 : 1) && cycle === 4
                          ? "#ff716b"
                          : "#d3e7f9"
                      }
                    >
                      {a}
                      <tspan x="88">{b}</tspan>
                    </text>
                  ))}
                </g>
              </SvgBox>
              <SvgBox
                x={585}
                y={25}
                w={234}
                h={163}
                title="CPU State (after execution)"
              >
                <g fill="#c7e1f4" fontSize="13" className="io-svg-mono">
                  <text x="14" y="60" fill="#37ffcc">
                    AL　　{hex(al)}　 '{String.fromCharCode(al)}'
                  </text>
                  <text x="14" y="91">
                    IP　　 {hex(cycle, 8)}
                  </text>
                  <text x="14" y="118">
                    EAX　　{hex(al, 8)}
                  </text>
                  <text x="14" y="145">
                    Flags　 - - - - - - -
                  </text>
                </g>
              </SvgBox>
              <SvgBox x={610} y={226} w={209} h={183} title="UART (COM1)">
                <text x="13" y="48" fill="#e3edff" fontSize="13">
                  TX Buffer
                </text>
                {Array.from({ length: 5 }, (_, i) => (
                  <g key={i}>
                    <rect
                      x={13 + i * 37}
                      y="58"
                      width="33"
                      height="34"
                      rx="4"
                      fill={buffer[i] !== undefined ? "#123bac" : "#0c1f2e"}
                      stroke="#306780"
                    />
                    <text
                      x={29 + i * 37}
                      y="80"
                      textAnchor="middle"
                      fill="#d4ecff"
                      fontSize="12"
                    >
                      {buffer[i] !== undefined ? hex(buffer[i]!) : ""}
                    </text>
                  </g>
                ))}
                <text x="13" y="120" fill="#e2edff" fontSize="13">
                  Transmitted Character
                </text>
                <text x="39" y="161" fill="white" fontSize="32">
                  {terminal.slice(-1) || "—"}
                </text>
                <text x="93" y="155" fill="#bdcee4" fontSize="13">
                  ({hex(al)})
                </text>
              </SvgBox>
              <g transform="translate(664 456)">
                <rect
                  width="157"
                  height="151"
                  rx="8"
                  fill="#292e32"
                  stroke="#8b999b"
                />
                <rect
                  x="8"
                  y="23"
                  width="141"
                  height="99"
                  rx="4"
                  fill="#001308"
                  stroke="#51635b"
                />
                <text x="12" y="16" fill="white" fontSize="11">
                  Serial Terminal (Receiver)
                </text>
                <text
                  x="18"
                  y="50"
                  fill="#54fda5"
                  fontSize="19"
                  fontFamily="monospace"
                >
                  <tspan key={terminal} className="io-terminal-output">
                    {terminal.slice(-10)}
                  </tspan>
                  <tspan className="io-terminal-cursor">▌</tspan>
                </text>
                <text x="12" y="137" fill="#9da7af" fontSize="10">
                  Baud: 9600　8-N-1
                </text>
                <circle cx="140" cy="137" r="4" fill="#66ff45" />
              </g>
              <SvgBox x={25} y={600} w={240} h={91} title="RAM (Memory)">
                <text x="14" y="47" fill="#b8d4e7" fontSize="13">
                  8 MB SDRAM
                </text>
                <text x="14" y="69" fill="#b8d4e7" fontSize="12">
                  Connected to memory space
                </text>
              </SvgBox>
              <SvgBox
                x={374}
                y={600}
                w={240}
                h={91}
                title="UART Controller (COM1)"
              >
                <text x="14" y="47" fill="#b8d4e7" fontSize="13">
                  Base port: 0x20
                </text>
                <text x="14" y="69" fill="#b8d4e7" fontSize="12">
                  TX port: 0x20　 RX port: 0x21
                </text>
              </SvgBox>
            </Board>
          </div>
        </section>
        <aside className="io-port-right">
          <Panel title="Guided Challenge" icon="target">
            <h4>Send the letter A to the serial port</h4>
            <ChallengeSteps
              steps={[
                "Load AL with the ASCII value for 'A'",
                "Execute OUT to port 0x20 (UART TX)",
                "Observe the byte in the UART TX buffer",
                "See the character 'A' arrive in the terminal",
              ]}
              current={
                terminal.includes("A") ? 4 : cycle < 4 ? 1 : cycle < 6 ? 2 : 3
              }
            />
            {notice && (
              <p className="io-notice" role="status">
                {notice}
              </p>
            )}
          </Panel>
          <Panel
            title="Event Trace"
            icon="bus"
            action={
              <button className="io-text-button" onClick={() => setTrace([])}>
                ♲ Clear
              </button>
            }
          >
            <table className="io-trace">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cycle</th>
                  <th>Event</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {trace.map((line, i) => (
                  <tr
                    className={i === trace.length - 1 ? "current" : ""}
                    key={i}
                  >
                    <td>{12 + i}</td>
                    <td>T{i}</td>
                    <td>{line.split("|")[0]}</td>
                    <td>{line.split("|")[1]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </aside>
      </div>
      <Transport
        running={running}
        onPlay={() => {
          if (valid) setRunning(!running);
        }}
        onStep={() => {
          setRunning(false);
          step();
        }}
        onReset={reset}
        speed={speed}
        setSpeed={setSpeed}
        zoom={zoom}
        setZoom={setZoom}
        extra={
          <div className="io-legend-light">
            <span>🟩 Memory bus (MEM)</span>
            <span>🟪 I/O bus (IO)</span>
            <span>🟦 Data flow</span>
            <span>🟥 Active signal</span>
          </div>
        }
      />
    </>
  );
}
function Code({ lines, active = -1 }: { lines: string[]; active?: number }) {
  return (
    <pre className="io-code">
      {lines.map((line, i) => (
        <div className={i === active ? "active" : ""} key={i}>
          <span>{i === active ? "▶" : i + 1}</span>
          <code>{line}</code>
        </div>
      ))}
    </pre>
  );
}
function PollingLab() {
  useSimulatorCapture("studios/io/IoStudio.tsx:PollingLab", () => ({ latency, interval, byte, injected, cycle, running, speed, zoom }), "8939271442ed");

  const [latency, setLatency] = useState(12),
    [interval, setIntervalValue] = useState(2),
    [byte, setByte] = useState("0x4B"),
    [injected, setInjected] = useState(75),
    [cycle, setCycle] = useState(12),
    [running, setRunning] = useState(false),
    [speed, setSpeed] = useState(1),
    [zoom, setZoom] = useState(100);
  const totalCycles = Math.max(
    24,
    Math.ceil(latency / interval) * interval + 4,
  );
  const state = pollState(cycle, latency, interval);
  const parsed = parseHex(byte, 255);
  function step() {
    setCycle((c) => {
      if (c >= totalCycles - 1) {
        setRunning(false);
        return totalCycles;
      }
      return c + 1;
    });
  }
  usePlayback(step, running, speed);
  return (
    <>
      <Title
        title="Programmed I/O & Polling"
        description="CPU repeatedly checks device status until data is ready, then reads the byte."
        icon="keyboard"
      />
      <div
        className="io-poll-grid"
        style={
          {
            "--io-zoom": zoom / 100,
            "--io-animation-duration": `${1.6 / speed}s`,
          } as CSSProperties
        }
      >
        <aside>
          <Panel title="Device & Polling Controls" icon="keyboard">
            <NumberField
              label="Device latency (ready after)"
              value={latency}
              onChange={(n) => {
                setLatency(n);
                setCycle(0);
              }}
              max={32}
              unit="cycles"
              slider
            />
            <NumberField
              label="Polling interval (check every)"
              value={interval}
              onChange={(n) => {
                setIntervalValue(n);
                setCycle(0);
              }}
              max={16}
              unit="cycles"
              slider
            />
            <label className="io-field">Inject input byte (keyboard)</label>
            <div className="io-inject">
              <input
                aria-label="Input byte"
                value={byte}
                aria-invalid={parsed === null}
                onChange={(e) => setByte(e.target.value)}
              />
              <button
                className="io-primary"
                disabled={parsed === null}
                onClick={() => {
                  setInjected(parsed!);
                  setCycle(0);
                  setRunning(true);
                }}
              >
                <IoIcon name="send" size={18} />
                Inject byte
              </button>
            </div>
          </Panel>
          <Panel title="Device Status (live)" icon="port">
            <StatRows
              rows={[
                ["▣　READY", state.ready ? "1" : "0"],
                ["▣　DATA", hex(injected)],
                [
                  "●　Received (ASCII)",
                  state.received
                    ? `${String.fromCharCode(injected)}　(${hex(injected)})`
                    : "Waiting…",
                ],
              ]}
            />
          </Panel>
        </aside>
        <section className="io-poll-center">
          <div className="io-dark io-poll-board">
            <h3>
              <span className="io-live-dot" />
              System Simulation (Cycle {cycle} / {totalCycles})
              <small>🟡 Status check　 🟦 Data transfer　 ⚫ Idle</small>
            </h3>
            <div className="io-poll-schematic">
              <Board
                label="Polling loop between CPU and keyboard controller"
                viewBox="0 0 860 440"
              >
                <Wire
                  d="M152 80V45Q152 20 181 20H488Q510 20 510 55V53"
                  color="#ffc647"
                  label="① Check status (READY)"
                  x={335}
                  y={10}
                />
                <Arrow x={222} y={20} color="#ffce50" />
                <Arrow x={510} y={50} color="#ffce50" direction="down" />
                <Wire
                  d="M220 125H490"
                  color="#ffd03e"
                  dashed
                  label="Status (READY)"
                  x={355}
                  y={111}
                />
                <Arrow x={476} y={125} color="#ffce50" />
                <Wire
                  d="M490 190H220"
                  color="#00ddec"
                  dashed
                  label="Data (DATA)"
                  x={355}
                  y={174}
                  active={state.received}
                />
                <Arrow x={230} y={190} direction="left" />
                <Chip
                  x={60}
                  y={80}
                  w={155}
                  h={147}
                  title="CPU"
                  sub={["AIMER-32"]}
                />
                <Chip
                  x={495}
                  y={80}
                  w={153}
                  h={147}
                  title="Keyboard|Controller"
                  sub={["KBC-8042"]}
                />
                <Keyboard
                  x={690}
                  y={128}
                  onPress={() => {
                    if (parsed !== null) {
                      setInjected(parsed);
                      setCycle(0);
                      setRunning(true);
                    }
                  }}
                />
                <path d="M658 158h28" stroke="#b7cce0" strokeDasharray="7 6" />
                <path
                  d="M325 300l49-38 49 38-49 38z"
                  fill="#0a1c2d"
                  stroke="#ffd343"
                  strokeWidth="2"
                />
                <text
                  x="374"
                  y="305"
                  textAnchor="middle"
                  fill="white"
                  fontSize="15"
                >
                  READY?
                </text>
                <Wire d="M152 237V300Q152 315 175 315H326" color="#ffc647" />
                <Wire
                  d="M325 315H40Q24 315 24 292V205Q24 182 49 182"
                  color="#ffce50"
                />
                <Wire
                  d="M424 300H490Q515 300 515 275V237"
                  active={state.received}
                />
                <Wire
                  d="M374 339V370H455Q472 370 472 352V317"
                  active={state.received}
                />
                <g fill="#ffcc45" fontSize="15">
                  <text x="135" y="346">
                    No (0)
                  </text>
                  <text x="135" y="371">
                    Busy wait (loop)
                  </text>
                </g>
                <g fill="#b7cee8" fontSize="14">
                  <text x="661" y="254">
                    0x60　DATA
                  </text>
                  <text x="661" y="284">
                    0x64　STATUS
                  </text>
                  <text x="420" y="332">
                    Yes (1)
                  </text>
                </g>
                <text x="520" y="361" fill="#d4faff" fontSize="15">
                  ③ Read byte (DATA)
                </text>
              </Board>
            </div>
            <div className="io-poll-timeline">
              <h3>
                Timeline <span>(CPU activity)</span>
                <small>
                  🟡 Status read (not ready)　 🟦 Read data (transfer)　 ⚫ Idle
                </small>
              </h3>
              <div className="io-cycle-cells">
                {Array.from({ length: totalCycles }, (_, i) => (
                  <div
                    key={i}
                    className={`${i === cycle ? "current" : ""} ${i === state.receiveAt && state.received ? "transfer" : i > 0 && i < state.receiveAt && i % interval === 0 && i <= cycle ? "check" : ""}`}
                  >
                    <span />
                    {i % 2 === 0 && <small>{i}</small>}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <Transport
            running={running}
            onPlay={() => {
              if (cycle >= totalCycles) setCycle(0);
              setRunning(!running);
            }}
            onStep={() => {
              setRunning(false);
              step();
            }}
            onReset={() => {
              setRunning(false);
              setCycle(0);
            }}
            speed={speed}
            setSpeed={setSpeed}
            zoom={zoom}
            setZoom={setZoom}
            compact
            extra={
              <Badge tone="gray">
                Cycle: {cycle} / {totalCycles}
              </Badge>
            }
          />
        </section>
        <aside>
          <Panel title="Polling Loop (C-like)" icon="code">
            <Code
              lines={[
                "uint8_t data;",
                "",
                "while (!(READ8(0x64) & 0x01)) {",
                "    // busy wait (polling)",
                "}",
                "data = READ8(0x60);",
                `// data = ${hex(injected)} ('${String.fromCharCode(injected)}')`,
              ]}
              active={state.received ? 5 : 2}
            />
          </Panel>
          <Panel
            title="Guided Challenge"
            icon="target"
            action={<Badge tone="amber">Medium</Badge>}
          >
            <h4>Reduce wasted status checks</h4>
            <p>
              The CPU is polling the device. Adjust the polling interval to
              reduce unnecessary status reads while still receiving the byte
              correctly.
            </p>
            <ul className="io-checklist">
              <li className={state.received ? "done" : ""}>
                Receive the injected byte ({hex(injected)})
              </li>
              <li className={state.received && state.wasted <= 1 ? "done" : ""}>
                Minimize total status reads
              </li>
              <li className={interval >= 4 ? "done" : ""}>
                Try a larger polling interval
              </li>
            </ul>
            <div className="io-big-stats">
              <div>
                <small>Status reads　🟡</small>
                <b>{state.reads}</b>
              </div>
              <div>
                <small>Bytes received　🟢</small>
                <b>{state.received ? 1 : 0}</b>
              </div>
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}
const IRQ_MESSAGES = [
  "Main program executing at PC 0x1040",
  "Device event: key 'K' (0x4B)",
  "CPU acknowledges IRQ 1; context saved",
  "ISR reads data from port 0x60: 0x4B",
  "ISR completed; restoring context",
  "IRET: resuming at PC 0x1040",
];
function InterruptLab() {
  useSimulatorCapture("studios/io/IoStudio.tsx:InterruptLab", () => ({ stage, masked, pending, priority, eventInterval, running, speed, zoom, view, codeView, log }), "8939271442ed");

  const [stage, setStage] = useState(3),
    [masked, setMasked] = useState(false),
    [pending, setPending] = useState(false),
    [priority, setPriority] = useState("IRQ 1 (Keyboard)"),
    [eventInterval, setEventInterval] = useState(3000),
    [running, setRunning] = useState(false),
    [speed, setSpeed] = useState(1),
    [zoom, setZoom] = useState(100),
    [view, setView] = useState("Schematic"),
    [codeView, setCodeView] = useState("Keyboard ISR (IRQ 1)"),
    [log, setLog] = useState(IRQ_MESSAGES.slice(1));
  function step() {
    if (stage === 0) return;
    if (masked && pending) {
      setLog((l) => [
        ...l.slice(-10),
        "IRQ 1 pending — masked by interrupt settings",
      ]);
      setRunning(false);
      return;
    }
    const next = stage >= 5 ? 0 : stage + 1;
    setStage(next);
    setLog((l) => [...l.slice(-10), IRQ_MESSAGES[next]!]);
    if (next === 5) setPending(false);
  }
  usePlayback(step, running, speed);
  function pressKey() {
    setPending(true);
    setStage(1);
    setLog((l) => [
      ...l.slice(-10),
      "Device event: key 'K' (0x4B)",
      masked ? "IRQ 1 pending (masked)" : "IRQ 1 raised by keyboard",
    ]);
    if (!masked) setRunning(true);
  }
  useEffect(() => {
    if (!running || stage !== 0) return;
    const timer = window.setTimeout(pressKey, eventInterval / speed);
    return () => window.clearTimeout(timer);
  }, [running, stage, eventInterval, speed, masked]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "k" ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement
      )
        return;
      pressKey();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [masked]);
  const servicing = stage >= 2 && stage <= 4;
  const pc =
    stage === 2 ? "0x0000F010" : stage === 3 ? "0x0000F020" : "0x00001040";
  return (
    <>
      <div
        className="io-irq-grid"
        style={
          {
            "--io-zoom": zoom / 100,
            "--io-animation-duration": `${1.6 / speed}s`,
          } as CSSProperties
        }
      >
        <aside className="io-irq-left">
          <Title
            title="Interrupt-Driven I/O"
            description="Explore how devices use interrupts to get CPU attention, run an ISR, and return to the main program."
            icon="bell"
          />
          <Panel title="Device Controls" icon="bus">
            <div className="io-device-line">
              <IoIcon name="keyboard" size={27} />
              <b>Keyboard Input</b>
              <Badge>{pending ? "Pending" : "◉ Ready"}</Badge>
            </div>
            <p className="io-indented">
              Simulate a key press from the keyboard controller.
            </p>
            <button className="io-primary io-full" onClick={pressKey}>
              <IoIcon name="keyboard" />
              Press key <kbd>K</kbd>
            </button>
            <hr />
            <h4>
              <IoIcon name="bell" />
              Interrupt Settings
            </h4>
            <label className="io-toggle-row">
              Mask IRQ 1
              <input
                role="switch"
                type="checkbox"
                checked={masked}
                onChange={(e) => {
                  setMasked(e.target.checked);
                  if (!e.target.checked && pending) setRunning(true);
                }}
              />
            </label>
            <label className="io-field">
              Interrupt Priority
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option>IRQ 1 (Keyboard)</option>
                <option>IRQ 0 (Timer first)</option>
              </select>
            </label>
            <NumberField
              label="Device Event Interval"
              value={eventInterval}
              onChange={setEventInterval}
              min={500}
              max={10000}
              unit="ms"
            />
            <small className="io-muted">
              Automatic key events during continuous play.
            </small>
          </Panel>
        </aside>
        <section
          className={`io-irq-center io-dark io-view-${view.toLowerCase()}`}
        >
          <h3>
            <IoIcon name="chip" />
            System Simulation
            <small>🔵 IRQ Signal　 🟣 Data Bus　 ┄ Control Bus</small>
          </h3>
          <div className="io-irq-hardware">
            {view === "Signals" && (
              <div className="io-irq-signal-overlay">
                <h4>Live interrupt signals — stage {stage}</h4>
                {[
                  ["IRQ 1", pending ? 1 : 0],
                  ["CPU IF", servicing ? 0 : 1],
                  ["ISR ACTIVE", stage === 3 ? 1 : 0],
                  ["IRQ MASK", masked ? 1 : 0],
                  ["DATA", stage >= 3 ? "0x4B" : "—"],
                ].map(([name, value]) => (
                  <div key={name}>
                    <b>{name}</b>
                    <code>{value}</code>
                    <span className={value === 1 ? "high" : ""} />
                  </div>
                ))}
              </div>
            )}
            <Board
              label="Interrupt driven CPU, interrupt controller and keyboard with saved context"
              viewBox="0 0 900 390"
            >
              <g opacity=".45">
                {Array.from({ length: 28 }, (_, i) => (
                  <g key={i}>
                    <path
                      d={`M${i * 34} 0v${65 + (i % 5) * 27}h${i % 2 ? 100 : -100}v${100 + (i % 4) * 37}`}
                      stroke={i % 3 ? "#47564b" : "#787144"}
                      fill="none"
                      strokeWidth={i % 4 === 0 ? 5 : 2}
                    />
                    <circle
                      cx={i * 33 + 12}
                      cy={27 + (i % 7) * 40}
                      r="4"
                      fill="#859675"
                    />
                    <rect
                      x={i * 31}
                      y={160 + (i % 5) * 35}
                      width="9"
                      height="16"
                      rx="2"
                      fill="#676e57"
                    />
                  </g>
                ))}
              </g>
              <Wire
                d="M660 220H455"
                active={pending || servicing}
                label="IRQ 1"
                x={570}
                y={201}
              />
              <Arrow x={535} y={220} />
              <Wire
                d="M333 220H245"
                active={(pending || servicing) && !masked}
              />
              <Arrow x={267} y={220} direction="left" />
              <Wire
                d="M668 292H619V347H291Q273 347 273 327V281H245"
                color="#ae48ff"
                active={servicing}
                label="Data Bus (8-bit)"
                x={460}
                y={372}
              />
              <Arrow x={505} y={347} color="#b86aff" direction="left" />
              <Arrow x={348} y={347} color="#b86aff" direction="left" />
              <Chip
                x={73}
                y={188}
                w={168}
                h={151}
                title="CPU"
                sub={["AIMER-CPU", "x86-64"]}
                silver
              />
              <Chip
                x={343}
                y={190}
                w={116}
                h={132}
                title="Interrupt|Controller"
                sub={["PIC/APIC"]}
              />
              <Chip
                x={665}
                y={192}
                w={129}
                h={139}
                title="Keyboard|Controller"
                sub={["8042"]}
              />
              <g transform="translate(820 220)">
                <rect
                  width="54"
                  height="66"
                  rx="6"
                  fill="#2e3336"
                  stroke="#8b8c82"
                />
                <rect
                  x="6"
                  y="7"
                  width="42"
                  height="49"
                  rx="4"
                  fill="#121923"
                  stroke="#c2c8cb"
                />
                <text
                  x="27"
                  y="42"
                  textAnchor="middle"
                  fill="white"
                  fontSize="34"
                >
                  K
                </text>
              </g>
              <SvgBox x={62} y={13} w={236} h={139} title="CPU State">
                <text
                  x="15"
                  y="51"
                  fill="#13f0e6"
                  fontSize="17"
                  fontWeight="600"
                >
                  {servicing
                    ? "Servicing IRQ 1"
                    : pending
                      ? "IRQ pending"
                      : "Executing main program"}
                </text>
                <g fill="#bee5fb" fontSize="13" className="io-svg-mono">
                  <text x="15" y="79">
                    PC　　 {pc}
                  </text>
                  <text x="15" y="103">
                    SP　　 {servicing ? "0x7FFE0010" : "0x7FFE0040"}
                  </text>
                  <text x="15" y="127">
                    FLAGS　0x00000202　{servicing ? "(IF=0)" : "(IF=1)"}
                  </text>
                </g>
              </SvgBox>
              <SvgBox x={628} y={63} w={200} h={87} title="Device Event">
                <circle cx="24" cy="52" r="9" fill="#00e9a5" />
                <text x="45" y="50" fill="#37a9ff" fontSize="17">
                  {pending || stage > 0 ? "Key pressed" : "Ready"}
                </text>
                <text x="45" y="72" fill="#a8c3ff" fontSize="14">
                  'K'　 (0x4B)
                </text>
              </SvgBox>
            </Board>
          </div>
          <div className="io-execution">
            <h4>Execution Timeline</h4>
            <div className="io-execution-steps">
              {[
                "Main Program",
                "Save Context",
                "Interrupt Service Routine",
                "Restore Context",
                "Resume Program",
              ].map((s, i) => (
                <button
                  onClick={() => {
                    setStage(i + 1);
                    setRunning(false);
                  }}
                  className={stage === i + 1 ? "active" : ""}
                  key={s}
                >
                  <b>
                    <span>{i + 1}</span>
                    {s}
                  </b>
                  <small>
                    {
                      [
                        "Executing useful work",
                        "Push PC, FLAGS, etc.",
                        "Handle device (read data)",
                        "Pop PC, FLAGS, etc.",
                        "Continue execution",
                      ][i]
                    }
                  </small>
                </button>
              ))}
            </div>
            <div className="io-execution-line">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={stage === i + 1 ? "active" : ""} />
              ))}
            </div>
          </div>
          <div className="io-irq-details">
            <div className="io-cpu-activity">
              <h4>
                CPU Activity <small>(real time)</small>
              </h4>
              <div>
                {Array.from({ length: 34 }, (_, i) => (
                  <i
                    key={i}
                    style={{
                      height: `${35 + ((i * 17) % 37)}px`,
                      animationDelay: `${-i * 0.13}s`,
                      background:
                        i < 14 ? "#12baff" : i < 23 ? "#b84bed" : "#1ac991",
                    }}
                  />
                ))}
              </div>
              <p>
                Executing useful work　 <span>Interrupt Handler (ISR)</span>
                　Resuming program
              </p>
            </div>
            <div className="io-isr">
              <h4>
                Code View (ISR)
                <select
                  aria-label="ISR code view"
                  value={codeView}
                  onChange={(e) => setCodeView(e.target.value)}
                >
                  <option>Keyboard ISR (IRQ 1)</option>
                  <option>Saved interrupt context</option>
                </select>
              </h4>
              <Code
                lines={
                  codeView === "Saved interrupt context"
                    ? [
                        "PC     0x00001040",
                        "SP     0x7FFE0040",
                        "FLAGS  0x00000202",
                        "RAX    0x00000000",
                        "RBX    0x00000000",
                        "RCX    0x00000000",
                      ]
                    : [
                        "0xF010:   push rax       ; save context",
                        "0xF011:   push rbx",
                        "0xF012:   push rcx",
                        "0xF013:   in   al, 0x60  ; read DATA from keyboard",
                        "0xF015:   mov [key_data], al",
                        "0xF018:   ... handle key ...",
                        "0xF020:   pop  rcx       ; restore context",
                        "0xF021:   pop  rbx",
                        "0xF022:   pop  rax",
                        "0xF023:   iret           ; return from interrupt",
                      ]
                }
                active={stage === 3 ? 3 : stage === 4 ? 6 : stage === 5 ? 9 : 0}
              />
              <div className="io-saved-context">
                <b>Saved Context (on stack)</b>
                <StatRows
                  rows={[
                    ["PC", "0x1040"],
                    ["FLAGS", "0x00000202"],
                    ["RAX", "0x00000000"],
                    ["RBX", "0x00000000"],
                    ["RCX", "0x00000000"],
                  ]}
                />
              </div>
            </div>
          </div>
        </section>
        <aside className="io-irq-right">
          <Panel
            title="Guided Challenge"
            icon="target"
            action={
              <Badge tone="amber">
                {stage === 5 ? "Complete" : "In Progress"}
              </Badge>
            }
          >
            <h4>Handle the interrupt and resume the program</h4>
            <p>
              Press a key on the keyboard, observe how the CPU handles the
              interrupt, and verify that the main program resumes at the correct
              address with its context restored.
            </p>
            <ChallengeSteps
              steps={[
                "A key press raises IRQ 1",
                "CPU acknowledges and runs the ISR",
                "ISR reads the keyboard data (0x60)",
                "Context is restored from the stack",
                "Program resumes at original PC (0x1040)",
              ]}
              current={stage === 5 ? 5 : Math.max(0, stage - 1)}
            />
            <Hint>
              The ISR reads the key from I/O port 0x60 and then returns with
              IRET, restoring the saved context.
            </Hint>
          </Panel>
          <Panel
            title="Event Log"
            icon="book"
            action={
              <button className="io-text-button" onClick={() => setLog([])}>
                Clear
              </button>
            }
          >
            <ul className="io-event-log">
              {log.map((s, i) => (
                <li key={i}>
                  <i />
                  <time>Cycle {i + 1}</time>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </aside>
      </div>
      <Transport
        running={running}
        onPlay={() => {
          if (stage === 0 || stage === 5) {
            pressKey();
          } else setRunning(!running);
        }}
        onStep={() => {
          setRunning(false);
          step();
        }}
        onReset={() => {
          setStage(0);
          setRunning(false);
          setPending(false);
          setLog([]);
        }}
        speed={speed}
        setSpeed={setSpeed}
        zoom={zoom}
        setZoom={setZoom}
        extra={
          <div className="io-view-buttons">
            <span>View</span>
            {["Schematic", "Layout", "Signals"].map((s) => (
              <button
                key={s}
                className={view === s ? "active" : ""}
                onClick={() => setView(s)}
              >
                {s}
              </button>
            ))}
          </div>
        }
      />
    </>
  );
}
function DmaLab() {
  useSimulatorCapture("studios/io/IoStudio.tsx:DmaLab", () => ({ source, dest, length, burst, cursor, memory, running, speed, zoom, started }), "8939271442ed");

  const [source, setSource] = useState("Storage Device FIFO"),
    [dest, setDest] = useState("0x2000"),
    [length, setLength] = useState(16),
    [burst, setBurst] = useState(4),
    [cursor, setCursor] = useState(8),
    [memory, setMemory] = useState<number[]>([
      ...FIFO.slice(0, 8),
      ...Array<number>(56).fill(0),
    ]),
    [running, setRunning] = useState(false),
    [speed, setSpeed] = useState(1),
    [zoom, setZoom] = useState(100),
    [started, setStarted] = useState(true);
  const done = cursor >= length,
    base = parseHex(dest, 65535),
    valid = base !== null && base + length <= 65536;
  function step() {
    if (!valid || done) {
      setRunning(false);
      return;
    }
    const result = dmaBurst(memory, cursor, length, burst);
    setMemory(result.memory);
    setCursor(result.cursor);
    if (result.done) setRunning(false);
  }
  usePlayback(step, running, speed);
  function start() {
    if (!valid) return;
    setMemory(Array<number>(64).fill(0));
    setCursor(0);
    setStarted(true);
    setRunning(true);
  }
  const status = done
    ? "Transfer complete"
    : started
      ? "Working independently"
      : "Ready to configure";
  return (
    <>
      <Title
        title="Direct Memory Access"
        description="Let a DMA controller transfer data directly between a device and memory, without CPU handling the data."
        aside={
          <div className="io-hands-on">
            <b>✓　Hands-on Simulation</b>
            <small>
              Adjust parameters, run the simulation, and observe the bus
              activity.
            </small>
          </div>
        }
      />
      <div
        className="io-dma-grid"
        style={
          {
            "--io-zoom": zoom / 100,
            "--io-animation-duration": `${1.6 / speed}s`,
          } as CSSProperties
        }
      >
        <Panel title="DMA Configuration">
          <label className="io-field">
            Source Device
            <select
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setRunning(false);
              }}
            >
              <option>Storage Device FIFO</option>
              <option>Network Device FIFO</option>
              <option>Sensor Sample FIFO</option>
            </select>
          </label>
          <HexField
            label="Destination Address"
            value={dest}
            onChange={(v) => {
              setDest(v);
              setRunning(false);
            }}
          />
          <NumberField
            label="Transfer Length"
            value={length}
            onChange={(v) => {
              setLength(v);
              setCursor(0);
              setRunning(false);
              setMemory(Array<number>(64).fill(0));
            }}
            max={64}
            unit="bytes"
          />
          <NumberField
            label="Burst Size"
            value={burst}
            onChange={setBurst}
            max={16}
            unit="bytes"
          />
          <button
            className="io-primary io-full"
            disabled={!valid}
            onClick={start}
          >
            <IoIcon name="play" size={19} />
            Start Transfer
          </button>
          <hr />
          <h4>Transfer Status</h4>
          <div className="io-progress-label">
            {cursor} / {length} bytes
          </div>
          <div className="io-transfer-progress">
            <span
              style={{ width: `${Math.min(100, (cursor / length) * 100)}%` }}
            />
          </div>
          <StatRows
            rows={[
              ["Bytes transferred", `${cursor} bytes`],
              ["Bytes remaining", `${Math.max(0, length - cursor)} bytes`],
              [
                "Current burst",
                `${Math.min(Math.ceil(length / burst), Math.ceil(cursor / burst))} of ${Math.ceil(length / burst)}`,
              ],
              ["CPU status", <span className="io-green">● {status}</span>],
            ]}
          />
          <small className="io-muted io-align-right">
            {done
              ? "Completion interrupt delivered."
              : "Executing other instructions…"}
          </small>
        </Panel>
        <section className="io-dma-board io-dark">
          <Board
            label="DMA controller moves device FIFO bytes directly to system RAM"
            viewBox="0 0 1170 610"
            className="io-dma-svg"
          >
            <Wire
              d="M402 130H275V304"
              dashed
              label="Control / Configuration (MMIO)"
              x={365}
              y={220}
            />
            <Wire d="M473 174V265" dashed />
            <Arrow x={473} y={249} direction="down" />
            <Wire d="M371 345H440" label="Read (DMA)" x={441} y={328} />
            <Wire d="M596 345H850" label="Write (DMA)" x={772} y={315} />
            {Array.from({ length: 7 }, (_, i) => (
              <Arrow key={i} x={392 + i * 77} y={345} />
            ))}
            <Wire
              d="M850 345V197H595V166H555"
              color="#a858ff"
              dashed
              active={done}
              label="Interrupt (on completion)"
              x={768}
              y={210}
            />
            <Chip
              x={405}
              y={38}
              w={130}
              h={125}
              title="CPU"
              sub={["AIMER", "RISC-V"]}
            />
            <Chip
              x={450}
              y={270}
              w={145}
              h={147}
              title="DMA|Controller"
              sub={["AIMER"]}
            />
            <Chip
              x={36}
              y={250}
              w={136}
              h={170}
              title={
                source.startsWith("Storage")
                  ? "NVMe SSD"
                  : source.startsWith("Network")
                    ? "Network"
                    : "Sensor"
              }
              sub={["Storage Device", "(Has DMA capability)"]}
            />
            <SvgBox x={182} y={257} w={189} h={154} title="Device FIFO (Data)">
              {FIFO.slice(0, 12).map((v, i) => (
                <g key={`${cursor}-${i}`} className="io-dma-byte">
                  <rect
                    x={22 + (i % 4) * 30}
                    y={42 + Math.floor(i / 4) * 27}
                    width="26"
                    height="24"
                    rx="3"
                    fill="#102e49"
                    stroke="#3f6a83"
                  />
                  <text
                    x={35 + (i % 4) * 30}
                    y={58 + Math.floor(i / 4) * 27}
                    fill="#c3e5fa"
                    textAnchor="middle"
                    fontSize="12"
                  >
                    {hex(v).slice(2)}
                  </text>
                </g>
              ))}
            </SvgBox>
            <SvgBox
              x={850}
              y={199}
              w={295}
              h={250}
              title="System RAM (Destination)"
            >
              {Array.from({ length: 5 }, (_, row) => (
                <g key={row}>
                  <text x="12" y={61 + row * 40} fill="#afcee4" fontSize="12">
                    {hex((base ?? 0x2000) + row * 4, 4)}
                  </text>
                  {Array.from({ length: 4 }, (_, col) => {
                    const i = row * 4 + col;
                    return (
                      <g key={col}>
                        <rect
                          className={
                            i < cursor && i >= cursor - burst
                              ? "io-memory-write"
                              : ""
                          }
                          x={73 + col * 50}
                          y={40 + row * 40}
                          width="47"
                          height="36"
                          rx="4"
                          fill={i < cursor ? "#0c4b8c" : "#102a40"}
                          stroke={
                            i < cursor && i >= cursor - burst
                              ? "#2bd6ff"
                              : "#456681"
                          }
                          strokeWidth={
                            i < cursor && i >= cursor - burst ? 2 : 1
                          }
                        />
                        <text
                          x={97 + col * 50}
                          y={62 + row * 40}
                          fill="#e8f1ff"
                          textAnchor="middle"
                          fontSize="13"
                        >
                          {i >= length ? "--" : hex(memory[i] ?? 0).slice(2)}
                        </text>
                      </g>
                    );
                  })}
                </g>
              ))}
            </SvgBox>
            <SvgBox x={639} y={30} w={223} h={99} title="CPU Status">
              <text x="15" y="47" fill="#31e6be" fontSize="16">
                ●　{done ? "IRQ received" : "Working independently"}
              </text>
              <text x="39" y="67" fill="#c0d9eb" fontSize="13">
                Running application code
              </text>
              <text x="39" y="85" fill="#c0d9eb" fontSize="13">
                while DMA transfers data.
              </text>
            </SvgBox>
            <SvgBox x={30} y={30} w={225} h={79} title="①　CPU configures DMA">
              <text x="42" y="48" fill="#c0d9eb" fontSize="12">
                CPU writes source, destination,
              </text>
              <text x="42" y="66" fill="#c0d9eb" fontSize="12">
                length and starts the transfer.
              </text>
            </SvgBox>
            <SvgBox x={231} y={433} w={240} h={97} title="②　DMA moves data">
              <text x="42" y="47" fill="#c0d9eb" fontSize="13">
                DMA controller reads from device
              </text>
              <text x="42" y="65" fill="#c0d9eb" fontSize="13">
                and writes directly to memory
              </text>
              <text x="42" y="83" fill="#c0d9eb" fontSize="13">
                in bursts (bypassing CPU).
              </text>
            </SvgBox>
            <SvgBox
              x={664}
              y={449}
              w={226}
              h={96}
              title="③　Interrupt on completion"
            >
              <text x="42" y="47" fill="#c0d9eb" fontSize="13">
                DMA triggers an interrupt
              </text>
              <text x="42" y="65" fill="#c0d9eb" fontSize="13">
                when all {length} bytes have been
              </text>
              <text x="42" y="83" fill="#c0d9eb" fontSize="13">
                transferred.
              </text>
            </SvgBox>
            {FIFO.slice(Math.max(0, cursor - burst), cursor)
              .slice(0, 4)
              .map((v, i) => (
                <g key={`${cursor}-${i}`} className="io-dma-byte">
                  <rect
                    x={727 + i * 34}
                    y="332"
                    width="31"
                    height="28"
                    rx="4"
                    fill="#0568c0"
                    stroke="#28dfff"
                  />
                  <text
                    x={742 + i * 34}
                    y="350"
                    fill="white"
                    textAnchor="middle"
                    fontSize="13"
                  >
                    {hex(v).slice(2)}
                  </text>
                </g>
              ))}
          </Board>
          <div className="io-dma-timeline">
            <h4>
              <IoIcon name="bus" size={18} />
              Bus Ownership Timeline
            </h4>
            <div>
              {[
                ["CPU setup", "Configure DMA registers", "purple"],
                ["DMA burst #1", `Transfer ${burst} bytes`, "blue"],
                ["CPU slot", "Execute instructions", "green"],
                [
                  `DMA burst #${Math.max(2, Math.ceil(cursor / burst))}`,
                  `Transfer ${burst} bytes`,
                  "blue",
                ],
                ["Completion IRQ", "Notify CPU", "purple"],
              ].map(([a, b, c], i) => (
                <div key={i} className={c}>
                  <b>{a}</b>
                  <small>{b}</small>
                </div>
              ))}
            </div>
            <div className="io-dma-times">
              <span>0 – 2</span>
              <span>2 – 6</span>
              <span>6 – 8</span>
              <span>8 – 12</span>
              <span>12 – 14</span>
            </div>
          </div>
        </section>
      </div>
      <Transport
        running={running}
        onPlay={() => {
          if (done) start();
          else setRunning(!running);
        }}
        onStep={() => {
          setRunning(false);
          if (!started) setStarted(true);
          step();
        }}
        onReset={() => {
          setRunning(false);
          setCursor(0);
          setMemory(Array<number>(64).fill(0));
          setStarted(false);
        }}
        speed={speed}
        setSpeed={setSpeed}
        zoom={zoom}
        setZoom={setZoom}
        extra={
          <div className="io-transfer-notice" role="status">
            <IoIcon name="dma" />
            <div>
              <b>
                {done
                  ? "Transfer complete — interrupt sent"
                  : `Transferring bytes ${cursor} – ${Math.min(length - 1, cursor + burst - 1)} (burst of ${burst})`}
              </b>
              <small>
                Address {hex((base ?? 0) + Math.max(0, cursor - burst), 4)} –{" "}
                {hex((base ?? 0) + Math.max(0, cursor - 1), 4)}
              </small>
            </div>
          </div>
        }
      />
    </>
  );
}
const INITIAL_BUS: BusState = {
  owner: "DMA",
  requests: { CPU: true, DMA: true },
  last: "CPU",
  elapsed: 1,
  completed: { CPU: 0, DMA: 0 },
  cycle: 12,
};
function BusLab() {
  useSimulatorCapture("studios/io/IoStudio.tsx:BusLab", () => ({ bus, mode, wait, running, speed, zoom, history }), "8939271442ed");

  const [bus, setBus] = useState<BusState>(INITIAL_BUS),
    [mode, setMode] = useState<"round" | "fixed">("round"),
    [wait, setWait] = useState(2),
    [running, setRunning] = useState(false),
    [speed, setSpeed] = useState(1),
    [zoom, setZoom] = useState(100),
    [history, setHistory] = useState<
      {
        cycle: number;
        cpu: boolean;
        dma: boolean;
        gc: boolean;
        gd: boolean;
        valid: boolean;
        ready: boolean;
      }[]
    >([]);
  function step() {
    const next = nextBus(bus, mode, wait);
    setBus(next);
    setHistory((h) => [
      ...h.slice(-19),
      {
        cycle: next.cycle,
        cpu: next.requests.CPU,
        dma: next.requests.DMA,
        gc: next.owner === "CPU",
        gd: next.owner === "DMA",
        valid: next.owner !== null,
        ready: next.owner !== null && next.elapsed >= wait + 1,
      },
    ]);
    if (!next.owner && !next.requests.CPU && !next.requests.DMA)
      setRunning(false);
  }
  usePlayback(step, running, speed);
  function request(master: Master) {
    setBus((s) => ({
      ...s,
      requests: { ...s.requests, [master]: !s.requests[master] },
    }));
  }
  const nextOwner = bus.owner === "DMA" ? "CPU" : "DMA",
    completed = bus.completed.CPU > 0 && bus.completed.DMA > 0;
  const signals =
    history.length > 0
      ? history
      : Array.from({ length: 14 }, (_, i) => ({
          cycle: i + 7,
          cpu: i === 1 || i === 2 || i === 11,
          dma: i >= 3 && i <= 7,
          gc: false,
          gd: i >= 4 && i <= 8,
          valid: i >= 4 && i <= 8,
          ready: i >= 4 && i !== 6 && i !== 7,
        }));
  return (
    <>
      <Title
        title="Bus Arbitration & Handshaking"
        description="Two masters request a shared bus. Observe arbitration, grants, and the VALID/READY handshake."
        icon="bus"
        aside={
          <div className="io-hands-on">
            <b>▣　Hands-on simulation</b>
            <small>Interact, observe, and complete the challenge.</small>
          </div>
        }
      />
      <div
        className="io-bus-grid"
        style={
          {
            "--io-zoom": zoom / 100,
            "--io-animation-duration": `${1.6 / speed}s`,
          } as CSSProperties
        }
      >
        <Panel title="Simulation Controls">
          <hr />
          <h4>Arbitration Mode　ⓘ</h4>
          <label className="io-radio-card">
            <input
              type="radio"
              name="arbitration"
              checked={mode === "fixed"}
              onChange={() => setMode("fixed")}
            />
            <span>
              Fixed priority<small>CPU always has higher priority</small>
            </span>
          </label>
          <label className="io-radio-card">
            <input
              type="radio"
              name="arbitration"
              checked={mode === "round"}
              onChange={() => setMode("round")}
            />
            <span>
              Round robin<small>Grants alternate between masters</small>
            </span>
          </label>
          <hr />
          <h4>Request Controls</h4>
          <div className="io-request-buttons">
            <button
              aria-pressed={bus.requests.CPU}
              onClick={() => request("CPU")}
            >
              <IoIcon name="chip" size={28} />
              <b>Request CPU</b>
              <small>REQ_CPU</small>
            </button>
            <button
              aria-pressed={bus.requests.DMA}
              onClick={() => request("DMA")}
            >
              <IoIcon name="play" size={28} />
              <b>Request DMA</b>
              <small>REQ_DMA</small>
            </button>
          </div>
          <hr />
          <h4>Target Wait States (Memory)　ⓘ</h4>
          <div className="io-stepper">
            <button
              aria-label="Decrease wait states"
              onClick={() => setWait(Math.max(0, wait - 1))}
            >
              −
            </button>
            <input
              aria-label="Memory wait states"
              type="number"
              min={0}
              max={8}
              value={wait}
              onChange={(e) =>
                setWait(Math.max(0, Math.min(8, +e.target.value)))
              }
            />
            <button
              aria-label="Increase wait states"
              onClick={() => setWait(Math.min(8, wait + 1))}
            >
              +
            </button>
          </div>
          <small className="io-muted">Cycles before READY high</small>
        </Panel>
        <section className="io-bus-board io-dark">
          <div className="io-bus-board-head">
            <b>Cycle {bus.cycle}</b>
            <span>
              🟦 Request (REQ)　 🟩 Grant (GNT)　 🟪 Data/Address　 🟨 Handshake
            </span>
          </div>
          <Board
            label="CPU and DMA requests enter bus arbiter; exclusive bus grants route to memory"
            viewBox="0 0 960 320"
          >
            <Wire
              d="M181 76H444V122"
              dashed
              active={bus.requests.CPU}
              label="REQ_CPU"
              x={260}
              y={66}
            />
            <Arrow x={444} y={111} direction="down" />
            <Wire
              d="M181 232H316V198H379"
              dashed
              active={bus.requests.DMA}
              label="REQ_DMA"
              x={258}
              y={220}
            />
            <Arrow x={367} y={198} />
            <Wire
              d="M181 108H318V136H379"
              color="#a7cbe6"
              dashed
              active={bus.owner === "CPU"}
              label="GNT_CPU"
              x={264}
              y={133}
            />
            <Arrow x={191} y={108} color="#a7cbe6" direction="left" />
            <Wire
              d="M181 265H444V237"
              color="#1fea95"
              active={bus.owner === "DMA"}
              label="GNT_DMA"
              x={271}
              y={290}
            />
            <Arrow x={190} y={265} color="#1fea95" direction="left" />
            {[144, 155, 166].map((y) => (
              <Wire key={y} d={`M502 ${y}H810`} color="#b87aef" />
            ))}
            <Arrow x={797} y={144} color="#bf8cf5" />
            <Arrow x={797} y={166} color="#bf8cf5" />
            <Wire
              d="M810 200H511"
              color="#ffcd28"
              dashed
              label="VALID"
              x={661}
              y={218}
              active={bus.owner !== null}
            />
            <Wire
              d="M810 230H538V209H511"
              color="#ffcd28"
              dashed
              label="READY"
              x={661}
              y={251}
              active={bus.elapsed >= wait + 1}
            />
            <Chip x={60} y={37} w={119} h={99} title="CPU" sub={["Master 0"]} />
            <Chip
              x={60}
              y={198}
              w={119}
              h={99}
              title="DMA"
              sub={["Master 1"]}
            />
            <Chip
              x={384}
              y={119}
              w={119}
              h={119}
              title="BUS|ARBITER"
              glow="#00bff0"
            />
            <Chip
              x={816}
              y={118}
              w={117}
              h={121}
              title="Memory"
              sub={["SRAM", "32-bit"]}
            />
            <text
              x="663"
              y="121"
              fill="#d3a5ff"
              textAnchor="middle"
              fontSize="15"
            >
              Shared System Bus
            </text>
            <text
              x="663"
              y="187"
              fill="#b9cae2"
              textAnchor="middle"
              fontSize="13"
            >
              ADDR / DATA / CONTROL
            </text>
          </Board>
          <div className="io-bus-signals">
            <svg
              viewBox="0 0 940 295"
              role="img"
              aria-label="Request, grant, VALID and READY timing traces"
            >
              <defs>
                <pattern
                  id="bus-timing-grid"
                  width="60"
                  height="36"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M60 0H0V36"
                    stroke="#284252"
                    fill="none"
                    strokeWidth=".7"
                  />
                </pattern>
              </defs>
              <rect
                x="100"
                y="10"
                width="820"
                height="250"
                fill="url(#bus-timing-grid)"
              />
              {[
                ["REQ_CPU", "cpu", "#21dfff"],
                ["REQ_DMA", "dma", "#21dfff"],
                ["GNT_CPU", "gc", "#20ee95"],
                ["GNT_DMA", "gd", "#20ee95"],
                ["VALID", "valid", "#ffcf27"],
                ["READY", "ready", "#ffcf27"],
              ].map(([name, key, color], row) => {
                const y = 20 + row * 37;
                let path = `M100 ${y + 20}`;
                signals.forEach((sample, i) => {
                  const v = sample[key as keyof typeof sample];
                  const x = 100 + (i * 820) / signals.length;
                  path += `H${x}V${v ? y : y + 20}H${x + 820 / signals.length}`;
                });
                return (
                  <g key={name}>
                    <text
                      x="17"
                      y={y + 15}
                      fill={color}
                      fontSize="13"
                      fontFamily="monospace"
                    >
                      {name}
                    </text>
                    <path
                      d={path}
                      fill="none"
                      stroke={color}
                      strokeWidth="2.5"
                    />
                  </g>
                );
              })}
              <path d="M430 6V260" stroke="white" strokeDasharray="6 5" />
              <rect
                x="397"
                y="0"
                width="68"
                height="23"
                rx="4"
                fill="#74beff"
              />
              <text
                x="430"
                y="16"
                textAnchor="middle"
                fill="#061b37"
                fontSize="12"
              >
                Cycle {bus.cycle}
              </text>
              {signals
                .filter((_, i) => i % 2 === 0)
                .map((s, i) => (
                  <text
                    key={i}
                    x={104 + (i * 1640) / signals.length}
                    y="282"
                    fill="#aac8de"
                    fontSize="12"
                  >
                    {s.cycle}
                  </text>
                ))}
              <rect
                x="560"
                y="87"
                width="218"
                height="91"
                rx="7"
                fill="#071c2d"
                stroke="#6d9db7"
              />
              <text x="574" y="109" fill="white" fontSize="13">
                Memory wait state
              </text>
              <text x="574" y="133" fill="#b8d5e9" fontSize="12">
                READY is {bus.elapsed >= wait + 1 ? "high" : "low"} ({wait} wait
                states)
              </text>
              <text x="574" y="153" fill="#b8d5e9" fontSize="12">
                Transfer completes when
              </text>
              <text x="574" y="170" fill="#b8d5e9" fontSize="12">
                VALID and READY are both high.
              </text>
            </svg>
          </div>
        </section>
        <Panel title="Guided Challenge" icon="target">
          <h4>Give both masters a turn without contention</h4>
          <p>
            Use the controls to request the bus from each master. Let the
            arbiter grant the bus using round robin, and observe a clean
            transfer for both without contention.
          </p>
          <hr />
          <h4>
            <IoIcon name="bus" size={19} />
            Status
          </h4>
          <StatRows
            rows={[
              ["Bus owner", <Badge tone="purple">{bus.owner ?? "Idle"}</Badge>],
              ["Contention", <Badge>None</Badge>],
              [
                "Next owner (after release)",
                <Badge tone="blue">{nextOwner}</Badge>,
              ],
            ]}
          />
          <hr />
          <h4>
            <IoIcon name="bus" />
            Arbitration Queue
          </h4>
          <StatRows
            rows={[
              ["①　" + nextOwner, <Badge tone="blue">Next</Badge>],
              [
                "②　" + (bus.owner ?? "CPU"),
                <Badge tone="gray">{bus.owner ? "Active" : "Waiting"}</Badge>,
              ],
            ]}
          />
          <hr />
          <h4>
            <IoIcon name="port" />
            Success Criteria
          </h4>
          <ul className="io-checklist">
            <li className={bus.completed.CPU ? "done" : ""}>
              CPU completes one transfer
            </li>
            <li className={bus.completed.DMA ? "done" : ""}>
              DMA completes one transfer
            </li>
            <li className={completed ? "done" : ""}>No contention occurs</li>
            <li className={completed ? "done" : ""}>
              Transfers only accepted when VALID and READY are high
            </li>
          </ul>
        </Panel>
      </div>
      <Transport
        running={running}
        onPlay={() => setRunning(!running)}
        onStep={() => {
          setRunning(false);
          step();
        }}
        onReset={() => {
          setRunning(false);
          setHistory([
            {
              cycle: 0,
              cpu: false,
              dma: false,
              gc: false,
              gd: false,
              valid: false,
              ready: false,
            },
          ]);
          setBus({
            ...INITIAL_BUS,
            cycle: 0,
            owner: null,
            requests: { CPU: false, DMA: false },
            completed: { CPU: 0, DMA: 0 },
            elapsed: 0,
          });
        }}
        speed={speed}
        setSpeed={setSpeed}
        zoom={zoom}
        setZoom={setZoom}
        extra={
          <div className="io-legend-light">
            <span>🟦 REQ (Request)</span>
            <span>🟩 GNT (Grant)</span>
            <span>🟪 Bus (Addr/Data)</span>
            <span>🟨 VALID / READY</span>
          </div>
        }
      />
    </>
  );
}
