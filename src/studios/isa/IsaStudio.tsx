import { useMemo, useState } from "react";
import { useStudioTab } from "../../layout/useStudioTab";
import { Card, Segmented } from "../../design-system/ui";
import { formatInstruction } from "../../engines/isa/assembler";
import { ADDRESSING, binaryWord, bits, CATEGORIES, decode, encodeI, encodeR, fieldValue, fieldsOf, OP, type Decoded, type FieldSlice } from "../../engines/isa/spec";
import { StudioFrame } from "../../layout/StudioFrame";
import { ISA_LESSONS, lessonOf } from "../../data/studioLessons";
import { usePrefs } from "../../store/prefs";
import { ExplainBar } from "../../design-system/ui";

const TABS = [
  { id: "basics", label: "ISA Basics" },
  { id: "anatomy", label: "Anatomy" },
  { id: "formats", label: "Formats" },
  { id: "style", label: "RISC / CISC" },
  { id: "load", label: "Load / Store" },
  { id: "modes", label: "Addressing" },
  { id: "catalog", label: "Categories" },
];

const CHOICES = ["ADD", "ADDI", "LOAD", "STORE", "BEQ", "J"];

function sample(name: string): Decoded {
  if (name === "ADDI") return decode(encodeI(OP.ADDI, 1, 2, 5));
  if (name === "LOAD") return decode(encodeI(OP.LOAD, 1, 2, 0));
  if (name === "STORE") return decode((OP.STORE << 12) | (3 << 9) | (2 << 6) | 4);
  if (name === "BEQ") return decode((OP.BEQ << 12) | (1 << 9) | (2 << 6) | 2);
  if (name === "J") return decode((OP.J << 12) | 4);
  return decode(encodeR("ADD", 1, 2, 3));
}

export function IsaStudio() {
  const [tab, setTab] = useStudioTab(TABS, "anatomy");
  const [choice, setChoice] = useState("ADD");
  const [hover, setHover] = useState("");
  const [edited, setEdited] = useState<number | null>(null);
  const decoded = useMemo(() => decode(edited ?? sample(choice).word), [choice, edited]);
  const { prefs } = usePrefs();
  const fields = fieldsOf(decoded);
  const active = fields.find((field) => field.name === hover) ?? fields[0];
  const lesson = lessonOf(ISA_LESSONS, tab, "anatomy");
  return (
    <StudioFrame icon="book" title="Instruction Set Architecture" description="LogicLab-16 is a 16-bit load/store ISA. The same definition drives the assembler, the decoder, and the datapath." tabs={TABS} tab={tab} onTab={setTab} guide={lesson.guide} takeaways={lesson.takeaways} theory={lesson.theory}>
      {prefs.explain && active ? <ExplainBar what={active.meaning} why={decoded.explain} notice="Hover a field to see which bits it owns." /> : null}
      {tab === "basics" ? (
        <Card title="The contract">
          <p>Program → Instruction Set Architecture → this CPU implementation.</p>
          <p className="muted">LogicLab-16 fixes the instruction width, the eight registers, and the legal operand forms. Compare this contract with the RISC-V, ARM, and x86 studios.</p>
        </Card>
      ) : null}
      {tab === "anatomy" || tab === "formats" ? (
        <Card title={formatInstruction(decoded)}>
          <Segmented options={CHOICES} value={choice} onChange={(value) => { setChoice(value); setEdited(null); }} />
          <div className="bit-fields">
            {fields.map((field) => (
              <button key={field.name} className={field.name === active?.name ? "bit-field on" : "bit-field"} onMouseEnter={() => setHover(field.name)} onClick={() => { setHover(field.name); setEdited(bumpField(decoded.word, field)); }}>
                <strong>{field.name}</strong>
                <span>{fieldValue(decoded.word, field)}</span>
              </button>
            ))}
          </div>
          <p className="mono">{binaryWord(decoded.word)}</p>
          <p>{active?.meaning}. Category {decoded.category}. Format {decoded.format}.</p>
        </Card>
      ) : null}
      {tab === "style" ? (
        <div className="grid cards-2">
          <Card title="RISC, in this lab"><p>Fixed 16-bit length, a small opcode set, and arithmetic that stays in registers. Fetch always adds one word to the PC.</p></Card>
          <Card title="CISC, as a contrast"><p>A CISC contract often allows variable lengths and memory operands inside arithmetic. That asks more of the decoder and sometimes of microcode. Neither style is universally better.</p></Card>
        </div>
      ) : null}
      {tab === "load" ? (
        <div className="grid cards-2">
          <Card title="Register operation"><p>ADD R1, R2, R3 reads R2 and R3, uses the ALU, and writes R1. Data memory stays idle.</p></Card>
          <Card title="Memory operation"><p>LOAD adds a base and an offset, then reads data memory into a register. STORE writes a register out and does not write a destination.</p></Card>
        </div>
      ) : null}
      {tab === "modes" ? (
        <div className="grid cards-3">
          {ADDRESSING.map((mode) => (
            <Card key={mode.id} title={mode.title}>
              <p className="mono">{mode.sample}</p>
              <p>{mode.formula}</p>
              <p className="tiny">{mode.note}</p>
            </Card>
          ))}
        </div>
      ) : null}
      {tab === "catalog" ? (
        <div className="grid cards-3">
          {CATEGORIES.map((category) => (
            <Card key={category.id} title={category.title}>
              <p>{category.note}</p>
              <p className="mono">{category.examples.join(" · ")}</p>
            </Card>
          ))}
        </div>
      ) : null}
    </StudioFrame>
  );
}

function bumpField(word: number, field: FieldSlice): number {
  const width = field.hi - field.lo + 1;
  const mask = (1 << width) - 1;
  const next = (bits(word, field.hi, field.lo) + 1) & mask;
  return (word & ~(mask << field.lo)) | (next << field.lo);
}
