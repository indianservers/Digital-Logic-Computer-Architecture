import { useSimulatorCapture } from "../../layout/SimulatorCapture";
import { useSandbox } from "./sandboxState";
import { bn, hx, LIBRARY, partPorts, TEMPLATE_LIST } from "./sandboxModel";
import {
  Block,
  Field,
  Led,
  MiniTable,
  Panel,
  PartThumbnail,
  Surface,
  Switch,
  Tabs,
  Trace,
  ValueBox,
} from "./SandboxUI";
export function LibraryView() {
  useSimulatorCapture("studios/sandbox/AnalysisViews.tsx:LibraryView", () => ({ s }), "86a172dc7120");

  const s = useSandbox();
  return (
    <div className="sb-library-main">
      <div className="sb-breadcrumb">Components　/　Arithmetic　/　ALU</div>
      <Surface
        label="Component testbench with live ALU inputs and outputs"
        viewBox="0 0 880 580"
      >
        <Trace d="M200 181H253V214H330" color="#2be4ff" on={!!s.operandA} />
        <Trace d="M200 294H253V313H330" color="#2be4ff" on={!!s.operandB} />
        <Trace d="M200 414H253V406H330" color="#e8d700" />
        <Trace d="M530 248H685" color="#ad49fa" on={!!s.arithmetic.y} />
        <Trace d="M530 350H685" color="#e55def" on={!!s.arithmetic.z} />
        <Trace d="M530 430H685" color="#e55def" on={!!s.arithmetic.c} />
        <path
          d="M348 175H512L530 193V442L512 460H348L330 442V193z"
          fill="url(#sb-block)"
          stroke="#4980ff"
          strokeWidth="2"
          filter="url(#sb-shadow)"
        />
        <text x="430" y="252" fill="#e0f2ff" fontSize="22" textAnchor="middle">
          {s.libItem}
        </text>
        {["A", "B", "OP"].map((n, i) => (
          <text key={n} x="341" y={217 + i * 99} fill="white" fontSize="14">
            {n}
          </text>
        ))}
        {[
          "000 : ADD",
          "001 : SUB",
          "010 : AND",
          "011 : OR",
          "100 : XOR",
          "101 : SHL",
          "110 : SHR",
        ].map((n, i) => (
          <text
            key={n}
            x="384"
            y={280 + i * 18}
            fill="#bbddf4"
            fontSize="12"
            fontFamily="Consolas,monospace"
          >
            {n}
          </text>
        ))}
        <text x="511" y="350" fill="white" fontSize="14">
          Z
        </text>
        <text x="511" y="431" fill="white" fontSize="14">
          C
        </text>
        {[0, 1, 2].map((i) => (
          <foreignObject
            key={i}
            x="35"
            y={135 + i * 118}
            width="165"
            height="86"
          >
            <div className="sb-testbench-input">
              <b>{["A (8-bit)", "B (8-bit)", "OP (3-bit)"][i]}</b>
              <span className="sb-radix">BIN　HEX</span>
              {i < 2 ? (
                <input
                  aria-label={`Testbench input ${i ? "B" : "A"}`}
                  value={hx(i ? s.operandB : s.operandA)}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n))
                      (i ? s.setOperandB : s.setOperandA)(
                        n & ((1 << s.width) - 1),
                      );
                  }}
                />
              ) : (
                <select
                  aria-label="Testbench operation"
                  value={s.operation}
                  onChange={(e) =>
                    s.setOperation(e.target.value as typeof s.operation)
                  }
                >
                  {["ADD", "SUB", "AND", "OR", "XOR", "SHL", "SHR"].map(
                    (v, n) => (
                      <option key={v} value={v}>
                        {v} ({n.toString(2).padStart(3, "0")})
                      </option>
                    ),
                  )}
                </select>
              )}
            </div>
          </foreignObject>
        ))}
        {[
          ["Result (8-bit)", s.arithmetic.y],
          ["Zero Flag (Z)", s.arithmetic.z],
          ["Carry Flag (C)", s.arithmetic.c],
        ].map(([label, value], i) => (
          <foreignObject
            key={label}
            x="685"
            y={185 + i * 107}
            width="155"
            height="97"
          >
            <div className="sb-testbench-input">
              <b>{label}</b>
              <output>{i ? value : hx(Number(value))}</output>
            </div>
          </foreignObject>
        ))}
      </Surface>
      <div className="sb-library-shelf">
        <h3>Component Palette</h3>
        <div>
          {["alu", "register", "mux", "memory", "decoder"].map((kind) => {
            const item = LIBRARY.find((p) => p.kind === kind)!;
            return (
              <button
                key={kind}
                draggable
                onDragStart={(e) =>
                  e.dataTransfer.setData("sandbox-kind", item.kind)
                }
                onClick={() => s.setLibItem(item.label)}
              >
                <PartThumbnail kind={kind} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
export function LibraryInspector() {
  useSimulatorCapture("studios/sandbox/AnalysisViews.tsx:LibraryInspector", () => ({ s }), "86a172dc7120");

  const s = useSandbox();
  return (
    <>
      <Panel title="Component Properties">
        <h2>{s.libItem}</h2>
        <p>
          Configurable arithmetic and logic operations with carry and status
          flags.
        </p>
        <Field label="Bit width">
          <select
            value={s.width}
            onChange={(e) => s.setWidth(Number(e.target.value))}
          >
            {[4, 8, 16].map((n) => (
              <option key={n} value={n}>
                {n} bits
              </option>
            ))}
          </select>
        </Field>
        <Field label="Operation">
          <select
            value={s.operation}
            onChange={(e) =>
              s.setOperation(e.target.value as typeof s.operation)
            }
          >
            {["ADD", "SUB", "AND", "OR", "XOR", "SHL", "SHR"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
        <label>
          <input
            type="checkbox"
            checked={s.signed}
            onChange={(e) => s.setSigned(e.target.checked)}
          />{" "}
          Signed interpretation
        </label>
        <Field label="A">
          <input
            type="number"
            value={s.operandA}
            onChange={(e) =>
              s.setOperandA(Number(e.target.value) & ((1 << s.width) - 1))
            }
          />
        </Field>
        <Field label="B">
          <input
            type="number"
            value={s.operandB}
            onChange={(e) =>
              s.setOperandB(Number(e.target.value) & ((1 << s.width) - 1))
            }
          />
        </Field>
        <Field label="Output Y">
          <output>
            {hx(s.arithmetic.y)} (
            {s.signed && s.arithmetic.y >= 1 << (s.width - 1)
              ? s.arithmetic.y - (1 << s.width)
              : s.arithmetic.y}
            )
          </output>
        </Field>
      </Panel>
      <Panel title="Ports">
        <MiniTable
          headers={["Name", "Direction", "Width"]}
          rows={[
            ["A", "Input", s.width],
            ["B", "Input", s.width],
            ["Y", "Output", s.width],
            ...s.extraPorts.map((p) => [p, "Input", 1]),
          ]}
        />
        <button
          onClick={() => s.setExtraPorts((p) => [...p, `IN${p.length + 1}`])}
        >
          ＋ Add Port
        </button>
      </Panel>
      <Panel title="Test Component">
        <p>
          A={s.operandA}, B={s.operandB} → Y={s.arithmetic.y}
        </p>
        <button className="sb-primary" onClick={s.runLibraryTests}>
          ▶ Run Tests
        </button>
      </Panel>
    </>
  );
}
export function LibraryDock() {
  useSimulatorCapture("studios/sandbox/AnalysisViews.tsx:LibraryDock", () => ({ s }), "86a172dc7120");

  const s = useSandbox();
  return (
    <>
      <Tabs
        items={["Test Console", "Documentation", "Truth Table"]}
        value={s.bottom || "Test Console"}
        onChange={s.setBottom}
      />
      {s.bottom === "Documentation" ? (
        <p className="sb-console">
          The {s.width}-bit ALU computes {s.operation} with unsigned wrapping. Z
          is set when the result is zero; N reflects the most significant bit.
        </p>
      ) : (
        <>
          <MiniTable
            headers={[
              "Test",
              "Operation",
              "A",
              "B",
              "Expected Y",
              "Actual Y",
              "Result",
            ]}
            rows={(s.libTests.length
              ? s.libTests
              : [
                  {
                    operation: "ADD",
                    a: 5,
                    b: 3,
                    y: 8,
                    expected: 8,
                    pass: true,
                  },
                  {
                    operation: "AND",
                    a: 5,
                    b: 3,
                    y: 1,
                    expected: 1,
                    pass: true,
                  },
                ]
            ).map((t, i) => [
              i + 1,
              t.operation,
              hx(t.a),
              hx(t.b),
              hx(t.expected),
              hx(t.y),
              <span className={t.pass ? "sb-pass" : "sb-fail"}>
                {t.pass ? "✓ Pass" : "Fail"}
              </span>,
            ])}
          />
          <p className="sb-console">
            {s.libTests.length || 2} tests completed • Every result is
            calculated by the component engine.
          </p>
        </>
      )}
    </>
  );
}
export function ProbesView() {
  useSimulatorCapture("studios/sandbox/AnalysisViews.tsx:ProbesView", () => ({ s }), "86a172dc7120");

  const s = useSandbox();
  return (
    <Surface
      label="Clock driven four bit counter with real output LEDs and probes"
      viewBox="0 0 1000 620"
    >
      <Trace d="M185 175H368" color="#00dcff" on={!!(s.tick % 2)} />
      <Trace d="M185 315H315V250H368" color="#a5c8dd" on={false} />
      <Block x={115} y={150} w={70} h={45} title="">
        <path
          d="M132 180H143V163H155V180H169"
          fill="none"
          stroke="#d4f2ff"
          strokeWidth="1.7"
        />
      </Block>
      <text x="150" y="219" fill="#c7e4f5" textAnchor="middle" fontSize="15">
        Clock
      </text>
      <text x="150" y="239" fill="#b8d9ee" textAnchor="middle" fontSize="14">
        1 Hz
      </text>
      <text x="150" y="280" fill="#b7d9f0" textAnchor="middle" fontSize="14">
        Reset
      </text>
      <text x="150" y="298" fill="#b7d9f0" textAnchor="middle" fontSize="11">
        (Active High)
      </text>
      <Switch
        x={122}
        y={305}
        label="Reset counter"
        value={0}
        onToggle={() => {
          s.setCounter(0);
          s.setCounterSamples([0]);
          s.setRunning(false);
        }}
      />
      <Block x={368} y={152} w={170} h={158} title="" selected>
        <text x="383" y="189" fill="#d4eafd" fontSize="14">
          CLK
        </text>
        <text x="383" y="255" fill="#d4eafd" fontSize="14">
          RST
        </text>
        <text
          x="453"
          y="232"
          fill="#8dcfff"
          fontSize="16"
          textAnchor="middle"
          fontWeight="600"
        >
          CTR
        </text>
        <text x="453" y="289" fill="#bedff7" fontSize="13" textAnchor="middle">
          4-bit Counter
        </text>
      </Block>
      {[0, 1, 2, 3].map((n) => (
        <g key={n}>
          <Trace
            d={`M538 ${180 + n * 32}H${674 - n * 37}V${148 + n * 64}H805`}
            color={["#18dcca", "#30df8e", "#ffdd30", "#b66aff"][n]}
            on={!!((s.counter >> n) & 1)}
          />
          <text x="504" y={185 + n * 32} fill="#d2e9fa" fontSize="13">
            Q{n}
          </text>
          <Led x={823} y={148 + n * 64} value={(s.counter >> n) & 1} />
          <text x="850" y={153 + n * 64} fill="#cce4f4" fontSize="12">
            LED{n}
          </text>
          <rect
            x="680"
            y={100 + n * 64}
            width="11"
            height="11"
            fill={["#30df8e", "#ffdd30", "#ffa641", "#b66aff"][n]}
          />
          <text
            x="699"
            y={111 + n * 64}
            fill={["#30df8e", "#ffdd30", "#ffa641", "#b66aff"][n]}
            fontSize="13"
          >
            P{n + 1}
          </text>
          <text x="699" y={130 + n * 64} fill="#d2e9fa" fontSize="13">
            Q{n}
          </text>
        </g>
      ))}
      <Trace d="M507 310V391H608" color="#b66aff" on={s.counter !== 0} />
      <rect x="602" y="370" width="12" height="12" fill="#ce82ff" />
      <text x="624" y="382" fill="#e6d2fa" fontSize="13">
        P5
      </text>
      <text x="624" y="402" fill="#e6d2fa" fontSize="15">
        count[3:0]
      </text>
      <ValueBox x={592} y={414} w={36} value={s.counter} />
      <rect x="238" y="112" width="11" height="11" fill="#68a9ff" />
      <Trace d="M244 124V175" color="#418cf1" />
      <text x="257" y="123" fill="#78b2ff" fontSize="13">
        P0
      </text>
      <text x="257" y="141" fill="#d9eaff" fontSize="14">
        CLK
      </text>
    </Surface>
  );
}
export function WaveformDock() {
  useSimulatorCapture("studios/sandbox/AnalysisViews.tsx:WaveformDock", () => ({ s }), "86a172dc7120");

  const s = useSandbox(),
    samples = s.counterSamples,
    start = Math.max(0, samples.length - 14),
    shown = samples.slice(start);
  return (
    <div className="sb-waveform">
      <div className="sb-dock-tabs">
        <b>Waveforms</b>
        <button onClick={() => s.setRunning(!s.running)}>
          {s.running ? "Ⅱ Pause" : "▶ Run"}
        </button>
        <button onClick={s.step}>Step</button>
        <button
          onClick={() => {
            s.setCounterSamples([s.counter]);
            s.setCursorA(0);
            s.setCursorB(0);
          }}
        >
          Clear
        </button>
        <button onClick={s.exportTrace}>Export CSV</button>
        <span>
          Cursor A: {s.cursorA}　Cursor B: {s.cursorB}　Δ{" "}
          {Math.abs(s.cursorB - s.cursorA)} cycles
        </span>
      </div>
      <div className="sb-wave-grid">
        <div className="sb-wave-signals">
          <div>
            Signal <span>Value</span>
          </div>
          {s.probes.map((p, i) => (
            <button
              key={p}
              className={s.selectedProbe === p ? "active" : ""}
              onClick={() => {
                s.setSelectedProbe(p);
                s.setProbeName(p);
              }}
            >
              <i
                style={{
                  background: [
                    "#f5bd42",
                    "#3cbeff",
                    "#cf8dff",
                    "#29df91",
                    "#ffa541",
                    "#76ddff",
                  ][i % 6],
                }}
              />
              {p}
              <span>
                {i === 0
                  ? s.tick % 2
                  : i < 5
                    ? (s.counter >> (i - 1)) & 1
                    : hx(s.counter)}
              </span>
            </button>
          ))}
        </div>
        <svg
          viewBox="0 0 1050 270"
          preserveAspectRatio="none"
          aria-label="Captured waveform samples"
        >
          <defs>
            <pattern
              id="sb-wave-grid"
              width="70"
              height="35"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M70 0H0V35"
                stroke="#2c4659"
                fill="none"
                strokeWidth=".7"
              />
            </pattern>
          </defs>
          <rect width="1050" height="270" fill="#071b29" />
          <rect width="1050" height="270" fill="url(#sb-wave-grid)" />
          {shown.map((_, i) => (
            <text key={i} x={i * 70 + 8} y="19" fill="#b3c7d6" fontSize="12">
              {start + i}
            </text>
          ))}
          {s.probes.map((p, row) => {
            if (s.hiddenProbes.includes(p)) return null;
            const color = [
              "#f5bd42",
              "#3cbeff",
              "#cf8dff",
              "#29df91",
              "#ffa541",
              "#76ddff",
            ][row % 6];
            if (row >= 5)
              return (
                <g key={p}>
                  {shown.map((v, i) => (
                    <g key={i}>
                      <path
                        d={`M${i * 70} 226l7 -9h56l7 9-7 9h-56z`}
                        stroke={color}
                        fill="#15354b"
                      />
                      <text
                        x={i * 70 + 35}
                        y="230"
                        textAnchor="middle"
                        fill={color}
                        fontSize="12"
                      >
                        {v.toString(16).toUpperCase()}
                      </text>
                    </g>
                  ))}
                </g>
              );
            const base = 52 + row * 35,
              d = shown
                .map((n, i) => {
                  const v = row === 0 ? (start + i) % 2 : (n >> (row - 1)) & 1,
                    y = base - (v ? 18 : 0);
                  return `${i ? "L" : "M"}${i * 70} ${y}H${(i + 1) * 70}`;
                })
                .join("");
            return (
              <path key={p} d={d} fill="none" stroke={color} strokeWidth="2" />
            );
          })}
          {[
            [s.cursorA, "A", "#ffff48"],
            [s.cursorB, "B", "#ff65bd"],
          ].map(([v, n, c]) => (
            <g key={n}>
              <path
                d={`M${(Number(v) - start) * 70} 20V260`}
                stroke={c as string}
                strokeDasharray="5 3"
              />
              <text
                x={(Number(v) - start) * 70 + 4}
                y="32"
                fill={c as string}
                fontSize="12"
              >
                {n}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
export function ProbesInspector() {
  useSimulatorCapture("studios/sandbox/AnalysisViews.tsx:ProbesInspector", () => ({ s }), "86a172dc7120");

  const s = useSandbox();
  return (
    <>
      <Panel title="Probe Properties">
        <Field label="Signal">
          <input
            value={s.probeName}
            onChange={(e) => s.setProbeName(e.target.value)}
            onBlur={() => {
              if (s.probeName.trim()) {
                s.setProbes((p) =>
                  p.map((n) => (n === s.selectedProbe ? s.probeName : n)),
                );
                s.setSelectedProbe(s.probeName);
              }
            }}
          />
        </Field>
        <Field label="Radix">
          <select
            value={s.probeRadix}
            onChange={(e) => s.setProbeRadix(e.target.value)}
          >
            {["Hexadecimal", "Binary", "Decimal"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Current value">
          <output>
            {s.probeRadix === "Binary"
              ? bn(s.counter)
              : s.probeRadix === "Decimal"
                ? s.counter
                : hx(s.counter)}
          </output>
        </Field>
        <label>
          <input
            type="checkbox"
            checked={!s.hiddenProbes.includes(s.selectedProbe)}
            onChange={(e) =>
              s.setHiddenProbes((p) =>
                e.target.checked
                  ? p.filter((n) => n !== s.selectedProbe)
                  : [...p, s.selectedProbe],
              )
            }
          />{" "}
          Show waveform
        </label>
      </Panel>
      <Panel title="Trigger">
        <label>
          <input
            type="checkbox"
            checked={s.triggerEnabled}
            onChange={(e) => s.setTriggerEnabled(e.target.checked)}
          />{" "}
          Enable trigger
        </label>
        <Field label="Condition">
          <span>
            count =={" "}
            <input
              aria-label="Counter trigger value"
              type="number"
              min="0"
              max="15"
              value={s.trigger}
              onChange={(e) => s.setTrigger(Number(e.target.value) & 15)}
            />
          </span>
        </Field>
        <p>Capture pauses when the counter reaches this value.</p>
      </Panel>
      <Panel title="Cursors">
        <Field label="Cursor A">
          <input
            type="number"
            min="0"
            max={s.counterSamples.length - 1}
            value={s.cursorA}
            onChange={(e) => s.setCursorA(Number(e.target.value))}
          />
        </Field>
        <Field label="Cursor B">
          <input
            type="number"
            min="0"
            max={s.counterSamples.length - 1}
            value={s.cursorB}
            onChange={(e) => s.setCursorB(Number(e.target.value))}
          />
        </Field>
        <p>Δ {Math.abs(s.cursorB - s.cursorA)} cycles</p>
      </Panel>
      <Panel title="Capture">
        <p>{s.counterSamples.length} samples • 6 signals</p>
        <button onClick={s.exportTrace}>Export CSV</button>
      </Panel>
    </>
  );
}
export function CircuitInspector() {
  useSimulatorCapture("studios/sandbox/AnalysisViews.tsx:CircuitInspector", () => ({ s }), "86a172dc7120");

  const s = useSandbox(),
    p = s.selectedPart,
    bits = s.circuit.parts.some((p) => p.id === "Sum") ? 1 : 4,
    mask = (1 << bits) - 1;
  return (
    <>
      <h2 className="sb-selected-title">
        {p?.kind === "fa" ? `Full Adder (${p.label})` : (p?.label ?? "Circuit")}
        <button
          aria-label="Delete selected component"
          onClick={() => s.removePart()}
        >
          ♜
        </button>
      </h2>
      <div className="sb-inspector-gate">
        <PartThumbnail kind={p?.kind ?? "fa"} />
      </div>
      <h3>Properties</h3>
      {p && (
        <>
          <Field label="Label">
            <input
              value={p.label}
              onChange={(e) => s.patchPart(p.id, { label: e.target.value })}
            />
          </Field>
          <Field label="Propagation delay (ns)">
            <input
              type="number"
              min="0"
              step="0.1"
              value={p.delay}
              onChange={(e) =>
                s.patchPart(p.id, { delay: Number(e.target.value) })
              }
            />
          </Field>
          {["constant", "register", "counter", "clock"].includes(p.kind) && (
            <Field label="Stored value">
              <input
                aria-label="Selected component value"
                type="number"
                min="0"
                max={(1 << p.width) - 1}
                value={p.value}
                onChange={(e) =>
                  s.patchPart(p.id, {
                    value: Number(e.target.value) & ((1 << p.width) - 1),
                  })
                }
              />
            </Field>
          )}
          {p.kind !== "fa" && (
            <Field label="Bus width">
              <select
                value={p.width}
                onChange={(e) =>
                  s.patchPart(p.id, { width: Number(e.target.value) })
                }
              >
                {[1, 4, 8, 16].map((n) => (
                  <option key={n} value={n}>
                    {n} bits
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="sb-position">
            Position{" "}
            <label>
              X{" "}
              <input
                aria-label="Component X position"
                type="number"
                value={Math.round(p.x)}
                onChange={(e) =>
                  s.patchPart(p.id, { x: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Y{" "}
              <input
                aria-label="Component Y position"
                type="number"
                value={Math.round(p.y)}
                onChange={(e) =>
                  s.patchPart(p.id, { y: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <label className="sb-show-pins">
            <input
              type="checkbox"
              checked={s.showPins}
              onChange={(e) => s.setShowPins(e.target.checked)}
            />{" "}
            Show pin labels
          </label>
          <h3 className="sb-ports-heading">Ports</h3>
          <MiniTable
            headers={["", ""]}
            rows={[
              ...partPorts(p.kind).inputs.map((n) => {
                const w = s.circuit.wires.find(
                  (w) => w.to === p.id && w.input === n,
                );
                return [
                  n,
                  <output>
                    {w ? (s.graph.output(w.from, w.out) ?? "X") : "X"}
                  </output>,
                ];
              }),
              ...partPorts(p.kind).outputs.map((n) => [
                n,
                <output>{s.graph.output(p.id, n) ?? "X"}</output>,
              ]),
            ]}
          />
        </>
      )}
      <Panel title="◎　Challenge">
        <p>Build and verify a {bits}-bit adder.</p>
        <h3>Test Vector</h3>
        <p className="sb-mono">
          A = {bn(s.a)} ({s.a})
        </p>
        <p className="sb-mono">
          B = {bn(s.b)} ({s.b})
        </p>
        <div className="sb-row">
          <p>Cin = {s.cin}</p>
          <button className="sb-primary" onClick={s.testCircuit}>
            Run Test
          </button>
        </div>
        <hr />
        <div
          className={
            s.graph.sum === ((s.a + s.b + s.cin) & mask) &&
            s.graph.carry === (s.a + s.b + s.cin) >> bits
              ? "sb-pass"
              : "sb-fail"
          }
        >
          ● {s.graph.sum === ((s.a + s.b + s.cin) & mask) ? "Pass" : "Fail"}
          　Expected: {bn((s.a + s.b + s.cin) & mask)} (
          {(s.a + s.b + s.cin) & mask})
          <p>Cout: {(s.a + s.b + s.cin) >> bits}</p>
        </div>
        {s.testResult && (
          <p className={s.testResult.pass ? "sb-pass" : "sb-fail"}>
            {s.testResult.message}
          </p>
        )}
      </Panel>
    </>
  );
}
export function TemplateInspector() {
  useSimulatorCapture("studios/sandbox/AnalysisViews.tsx:TemplateInspector", () => ({ s }), "86a172dc7120");

  const s = useSandbox(),
    t = TEMPLATE_LIST[s.templateIndex]!;
  return (
    <>
      <h2 className="sb-template-title">
        {s.templateIndex === 0 ? "1-bit Full Adder" : t.name}
      </h2>
      <p>◴　{t.description}</p>
      <p>
        {s.templateIndex === 0
          ? "Adds three 1-bit inputs and produces a sum and carry using two XOR gates, two AND gates, and one OR gate."
          : "Explore this working experiment, then open an editable copy to change inputs and inspect its state."}
      </p>
      <p>Includes</p>
      <div className="sb-template-counts">
        <div>
          <b>{s.templateIndex === 0 ? 5 : s.templateIndex === 1 ? 4 : 6}</b>
          Components
        </div>
        <div>
          <b>3</b>Inputs
        </div>
        <div>
          <b>2</b>Outputs
        </div>
      </div>
      <button
        className="sb-primary sb-template-open"
        onClick={() => s.loadTemplate()}
      >
        ▯　Open editable copy
      </button>
      <button
        className="sb-template-open"
        onClick={() => {
          s.updateCircuit({ parts: [], wires: [] });
          s.go("circuit");
        }}
      >
        ＋　Start blank
      </button>
      <Panel title="◎　Challenge">
        <p>
          Rebuild the carry path using AND and OR gates. Verify Cout matches the
          truth table for all inputs.
        </p>
      </Panel>
      <h3>⌄　Component Properties</h3>
      <Panel title="2-input XOR Gate">
        <Field label="Label">
          <input
            value={s.templateGateLabel}
            onChange={(e) => s.setTemplateGateLabel(e.target.value)}
          />
        </Field>
        <Field label="Inputs">
          <output>A, B</output>
        </Field>
        <Field label="Output">
          <output>Y</output>
        </Field>
        <Field label="Propagation Delay (ns)">
          <input
            type="number"
            min="0"
            step="0.1"
            value={s.templateDelay}
            onChange={(e) => s.setTemplateDelay(Number(e.target.value))}
          />
        </Field>
      </Panel>
    </>
  );
}
