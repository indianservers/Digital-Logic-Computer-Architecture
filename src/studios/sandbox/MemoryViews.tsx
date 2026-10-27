import { useState } from "react";
import { useSandbox } from "./sandboxState";
import { cacheDecode, hx, RAM_BYTES, readHex } from "./sandboxModel";
import {
  Block,
  DarkTable,
  Surface,
  Trace,
  MiniTable,
  Tabs,
  SIcon,
} from "./SandboxUI";
export function MemoryView() {
  const s = useSandbox(),
    address = s.currentAddress,
    d = cacheDecode(address, s.cacheLines, s.blockSize),
    line = s.cache[d.index],
    last = s.accesses.at(-1),
    hit =
      last?.address === address ? last.hit : line?.valid && line.tag === d.tag;
  const data = Array.from(
    { length: s.blockSize },
    (_, i) => RAM_BYTES[d.base - (d.base % 4)]?.[(d.base + i) % 4] ?? 0,
  );
  return (
    <Surface
      label="Direct mapped cache and main memory with live address decoding"
      viewBox="0 0 910 775"
      toolbar={false}
      className="sb-memory-surface"
    >
      <Block x={30} y={105} w={154} h={202} title="CPU">
        <text x="49" y="172" fill="#b4d7f0" fontSize="13">
          Address　16-bit
        </text>
        <text x="49" y="204" fill="#b4d7f0" fontSize="13">
          Read　　　 1
        </text>
        <text x="49" y="235" fill="#b4d7f0" fontSize="13">
          Write　　　0
        </text>
        <text x="49" y="267" fill="#b4d7f0" fontSize="13">
          Data Out　16-bit
        </text>
      </Block>
      <Trace
        d="M184 128H330V175H360"
        color="#369eff"
        label={`Address ${hx(address, 4)}`}
        x={268}
        y={117}
      />
      <Trace
        d="M184 190H360"
        color="#19dfa3"
        label="Read (1)"
        x={270}
        y={181}
      />
      <Trace d="M184 231H360" color="#8ca1bb" on={false} />
      <Trace
        d="M360 272H184"
        color="#c766f0"
        label="Data (to CPU)"
        x={264}
        y={258}
        on={hit}
      />
      <Block
        x={360}
        y={105}
        w={206}
        h={200}
        title="Cache"
        subtitle="Direct Mapped"
        selected
      >
        <text x="463" y="185" textAnchor="middle" fill="#b4def5" fontSize="14">
          {s.cacheLines} lines
        </text>
        <text x="463" y="208" textAnchor="middle" fill="#b4def5" fontSize="14">
          {s.blockSize}-byte blocks
        </text>
        <text x="463" y="231" textAnchor="middle" fill="#b4def5" fontSize="14">
          16-bit address
        </text>
      </Block>
      <Trace
        d="M566 188H759"
        color="#35abff"
        label="Mem Addr　16"
        x={665}
        y={175}
      />
      <Trace d="M566 231H759" color="#1bdaa2" label="Mem R/W" x={665} y={222} />
      <Trace
        d="M566 272H759"
        color="#b76bef"
        label="Mem Data　32"
        x={662}
        y={259}
      />
      <Block
        x={759}
        y={90}
        w={135}
        h={237}
        title="Main Memory"
        subtitle="(RAM)"
      >
        <svg
          x="793"
          y="162"
          width="68"
          height="99"
          viewBox="22 480 442 316"
          preserveAspectRatio="none"
        >
          <image
            href="/assets/sandbox/hardware-atlas.png"
            width="1254"
            height="1254"
          />
        </svg>
        <text x="826" y="287" textAnchor="middle" fill="#b4def5" fontSize="13">
          64 KB
        </text>
        <text x="826" y="309" textAnchor="middle" fill="#b4def5" fontSize="12">
          (16-bit addr)
        </text>
      </Block>
      <DarkTable
        x={50}
        y={380}
        w={425}
        title={`Cache (${s.cacheLines} lines × ${s.blockSize} bytes)`}
        headers={["Line", "Valid", "Tag (bits)", "Data (bytes)"]}
        rows={s.cache
          .slice(0, 8)
          .map((l, i) => [
            i,
            l.valid ? 1 : 0,
            l.valid ? hx(l.tag) : "—",
            l.valid
              ? l.data.map((n) => hx(n).slice(2)).join(" ")
              : "—  —  —  —",
          ])}
        highlight={d.index}
      />
      <DarkTable
        x={520}
        y={382}
        w={338}
        title="Main Memory (RAM)"
        headers={["Address", "+0", "+1", "+2", "+3"]}
        rows={Object.entries(RAM_BYTES).map(([addr, bytes]) => [
          hx(+addr, 4),
          ...bytes.map((v) => hx(v).slice(2)),
        ])}
        highlight={Object.keys(RAM_BYTES).map(Number).indexOf(d.base)}
      />
      {!hit && (
        <>
          <Trace d="M828 328V365H462V307" color="#ffb014" role="control" />
          <Trace
            d={`M830 ${487 + ((d.base - 32) / 4) * 27}H470`}
            color="#ffb014"
            role="control"
          />
          <text x="540" y="337" fill="#ffbd36" fontSize="15" fontWeight="600">
            Miss: Fetch block {hx(d.base)} – {hx(d.base + s.blockSize - 1)}
          </text>
          <text x="540" y="357" fill="#ffbd36" fontSize="14">
            from main memory to cache line {d.index}
          </text>
        </>
      )}
      {hit && (
        <text x="540" y="351" fill="#2af4b0" fontSize="17">
          ✓ Cache hit — data available without RAM access
        </text>
      )}
      {data.length === 0 && (
        <text x="10" y="30">
          No data
        </text>
      )}
    </Surface>
  );
}
export function MemoryDock() {
  const s = useSandbox();
  return (
    <div className="sb-memory-dock">
      <div className="sb-dock-tabs">
        <Tabs
          items={["Simulation", "Access Trace", "Console"]}
          value={s.bottom || "Access Trace"}
          onChange={s.setBottom}
        />
        <div className="sb-right">
          <button onClick={s.rewindMemory}>‹ Step Back</button>
          <button className="sb-soft-primary" onClick={s.nextMemory}>
            <SIcon name="step" size={14} />
            Step Forward
          </button>
          <label>
            <input
              type="checkbox"
              checked={s.running}
              onChange={(e) => s.setRunning(e.target.checked)}
            />
            Auto Run
          </label>
        </div>
      </div>
      <div className="sb-memory-dock-grid">
        <div>
          <h4>Access Sequence (Trace Editor)</h4>
          <div className="sb-sequence">
            {s.sequence.map((a, i) => (
              <label key={i}>
                <span>{i + 1}</span>
                <input
                  aria-label={`Access sequence address ${i + 1}`}
                  className={s.accessCursor === i ? "active" : ""}
                  value={a}
                  onChange={(e) =>
                    s.setSequence((seq) =>
                      seq.map((v, j) => (i === j ? e.target.value : v)),
                    )
                  }
                />
              </label>
            ))}
          </div>
          <button
            className="sb-right"
            onClick={() => s.setSequence((seq) => [...seq, "0x0020"])}
          >
            ＋ Add
          </button>
        </div>
        <div>
          <h4>Access History (during simulation)</h4>
          <MiniTable
            headers={[
              "#",
              "Cycle",
              "Address",
              "Tag",
              "Index",
              "Offset",
              "Result",
              "Action",
              "Data (hex)",
            ]}
            rows={s.accesses
              .slice(-5)
              .map((r, i) => [
                i + 1,
                i + 1,
                hx(r.address, 4),
                hx(r.tag),
                hx(r.index),
                hx(r.address % s.blockSize),
                <span className={r.hit ? "sb-pass-badge" : "sb-miss-badge"}>
                  {r.hit ? "Hit" : "Miss"}
                </span>,
                r.hit
                  ? `Read line ${r.index}`
                  : `Fill line ${r.index} from ${hx(r.address - (r.address % s.blockSize))}`,
                r.data.map((n) => hx(n).slice(2)).join(" "),
              ])}
          />
        </div>
      </div>
    </div>
  );
}
export function MulticoreView() {
  const s = useSandbox();
  return (
    <Surface
      label="MESI two core coherence workbench with cache state and actual memory values"
      viewBox="0 0 900 740"
      toolbar={false}
      className="sb-mesi-surface"
    >
      {s.mesi.cores.map((core, i) => {
        const x = 100 + i * 400,
          focus = s.selected === `Core ${i}`;
        return (
          <g key={i}>
            <Block
              x={x + 25}
              y={45}
              w={283}
              h={145}
              title={`Core ${i}`}
              selected={focus}
              onSelect={() => s.setSelected(`Core ${i}`)}
              stroke="#27b6c8"
            >
              <svg
                x={x + 43}
                y={67}
                width="41"
                height="41"
                viewBox="18 838 430 370"
              >
                <image
                  href="/assets/sandbox/hardware-atlas.png"
                  width="1254"
                  height="1254"
                />
              </svg>
              <foreignObject x={x + 105} y="88" width="188" height="94">
                <div className="sb-core-control">
                  <div>
                    <button
                      className={s.coreOp[i] === "read" ? "active" : ""}
                      onClick={() =>
                        s.setCoreOp((ops) =>
                          ops.map((v, j) => (j === i ? "read" : v)),
                        )
                      }
                    >
                      Read
                    </button>
                    <button
                      className={s.coreOp[i] === "write" ? "active" : ""}
                      onClick={() =>
                        s.setCoreOp((ops) =>
                          ops.map((v, j) => (j === i ? "write" : v)),
                        )
                      }
                    >
                      Write
                    </button>
                  </div>
                  <label>
                    Address
                    <input
                      aria-label={`Core ${i} address`}
                      value={s.coreAddress[i]}
                      onChange={(e) =>
                        s.setCoreAddress((values) =>
                          values.map((v, j) => (i === j ? e.target.value : v)),
                        )
                      }
                    />
                  </label>
                  <label>
                    Value
                    <input
                      aria-label={`Core ${i} value`}
                      value={s.coreValue[i]}
                      onChange={(e) =>
                        s.setCoreValue((values) =>
                          values.map((v, j) => (i === j ? e.target.value : v)),
                        )
                      }
                    />
                    <button
                      aria-label={`Execute Core ${i} access`}
                      onClick={() => s.transact(i)}
                    >
                      ▶
                    </button>
                  </label>
                </div>
              </foreignObject>
            </Block>
            <Trace d={`M${x + 169} 190V225`} on color="#24d8e5" />
            <DarkTable
              x={x}
              y={225}
              w={334}
              title={`▣　L1 Cache ${i}`}
              headers={["Index", "Address", "State", "Value"]}
              rows={[
                [
                  0,
                  hx(core.address, 4),
                  core.state,
                  core.state === "I" ? "—" : hx(core.value),
                ],
                [1, "0x1040", "I", "—"],
                [2, "0x1080", "I", "—"],
              ]}
              highlight={i === s.mesi.source ? 0 : -1}
            />
            <Trace
              d={`M${x + 169} 390V467`}
              color="#33d6e0"
              on={core.state !== "I"}
            />
          </g>
        );
      })}
      <Block
        x={60}
        y={450}
        w={775}
        h={62}
        title="Snooping Interconnect (Shared Bus)"
        stroke="#1eb7c9"
      >
        <Trace d="M269 451V492H669V451" color="#ffbd2c" role="control" />
        <rect x="471" y="485" width="161" height="27" rx="8" fill="#ffd05d" />
        <text x="551" y="504" textAnchor="middle" fill="#372709" fontSize="13">
          {s.mesi.bus.includes("Invalidate")
            ? "Invalidate"
            : s.mesi.bus.split(" ")[0]}{" "}
          ({s.coreAddress[s.mesi.source]})
        </text>
      </Block>
      <Trace d="M449 512V558" />
      <DarkTable
        x={245}
        y={558}
        w={410}
        title="▣　Main Memory (RAM)"
        headers={["Address", "Value", "Status"]}
        rows={Object.entries(s.mesi.memory)
          .slice(0, 2)
          .map(([address, value]) => [
            hx(+address, 4),
            hx(value),
            s.mesi.cores.some((c) => c.address === +address && c.state === "M")
              ? "Stale (not written back)"
              : "Current",
          ])}
      />
    </Surface>
  );
}
export function MulticoreDock() {
  const [filter, setFilter] = useState("All Events"),
    [autoScroll, setAutoScroll] = useState(true),
    [frozenCount, setFrozenCount] = useState(0);
  const s = useSandbox(),
    last = s.mesiLog[s.mesiLog.length - 1];
  return (
    <div className="sb-mesi-dock">
      <div className="sb-dock-tabs">
        <Tabs
          items={["Event Timeline", "Console", "Signals", "Memory View"]}
          value={s.bottom || "Event Timeline"}
          onChange={s.setBottom}
        />
        <div className="sb-right">
          <span>Filter:</span>
          <select
            aria-label="Coherence event filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option>All Events</option>
            <option>Reads</option>
            <option>Writes</option>
          </select>
          <label>
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => {
                setAutoScroll(e.target.checked);
                setFrozenCount(s.mesiLog.length);
              }}
            />
            Auto-scroll
          </label>
          <button onClick={() => s.setMesiLog([])}>Clear</button>
        </div>
      </div>
      <div className="sb-mesi-dock-grid">
        <MiniTable
          headers={[
            "#",
            "Time",
            "Event",
            "Source",
            "Address",
            "Value",
            "Details",
          ]}
          rows={s.mesiLog
            .slice(0, autoScroll ? undefined : frozenCount)
            .filter(
              (r) =>
                filter === "All Events" ||
                r.op === (filter === "Reads" ? "Read" : "Write"),
            )
            .slice(-4)
            .map((r, i) => [
              i + 1,
              `${r.cycle * 40} ns`,
              r.op,
              `Core ${r.core}`,
              hx(r.address, 4),
              hx(r.value),
              r.bus,
            ])}
        />
        <div className="sb-event-details">
          <h4>
            Event Details{" "}
            <span className="sb-warning">
              {s.running ? "In Progress" : "Captured"}
            </span>
          </h4>
          <dl>
            <dt>Event</dt>
            <dd>{last?.op ?? "None"}</dd>
            <dt>Source</dt>
            <dd>Core {last?.core ?? 0}</dd>
            <dt>Address</dt>
            <dd>{hx(last?.address ?? 4096, 4)}</dd>
            <dt>Value</dt>
            <dd>{hx(last?.value ?? 42)}</dd>
            <dt>Transaction</dt>
            <dd>{s.mesi.bus}</dd>
          </dl>
          <div className="sb-state-transitions">
            <h4>State Transitions</h4>
            {s.mesi.cores.map((c, i) => (
              <div key={i}>
                Core {i}
                <span className={c.state === "I" ? "sb-fail" : "sb-pass"}>
                  {s.mesi.previous[i]} → {c.state}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
export function MemoryInspector() {
  const s = useSandbox(),
    d = cacheDecode(s.currentAddress, s.cacheLines, s.blockSize),
    line = s.cache[d.index],
    last = s.accesses.at(-1),
    hit =
      last?.address === s.currentAddress
        ? last.hit
        : !!line?.valid && line.tag === d.tag;
  return (
    <>
      <h3>
        Component Inspector <button onClick={() => s.setSelected("")}>×</button>
      </h3>
      <div className="sb-component-card">
        <span className="sb-mini-chip">▣</span>
        <div>
          <b>Cache (Direct Mapped)</b>
          <small className="sb-pass">● Active</small>
        </div>
      </div>
      <Tabs
        items={["Properties", "Signals", "Statistics"]}
        value={
          s.bottom === "Signals"
            ? "Signals"
            : s.bottom === "Statistics"
              ? "Statistics"
              : "Properties"
        }
        onChange={s.setBottom}
      />
      <section>
        <h4>Configuration</h4>
        <label className="sb-field">
          <span>Address width</span>
          <input value="16" readOnly />
          bits
        </label>
        <label className="sb-field">
          <span>Cache lines</span>
          <select
            aria-label="Cache lines"
            value={s.cacheLines}
            onChange={(e) => {
              const n = +e.target.value;
              s.setCacheLines(n);
              s.setCache(
                Array.from({ length: n }, () => ({
                  valid: false,
                  tag: 0,
                  data: [],
                })),
              );
              s.setAccesses([]);
            }}
          >
            {[2, 4, 8, 16].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="sb-field">
          <span>Block size</span>
          <select
            aria-label="Cache block size"
            value={s.blockSize}
            onChange={(e) => {
              s.setBlockSize(+e.target.value);
              s.setCache(s.cache.map((l) => ({ ...l, valid: false })));
              s.setAccesses([]);
            }}
          >
            {[1, 2, 4, 8, 16].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          bytes
        </label>
        <label className="sb-field">
          <span>Mapping</span>
          <select>
            <option>Direct mapped</option>
          </select>
        </label>
      </section>
      <section>
        <h4>Address Decode (current access)</h4>
        <label className="sb-field">
          <span>Address (hex)</span>
          <input
            aria-label="Cache address"
            value={s.address}
            aria-invalid={readHex(s.address) === null}
            onChange={(e) => s.setAddress(e.target.value)}
          />
          <button onClick={s.readMemory}>↦</button>
        </label>
        <label className="sb-field">
          <span>Binary</span>
          <code>
            {s.currentAddress
              .toString(2)
              .padStart(16, "0")
              .match(/.{4}/g)
              ?.join(" ")}
          </code>
        </label>
        {[
          [
            `Tag [15:${d.indexBits + d.offsetBits}]`,
            hx(d.tag),
            `${16 - d.indexBits - d.offsetBits} bits`,
          ],
          [
            `Index [${d.indexBits + d.offsetBits - 1}:${d.offsetBits}]`,
            hx(d.index),
            `${d.indexBits} bits`,
          ],
          [
            `Offset [${d.offsetBits - 1}:0]`,
            hx(d.offset),
            `${d.offsetBits} bits`,
          ],
        ].map(([label, value, bits]) => (
          <label className="sb-field" key={label}>
            <span>{label}</span>
            <input value={value} readOnly />
            <small>({bits})</small>
          </label>
        ))}
      </section>
      <section>
        <h4>Access Result</h4>
        <dl>
          <dt>Status</dt>
          <dd>
            <span className={hit ? "sb-pass-badge" : "sb-miss-badge"}>
              ● {hit ? "Hit" : "Compulsory miss"}
            </span>
          </dd>
          <dt>Selected index</dt>
          <dd>{d.index}</dd>
          <dt>Selected tag</dt>
          <dd>{hx(d.tag)}</dd>
          <dt>Selected valid</dt>
          <dd>
            {line?.valid ? 1 : 0}　{line?.valid ? "(occupied)" : "(was empty)"}
          </dd>
          <dt>Action</dt>
          <dd>
            {hit
              ? "Read cache line"
              : `Fill line ${d.index} from ${hx(d.base)} – ${hx(d.base + s.blockSize - 1)}`}
          </dd>
        </dl>
        <h4>Block Data (from memory)</h4>
        <div className="sb-byte-row">
          {Array.from({ length: s.blockSize }, (_, i) => (
            <div key={i}>
              <small>{hx(d.base + i)}</small>
              {hx(RAM_BYTES[d.base]?.[i] ?? 0).slice(2)}
            </div>
          ))}
        </div>
        <p className="sb-tiny">
          Hits: {s.accesses.filter((a) => a.hit).length}　Misses:{" "}
          {s.accesses.filter((a) => !a.hit).length}
        </p>
      </section>
    </>
  );
}
export function MulticoreInspector() {
  const s = useSandbox(),
    source = s.mesi.source,
    other = 1 - source;
  return (
    <>
      <h3>
        Properties & Inspector{" "}
        <button onClick={() => s.setSelected("")}>×</button>
      </h3>
      <div className="sb-component-card">
        <SIcon name="cpu" size={38} />
        <div>
          <b>{s.selected || `Core ${source}`}</b>
          <small>RISC-V Core (RV32IM)</small>
        </div>
      </div>
      <Tabs
        items={["Properties", "Transaction", "Signals"]}
        value={
          s.bottom === "Properties"
            ? "Properties"
            : s.bottom === "Signals"
              ? "Signals"
              : "Transaction"
        }
        onChange={s.setBottom}
      />
      <section>
        <h4>MESI Coherence Transition</h4>
        <dl>
          {[
            ["Transaction Type", s.mesi.bus],
            ["Initiator", `Core ${source}`],
            ["Address", s.coreAddress[source]],
            [
              `Previous State (Core ${source})`,
              `${s.mesi.previous[source]} (${s.mesi.previous[source] === "S" ? "Shared" : "Previous"})`,
            ],
            [
              `New State (Core ${source})`,
              <strong className="sb-pass">
                {s.mesi.cores[source]!.state} (
                {s.mesi.cores[source]!.state === "M"
                  ? "Modified"
                  : "Shared / Exclusive"}
                )
              </strong>,
            ],
            [
              `Snoop Result (Core ${other})`,
              <strong className="sb-fail">
                {s.mesi.previous[other]} → {s.mesi.cores[other]!.state}
              </strong>,
            ],
            [
              "Affects Memory",
              s.mesi.bus.includes("WriteBack")
                ? "Yes (writeback)"
                : "No (writeback later)",
            ],
          ].map(([a, b], i) => (
            <div className="sb-definition-row" key={i}>
              <dt>{a}</dt>
              <dd>{b}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h4>Message Details</h4>
        <dl>
          {[
            ["Bus Message", s.mesi.bus.split(" ")[0]],
            ["Address", s.coreAddress[source]],
            ["From", `Core ${source}`],
            ["To", "All cores (snoop)"],
            [
              "Responders",
              `Core ${other} (${s.mesi.previous[other]} → ${s.mesi.cores[other]!.state})`,
            ],
            [
              "Data Transfer",
              s.mesi.write ? "None (upgrade)" : hx(s.mesi.cores[source]!.value),
            ],
          ].map(([a, b], i) => (
            <div className="sb-definition-row" key={i}>
              <dt>{a}</dt>
              <dd>{b}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
