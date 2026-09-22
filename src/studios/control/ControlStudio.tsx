import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Card, ExplainBar, Segmented } from "../../design-system/ui";
import { hardwired, MICROPROGRAM, stepMicro } from "../../engines/isa/rtl";
import { OP } from "../../engines/isa/spec";
import { StudioFrame } from "../../layout/StudioFrame";
import { usePrefs } from "../../store/prefs";

export function ControlStudio() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "hardwired";
  const [mnemonic, setMnemonic] = useState("ADD");
  const [addr, setAddr] = useState(0);
  const [opcode, setOpcode] = useState<number>(OP.ALU);
  const { prefs } = usePrefs();
  const signals = hardwired(mnemonic);
  const word = MICROPROGRAM.find((item) => item.addr === addr) ?? MICROPROGRAM[0];

  return (
    <StudioFrame icon="gate" title="Control Unit" description="Hardwired control decodes the opcode into signals. Microprogrammed control reads the next control word from a small control store." tabs={[{ id: "hardwired", label: "Hardwired" }, { id: "micro", label: "Microprogram" }, { id: "compare", label: "Horizontal / Vertical" }]} tab={tab} onTab={(id) => setParams({ tab: id })} guide={["ADD turns on RegWrite and leaves memory quiet.", "LOAD turns on MemRead, then RegWrite in a later microinstruction.", "Dispatch after fetch jumps to the opcode's routine."]} takeaways={["The signals are the same ones the multi-cycle CPU uses.", "A horizontal word exposes each control bit.", "A vertical word stores an encoded operation and needs a decoder."]}>
      {prefs.explain ? <ExplainBar what={`${mnemonic}: RegWrite ${signals.RegWrite}, MemRead ${signals.MemRead}, MemWrite ${signals.MemWrite}.`} why={word ? `${word.name}: ${word.signals}` : "Control store"} notice="Neither style is universally smaller or faster. Width and decoding trade off." /> : null}
      {tab === "hardwired" ? (
        <Card title="Opcode to signals">
          <Segmented options={["ADD", "LOAD", "STORE", "BEQ"]} value={mnemonic} onChange={setMnemonic} />
          {Object.entries(signals).map(([name, value]) => <div key={name} className="spread"><span>{name}</span><strong>{value}</strong></div>)}
        </Card>
      ) : null}
      {tab === "micro" && word ? (
        <Card title="Control memory">
          <p>µPC {word.addr} · {word.name}</p>
          <p>{word.signals}</p>
          <p>Next {String(word.next)}</p>
          <div className="row">
            <Button onClick={() => setOpcode(OP.ALU)}>Dispatch ADD</Button>
            <Button onClick={() => setOpcode(OP.LOAD)}>Dispatch LOAD</Button>
            <Button variant="primary" onClick={() => setAddr(stepMicro(addr, opcode))}>Step microinstruction</Button>
          </div>
          <table className="data">
            <thead><tr><th>µAddr</th><th>Name</th><th>Next</th></tr></thead>
            <tbody>{MICROPROGRAM.map((item) => <tr key={item.addr} className={item.addr === addr ? "active" : ""}><td>{item.addr}</td><td>{item.name}</td><td>{String(item.next)}</td></tr>)}</tbody>
          </table>
        </Card>
      ) : null}
      {tab === "compare" && word ? (
        <div className="grid cards-2">
          <Card title="Horizontal"><p className="mono">{word.horizontal}</p><p>Each bit can drive a control point directly. The word is wider, and the control store stores more bits per step.</p></Card>
          <Card title="Vertical"><p className="mono">{word.vertical}</p><p>The field names an operation. A decoder expands it into the same signals. The word is narrower.</p></Card>
        </div>
      ) : null}
    </StudioFrame>
  );
}
