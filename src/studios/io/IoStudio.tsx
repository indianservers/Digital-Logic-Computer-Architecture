import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Card, ExplainBar, Metric } from "../../design-system/ui";
import { addressSpace, MMIO, pollTransfer } from "../../engines/arch/io";
import { StudioFrame } from "../../layout/StudioFrame";
import { usePrefs } from "../../store/prefs";

const DEVICES = [
  { name: "Keyboard", path: "controller status, then data" },
  { name: "Display", path: "controller data register" },
  { name: "Storage", path: "block request register" },
  { name: "Sensor", path: "status bit, then sample" },
];

export function IoStudio() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "devices";
  const [address, setAddress] = useState("FFFF0004");
  const [polls, setPolls] = useState(4);
  const [mode, setMode] = useState<"mapped" | "isolated">("mapped");
  const { prefs } = usePrefs();
  const numeric = Number.parseInt(address, 16);
  const space = Number.isFinite(numeric) ? addressSpace(mode, numeric) : "memory";
  const polled = pollTransfer(polls);

  return (
    <StudioFrame icon="bolt" title="I/O Architecture" description="Devices sit behind a controller on the bus. The CPU either polls a status bit or waits for an interrupt." tabs={[{ id: "devices", label: "Devices" }, { id: "mapped", label: "Memory-mapped" }, { id: "isolated", label: "Isolated" }, { id: "poll", label: "Programmed I/O" }]} tab={tab} onTab={(id) => setParams({ tab: id })} guide={["Memory-mapped I/O uses ordinary loads and stores.", "Isolated I/O keeps a second address space.", "Each failed poll is a CPU cycle that did not run the main program."]} takeaways={["The keyboard status and data registers are two addresses.", "Polling wastes the polls that happen before the device is ready.", "Interrupt-driven transfer continues in the next studio."]}>
      {prefs.explain ? <ExplainBar what={space === "io" ? "This address names a device register." : "This address names memory."} why={mode === "mapped" ? `Status ${MMIO.status.toString(16)} and data ${MMIO.data.toString(16)} share the memory map.` : "Addresses at or above 0xFF00 are the isolated I/O space in this lab."} notice="The same numeric address can mean memory or a device, depending on the address space." /> : null}
      {tab === "devices" ? (
        <Card title="CPU — bus — controller — device">
          {DEVICES.map((device) => <div key={device.name} className="spread"><strong>{device.name}</strong><span className="tiny">{device.path}</span></div>)}
        </Card>
      ) : null}
      {tab === "mapped" || tab === "isolated" ? (
        <Card title={tab === "mapped" ? "One address space" : "Memory space plus I/O space"}>
          <Button onClick={() => setMode(tab === "mapped" ? "mapped" : "isolated")}>Use {tab === "mapped" ? "mapped" : "isolated"} decoding</Button>
          <input className="text-input" aria-label="Address hex" value={address} onChange={(event) => setAddress(event.target.value)} />
          <p>Decoded space: {space}. Active mode: {mode}.</p>
        </Card>
      ) : null}
      {tab === "poll" ? (
        <Card title="CPU checks status until ready">
          <input className="text-input" aria-label="Polls before ready" type="number" value={polls} onChange={(event) => setPolls(Number(event.target.value))} />
          <div className="grid cards-3">
            <Metric label="Polls" value={String(polled.polls)} />
            <Metric label="Wasted checks" value={String(polled.wasted)} />
            <Metric label="Transferred" value={polled.transferred ? "yes" : "no"} />
          </div>
          <p className="tiny">Ready → transfer one word. The failed checks are the CPU involvement programmed I/O cannot hide.</p>
        </Card>
      ) : null}
    </StudioFrame>
  );
}
