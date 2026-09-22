import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Card, ExplainBar, Metric, Segmented } from "../../design-system/ui";
import { activeControls, addressReach, asyncHandshake, bandwidthBytes, grantBus, syncEdge, transferValue, type BusMaster } from "../../engines/arch/busarch";
import { StudioFrame } from "../../layout/StudioFrame";
import { usePrefs } from "../../store/prefs";

const WIDTHS = ["8", "16", "32", "64"];

export function BusStudio() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "address";
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

  return (
    <StudioFrame icon="project" title="Bus Architecture" description="Address, data, and control are separate groups of wires. One arbiter grant, or a daisy-chain position, decides who may drive them." tabs={[{ id: "address", label: "Address" }, { id: "data", label: "Data" }, { id: "control", label: "Control" }, { id: "timing", label: "Timing" }, { id: "arbitrate", label: "Arbitration" }, { id: "bandwidth", label: "Bandwidth" }]} tab={tab} onTab={(id) => setParams({ tab: id })} guide={["Address width sets how many locations the bus can name.", "Data width and clock set the raw transfer rate.", "Two drivers without a grant produce X, the same contention result as the register bus."]} takeaways={["Bandwidth multiplies width, frequency, and efficiency.", "Daisy chain grants the earliest requesting device in the chain.", "Central arbitration grants the best priority. Distributed arbitration rotates."]}>
      {prefs.explain ? <ExplainBar what={grant ? `${grant.name} may drive the bus.` : "Nobody is requesting."} why={contended.explain} notice="Efficiency below 1 accounts for idle cycles and handshake overhead in this lab." /> : null}
      {tab === "address" ? (
        <Card title="Address bus">
          <input className="text-input" aria-label="Address width" type="number" value={addressWidth} onChange={(event) => setAddressWidth(Number(event.target.value))} />
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
            <Button key={name} onClick={() => setControls({ ...controls, [name]: !controls[name as keyof typeof controls] })}>{name} {controls[name as keyof typeof controls] ? "1" : "0"}</Button>
          ))}
          <p>Active: {activeControls(controls).join(", ") || "none"}</p>
        </Card>
      ) : null}
      {tab === "timing" ? (
        <Card title="Clocked or handshake">
          <Button onClick={() => setClockHigh((value) => !value)}>{syncEdge(clockHigh).explain}</Button>
          <Button onClick={() => setRequest((value) => !value)}>Request {request ? "1" : "0"}</Button>
          <Button onClick={() => setAck((value) => !value)}>Acknowledge {ack ? "1" : "0"}</Button>
          <p>{asyncHandshake(request, ack).explain}</p>
        </Card>
      ) : null}
      {tab === "arbitrate" ? (
        <Card title={mode}>
          <Segmented options={["daisy", "central", "distributed"]} value={mode} onChange={(value) => setMode(value as typeof mode)} />
          {masters.map((master) => (
            <Button key={master.name} onClick={() => setMasters(masters.map((item) => item.name === master.name ? { ...item, request: !item.request } : item))}>{master.name} {master.request ? "requests" : "idle"} · priority {master.priority}</Button>
          ))}
          <p>Grant: {grant?.name ?? "none"}. Unarbitrated dual drive: {String(contended.value)}. Filtered drive: {String(driven.value)}.</p>
        </Card>
      ) : null}
      {tab === "bandwidth" ? (
        <Card title="Width × frequency × efficiency">
          <input className="text-input" aria-label="Frequency" type="number" value={frequency} onChange={(event) => setFrequency(Number(event.target.value))} />
          <input className="text-input" aria-label="Efficiency" type="number" step="0.1" value={efficiency} onChange={(event) => setEfficiency(Number(event.target.value))} />
          <Metric label="Bytes per second" value={String(bandwidthBytes(width, frequency, efficiency))} />
        </Card>
      ) : null}
    </StudioFrame>
  );
}
