import { useState } from "react";
import { useStudioTab } from "../../layout/useStudioTab";
import { Card, ExplainBar, Metric, Segmented, Toggle, parseNumberInput } from "../../design-system/ui";
import { activeControls, addressReach, asyncHandshake, bandwidthBytes, grantBus, syncEdge, transferValue, type BusMaster } from "../../engines/arch/busarch";
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
  const [tab, setTab] = useStudioTab(TABS, "address");
  const [addressWidth, setAddressWidth] = useState(16);
  const [dataWidth, setDataWidth] = useState("32");
  const [frequency, setFrequency] = useState(100);
  const [efficiency, setEfficiency] = useState(1);
  const [mode, setMode] = useState<"daisy" | "central" | "distributed">("central");
  const [clockHigh, setClockHigh] = useState(false);
  const [request, setRequest] = useState(false);
  const [ack, setAck] = useState(false);
  const [controls, setControls] = useState({ Read: true, Write: false, Clock: true, Interrupt: false, Reset: false });
  const [masters, setMasters] = useState<BusMaster[]>([
    { name: "CPU", request: true, priority: 1 },
    { name: "DMA", request: true, priority: 0 },
    { name: "GPU", request: false, priority: 2 },
  ]);
  const { prefs } = usePrefs();
  const reach = addressReach(addressWidth);
  const grant = grantBus(mode, masters, 0);
  const driven = transferValue(masters.filter((master) => master.request).map((master) => ({ name: master.name, enabled: mode === "daisy" ? false : master.request, value: 1 })));
  const contended = transferValue([
    { name: "CPU", enabled: true, value: 1 },
    { name: "DMA", enabled: true, value: 2 },
  ]);
  const width = Number(dataWidth);
  const lesson = lessonOf(BUS_LESSONS, tab, "address");

  return (
    <StudioFrame icon="project" title="Bus Architecture" description="Address, data, and control are separate groups of wires. One arbiter grant, or a daisy-chain position, decides who may drive them." tabs={TABS} tab={tab} onTab={setTab} guide={lesson.guide} takeaways={lesson.takeaways} theory={lesson.theory}>
      {prefs.explain ? <ExplainBar what={grant ? `${grant.name} may drive the bus.` : "Nobody is requesting."} why={contended.explain} notice="Efficiency below 1 accounts for idle cycles and handshake overhead in this lab." /> : null}
      {tab === "address" ? (
        <Card title="Address bus">
          <input className="text-input" aria-label="Address width" type="number" value={addressWidth} onChange={(event) => setAddressWidth(parseNumberInput(event.target.value, addressWidth))} />
          <p>{addressWidth}-bit address bus names {reach.expression} locations{reach.count !== null ? ` (${reach.count})` : ""}.</p>
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
        </Card>
      ) : null}
      {tab === "arbitrate" ? (
        <Card title={mode}>
          <Segmented options={["daisy", "central", "distributed"]} value={mode} onChange={(value) => setMode(value as typeof mode)} />
          {masters.map((master) => (
            <Toggle key={master.name} on={master.request} onChange={(next) => setMasters(masters.map((item) => item.name === master.name ? { ...item, request: next } : item))} label={`${master.name} · P${master.priority}`} tone={master.name === "CPU" ? "ok" : master.name === "DMA" ? "primary" : "warn"} />
          ))}
          <p>Grant: {grant?.name ?? "none"}. Unarbitrated dual drive: {String(contended.value)}. Filtered drive: {String(driven.value)}.</p>
        </Card>
      ) : null}
      {tab === "bandwidth" ? (
        <Card title="Width × frequency × efficiency">
          <input className="text-input" aria-label="Frequency" type="number" value={frequency} onChange={(event) => setFrequency(parseNumberInput(event.target.value, frequency))} />
          <input className="text-input" aria-label="Efficiency" type="number" step="0.1" value={efficiency} onChange={(event) => setEfficiency(parseNumberInput(event.target.value, efficiency))} />
          <Metric label="Bytes per second" value={String(bandwidthBytes(width, frequency, efficiency))} />
        </Card>
      ) : null}
    </StudioFrame>
  );
}
