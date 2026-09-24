import { useState } from "react";
import { useStudioTab } from "../../layout/useStudioTab";
import { Button, Card, ExplainBar, Metric, Toggle } from "../../design-system/ui";
import { classifyException, cpuCopy, createDma, handlerFor, highestPriority, interruptTimeline, stepDma, type DmaState, type IoDevice } from "../../engines/arch/io";
import { StudioFrame } from "../../layout/StudioFrame";
import { INTERRUPT_LESSONS, lessonOf } from "../../data/studioLessons";
import { usePrefs } from "../../store/prefs";

const DEVICES: IoDevice[] = [
  { name: "Keyboard", irq: 1, priority: 2, vector: 0x1000, pending: true, status: 1, data: 65 },
  { name: "Network", irq: 5, priority: 3, vector: 0x1400, pending: false, status: 0, data: 0 },
  { name: "Timer", irq: 0, priority: 0, vector: 0x2000, pending: true, status: 1, data: 1 },
  { name: "Storage", irq: 14, priority: 1, vector: 0x1800, pending: false, status: 0, data: 0 },
];

const TABLE = [{ irq: 0, handler: 0x2000 }, { irq: 1, handler: 0x1000 }, { irq: 3, handler: 0x1000 }, { irq: 5, handler: 0x1400 }, { irq: 14, handler: 0x1800 }];
const TABS = [
  { id: "timeline", label: "Interrupt" },
  { id: "priority", label: "Priority" },
  { id: "vectors", label: "Vectors" },
  { id: "exceptions", label: "Exceptions" },
  { id: "dma", label: "DMA" },
];

export function InterruptStudio() {
  const [tab, setTab] = useStudioTab(TABS, "timeline");
  const [devices, setDevices] = useState(DEVICES);
  const [kind, setKind] = useState<"div0" | "illegal" | "protect">("div0");
  const [dma, setDma] = useState<DmaState>(() => createDma([0, 0, 0, 0], [9, 8, 7], 0, 1, 3, "to-memory"));
  const { prefs } = usePrefs();
  const winner = highestPriority(devices);
  const timeline = interruptTimeline([0x10, 0x11, 0x12, 0x13], 2, winner ? [winner.vector] : []);
  const programmed = cpuCopy([0, 0, 0, 0], [9, 8, 7], 1, 3);
  const fault = classifyException(kind);
  const lesson = lessonOf(INTERRUPT_LESSONS, tab, "timeline");

  return (
    <StudioFrame icon="step" title="Interrupts & DMA" description="A device request saves the PC, runs the vectored handler, and returns. DMA moves the block and interrupts once at the end." tabs={TABS} tab={tab} onTab={setTab} guide={lesson.guide} takeaways={lesson.takeaways} theory={lesson.theory}>
      {prefs.explain ? <ExplainBar what={winner ? `${winner.name} wins and vectors to ${winner.vector.toString(16)}.` : "No device is pending."} why={timeline.find((step) => step.phase === "save")?.note ?? "The timeline is idle."} notice="Exception recovery in this lab stops the instruction. It does not boot an operating system." /> : null}
      {tab === "timeline" ? (
        <Card title="User stream, then the handler">
          <table className="data">
            <tbody>{timeline.map((step, index) => <tr key={`${step.phase}-${index}`}><td>{step.phase}</td><td className="mono">{step.pc.toString(16)}</td><td>{step.note}</td></tr>)}</tbody>
          </table>
        </Card>
      ) : null}
      {tab === "priority" ? (
        <Card title="Pending requests">
          {devices.map((device) => (
            <Toggle key={device.name} on={device.pending} onChange={(next) => setDevices(devices.map((item) => item.name === device.name ? { ...item, pending: next } : item))} label={`${device.name} · P${device.priority}`} tone={device.pending ? "danger" : "neutral"} />
          ))}
          <p>Selected: {winner?.name ?? "none"}</p>
        </Card>
      ) : null}
      {tab === "vectors" ? (
        <Card title="IRQ to handler">
          <table className="data">
            <thead><tr><th>IRQ</th><th>Handler</th></tr></thead>
            <tbody>{TABLE.map((row) => <tr key={row.irq} className={winner?.irq === row.irq ? "active" : ""}><td>{row.irq}</td><td className="mono">{(handlerFor(TABLE, row.irq) ?? 0).toString(16)}</td></tr>)}</tbody>
          </table>
        </Card>
      ) : null}
      {tab === "exceptions" ? (
        <Card title={fault.name}>
          <div className="row">
            <Button onClick={() => setKind("div0")}>Divide by zero</Button>
            <Button onClick={() => setKind("illegal")}>Invalid instruction</Button>
            <Button onClick={() => setKind("protect")}>Protection fault</Button>
          </div>
          <p>Vector {fault.vector}. The instruction does not resume.</p>
        </Card>
      ) : null}
      {tab === "dma" ? (
        <Card title="Bus owner">
          <p>Owner {dma.owner} · transferred {dma.transferred}/{dma.size} · CPU cycles {dma.cpuCycles} · completion interrupt {dma.interrupt ? "yes" : "no"}</p>
          <p>Memory [{dma.memory.join(", ")}]</p>
          <p className="tiny">The same copy done by the CPU costs {programmed.cpuCycles} cycles and never raises a completion interrupt by itself.</p>
          <Button variant="primary" onClick={() => setDma(stepDma(dma))}>Step DMA</Button>
          <Button onClick={() => setDma(createDma([0, 0, 0, 0], [9, 8, 7], 0, 1, 3, "to-memory"))}>Reset</Button>
          <Metric label="CPU cycles saved" value={String(Math.max(0, programmed.cpuCycles - dma.cpuCycles))} />
        </Card>
      ) : null}
    </StudioFrame>
  );
}
