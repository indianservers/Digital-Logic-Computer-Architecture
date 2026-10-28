import { useSimulatorCapture } from "../../layout/SimulatorCapture";
import { useState } from "react";
import { useSandbox } from "./sandboxState";
import { bn, evaluateCircuit, partPorts, type Part } from "./sandboxModel";
import {
  GateSymbol,
  Led,
  MiniTable,
  SIcon,
  Surface,
  Switch,
  Terminal,
  Trace,
  ValueBox,
} from "./SandboxUI";
function portPosition(part: Part, port: string, out = false) {
  const w = part.kind === "fa" ? 90 : 100,
    h = part.kind === "fa" ? 120 : 90,
    ports = partPorts(part.kind),
    list = out ? ports.outputs : ports.inputs,
    index = Math.max(0, list.indexOf(port));
  return {
    x: part.x + (out ? w : 0),
    y: part.y + 36 + (index * (h - 45)) / Math.max(1, list.length - 1),
  };
}
export function CircuitView() {
  useSimulatorCapture("studios/sandbox/CircuitViews.tsx:CircuitView", () => ({ s }), "1eedafb65f8b");

  const s = useSandbox();
  function source(id: string, port: string) {
    if (/^[AB]\d$/.test(id)) {
      const bit = Number(id[1]);
      return { x: 118, y: (id[0] === "A" ? 242 : 457) - bit * 35 };
    }
    if (id === "Cin") return { x: 110, y: 525 };
    const part = s.circuit.parts.find((p) => p.id === id);
    return part ? portPosition(part, port, true) : { x: 0, y: 0 };
  }
  return (
    <Surface
      label="Editable 4-bit ripple carry adder with live inputs and output LEDs"
      className="sb-circuit-surface"
    >
      <g className="sb-circuit-inputs">
        <text x="20" y="110" fill="#eef5ff" fontSize="16">
          A[3:0] ={" "}
          <tspan fontFamily="Consolas,monospace">
            {bn(s.a)} ({s.a})
          </tspan>
        </text>
        <text x="20" y="325" fill="#eef5ff" fontSize="16">
          B[3:0] ={" "}
          <tspan fontFamily="Consolas,monospace">
            {bn(s.b)} ({s.b})
          </tspan>
        </text>
        {["A", "B"].map((name) =>
          Array.from({ length: 4 }, (_, row) => {
            const bit = 3 - row,
              y = (name === "A" ? 137 : 352) + row * 35,
              value = ((name === "A" ? s.a : s.b) >> bit) & 1;
            return (
              <g key={name + bit}>
                <text x="32" y={y + 5} fill="#c7dfef" fontSize="15">
                  {name}
                  {bit}
                </text>
                <Switch
                  x={64}
                  y={y - 11}
                  label={`${name}${bit}`}
                  value={value}
                  onToggle={() =>
                    name === "A"
                      ? s.setA(s.a ^ (1 << bit))
                      : s.setB(s.b ^ (1 << bit))
                  }
                />
                <Terminal
                  x={118}
                  y={y}
                  label={`Output ${name}${bit}`}
                  output
                  onClick={() => s.portClick(`${name}${bit}`, "Y", true)}
                  color={name === "A" ? "#37aaff" : "#a76cff"}
                />
              </g>
            );
          }),
        )}
        <text x="28" y="531" fill="#c7dfef" fontSize="15">
          Cin
        </text>
        <Switch
          x={62}
          y={514}
          value={s.cin}
          label="Carry input"
          onToggle={() => s.setCin(s.cin ? 0 : 1)}
        />
        <Terminal
          x={110}
          y={525}
          label="Output Cin"
          output
          onClick={() => s.portClick("Cin", "Y", true)}
          color="#ffbb2b"
        />
      </g>
      {s.circuit.wires.map((wire) => {
        const from = source(wire.from, wire.out),
          toPart = s.circuit.parts.find((p) => p.id === wire.to);
        if (!toPart) return null;
        const to = portPosition(toPart, wire.input);
        const isInput = /^[AB]\d$/.test(wire.from),
          carry = wire.out === "Cout" || wire.from === "Cin",
          color = carry
            ? "#ffbd27"
            : wire.from.startsWith("B")
              ? "#a66dff"
              : "#35a7ff";
        const d = isInput
          ? `M${from.x} ${from.y}H${to.x - 30 - (wire.input === "B" ? 15 : 0)}V${to.y}H${to.x}`
          : `M${from.x} ${from.y}H${to.x - 20}V${to.y}H${to.x}`;
        return (
          <Trace
            key={wire.id}
            d={d}
            color={color}
            on={!!s.graph.output(wire.from, wire.out)}
            remove={() =>
              s.updateCircuit({
                ...s.circuit,
                wires: s.circuit.wires.filter((w) => w.id !== wire.id),
              })
            }
          />
        );
      })}
      {s.circuit.parts.map((part) => {
        const selected = part.id === s.selected,
          ports = partPorts(part.kind),
          w = part.kind === "fa" ? 90 : 100,
          h = part.kind === "fa" ? 120 : 90;
        return (
          <g
            key={part.id}
            className={`sb-editable-part ${selected ? "selected" : ""}`}
            onPointerDown={(event) => {
              if (s.tool !== "Select" || event.button !== 0) return;
              event.stopPropagation();
              const rect =
                event.currentTarget.ownerSVGElement!.getBoundingClientRect();
              s.updateCircuit({ ...s.circuit });
              s.drag.current = {
                id: part.id,
                x: part.x,
                y: part.y,
                px: event.clientX,
                py: event.clientY,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
              s.setSelected(part.id);
              event.currentTarget.dataset.factorX = String(
                ((980 / rect.width) * 100) / s.zoom,
              );
              event.currentTarget.dataset.factorY = String(
                ((760 / rect.height) * 100) / s.zoom,
              );
            }}
            onPointerMove={(event) => {
              const drag = s.drag.current;
              if (!drag || drag.id !== part.id) return;
              const x =
                  drag.x +
                  (event.clientX - drag.px) *
                    Number(event.currentTarget.dataset.factorX),
                y =
                  drag.y +
                  (event.clientY - drag.py) *
                    Number(event.currentTarget.dataset.factorY);
              s.patchPart(
                part.id,
                {
                  x: Math.max(130, Math.min(860, x)),
                  y: Math.max(90, Math.min(620, y)),
                },
                false,
              );
            }}
            onPointerUp={() => {
              s.drag.current = null;
            }}
            onClick={() => s.setSelected(part.id)}
          >
            <rect
              x={part.x}
              y={part.y}
              width={w}
              height={h}
              rx="4"
              fill="url(#sb-block)"
              stroke={selected ? "#1681ff" : "#6dadd3"}
              strokeWidth={selected ? 3 : 1.6}
              filter="url(#sb-shadow)"
            />
            <text
              x={part.x + w / 2}
              y={part.y + 24}
              textAnchor="middle"
              fill="#edf4ff"
              fontSize="16"
              fontWeight="600"
            >
              {part.label}
            </text>
            {part.kind === "led" && (
              <Led
                x={part.x + 50}
                y={part.y + 58}
                value={s.graph.output(part.id, "A")}
              />
            )}
            {part.kind !== "fa" && part.kind !== "led" && (
              <g>
                <svg
                  x={part.x + 21}
                  y={part.y + 26}
                  width="58"
                  height="44"
                  onDoubleClick={() => {
                    if (part.kind === "constant")
                      s.patchPart(part.id, { value: part.value ? 0 : 1 });
                  }}
                >
                  <GateSymbol kind={part.kind} realistic />
                </svg>
                <text
                  x={part.x + w / 2}
                  y={part.y + 82}
                  textAnchor="middle"
                  fill="#a9d8ee"
                  fontSize="12"
                >
                  {s.graph.output(part.id, "Y") ?? "X"}
                </text>
              </g>
            )}
            {ports.inputs.map((port) => {
              const pos = portPosition(part, port);
              return (
                <g key={port}>
                  <Terminal
                    {...pos}
                    label={`Connect to ${part.label}.${port}`}
                    onClick={() => s.portClick(part.id, port, false)}
                    color={port === "Cin" ? "#ffbe40" : "#ad91ff"}
                  />
                  {s.showPins && (
                    <text
                      x={pos.x + 12}
                      y={pos.y + 4}
                      fill="#d3e7f7"
                      fontSize="12"
                    >
                      {port}
                    </text>
                  )}
                </g>
              );
            })}
            {ports.outputs.map((port) => {
              const pos = portPosition(part, port, true);
              return (
                <g key={port}>
                  <Terminal
                    {...pos}
                    output
                    label={`Connect from ${part.label}.${port}`}
                    onClick={() => s.portClick(part.id, port, true)}
                    color="#72caff"
                  />
                  {s.showPins && (
                    <text
                      x={pos.x - 11}
                      y={pos.y + 5}
                      fill="#d3e7f7"
                      textAnchor="end"
                      fontSize="12"
                    >
                      {port}
                    </text>
                  )}
                </g>
              );
            })}
            {selected &&
              [
                [part.x, part.y],
                [part.x + w, part.y],
                [part.x, part.y + h],
                [part.x + w, part.y + h],
              ].map(([x, y], i) => (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="4"
                  fill="#f5faff"
                  stroke="#0077ff"
                  strokeWidth="2"
                />
              ))}
          </g>
        );
      })}
      {s.circuit.parts
        .filter((p) => p.kind === "fa")
        .map((part, i) => {
          const point = portPosition(part, "S", true),
            value = s.graph.output(part.id, "S"),
            x = part.x + 45;
          return (
            <g key={part.id}>
              <Trace
                d={`M${point.x} ${point.y}H${point.x + 18}V530H${x}V556`}
                color="#2ae4a6"
                on={!!value}
              />
              <Led x={x} y={574} value={value} label={`S${i}`} />
              <text x={x + 25} y="579" fill="#d5ecff" fontSize="15">
                {value ?? "X"}
              </text>
            </g>
          );
        })}
      {s.circuit.parts.some((p) => p.id === "FA3") && (
        <>
          <Trace
            d={`M${source("FA3", "Cout").x} ${source("FA3", "Cout").y}H930V438H940`}
            color="#ffbd27"
            on={!!s.graph.carry}
          />
          <Led x={940} y={438} value={s.graph.carry} label="Cout" />
          <text
            x="940"
            y="474"
            fill="#d5ecff"
            fontSize="15"
            textAnchor="middle"
          >
            {s.graph.carry ?? "X"}
          </text>
        </>
      )}
    </Surface>
  );
}
export function CircuitDock() {
  useSimulatorCapture("studios/sandbox/CircuitViews.tsx:CircuitDock", () => ({ s }), "1eedafb65f8b");

  const s = useSandbox(),
    bits = s.circuit.parts.some((p) => p.id === "Sum") ? 1 : 4,
    mask = (1 << bits) - 1,
    tab = s.bottom || "Truth Table / Test Vectors";
  return (
    <div className="sb-circuit-dock">
      <div>
        <div className="sb-dock-tabs">
          {["Truth Table / Test Vectors", "Simulation Log", "Waveform"].map(
            (t) => (
              <button
                className={tab === t ? "active" : ""}
                key={t}
                onClick={() => s.setBottom(t)}
              >
                {t}
              </button>
            ),
          )}
          <button onClick={() => s.testCircuit()}>＋</button>
        </div>
        {tab === "Truth Table / Test Vectors" ? (
          <MiniTable
            headers={[
              "#",
              "A (dec)",
              "B (dec)",
              "Cin",
              "Expected S (dec)",
              "Expected Cout",
              "Actual S (dec)",
              "Actual Cout",
              "Result",
            ]}
            rows={[
              [0, 0, 0],
              [s.a, s.b, s.cin],
              [mask, 1, 0],
            ].map(([a, b, c], i) => {
              const output = evaluateCircuit(s.circuit, a!, b!, c!);
              const sum = (a! + b! + c!) & mask,
                carry = (a! + b! + c!) >>> bits;
              return [
                i + 1,
                a,
                b,
                c,
                sum,
                carry,
                output.sum ?? "X",
                output.carry ?? "X",
                <span
                  className={
                    output.sum !== sum || output.carry !== carry
                      ? "sb-fail"
                      : "sb-pass"
                  }
                >
                  {output.sum !== sum || output.carry !== carry
                    ? "Fail"
                    : "Pass"}
                </span>,
              ];
            })}
          />
        ) : tab === "Simulation Log" ? (
          <pre className="sb-console">
            [Cycle {s.tick}] A={s.a} B={s.b} Cin={s.cin}
            {"\n"}SUM={s.graph.sum ?? "X"} Cout={s.graph.carry ?? "X"}
            {"\n"}
            {s.testResult?.message ??
              "Input changes propagate through the connected circuit."}
          </pre>
        ) : (
          <MiniTable
            headers={["Signal", "Binary", "Decimal"]}
            rows={[
              ["A", bn(s.a), s.a],
              ["B", bn(s.b), s.b],
              [
                "S",
                s.graph.sum === null ? "XXXX" : bn(s.graph.sum),
                s.graph.sum ?? "X",
              ],
              ["Cout", s.graph.carry ?? "X", s.graph.carry ?? "X"],
            ]}
          />
        )}
      </div>
      <div className="sb-vector-controls">
        <div>
          <button className="sb-primary" onClick={() => s.testCircuit()}>
            <SIcon name="run" size={15} />
          </button>
          <select
            aria-label="Test vector"
            value={`${s.a},${s.b},${s.cin}`}
            onChange={(e) => {
              const [a, b, c] = e.target.value.split(",").map(Number);
              s.setA(a!);
              s.setB(b!);
              s.setCin(c!);
            }}
          >
            <option value={`${s.a},${s.b},${s.cin}`}>
              {s.a} + {s.b} = {s.a + s.b + s.cin} (current)
            </option>
            <option value="0,0,0">0 + 0 = 0</option>
            <option value="5,3,0">5 + 3 = 8</option>
            <option value="15,1,0">15 + 1 = 16</option>
          </select>
          <button onClick={() => s.setA((s.a + 1) & 15)}>＋</button>
          <button onClick={() => s.setA((s.a + 15) & 15)}>−</button>
        </div>
        <label>
          A (bin)
          <input
            aria-label="A binary input"
            value={bn(s.a)}
            maxLength={4}
            onChange={(e) => {
              if (/^[01]{0,4}$/.test(e.target.value))
                s.setA(parseInt(e.target.value || "0", 2));
            }}
          />
          ({s.a})
        </label>
        <label>
          B (bin)
          <input
            aria-label="B binary input"
            value={bn(s.b)}
            maxLength={4}
            onChange={(e) => {
              if (/^[01]{0,4}$/.test(e.target.value))
                s.setB(parseInt(e.target.value || "0", 2));
            }}
          />
          ({s.b})
        </label>
        <label>
          Cin
          <input
            aria-label="Carry input value"
            type="number"
            min={0}
            max={1}
            value={s.cin}
            onChange={(e) => s.setCin(Number(e.target.value) ? 1 : 0)}
          />
        </label>
        <div className="sb-vector-output">
          S (bin) <b>{s.graph.sum === null ? "XXXX" : bn(s.graph.sum)}</b> (
          {s.graph.sum ?? "X"})<br />
          Cout <b>{s.graph.carry ?? "X"}</b>
        </div>
      </div>
    </div>
  );
}
export function TemplateView() {
  useSimulatorCapture("studios/sandbox/CircuitViews.tsx:TemplateView", () => ({ s }), "1eedafb65f8b");

  const s = useSandbox();
  const xor = s.templateA ^ s.templateB,
    sum = xor ^ s.templateCin,
    carry = (s.templateA & s.templateB) | (xor & s.templateCin);
  return (
    <Surface
      label="Interactive editable full adder template"
      viewBox="0 0 840 610"
      className="sb-template-surface"
    >
      <text x="810" y="34" textAnchor="end" fill="#b8d3ed" fontSize="12">
        ⓘ Every wire and component is editable.
      </text>
      {[
        ["A", s.templateA, 130],
        ["B", s.templateB, 250],
        ["Cin", s.templateCin, 390],
      ].map(([name, value, y]) => (
        <g key={name}>
          <text x="35" y={Number(y) - 23} fill="#e9f5ff" fontSize="17">
            {name}
          </text>
          <Switch
            x={22}
            y={Number(y) - 11}
            value={Number(value)}
            label={`Template ${name}`}
            onToggle={() =>
              name === "A"
                ? s.setTemplateA(s.templateA ? 0 : 1)
                : name === "B"
                  ? s.setTemplateB(s.templateB ? 0 : 1)
                  : s.setTemplateCin(s.templateCin ? 0 : 1)
            }
          />
          <ValueBox x={73} y={Number(y) - 13} w={40} value={value} />
        </g>
      ))}
      <Trace d="M113 130H278M158 130V370H240" on={!!s.templateA} />
      <Trace
        d="M113 250H184V165H278M184 250V334H240"
        on={!!s.templateB}
        color="#aa6aff"
      />
      <Trace
        d="M113 390H208V188H455M208 390V458H375"
        on={!!s.templateCin}
        color="#b17bf2"
      />
      <Trace d="M366 150H453M399 150V425H375" color="#ffce36" on={!!xor} />
      <Trace d="M542 169H691V169H738" color="#10eb76" on={!!sum} />
      <Trace
        d="M325 352H573V421H610"
        color="#13e2e7"
        on={!!(s.templateA & s.templateB)}
      />
      <Trace
        d="M462 445H545V453H610"
        color="#c387eb"
        on={!!(xor & s.templateCin)}
      />
      <Trace d="M690 438H738" color="#f4ccff" on={!!carry} />
      <TemplateGate
        x={278}
        y={116}
        kind="xor"
        label={s.templateGateLabel === "XOR1" ? "XOR" : s.templateGateLabel}
      />
      <TemplateGate x={455} y={135} kind="xor" label="XOR" />
      <TemplateGate x={240} y={318} kind="and" label="AND" />
      <TemplateGate x={375} y={411} kind="and" label="AND" />
      <TemplateGate x={610} y={403} kind="or" label="OR" />
      <text x="409" y="119" fill="#d0e9ff" fontSize="17">
        A ⊕ B
      </text>
      <text x="465" y="389" fill="#d0e9ff" fontSize="17">
        A · B
      </text>
      <Led x={750} y={169} value={sum} label="Sum" />
      <ValueBox x={773} y={156} w={40} value={sum} />
      <Led x={750} y={438} value={carry} label="Cout" />
      <ValueBox x={773} y={425} w={40} value={carry} />
    </Surface>
  );
}
function TemplateGate({
  x,
  y,
  kind,
  label,
}: {
  x: number;
  y: number;
  kind: string;
  label: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <svg width="95" height="72" viewBox="0 0 70 65" color="#c7e7ff">
        <GateSymbol kind={kind} />
      </svg>
      <text x="48" y="40" fill="#e3efff" fontSize="15" textAnchor="middle">
        {label}
      </text>
    </g>
  );
}
export function TemplateDock() {
  useSimulatorCapture("studios/sandbox/CircuitViews.tsx:TemplateDock", () => ({ auto, frozen, format, s }), "1eedafb65f8b");

  const [auto, setAuto] = useState(true),
    [frozen, setFrozen] = useState(6),
    [format, setFormat] = useState("Binary");
  const s = useSandbox(),
    tab = s.bottom || "Truth Table";
  return (
    <div className="sb-template-dock">
      <div className="sb-dock-tabs">
        {["Truth Table", "Waveform", "Console"].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => s.setBottom(t)}
          >
            {t}
          </button>
        ))}
        <label className="sb-auto">
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => {
              setAuto(e.target.checked);
              setFrozen(
                (s.templateA << 2) | (s.templateB << 1) | s.templateCin,
              );
            }}
          />
          Auto update
        </label>
        <span>Binary / Decimal</span>
        <select
          aria-label="Truth table number format"
          value={format}
          onChange={(e) => setFormat(e.target.value)}
        >
          <option>Binary</option>
          <option>Decimal</option>
        </select>
      </div>
      {tab === "Truth Table" ? (
        <MiniTable
          selectedRow={
            auto
              ? (s.templateA << 2) | (s.templateB << 1) | s.templateCin
              : frozen
          }
          className={`sb-radix-${format.toLowerCase()}`}
          headers={[
            "A",
            "B",
            "Cin",
            "Sum (A ⊕ B ⊕ Cin)",
            "Cout (A · B + (A ⊕ B) · Cin)",
          ]}
          rows={Array.from({ length: 8 }, (_, i) => {
            const a = i >> 2,
              b = (i >> 1) & 1,
              c = i & 1;
            return [a, b, c, a ^ b ^ c, (a & b) | ((a ^ b) & c)];
          })}
        />
      ) : (
        <pre className="sb-console">
          A={s.templateA}　B={s.templateB}　Cin={s.templateCin}
          {"\n"}Sum={s.templateA ^ s.templateB ^ s.templateCin}　Cout=
          {(s.templateA + s.templateB + s.templateCin) >> 1}
        </pre>
      )}
    </div>
  );
}
