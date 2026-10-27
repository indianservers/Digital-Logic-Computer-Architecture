import { useSandbox } from "./sandboxState";
import { hx } from "./sandboxModel";
import {
  Block,
  Field,
  GateSymbol,
  MiniTable,
  Panel,
  Surface,
  Tabs,
  Trace,
  ValueBox,
} from "./SandboxUI";
const STAGES = ["Fetch", "Decode", "Execute", "Memory", "Writeback"];
export function CpuView() {
  const s = useSandbox(),
    cpu =
      s.page === "history" && s.historical
        ? s.history[s.historyIndex]!.cpu
        : s.cpu,
    r = cpu.registers;
  return (
    <Surface
      label="8-bit educational CPU with live register values and control signals"
      viewBox="0 0 980 690"
    >
      <text x="32" y="54" className="sb-svg-title">
        8-bit Educational CPU
      </text>
      {s.page === "breaks" && s.pausedReason && (
        <g>
          <rect
            x="16"
            y="75"
            width="940"
            height="44"
            fill="#75500a"
            stroke="#ffc239"
          />
          <text x="35" y="103" fill="#ffe699" fontSize="16">
            Ⅱ Paused • {s.pausedReason} • STORE R3, [0x20] — before memory write
          </text>
        </g>
      )}
      <Trace
        d="M114 148H405M155 148V312"
        color="#06d4f8"
        on={s.running || !!(s.tick % 2)}
      />
      <Trace d="M215 350H270M215 350H240V205H405" color="#c5edff" />
      <Trace
        d="M383 338H475M383 365H433V482H630"
        color="#02e6ee"
        on={r[1] !== 0}
      />
      <Trace
        d="M620 338H690M620 388H690M806 364H920V568H755"
        color="#00dbe8"
        on={r[2] !== 0}
      />
      <Trace
        d="M925 365V451H150V402M150 451V503M443 451V386H475"
        color="#b691ff"
        on={r[3] !== 0}
      />
      <Trace
        d="M495 230V278H520M552 230V265H750V315M451 230V273H336V300"
        color="#ffb20b"
        on={s.stage >= 2}
      />
      <Trace d="M62 330H88M62 330V555H125" color="#acd5eb" />
      <Block x={44} y={117} w={70} h={63} title="CLK">
        <path
          d="M56 165H64V146H76V165H87V146H100"
          stroke="#40ebff"
          fill="none"
          strokeWidth="2"
        />
      </Block>
      <text x="60" y="199" fill="#8fc8e5" fontSize="12">
        1 Hz (sim)
      </text>
      <Block
        x={405}
        y={132}
        w={178}
        h={101}
        title="Control Unit"
        subtitle="Instruction Decode"
      >
        <text x="494" y="209" textAnchor="middle" fill="#9dd8ef" fontSize="13">
          & Control Logic
        </text>
      </Block>
      {["RegWrite", "ALUSrc", "MemRead", "MemWrite"].map((n, i) => (
        <g key={n}>
          <Trace
            d={`M723 ${150 + i * 21}H583`}
            color="#ffb60c"
            on={i === 0 && !cpu.halted}
          />
          <rect
            x="718"
            y={146 + i * 21}
            width="7"
            height="7"
            fill={i === 0 ? "#ffdb54" : "#6c4914"}
          />
          <text x="738" y={154 + i * 21} fill="#ffbe26" fontSize="12">
            {n}
          </text>
        </g>
      ))}
      <Block x={88} y={312} w={128} h={96} title="PC">
        <ValueBox x={121} y={350} value={hx(cpu.pc)} />
        <text x="152" y="395" textAnchor="middle" fill="#afd5ef" fontSize="13">
          +1
        </text>
      </Block>
      <Block
        x={270}
        y={300}
        w={115}
        h={112}
        title="Instruction"
        subtitle="Decoder"
      >
        <ValueBox x={299} y={351} w={61} value="DEC" />
      </Block>
      <Block
        x={475}
        y={300}
        w={148}
        h={132}
        title="Register File"
        selected={s.selected === "Register File"}
        onSelect={() => s.setSelected("Register File")}
      >
        {[0, 1, 2, 3].map((n, i) => (
          <g key={n}>
            <text x="486" y={343 + i * 23} fill="#bad3e5" fontSize="12">
              {["A1", "A2", "WD", ""][i]}
            </text>
            <ValueBox
              x={528}
              y={329 + i * 23}
              w={80}
              value={`R${n}  ${hx(r[n]!)}`}
            />
          </g>
        ))}
      </Block>
      <Block
        x={694}
        y={315}
        w={116}
        h={116}
        title=""
        selected={s.selected === "ALU"}
        onSelect={() => s.setSelected("ALU")}
      >
        <path
          d="M710 336L739 348 752 361 766 348 793 336 779 381H724z"
          fill="#91a5b7"
          stroke="#e8f8ff"
        />
        <text x="752" y="396" fill="white" fontSize="14" textAnchor="middle">
          ALU
        </text>
        <ValueBox x={710} y={403} w={84} value="ADD" />
      </Block>
      <ValueBox x={897} y={351} w={51} value={hx(r[3]!)} />
      <Block x={128} y={496} w={284} h={145} title="">
        <svg x="160" y="507" width="58" height="62">
          <GateSymbol kind="memory" realistic />
        </svg>
        <text x="203" y="591" fill="white" fontSize="12" textAnchor="middle">
          Instruction Memory
        </text>
        <text x="203" y="609" fill="#82bddb" fontSize="11" textAnchor="middle">
          256 × 8-bit (ROM)
        </text>
        {s.program
          .split("\n")
          .slice(0, 6)
          .map((line, i) => (
            <g key={i}>
              {i === Math.max(0, cpu.pc - 1) && (
                <rect
                  x="241"
                  y={506 + i * 20}
                  width="164"
                  height="21"
                  fill="#0455ab"
                  stroke="#16b4ff"
                />
              )}
              <text
                x="247"
                y={521 + i * 20}
                fill="#c6dff0"
                fontSize="10"
                fontFamily="Consolas,monospace"
              >
                {hx(i)}: {line}
              </text>
            </g>
          ))}
      </Block>
      <Block x={633} y={500} w={128} h={122} title="">
        <svg x="675" y="514" width="52" height="54">
          <GateSymbol kind="memory" realistic />
        </svg>
        <text x="697" y="590" fill="white" fontSize="12" textAnchor="middle">
          Data Memory
        </text>
        <text x="697" y="609" fill="#82bddb" fontSize="11" textAnchor="middle">
          256 × 8-bit (RAM)
        </text>
      </Block>
      <ValueBox x={766} y={561} w={60} value={hx(cpu.memory[32] ?? 0)} />
      <text x="829" y="470" fill="#b594ff" fontSize="12">
        8-bit Data Bus
      </text>
      <g transform="translate(850 20) scale(.11)">
        <rect
          width="950"
          height="650"
          fill="#061724"
          stroke="#6f9bb9"
          strokeWidth="10"
        />
        <path
          d="M50 100H400V300H700V500H200V100M400 300V600M700 300H900"
          stroke="#4189ae"
          fill="none"
          strokeWidth="15"
        />
      </g>
    </Surface>
  );
}
export function CpuDock() {
  const s = useSandbox(),
    tab = s.bottom || "Program";
  return (
    <>
      <Tabs
        items={["Program", "Timing Diagram", "Console"]}
        value={tab}
        onChange={s.setBottom}
      />
      {tab === "Program" ? (
        <div className="sb-cpu-dock-grid">
          <div className="sb-program-editor">
            <textarea
              aria-label="CPU assembly program"
              spellCheck={false}
              value={s.program}
              onChange={(e) => {
                s.setProgram(e.target.value);
                s.setRunning(false);
              }}
            />
            <button onClick={() => s.setProgram(s.program + "\nNOP")}>
              ＋　Add instruction
            </button>
          </div>
          <Panel title="Simulation Controls">
            <div className="sb-row">
              <button onClick={s.reset}>■</button>
              <button onClick={() => s.setRunning(false)}>Ⅱ</button>
              <button onClick={() => s.setRunning(!s.running)}>▶</button>
              <button onClick={() => s.commitInstruction(true)}>▸▏</button>
            </div>
            <Field label="Clock Cycle">
              <output>{s.cpu.cycle}</output>
            </Field>
            <Field label="Stage">
              <select
                value={s.stage}
                onChange={(e) => s.setStage(Number(e.target.value))}
              >
                {STAGES.map((n, i) => (
                  <option key={n} value={i}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
          </Panel>
          <Panel title="Control Signals (current cycle)">
            {["RegWrite", "ALUSrc", "MemRead", "MemWrite"].map((v, i) => (
              <div className="sb-control-signal" key={v}>
                <i
                  style={{
                    background: ["#ff9d00", "#00b5ec", "#a044ff", "#fa2599"][i],
                  }}
                />
                {v}
                <svg viewBox="0 0 100 20">
                  <path
                    d={i === 0 ? "M0 3H45V17H80V3H100" : "M0 3H25V17H100"}
                    fill="none"
                    stroke={["#ff9d00", "#00b5ec", "#a044ff", "#fa2599"][i]}
                  />
                </svg>
                <b>{i === 0 ? 1 : 0}</b>
              </div>
            ))}
          </Panel>
          <Panel title="Stage Pipeline (single cycle)">
            <div className="sb-stages">
              {STAGES.map((n, i) => (
                <button
                  className={s.stage === i ? "active" : ""}
                  key={n}
                  onClick={() => s.setStage(i)}
                >
                  {i + 1}
                  <small>{n}</small>
                </button>
              ))}
            </div>
            <h4>Stage Details</h4>
            <p>
              {STAGES[s.stage]} • {s.cpu.last}
            </p>
            <p>R3 ← {hx(s.cpu.registers[3]!)}</p>
          </Panel>
        </div>
      ) : tab === "Console" ? (
        <pre className="sb-console">
          [Cycle {s.cpu.cycle}] {s.cpu.last}
          {"\n"}PC={hx(s.cpu.pc)}　R3={hx(s.cpu.registers[3]!)}　
          {s.cpu.halted ? "HALTED" : "Ready"}
        </pre>
      ) : (
        <MiniTable
          headers={["Stage", "Cycle", "Instruction"]}
          rows={s.history
            .slice(-5)
            .map((h) => [h.event, h.cycle, h.instruction])}
        />
      )}
    </>
  );
}
export function CpuInspector() {
  const s = useSandbox(),
    c =
      s.page === "history" && s.historical
        ? s.history[s.historyIndex]!.cpu
        : s.cpu;
  return (
    <>
      <Panel title="Instruction Details">
        <dl>
          <dt>Address</dt>
          <dd>{hx(Math.max(0, c.pc - 1))}</dd>
          <dt>Instruction</dt>
          <dd className="sb-blue-value">{c.last}</dd>
          <dt>Opcode</dt>
          <dd>0x03</dd>
        </dl>
        <h4>Operands</h4>
        <MiniTable
          headers={["", ""]}
          rows={[
            ["Rd", "R3"],
            ["Rs1", "R1"],
            ["Rs2", "R2"],
          ]}
        />
        <h4>Description</h4>
        <p>R3 ← R1 + R2 (8-bit addition)</p>
      </Panel>
      <Panel title="Register File">
        <MiniTable
          headers={["Register", "Hex", "Decimal"]}
          rows={[0, 1, 2, 3].map((n) => [
            <span className={`sb-register-dot r${n}`}>R{n}</span>,
            <output>{hx(c.registers[n]!)}</output>,
            c.registers[n],
          ])}
        />
      </Panel>
      <Panel title="ALU">
        <dl>
          {[
            ["Operation", "ADD"],
            ["A", hx(c.registers[1]!)],
            ["B", hx(c.registers[2]!)],
            ["Result", hx(c.registers[3]!)],
            ["Zero Flag", c.flags.z],
            ["Carry Flag", c.flags.c],
            ["Negative Flag", c.flags.n],
          ].map(([a, b]) => (
            <div className="sb-dl-row" key={a}>
              <dt>{a}</dt>
              <dd>{b}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </>
  );
}
export function DatapathView() {
  const s = useSandbox();
  return (
    <Surface
      toolbar={false}
      label="Interactive 8-bit datapath with ALU and register writeback"
      viewBox="0 0 1000 700"
    >
      <g>
        {[
          ["ADD R3, R1, R2", 30, 125, "#d8ecff"],
          [`R1 = ${s.operandA} (${hx(s.operandA)})`, 168, 110, "#03c8ff"],
          [`R2 = ${s.operandB} (${hx(s.operandB)})`, 302, 110, "#03c8ff"],
          [
            `ALU result = ${s.arithmetic.y} (${hx(s.arithmetic.y)})`,
            436,
            180,
            "#ffba39",
          ],
          [`R3 ← ${s.reg3} (${hx(s.reg3)})`, 630, 120, "#b774ff"],
        ].map(([v, x, w, c]) => (
          <g key={v}>
            <rect
              x={Number(x)}
              y="16"
              width={Number(w)}
              height="28"
              rx="3"
              fill="#102b3d"
              stroke="#35586f"
            />
            <text
              x={Number(x) + Number(w) / 2}
              y="35"
              textAnchor="middle"
              fill={String(c)}
              fontSize="13"
            >
              {v}
            </text>
          </g>
        ))}
      </g>
      <Trace d="M110 132H250M58 172V270H114" color="#03dce7" />
      <Trace d="M470 137H665V245H812V320" color="#71819d" />
      <Trace d="M274 320H504" color="#00d8ec" on={!!s.operandA} />
      <Trace d="M274 396H504" color="#00d8ec" on={!!s.operandB} />
      <Trace
        d="M634 361H718L812 335"
        color="#00e8e8"
        on={s.writeback && !!s.arithmetic.y}
      />
      <Trace
        d="M927 373H960V650H42V445H114"
        color="#ac5dff"
        on={s.writeback && !!s.reg3}
      />
      <Trace d="M812 420H762V594H700" color="#a7b9c9" on={false} />
      <Trace d="M114 448H42V650" color="#e1a761" on={s.micro === 2} />
      <Trace d="M557 548V455" color="#ffb82a" />
      <Block x={20} y={92} w={90} h={80} title="PC" subtitle="8-bit" />
      <Block
        x={250}
        y={80}
        w={220}
        h={120}
        title="Instruction Memory"
        subtitle="256 × 16"
      >
        <ValueBox x={304} y={139} w={121} value="0x0231" />
        <text x="360" y="181" fill="white" textAnchor="middle" fontSize="13">
          ADD R3, R1, R2
        </text>
      </Block>
      <Block
        x={114}
        y={235}
        w={160}
        h={315}
        title="Register File"
        subtitle="8 × 8"
      >
        {Array.from({ length: 8 }, (_, n) => (
          <g key={n}>
            <rect
              x="137"
              y={282 + n * 26}
              width="112"
              height="25"
              fill={
                n === 1 || n === 2 ? "#064153" : n === 3 ? "#402259" : "#293d55"
              }
              stroke={
                n === 1 || n === 2 ? "#00d8f2" : n === 3 ? "#b475ff" : "#52687e"
              }
            />
            <text
              x="150"
              y={300 + n * 26}
              fill={n === 3 ? "#d2a2ff" : "#cde9f6"}
              fontSize="13"
              fontFamily="Consolas,monospace"
            >
              R{n}　{" "}
              {hx(
                n === 1
                  ? s.operandA
                  : n === 2
                    ? s.operandB
                    : n === 3
                      ? s.reg3
                      : 0,
              )}
            </text>
          </g>
        ))}
      </Block>
      <Block
        x={504}
        y={283}
        w={130}
        h={172}
        title=""
        selected
        onSelect={() => s.setSelected("ALU")}
      >
        <path
          d="M529 318L555 332 570 345 584 330 606 318 595 375H540z"
          fill="#122c40"
          stroke="#e5f7ff"
          strokeWidth="2"
        />
        <text x="569" y="389" fill="white" fontSize="14" textAnchor="middle">
          ALU
        </text>
        <text x="569" y="406" fill="#c9e6f6" fontSize="12" textAnchor="middle">
          8-bit
        </text>
        <foreignObject x="517" y="419" width="104" height="28">
          <select
            aria-label="Canvas ALU operation"
            className="sb-canvas-select"
            value={s.operation}
            onChange={(e) =>
              s.setOperation(e.target.value as typeof s.operation)
            }
          >
            {["ADD", "SUB", "AND", "OR", "XOR"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </foreignObject>
      </Block>
      <Block
        x={812}
        y={284}
        w={115}
        h={142}
        title="Writeback MUX"
        subtitle="2:1 (8-bit)"
        onSelect={() => {
          s.setWriteback(!s.writeback);
          s.setNotice(
            s.writeback
              ? "Writeback disconnected. Click MUX to reconnect."
              : "Writeback connected.",
          );
        }}
      >
        <path
          d="M854 340L892 360V379L854 402z"
          fill="#172f42"
          stroke="white"
          strokeWidth="2"
        />
      </Block>
      <Block
        x={540}
        y={548}
        w={160}
        h={90}
        title="Data Memory"
        subtitle="256 × 8"
      >
        <ValueBox x={574} y={597} w={92} value="" />
      </Block>
      <ValueBox
        x={609}
        y={473}
        w={99}
        value={`Z ${s.arithmetic.z}  C ${s.arithmetic.c}`}
      />
      <text x="398" y="310" fill="#00d6ff" fontSize="16">
        {hx(s.operandA)}
      </text>
      <text x="398" y="390" fill="#00d6ff" fontSize="16">
        {hx(s.operandB)}
      </text>
      <text x="662" y="345" fill="#00e8ff" fontSize="16">
        {hx(s.arithmetic.y)}
      </text>
      {["opcode", "rs1", "rs2", "rd"].map((v, i) => (
        <g key={v}>
          <text x={718 + i * 57} y="115" fill="#a9bed4" fontSize="12">
            {v}
          </text>
          <ValueBox
            x={697 + i * 57}
            y={125}
            w={55}
            value={["0000", "001", "010", "011"][i]}
            color={["#ffb727", "#00bdff", "#00bdff", "#c37bff"][i]}
          />
        </g>
      ))}
    </Surface>
  );
}
export function DatapathDock() {
  const s = useSandbox();
  return (
    <div className="sb-datapath-dock">
      <div>
        <Tabs
          items={["Simulation", "Console", "Breakpoints", "Signal Manager"]}
          value={s.bottom || "Simulation"}
          onChange={s.setBottom}
        />
        <h3 className="sb-micro-title">Micro-operations (ADD R3, R1, R2)</h3>
        {["Read operands", "ALU execute", "Write back"].map((v, i) => (
          <button
            className={`sb-micro-row ${s.micro === i ? "active" : ""}`}
            key={v}
            onClick={() => {
              s.setMicro(i);
              if (i === 2 && s.writeback) s.setReg3(s.arithmetic.y);
            }}
          >
            <b>{i + 1}</b>
            <strong>{v}</strong>
            <span>
              {
                [
                  "Fetch R1 and R2 from register file",
                  "Perform ADD operation",
                  "Write result to R3",
                ][i]
              }
            </span>
            <em>{i < s.micro ? "✓" : i === s.micro ? "❯" : "○"}</em>
          </button>
        ))}
        <div className="sb-micro-task">
          <b>Task {s.micro + 1} of 3</b>
          <strong>Connect ALU result to writeback</strong>
          <small>
            Click the writeback multiplexer to connect or disconnect the result.
          </small>
        </div>
      </div>
      <div className="sb-datapath-wave">
        <div className="sb-wave-toolbar">
          <select>
            <option>8 signals</option>
          </select>
          <select>
            <option>100 ns/div</option>
          </select>
          <button onClick={s.step}>≫</button>
          <span>t = {s.tick * 80 + 240} ns</span>
        </div>
        <svg viewBox="0 0 900 170" preserveAspectRatio="none">
          <rect width="900" height="170" fill="#071723" />
          {[
            "clk",
            "pc[7:0]",
            "instr[15:0]",
            "rs1_data[7:0]",
            "rs2_data[7:0]",
            "alu_result[7:0]",
            "wb_data[7:0]",
            "wb_en",
          ].map((v, i) => (
            <g key={v}>
              <text
                x="8"
                y={25 + i * 19}
                fill={i === 5 ? "#ffbd27" : "#c8dfef"}
                fontFamily="Consolas,monospace"
                fontSize="12"
              >
                {v}
              </text>
              <text x="140" y={25 + i * 19} fill="#c8dfef" fontSize="12">
                {
                  [
                    "0",
                    hx(4),
                    "0x0231",
                    hx(s.operandA),
                    hx(s.operandB),
                    hx(s.arithmetic.y),
                    hx(s.reg3),
                    Number(s.writeback),
                  ][i]
                }
              </text>
              <path
                d={
                  i === 0
                    ? "M205 25h45V13h40v12h50V13h40v12h50V13h40v12h50V13h40v12h50V13h40v12h50V13h40v12h100"
                    : `M205 ${21 + i * 19}H895V${12 + i * 19}H205Z`
                }
                fill="none"
                stroke={
                  [
                    "#cce4f2",
                    "#00c5ff",
                    "#6072cc",
                    "#00d8e9",
                    "#00d8e9",
                    "#ffbd27",
                    "#b56aff",
                    "#00d991",
                  ][i]
                }
              />
            </g>
          ))}
          <path d="M490 0V170" stroke="#c5f1ff" strokeDasharray="5 3" />
        </svg>
      </div>
    </div>
  );
}
export function DatapathInspector() {
  const s = useSandbox();
  return (
    <>
      <Panel title="ALU Properties">
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
        <Field label="Input A">
          <input
            type="number"
            min="0"
            max="255"
            value={s.operandA}
            onChange={(e) => s.setOperandA(Number(e.target.value) & 255)}
          />
        </Field>
        <Field label="Input B">
          <input
            type="number"
            min="0"
            max="255"
            value={s.operandB}
            onChange={(e) => s.setOperandB(Number(e.target.value) & 255)}
          />
        </Field>
        <Field label="Result">
          <output>{hx(s.arithmetic.y)}</output>
        </Field>
        <label>
          <input
            type="checkbox"
            checked={s.writeback}
            onChange={(e) => s.setWriteback(e.target.checked)}
          />{" "}
          Writeback connected
        </label>
      </Panel>
      <Panel title="Register File">
        <MiniTable
          headers={["Register", "Value"]}
          rows={[
            ["R0", 0],
            ["R1", s.operandA],
            ["R2", s.operandB],
            ["R3", s.reg3],
          ]}
        />
      </Panel>
      <Panel title="Control Signals">
        <p>RegWrite = {Number(s.micro === 2)}</p>
        <p>ALUSrc = 0</p>
        <p>MemRead = 0　MemWrite = 0</p>
      </Panel>
    </>
  );
}
