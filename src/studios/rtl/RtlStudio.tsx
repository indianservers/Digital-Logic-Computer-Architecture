import { useState } from "react";
import { useStudioTab } from "../../layout/useStudioTab";
import { Button, Card, ExplainBar, Toggle } from "../../design-system/ui";
import { driveBus } from "../../engines/cpu/buses";
import { evalRtl } from "../../engines/isa/rtl";
import { StudioFrame } from "../../layout/StudioFrame";
import { RTL_LESSONS, lessonOf } from "../../data/studioLessons";
import { usePrefs } from "../../store/prefs";

const TABS = [
  { id: "transfer", label: "Transfer" },
  { id: "bus", label: "Bus" },
  { id: "word", label: "Control Word" },
];

export function RtlStudio() {
  const [tab, setTab] = useStudioTab(TABS, "transfer");
  const [line, setLine] = useState("R3 <- R1 + R2");
  const [regs, setRegs] = useState([0, 5, 3, 0, 0, 0, 0, 0]);
  const [note, setNote] = useState("Load values, then step the transfer.");
  const [pcOn, setPc] = useState(true);
  const [irOn, setIr] = useState(false);
  const { prefs } = usePrefs();
  const bus = driveBus([{ name: "R1", enabled: pcOn, value: regs[1] ?? 0 }, { name: "R2", enabled: irOn, value: regs[2] ?? 0 }]);
  const lesson = lessonOf(RTL_LESSONS, tab, "transfer");

  return (
    <StudioFrame icon="project" title="Register Transfer" description="Move a value from registers through the ALU and back. A shared bus accepts one driver." tabs={TABS} tab={tab} onTab={setTab} guide={lesson.guide} takeaways={lesson.takeaways} theory={lesson.theory}>
      {prefs.explain ? <ExplainBar what={note} why={bus.explain} notice="This playground is not a hardware description language." /> : null}
      {tab === "transfer" ? (
        <Card title="RTL">
          <input className="text-input" aria-label="RTL expression" value={line} onChange={(event) => setLine(event.target.value)} />
          <Button variant="primary" onClick={() => {
            const next = evalRtl(regs, line);
            setRegs(next.regs);
            setNote(next.explain);
          }}>Step</Button>
          <div className="reg-row">{regs.map((value, index) => <div key={index} className="ff-cell">R{index}<small>{value}</small></div>)}</div>
        </Card>
      ) : null}
      {tab === "bus" ? (
        <Card title="Shared bus">
          <Toggle on={pcOn} onChange={setPc} label="R1 drive" tone="ok" />
          <Toggle on={irOn} onChange={setIr} label="R2 drive" tone="danger" />
          <p>Bus = {String(bus.value)}. {bus.contention ? "BUS CONTENTION" : bus.explain}</p>
        </Card>
      ) : null}
      {tab === "word" ? (
        <Card title="One control word">
          <p className="mono">SRC_A | SRC_B | ALU_OP | DEST | REG_WRITE | MEM</p>
          <p>The expression {line} sets the ALU operation and the destination. Memory stays off unless the instruction is LOAD, STORE, CALL, or RET.</p>
        </Card>
      ) : null}
    </StudioFrame>
  );
}
