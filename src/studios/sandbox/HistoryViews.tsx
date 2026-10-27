import { useSandbox } from "./sandboxState";
import { hx } from "./sandboxModel";
import {
  Block,
  Field,
  MiniTable,
  Panel,
  Surface,
  Tabs,
  Trace,
  ValueBox,
} from "./SandboxUI";
export function HistoryView() {
  const s = useSandbox(),
    h = s.historical ? s.history[s.historyIndex]!.cpu : s.cpu,
    r = h.registers;
  return (
    <Surface
      label="Historical CPU state with restorable register snapshots"
      viewBox="0 0 900 610"
      toolbar={false}
    >
      <rect
        x="8"
        y="10"
        width="246"
        height="34"
        rx="4"
        fill="#0b2030"
        stroke="#34556e"
      />
      <text x="19" y="32" fill="#ddf2ff" fontSize="13">
        ⚒ Single-Cycle RISC-V (Educational)
      </text>
      <ValueBox
        x={550}
        y={12}
        w={139}
        value={`Cycle ${h.cycle} (Write Back)`}
      />
      <Trace d="M86 308H135M223 344H325M86 307V168H190V285" color="#00cfe9" />
      <Trace d="M224 344H261V156H364M224 344H290V190H325" color="#64bfff" />
      <Trace d="M446 351H546M446 392H508V460H546" color="#04ddf3" />
      <Trace
        d="M615 368H688M446 466H519V514H821V421"
        color="#a76cff"
        on={!!r[3]}
      />
      <Trace d="M417 222V257H565V311M431 222V257H775V335" color="#ffbd27" />
      <Trace d="M785 396H837V473H870V211H84V275" color="#dceeff" />
      <Block x={38} y={274} w={48} h={51} title="PC" />
      <ValueBox x={22} y={333} w={78} value={hx(h.pc * 8, 8)} />
      <Block
        x={135}
        y={285}
        w={88}
        h={110}
        title="Instruction"
        subtitle="Memory"
      >
        <text x="180" y="364" fill="#d8eaff" textAnchor="middle" fontSize="12">
          (IMEM)
        </text>
      </Block>
      <ValueBox x={142} y={402} w={76} value="0x00818433" />
      <Block
        x={364}
        y={116}
        w={87}
        h={107}
        title="Control Unit"
        subtitle="(CU)"
      />
      <Block
        x={325}
        y={295}
        w={121}
        h={152}
        title="Register File"
        subtitle="(x0–x31)"
        selected
      >
        {["rs1", "rs2", "rd"].map((v, i) => (
          <g key={v}>
            <text x="340" y={375 + i * 24} fill="#b5d7ec" fontSize="12">
              {v}
            </text>
            <ValueBox x={371} y={359 + i * 24} w={39} value={i + 1} />
          </g>
        ))}
      </Block>
      {[1, 2, 3].map((n, i) => (
        <g key={n}>
          {n === 3 && (
            <rect
              x="345"
              y="500"
              width="80"
              height="25"
              rx="3"
              fill="#39237c"
              stroke="#9672ff"
            />
          )}
          <text
            x="354"
            y={470 + i * 25}
            fill="#e8f6ff"
            fontFamily="Consolas,monospace"
            fontSize="13"
          >
            R{n}　= {r[n]}
          </text>
        </g>
      ))}
      <Block x={480} y={336} w={31} h={77} title="0" subtitle="1" />
      <path
        d="M546 312L615 342V396L546 428V389L557 370 546 351z"
        fill="#0c4254"
        stroke="#04e0f4"
        strokeWidth="2"
      />
      <text x="582" y="361" fill="white" textAnchor="middle" fontSize="15">
        ALU
      </text>
      <text x="582" y="397" fill="white" textAnchor="middle" fontSize="13">
        ADD
      </text>
      <ValueBox x={546} y={455} w={69} value={r[3]} />
      <text x="555" y="446" fill="#c9dff2" fontSize="13">
        ALU result
      </text>
      <Block x={685} y={337} w={100} h={113} title="Data" subtitle="Memory">
        <text x="736" y="404" textAnchor="middle" fill="#cbe7ff" fontSize="12">
          (DMEM)
        </text>
      </Block>
      <Block x={837} y={373} w={30} h={73} title="0" subtitle="1" />
      {["RegWrite", "MemRead", "MemWrite", "ALUSrc", "Branch", "ALUOp"].map(
        (v, i) => (
          <g key={v}>
            <Trace
              d={`M451 ${127 + i * 19}H500`}
              color={i < 4 ? "#00c9f4" : "#ffc332"}
              on={i === 0}
            />
            <text x="510" y={131 + i * 19} fill="#c5e0f1" fontSize="12">
              {v}
            </text>
          </g>
        ),
      )}
    </Surface>
  );
}
export function TimeMachineDock() {
  const s = useSandbox(),
    h = s.history[s.historyIndex]!;
  return (
    <>
      <Tabs
        items={["Timing", "Console", "Event History", "State Diff"]}
        value={s.bottom || "Event History"}
        onChange={s.setBottom}
      />
      <div className="sb-time-machine">
        <div className="sb-time-events">
          <h3>Event History</h3>
          {s.history
            .slice(Math.max(0, s.historyIndex - 2), s.historyIndex + 3)
            .map((item, i) => (
              <button
                key={item.cycle}
                className={item === h ? "active" : ""}
                onClick={() => {
                  s.setHistoryIndex(s.history.indexOf(item));
                  s.setHistorical(true);
                }}
              >
                <b>{item === h ? "▶" : "✓"}</b>
                {item.cycle}
                <span>{item.event}</span>
                <small>
                  {i === 2 ? `R3 = ${item.cpu.registers[3]}` : item.instruction}
                </small>
              </button>
            ))}
        </div>
        <div className="sb-time-scrubber">
          <div className="sb-time-controls">
            <b>Viewing history • Cycle {h.cycle}</b>
            <button
              onClick={() => {
                s.setHistorical(true);
                s.setHistoryIndex(Math.max(0, s.historyIndex - 1));
              }}
            >
              ← Previous
            </button>
            <button
              onClick={() => {
                s.setHistorical(true);
                s.setHistoryIndex(
                  Math.min(s.history.length - 1, s.historyIndex + 1),
                );
              }}
            >
              Next →
            </button>
            <button onClick={() => s.setHistorical(false)}>
              ◉ Return to live
            </button>
            <button onClick={s.branchHistory}>
              ♧ Branch simulation from here
            </button>
          </div>
          <div className="sb-time-points">
            {s.history.map((item, i) => (
              <button
                aria-label={`View cycle ${item.cycle}`}
                className={i === s.historyIndex ? "active" : ""}
                key={i}
                onClick={() => {
                  s.setHistoryIndex(i);
                  s.setHistorical(true);
                }}
                style={
                  {
                    "--point-color": [
                      "#00b6fb",
                      "#00d7e7",
                      "#ffa900",
                      "#7d32ff",
                      "#ad67ff",
                    ][i % 5],
                  } as React.CSSProperties
                }
              >
                <i />
                {item.cycle}
              </button>
            ))}
          </div>
          <div className="sb-time-legend">
            🔵 Fetch　 🟢 Decode　 🟠 Execute　 🟣 Memory　 🟣 Write Back
          </div>
          <Panel title="◉　Challenge">
            <p>Find the cycle where R3 becomes 8.</p>
            <button
              onClick={() =>
                s.setNotice("Hint: inspect the Write Back snapshot at cycle 6.")
              }
            >
              ♧ Hint
            </button>
          </Panel>
        </div>
      </div>
    </>
  );
}
export function TimeMachineInspector() {
  const s = useSandbox(),
    h = s.historical ? s.history[s.historyIndex]! : s.history.at(-1)!,
    prev = s.history[Math.max(0, s.historyIndex - 1)]!;
  return (
    <>
      <h3>Inspector</h3>
      <Tabs
        items={["Component", "Signals"]}
        value={s.bottom === "Signals" ? "Signals" : "Component"}
        onChange={s.setBottom}
      />
      <Panel title="Register File">
        <p>32 × 32-bit general purpose registers.</p>
        <Field label="Name">
          <output>regfile0</output>
        </Field>
        <Field label="Registers">
          <output>32</output>
        </Field>
        <Field label="Data Width">
          <output>32 bits</output>
        </Field>
        <Field label="View">
          <output>Decimal</output>
        </Field>
        <MiniTable
          headers={["Reg", "Name", "Value"]}
          rows={Array.from({ length: 8 }, (_, i) => [
            `x${i}`,
            i === 0 ? "ZERO" : `R${i}`,
            h.cpu.registers[i],
          ])}
        />
      </Panel>
      <Panel title={`Control Signals (Cycle ${h.cycle})`}>
        <MiniTable
          headers={["Signal", "Value"]}
          rows={[
            ["RegWrite", h.event === "Write Back" ? 1 : 0],
            ["MemRead", 0],
            ["MemWrite", h.cpu.lastWrite ? 1 : 0],
            ["ALUSrc", 0],
            ["MemtoReg", 0],
            ["Branch", 0],
            ["ALUOp", "ADD (00)"],
          ]}
        />
      </Panel>
      <Panel title={`State Diff (Cycle ${prev.cycle} → ${h.cycle})`}>
        <MiniTable
          headers={["Item", "Before", "After"]}
          rows={[
            ["R3", prev.cpu.registers[3], h.cpu.registers[3]],
            ["R1", prev.cpu.registers[1], h.cpu.registers[1]],
            ["R2", prev.cpu.registers[2], h.cpu.registers[2]],
            ["PC", hx(prev.cpu.pc * 8, 8), hx(h.cpu.pc * 8, 8)],
          ]}
        />
      </Panel>
    </>
  );
}
