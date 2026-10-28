import { useSimulatorCapture } from "../../layout/SimulatorCapture";
import { useSandbox } from "./sandboxState";
import { hx } from "./sandboxModel";
import {
  Block,
  Field,
  MiniTable,
  Panel,
  Surface,
  Trace,
  ValueBox,
} from "./SandboxUI";
export function DebugView() {
  useSimulatorCapture("studios/sandbox/DebugViews.tsx:DebugView", () => ({ s }), "92c5298cec22");

  const s = useSandbox(),
    pending = s.cpu.memory[32] === undefined,
    value = s.cpu.registers[3]!;
  return (
    <Surface
      label="CPU debugger paused before store instruction with live memory and register signals"
      viewBox="0 0 914 595"
      toolbar={false}
    >
      <rect
        x="12"
        y="10"
        width="700"
        height="38"
        rx="4"
        fill="#ffd271"
        stroke="#ffdf94"
      />
      <text x="28" y="35" fill="#291c00" fontSize="15" fontWeight="600">
        Ⅱ　{s.pausedReason || "Debugger ready"}
        <tspan x="450" fontSize="11">
          {pending
            ? `Next step will write ${hx(value)} to address 0x20`
            : "Store committed to memory"}
        </tspan>
      </text>
      <Trace d="M70 188H140M44 220V350H185" color="#24baf0" />
      <Trace d="M245 194H440M245 194H390V350H465" color="#a16bf0" />
      <Trace
        d="M345 350H465M345 390H430V418H465"
        color="#20e1f4"
        on={value !== 0}
      />
      <Trace
        d="M535 350H615M345 390V506H670V450"
        color="#1ee4f2"
        on={value !== 0}
      />
      <Trace
        d="M525 245V270H665V275M440 130H377V290H250"
        color="#ffb818"
        on={pending}
      />
      <Trace d="M785 350H830M875 370H900" color="#39b8f1" />
      <Block x={16} y={156} w={55} h={68} title="PC">
        <ValueBox x={23} y={190} w={40} value={hx(s.cpu.pc)} color="#ffd77a" />
      </Block>
      <Block
        x={140}
        y={150}
        w={105}
        h={90}
        title="Instruction"
        subtitle="Memory"
      >
        <text x="192" y="220" fill="#b9dfef" textAnchor="middle" fontSize="12">
          256 × 32
        </text>
      </Block>
      <Block x={440} y={105} w={170} h={140} title="Control Unit">
        {["RegWrite", "MemWrite", "MemRead", "Branch", "ALUSrc", "RegDst"].map(
          (n, i) => (
            <text
              key={n}
              x="455"
              y={144 + i * 17}
              fill={i === 1 ? "#ffca53" : "#b9ddef"}
              fontSize="11"
            >
              ●　{n}
              <tspan x="590">
                {i === 1 ? Number(pending) : i === 4 ? 1 : 0}
              </tspan>
            </text>
          ),
        )}
      </Block>
      <Block
        x={185}
        y={290}
        w={160}
        h={160}
        title="Register File"
        subtitle="32 × 32"
      >
        {[1, 2, 3].map((n, i) => (
          <g key={n}>
            <text x="197" y={355 + i * 25} fill="#b9ddef" fontSize="12">
              R{n}
            </text>
            <ValueBox
              x={225}
              y={338 + i * 25}
              w={108}
              value={hx(s.cpu.registers[n]!, 8)}
            />
          </g>
        ))}
      </Block>
      <Block x={395} y={335} w={39} h={86} title="MUX" />
      <path
        d="M465 307L525 331V393L465 416V380L474 365 465 350z"
        fill="url(#sb-block)"
        stroke="#a4e1ff"
        strokeWidth="1.7"
      />
      <text x="495" y="351" fill="white" textAnchor="middle" fontSize="15">
        ALU
      </text>
      <text x="495" y="381" fill="white" textAnchor="middle" fontSize="13">
        ADD
      </text>
      <Block
        x={615}
        y={275}
        w={170}
        h={175}
        title="Data Memory"
        subtitle="1 KB (256 × 32)"
      >
        <text x="625" y="353" fill="#b8d7e8" fontSize="11">
          addr
        </text>
        <ValueBox
          x={660}
          y={355}
          w={115}
          value={`[0x20] = ${hx(s.cpu.memory[32] ?? 0, 8)}`}
          color="#ffda7f"
        />
        <text x="625" y="431" fill="#b8d7e8" fontSize="11">
          wdata
        </text>
      </Block>
      <path
        d="M830 325L868 337V392L830 405z"
        fill="url(#sb-block)"
        stroke="#abe2ff"
        strokeWidth="1.7"
      />
      <text x="845" y="429" textAnchor="middle" fill="#cde6f6" fontSize="12">
        MUX
      </text>
      <ValueBox x={348} y={457} w={78} value="Imm 0x20" />
      <text x="568" y="340" fill="#c9e0f1" fontSize="12">
        0x00000020
      </text>
      <text x="590" y="477" fill="#c9e0f1" fontSize="12">
        {hx(value, 8)}
      </text>
      <text x="25" y="571" fill="#87cfee" fontSize="11">
        ━━　Data (32-bit)　　 <tspan fill="#ffc332">━━　Control</tspan>
        <tspan fill="#b77bf5">　　 ━━　Address</tspan>
        <tspan fill="#25e5ee">　　 ━━　Active / Selected</tspan>
      </text>
    </Surface>
  );
}
export function DebugInspector() {
  useSimulatorCapture("studios/sandbox/DebugViews.tsx:DebugInspector", () => ({ s }), "92c5298cec22");

  const s = useSandbox(),
    pending = s.cpu.memory[32] === undefined;
  return (
    <>
      <h3>Signal / Properties</h3>
      <div className="sb-dock-tabs">Selected　 Signals　 CPU　 Memory</div>
      <Panel title="R3　General Purpose Register">
        <Field label="Name">
          <output>R3</output>
        </Field>
        <Field label="Register #">
          <output>3</output>
        </Field>
        <Field label="Value (hex)">
          <input
            aria-label="R3 register value"
            value={hx(s.cpu.registers[3]!, 8)}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n))
                s.setCpu((c) => ({
                  ...c,
                  registers: c.registers.map((v, i) => (i === 3 ? n & 255 : v)),
                }));
            }}
          />
        </Field>
        <Field label="Value (dec)">
          <output>{s.cpu.registers[3]}</output>
        </Field>
        <Field label="Last write">
          <output>{hx(s.cpu.registers[3]!, 8)} (cycle 12)</output>
        </Field>
      </Panel>
      <Panel title="⌄ Data Memory (Selected Address)">
        <Field label="Address">
          <output>0x00000020</output>
        </Field>
        <Field label="Current value">
          <output>{hx(s.cpu.memory[32] ?? 0, 8)}</output>
        </Field>
        <Field label="Pending write">
          <output className="sb-amber-value">
            {pending ? hx(s.cpu.registers[3]!, 8) : "Committed"}
          </output>
        </Field>
        <Field label="MemWrite">
          <output>{pending ? "1 (asserted)" : "0"}</output>
        </Field>
        <Field label="MemRead">
          <output>0</output>
        </Field>
      </Panel>
      <Panel title={`⌄ Control Signals (at PC ${hx(s.cpu.pc)})`}>
        <MiniTable
          headers={["Signal", "Value"]}
          rows={[
            ["RegWrite", 0],
            ["MemWrite", Number(pending)],
            ["MemRead", 0],
            ["ALUSrc", 1],
            ["MemtoReg", 0],
            ["Branch", 0],
          ]}
        />
      </Panel>
    </>
  );
}
export function BreakpointList() {
  useSimulatorCapture("studios/sandbox/DebugViews.tsx:BreakpointList", () => ({ s }), "92c5298cec22");

  const s = useSandbox();
  return (
    <div className="sb-break-list">
      <h3>
        Breakpoints <button onClick={s.addBreakpoint}>＋ Add</button>
      </h3>
      <MiniTable
        headers={["", "", "Condition", ""]}
        rows={s.breakpoints.map((bp) => [
          <input
            aria-label={`Enable ${bp.signal} breakpoint`}
            type="checkbox"
            checked={bp.enabled}
            onChange={(e) =>
              s.setBreakpoints((p) =>
                p.map((b) =>
                  b.id === bp.id ? { ...b, enabled: e.target.checked } : b,
                ),
              )
            }
          />,
          <i className="sb-break-dot" />,
          `${bp.signal} ${bp.operator} ${hx(bp.value)}`,
          <button
            aria-label={`Delete ${bp.signal} breakpoint`}
            onClick={() =>
              s.setBreakpoints((p) => p.filter((b) => b.id !== bp.id))
            }
          >
            ♜
          </button>,
        ])}
      />
      <h4>Add Breakpoint</h4>
      <div className="sb-add-break">
        <label>
          Signal
          <select
            value={s.breakSignal}
            onChange={(e) =>
              s.setBreakSignal(e.target.value as typeof s.breakSignal)
            }
          >
            {["PC", "Memory write", "R3"].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Operator
          <select
            value={s.breakOperator}
            onChange={(e) =>
              s.setBreakOperator(e.target.value as typeof s.breakOperator)
            }
          >
            {["==", "!=", ">="].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Value
          <input
            value={s.breakValue}
            onChange={(e) => s.setBreakValue(e.target.value)}
          />
        </label>
        <button className="sb-primary" onClick={s.addBreakpoint}>
          Add
        </button>
      </div>
    </div>
  );
}
export function DebugDock() {
  useSimulatorCapture("studios/sandbox/DebugViews.tsx:DebugDock", () => ({ s }), "92c5298cec22");

  const s = useSandbox(),
    pending = s.cpu.memory[32] === undefined;
  return (
    <>
      <div className="sb-debug-program">
        <div>
          <div className="sb-dock-tabs">Program　　Memory</div>
          <b>main.asm</b>
          <textarea
            aria-label="Debug assembly program"
            value={s.program}
            onChange={(e) => {
              s.setProgram(e.target.value);
              s.setRunning(false);
            }}
            spellCheck={false}
          />
        </div>
        <Panel title="◇　Guided Challenge">
          <h3>Pause before memory changes</h3>
          <p>
            Set a write watchpoint on address 0x20 and pause execution before
            the STORE updates memory. Inspect R3, the pending write value, and
            control signals, then step the instruction.
          </p>
          {s.breakpoints.map((b) => (
            <label className="sb-challenge-point" key={b.id}>
              <input
                type="checkbox"
                checked={b.enabled}
                onChange={(e) =>
                  s.setBreakpoints((p) =>
                    p.map((bp) =>
                      bp.id === b.id
                        ? { ...bp, enabled: e.target.checked }
                        : bp,
                    ),
                  )
                }
              />{" "}
              Add breakpoint: {b.signal} {b.operator} {hx(b.value)}
            </label>
          ))}
        </Panel>
      </div>
      <div className="sb-debug-console">
        <h3>Debug Console & Timeline</h3>
        <div>
          <pre>
            [Cycle {s.cpu.cycle}] PC = {hx(s.cpu.pc, 8)}
            {"\n"}
            <em>[Break] {s.pausedReason || "Ready"}</em>
            {"\n"}[Info] R3 = {hx(s.cpu.registers[3]!, 8)}
            {"\n"}[Info] Memory[0x20] = {hx(s.cpu.memory[32] ?? 0, 8)}
            {"\n"}[Info] Pending write:{" "}
            {pending ? hx(s.cpu.registers[3]!, 8) : "completed"}
          </pre>
          <div className="sb-debug-timeline">
            <span>
              ● Clock cycle　● Instruction　
              <span className="sb-fail">● Breakpoint</span>
            </span>
            <div>●──●──●──◎──●──●──●</div>
            <p>8　　 9　　10　　12　　13　　14　　16</p>
            <b className="sb-fail">Pause (PC {hx(s.cpu.pc)}, write 0x20)</b>
          </div>
          <div className="sb-debug-actions">
            <p className="sb-paused">
              ⓘ{" "}
              {pending
                ? "Next step writes " +
                  hx(s.cpu.registers[3]!) +
                  " to address 0x20"
                : "Memory write committed"}
            </p>
            <div className="sb-row">
              <button
                className="sb-primary"
                onClick={() => {
                  s.setIgnoreBreak(true);
                  s.setRunning(true);
                }}
              >
                ▶ Continue
              </button>
              <button onClick={s.step}>Step clock</button>
              <button onClick={() => s.commitInstruction(true)}>
                Step instruction
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
