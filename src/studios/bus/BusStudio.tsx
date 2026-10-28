import { useSimulatorCapture } from "../../layout/SimulatorCapture";
import { useState } from "react";
import { useStudioTab } from "../../layout/useStudioTab";
import { Button, Card, ExplainBar, Metric, Segmented, Toggle, parseNumberInput } from "../../design-system/ui";
import { activeControls, addressReach, arbitratedTransfer, asyncHandshake, bandwidthBytes, syncEdge, transferValue, type BusMaster } from "../../engines/arch/busarch";
import { LabChallenge } from "../../layout/LabChallenge";
import { StudioFrame } from "../../layout/StudioFrame";
import { BUS_LESSONS, lessonOf } from "../../data/studioLessons";
import { usePrefs } from "../../store/prefs";

const WIDTHS = ["8", "16", "32", "64"];
const TABS = [
  { id: "address", label: "Address" },
  { id: "data", label: "Data" },
  { id: "control", label: "Control" },
  { id: "timing", label: "Timing" },
  { id: "arbitrate", label: "Arbitration" },
  { id: "bandwidth", label: "Bandwidth" },
];

export function BusStudio() {
  useSimulatorCapture("studios/bus/BusStudio.tsx:BusStudio", () => ({ tab, addressWidth, dataWidth, frequency, efficiency, mode, clockHigh, request, ack, lastGrant, history, controls, masters }), "8a201ceb7a6f");

  const [tab, setTab] = useStudioTab(TABS, "address");
  const [addressWidth, setAddressWidth] = useState(16);
  const [dataWidth, setDataWidth] = useState("32");
  const [frequency, setFrequency] = useState(100);
  const [efficiency, setEfficiency] = useState(1);
  const [mode, setMode] = useState<"daisy" | "central" | "distributed">("central");
  const [clockHigh, setClockHigh] = useState(false);
  const [request, setRequest] = useState(false);
  const [ack, setAck] = useState(false);
  const [lastGrant, setLastGrant] = useState(-1);
  const [history, setHistory] = useState<Array<{ master: string; value: string }>>([]);
  const [controls, setControls] = useState({ Read: true, Write: false, Clock: true, Interrupt: false, Reset: false });
  const [masters, setMasters] = useState<BusMaster[]>([
    { name: "CPU", request: true, priority: 1 },
    { name: "DMA", request: true, priority: 0 },
    { name: "GPU", request: false, priority: 2 },
  ]);
  const { prefs } = usePrefs();
  const reach = addressReach(addressWidth);
  const { grant, bus: driven } = arbitratedTransfer(mode, masters, lastGrant);
  const contended = transferValue(masters.map((master, index) => ({ name: master.name, enabled: master.request, value: (index + 1) * 0x11 })));
  const width = Number(dataWidth);
  const lesson = lessonOf(BUS_LESSONS, tab, "address");

  return (
    <StudioFrame icon="project" title="Bus Architecture" description="Address, data, and control are separate groups of wires. One arbiter grant, or a daisy-chain position, decides who may drive them." tabs={TABS} tab={tab} onTab={setTab} guide={lesson.guide} takeaways={lesson.takeaways} theory={lesson.theory}>
      {prefs.explain ? <ExplainBar what={tab === "address" ? `${addressWidth} address bits select ${reach.expression} locations.` : tab === "bandwidth" ? `${bandwidthBytes(width, frequency, efficiency)} useful bytes/s.` : grant ? `${grant.name} may drive the bus.` : "Nobody is requesting."} why={tab === "arbitrate" ? driven.explain : "Address width, data width, transfer frequency, and useful efficiency describe different bus properties."} notice={tab === "arbitrate" ? `Without arbitration: ${contended.explain}` : "Efficiency below 1 accounts for idle cycles and handshake overhead in this lab."} /> : null}
      {tab === "address" ? (
        <Card title="Address bus">
          <label>Address width (bits)<input className="text-input" aria-label="Address width" type="number" min={1} max={64} value={addressWidth} onChange={(event) => setAddressWidth(Math.min(64, Math.max(1, Math.trunc(parseNumberInput(event.target.value, addressWidth)))))} /></label>
          <p>{addressWidth}-bit address bus names {reach.expression} locations{reach.count !== null ? ` (${reach.count})` : ""}.</p>
          <LabChallenge key={tab} objective="Configure a byte-addressed bus that can select exactly 65,536 locations." passed={addressWidth === 16} success="16 address bits select 2¹⁶ = 65,536 byte locations, or 64 KiB." hint="The number of locations is 2 raised to the number of address bits." />
        </Card>
      ) : null}
      {tab === "data" ? (
        <Card title="Data bus">
          <Segmented options={WIDTHS} value={dataWidth} onChange={setDataWidth} />
          <p>{dataWidth} bits move {width / 8} bytes per transfer.</p>
        </Card>
      ) : null}
      {tab === "control" ? (
        <Card title="Control wires">
          {Object.keys(controls).map((name) => (
            <Toggle key={name} on={controls[name as keyof typeof controls]} onChange={(next) => setControls({ ...controls, [name]: next })} label={name} tone={name === "Write" || name === "Reset" ? "danger" : name === "Read" ? "ok" : "primary"} />
          ))}
          <p>Active: {activeControls(controls).join(", ") || "none"}</p>
        </Card>
      ) : null}
      {tab === "timing" ? (
        <Card title="Clocked or handshake">
          <Toggle on={clockHigh} onChange={setClockHigh} label="Clock high" tone="ok" />
          <Toggle on={request} onChange={setRequest} label="Request" tone="primary" />
          <Toggle on={ack} onChange={setAck} label="Acknowledge" tone="warn" />
          <p>{syncEdge(clockHigh).explain} {asyncHandshake(request, ack).explain}</p>
          <p className="tiny">The clock control represents a sample point, not a continuous waveform or edge detector.</p>
          <LabChallenge key={tab} objective="Complete an asynchronous transfer by asserting both request and acknowledge." passed={asyncHandshake(request, ack).moved} success="The requester and receiver have both asserted their handshake signals." hint="Request alone waits. Acknowledge without request does not transfer data." />
        </Card>
      ) : null}
      {tab === "arbitrate" ? (
        <Card title={mode}>
          <Segmented options={["daisy", "central", "distributed"]} value={mode} onChange={(value) => setMode(value as typeof mode)} />
          {masters.map((master) => (
            <div className="row" key={master.name}><Toggle on={master.request} onChange={(next) => setMasters(masters.map((item) => item.name === master.name ? { ...item, request: next } : item))} label={`${master.name} request`} tone={master.name === "CPU" ? "ok" : master.name === "DMA" ? "primary" : "warn"} /><label className="tiny">Priority <input aria-label={`${master.name} priority`} type="number" min={0} max={15} value={master.priority} style={{ width: 64 }} onChange={(event) => setMasters(masters.map((item) => item.name === master.name ? { ...item, priority: Math.max(0, Math.min(15, Math.trunc(parseNumberInput(event.target.value, item.priority)))) } : item))} /></label></div>
          ))}
          <div className="stage-row">{masters.map((master, index) => <div key={master.name} className={grant?.index === index ? "cpu-block on" : "cpu-block"}>{master.name}<small>{grant?.index === index ? "DRIVING" : master.request ? "WAITING" : "IDLE"} · 0x{((index + 1) * 0x11).toString(16).toUpperCase()}</small></div>)}</div>
          <div className="row"><Metric label="Without arbitration" value={String(contended.value)} /><Metric label="Granted source" value={driven.source ?? "none"} /><Metric label="Bus data" value={typeof driven.value === "number" ? `0x${driven.value.toString(16).toUpperCase()}` : driven.value} /></div>
          <p>{driven.explain} {mode === "distributed" ? "This teaching mode uses round-robin grants." : mode === "central" ? "The lowest priority number wins." : "The first requesting device in the chain wins."}</p>
          <div className="row"><Button variant="primary" disabled={!grant} onClick={() => { if (!grant) return; setHistory((entries) => [...entries, { master: grant.name, value: String(driven.value) }].slice(-8)); setLastGrant(grant.index); }}>Transfer granted word</Button><Button onClick={() => { setLastGrant(-1); setHistory([]); }}>Reset transfers</Button></div>
          {!!history.length && <table className="data"><caption>Most recent 8 completed transfers · data in decimal</caption><thead><tr><th scope="col">Transfer</th><th scope="col">Master</th><th scope="col">Data</th></tr></thead><tbody>{history.map((entry, index) => <tr key={index}><td>{index + 1}</td><td>{entry.master}</td><td>{entry.value}</td></tr>)}</tbody></table>}
          <LabChallenge key={tab} objective="Select daisy-chain arbitration with both CPU and DMA requesting. Make CPU the only bus driver." passed={mode === "daisy" && !!masters[0]?.request && !!masters[1]?.request && driven.source === "CPU" && !driven.contention} success="CPU is first in the chain; DMA waits. One enabled driver prevents contention." hint="Select daisy, then enable CPU and DMA requests. Requesting access does not enable a bus driver until it wins." />
        </Card>
      ) : null}
      {tab === "bandwidth" ? (
        <Card title="Width × frequency × efficiency">
          <Segmented options={WIDTHS} value={dataWidth} onChange={setDataWidth} />
          <label>Transfers per second (Hz)<input className="text-input" aria-label="Frequency" type="number" min={0} value={frequency} onChange={(event) => setFrequency(Math.max(0, parseNumberInput(event.target.value, frequency)))} /></label>
          <label>Useful transfer efficiency (0–1)<input className="text-input" aria-label="Efficiency" type="number" min={0} max={1} step="0.1" value={efficiency} onChange={(event) => setEfficiency(Math.min(1, Math.max(0, parseNumberInput(event.target.value, efficiency))))} /></label>
          <Metric label="Bytes per second" value={String(bandwidthBytes(width, frequency, efficiency))} />
          <LabChallenge key={tab} objective="Produce 200 bytes/s using a 32-bit bus, 100 transfers/s, and 50% useful transfers." passed={width === 32 && frequency === 100 && efficiency === 0.5 && bandwidthBytes(width, frequency, efficiency) === 200} success="4 bytes/transfer × 100 transfers/s × 0.5 = 200 bytes/s." hint="Choose width 32, frequency 100 Hz, and efficiency 0.5. Bandwidth counts useful bytes rather than raw bits." />
        </Card>
      ) : null}
    </StudioFrame>
  );
}
