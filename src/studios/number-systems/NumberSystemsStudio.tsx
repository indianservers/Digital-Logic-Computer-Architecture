import { useMemo, useState } from "react";
import { useStudioTab } from "../../layout/useStudioTab";
import { Card, ExplainBar, Metric, Segmented, Toggle, parseNumberInput } from "../../design-system/ui";
import { StudioFrame } from "../../layout/StudioFrame";
import { binaryArithmetic, type ArithmeticOp } from "../../engines/numbers/arithmetic";
import { adjacentGray, excess3FromDecimal, inspectCharacter, parityBit, parityCheck, toBcd } from "../../engines/numbers/codes";
import { contributionSum, divisionSteps, formatBase, isValidInBase, parseBase, placeValues, valueFromBits } from "../../engines/numbers/convert";
import { analyzeFixedPoint, fixedFromValue } from "../../engines/numbers/fixed";
import { decodeFloatBits, FLOAT_PRESETS, floatBitsToNumber, numberToFloatBits, presetBits, toggleFloatBit } from "../../engines/numbers/ieee754";
import { coverage, encodeHamming, flipBit, syndromeOf, type Bit } from "../../engines/numbers/hamming";
import { decodeSigned, encodeSigned, signMagnitudeRange, twosNegationSteps, twosRange, unsignedRange, type SignedCode } from "../../engines/numbers/signed";
import { BitSwitch } from "../shared/widgets";
import { usePrefs } from "../../store/prefs";

const TABS = [
  { id: "convert", label: "Convert & Visualize" },
  { id: "math", label: "Binary Arithmetic" },
  { id: "signed", label: "Signed Numbers" },
  { id: "fixed", label: "Fixed Point" },
  { id: "ieee", label: "IEEE-754" },
  { id: "codes", label: "Digital Codes" },
  { id: "parity", label: "Error Detection" },
  { id: "hamming", label: "Hamming Code" },
];

const LESSONS: Record<string, { guide: string[]; takeaways: string[]; theory: { title: string; body: string }; what: string; why: string; notice: string }> = {
  convert: {
    theory: { title: "Place value", body: "A digit in base b is worth digit × b^k, where k is its distance from the point. The same integer is 42 in decimal, 101010 in binary, and 2A in hex — three writings of one value." },
    guide: ["Type a number in any base; the others follow.", "Toggle bits to add or remove each power of two.", "Change the bit width to see which values still fit.", "Watch the place-value chips light for each 1."],
    takeaways: ["Position determines weight: b^k for the k-th digit.", "Hex groups four bits; one hex digit is a nibble.", "A width of n bits holds 0 through 2ⁿ − 1 unsigned."],
    what: "Each bit is a weight. Turning a bit on adds that power of two.",
    why: "Conversion is the same integer written beside different place values, not a new quantity.",
    notice: "Blue is 1 and contributes its weight. Gray is 0 and contributes nothing.",
  },
  math: {
    theory: { title: "Binary add, subtract, multiply, divide", body: "Column arithmetic in base 2 uses the same carry and borrow rules as decimal. Addition produces a carry when a column sums to 2 or more. Multiplication is shifted copies of the multiplicand, one per 1 in the multiplier." },
    guide: ["Pick ADD, SUB, MUL, or DIV and two operands.", "Read the column carries or the partial products.", "Widen the word if the result does not fit.", "Compare the unsigned result with the binary layout."],
    takeaways: ["A carry is a 2 that becomes a 1 in the next column.", "Unsigned subtract borrows when the top bit is smaller.", "Multiply is add-and-shift; divide is subtract-and-shift."],
    what: "The engine applies the same column algorithm a person uses on paper.",
    why: "Hardware adders are those columns wired so every bit is computed together.",
    notice: "Overflow here means the unsigned result does not fit in the chosen width.",
  },
  signed: {
    theory: { title: "Signed encodings", body: "The same bit pattern can mean different integers. Sign-magnitude uses the MSB as a sign. Two's complement makes −x by invert-then-add-1, so one adder handles add and subtract. Range is not symmetric: n-bit two's complement runs from −2ⁿ⁻¹ to 2ⁿ⁻¹ − 1." },
    guide: ["Enter a value and compare unsigned, sign-magnitude, and two's complement.", "Negate a two's-complement word with invert-then-add-1.", "Watch which encodings can represent the same number.", "Read the legal range for the current width."],
    takeaways: ["Two's complement needs one adder for add and subtract.", "Sign-magnitude has two zeros.", "Overflow is wrapping outside the signed range, not 'a negative appeared'."],
    what: "Encoding is a contract: which patterns mean negative, and how negation is computed.",
    why: "Hardware prefers two's complement because subtraction is addition of the negated operand.",
    notice: "This lab shows teaching widths, not a specific CPU's flags.",
  },
  fixed: {
    theory: { title: "Fixed-point binary", body: "A binary point splits the word into integer bits and fraction bits. The weight of the k-th fraction bit is 2⁻ᵏ. Precision is the smallest step, 2^(−fraction bits). Signed fixed-point uses two's complement on the whole word." },
    guide: ["Set integer bits, fraction bits, and a decimal value.", "Read the bit string with the point marked.", "Toggle signed to see the negative range.", "Compare precision with the step between representable values."],
    takeaways: ["Precision is 2 to the power of minus the fraction width.", "The point does not occupy a stored bit; it is an interpretation.", "Values that are not multiples of that step round to a representable word."],
    what: "Fixed-point is an integer whose place values include negative powers of two.",
    why: "DSP and graphics often want a known step size without a floating-point unit.",
    notice: "Rounding here is toward the nearest representable teaching value.",
  },
  ieee: {
    theory: { title: "IEEE-754", body: "A binary floating-point word is sign, biased exponent, and fraction. Single precision is 1 + 8 + 23 with bias 127. Double is 1 + 11 + 52 with bias 1023. The stored exponent is the true power plus the bias, so negatives become unsigned." },
    guide: ["Type a decimal, or pick a preset such as 1, 0, or NaN.", "Toggle bits in S, E, or F and watch the decoded value.", "Switch 32-bit and 64-bit to see field widths change.", "Compare a normal number with zero, infinity, and NaN."],
    takeaways: ["Value ≈ (−1)^S × 2^(E − bias) × (1.fraction) for normals.", "All-zero exponent is subnormal or zero. All-one exponent is inf or NaN.", "The fraction is the bits after the binary point of the significand."],
    what: "IEEE-754 splits the word so range lives in the exponent and precision in the fraction.",
    why: "A bias lets hardware compare exponents as unsigned magnitudes.",
    notice: "This decoder follows IEEE-754 binary32/binary64, not a vendor rounding mode table.",
  },
  codes: {
    theory: { title: "BCD, Excess-3, Gray, and ASCII", body: "BCD stores each decimal digit as a 4-bit nibble (0–9). Excess-3 is that nibble plus 3. Gray code changes one bit between adjacent values, including the wrap from 15 to 0. ASCII is a 7-bit character code; the low byte of 'A' is 65." },
    guide: ["Enter decimal digits and read BCD and Excess-3 nibbles.", "Step the Gray wheel; neighbors differ by one bit.", "Type a character and read decimal, hex, and UTF-8 bits.", "Watch the wrap from 15 back to 0 on the Gray wheel."],
    takeaways: ["Gray adjacency is why K-map cells sit in Gray order.", "BCD is not a binary integer of the whole number — it is digit by digit.", "ASCII 0x41 is 'A'; the high bit of a byte may be unused."],
    what: "These are different maps from bits to meaning: digits, unit-distance codes, or glyphs.",
    why: "Hardware that talks to people or to a K-map needs the code that matches the interface.",
    notice: "The Gray wheel is 4-bit. ASCII here is the classic 7-bit set inside a byte.",
  },
  parity: {
    theory: { title: "Parity bits", body: "Even parity adds a bit so the total number of 1s is even. Odd parity makes that count odd. A single flipped data bit changes the count, so the receiver's check fails. Parity detects one flip; it does not name which bit, and two flips can cancel." },
    guide: ["Choose even or odd parity and a data word.", "Read the computed parity bit and the sent frame.", "Flip a transmitted bit and watch the check fail.", "Flip a second bit and see that even parity can look valid again."],
    takeaways: ["Even parity: the extra bit makes the 1-count even.", "A mismatch means an odd number of flips in the frame.", "Parity detects; Hamming (next tab) can also correct one bit."],
    what: "The parity bit is a one-bit checksum over the data bits.",
    why: "Links add a cheap check that something changed, not a full error-correcting code.",
    notice: "This lab uses even or odd over the visible bits, not CRC polynomials.",
  },
  hamming: {
    theory: { title: "Hamming(7,4)", body: "Positions 1, 2, and 4 are parity; data sits in 3, 5, 6, and 7 (1-based). Each parity bit covers positions whose index has that bit set. The syndrome is the sum of the failing parity positions and names the flipped bit, or 0 if the word is clean." },
    guide: ["Set four data bits and encode.", "Read positions 1–7: parity at 1, 2, 4.", "Flip one encoded bit and watch the syndrome name it.", "Compare each parity group's cover list with the failing check."],
    takeaways: ["Parity bits occupy power-of-two positions.", "The syndrome is the 1-based index of a single error.", "Two flips can produce a misleading syndrome; this code corrects one error."],
    what: "Each parity check is a vote over a subset of positions. Together they write a binary index.",
    why: "If you can name the bad position, you can invert that bit and restore the word.",
    notice: "Labels are Hamming positions 1–7, matching the engine — not bit weights 0–6.",
  },
};

export function NumberSystemsStudio() {
  const [tab, setTab] = useStudioTab(TABS, "convert");
  const [resetKey, setResetKey] = useState(0);
  const { prefs } = usePrefs();
  const lesson = LESSONS[tab] ?? LESSONS.convert!;
  return (
    <StudioFrame
      icon="book"
      title="Number Systems & Data Representation"
      description="Change a digit, a bit, or a code and every related representation updates immediately."
      tabs={TABS}
      tab={tab}
      onTab={setTab}
      onReset={() => setResetKey((n) => n + 1)}
      guide={lesson.guide}
      takeaways={lesson.takeaways}
      theory={lesson.theory}
    >
      <div key={`${tab}-${resetKey}`}>
        {prefs.explain ? <ExplainBar what={lesson.what} why={lesson.why} notice={lesson.notice} /> : null}
        {tab === "convert" ? <ConvertLab /> : null}
        {tab === "math" ? <MathLab /> : null}
        {tab === "signed" ? <SignedLab /> : null}
        {tab === "fixed" ? <FixedLab /> : null}
        {tab === "ieee" ? <IeeeLab /> : null}
        {tab === "codes" ? <CodesLab /> : null}
        {tab === "parity" ? <ParityLab /> : null}
        {tab === "hamming" ? <HammingLab /> : null}
      </div>
    </StudioFrame>
  );
}

function Bits({ bits, onToggle, weights, kind = "weight" }: { bits: Array<0 | 1>; onToggle?: (index: number) => void; weights?: number[]; kind?: "weight" | "position" | "data" }) {
  return (
    <div>
      <div className="bits">
        {bits.map((bit, index) => {
          const caption = kind === "position" || kind === "data" ? index + 1 : weights?.[index];
          const label = kind === "position"
            ? `Position ${index + 1}, value ${bit}`
            : kind === "data"
              ? `Data bit ${index + 1}, value ${bit}`
              : `Bit weight ${weights?.[index] ?? index}, value ${bit}`;
          return (
            <BitSwitch key={index} on={bit === 1} label={caption !== undefined ? String(caption) : ""} onChange={() => onToggle?.(index)} ariaLabel={label} />
          );
        })}
      </div>
    </div>
  );
}

function ConvertLab() {
  const { prefs, update, earn } = usePrefs();
  const [value, setValue] = useState(42);
  const [base, setBase] = useState(2);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const width = prefs.bitWidth;
  const binary = formatBase(value, 2).padStart(width, "0").slice(-width);
  const bits = binary.split("").map((ch) => (ch === "1" ? 1 : 0)) as Array<0 | 1>;
  const weights = bits.map((_, index) => 2 ** (width - 1 - index));
  const places = placeValues(formatBase(value, base).slice(0, 16), base);
  const fields = [
    { label: "Decimal", b: 10 },
    { label: "Binary", b: 2 },
    { label: "Octal", b: 8 },
    { label: "Hexadecimal", b: 16 },
  ];
  const setFrom = (text: string, b: number) => {
    setDrafts((prev) => ({ ...prev, [b]: text }));
    if (!isValidInBase(text, b)) return;
    const next = parseBase(text, b);
    if (next === null) return;
    setValue(next);
    setDrafts({});
    earn("convert");
  };
  return (
    <div className="grid">
      <Card title="Number Base Converter" action={<Segmented options={["4", "8", "16", "32"]} value={String(width)} onChange={(v) => update({ bitWidth: Number(v) as 4 | 8 | 16 | 32 })} />}>
        <div className="grid cards-4">
          {fields.map((field) => (
            <label className="field" key={field.b}>
              <span>{field.label} (base {field.b})</span>
              <input className="text-input" aria-label={field.label} value={drafts[field.b] ?? formatBase(value, field.b)} onChange={(event) => setFrom(event.target.value, field.b)} />
            </label>
          ))}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <span className="tiny">Custom base</span>
          <input className="text-input" style={{ width: 70 }} type="number" min={2} max={16} value={base} aria-label="Custom base" onChange={(event) => setBase(Math.min(16, Math.max(2, Number(event.target.value) || 2)))} />
          <input className="text-input" aria-label="Custom base value" value={drafts.custom ?? formatBase(value, base)} onChange={(event) => { setDrafts((p) => ({ ...p, custom: event.target.value })); const n = parseBase(event.target.value, base); if (n !== null) setValue(n); }} />
          <Metric label="Unsigned range" value={`0 – ${unsignedRange(width).max}`} />
        </div>
      </Card>
      <div className="grid cards-2">
        <Card title="Bit representation">
          <Bits bits={bits} weights={weights} onToggle={(index) => {
            const next = bits.map((bit, i) => (i === index ? (bit === 1 ? 0 : 1) : bit)) as Array<0 | 1>;
            setValue(valueFromBits(next));
          }} />
          <p className="muted">Unsigned {valueFromBits(bits)} · Hex {formatBase(valueFromBits(bits), 16)} · Octal {formatBase(valueFromBits(bits), 8)}</p>
        </Card>
        <Card title={`Place values · base ${base}`}>
          <div className="weights">
            {places.map((place, index) => (
              <div key={index} className={place.active ? "weight active" : "weight"}><b>{place.digit}</b>{place.weight}</div>
            ))}
          </div>
          <p className="expr" style={{ fontSize: 16 }}>{contributionSum(places)} = {value}</p>
        </Card>
      </div>
      <Card title="Decimal to binary, remainder walk">
        <ol className="muted">
          {divisionSteps(valueFromBits(bits), 2).map((step, index) => (
            <li key={index}>{step.dividend} ÷ 2 = {step.quotient} remainder {step.remainder}</li>
          ))}
        </ol>
        <p className="tiny">Read remainders from bottom to top.</p>
      </Card>
    </div>
  );
}

function MathLab() {
  const { prefs, update } = usePrefs();
  const [a, setA] = useState(11);
  const [b, setB] = useState(6);
  const [op, setOp] = useState<ArithmeticOp>("add");
  const result = binaryArithmetic(a, b, prefs.bitWidth, op);
  return (
    <div className="grid cards-2">
      <Card title="Binary calculator" action={<Segmented options={["add", "sub", "mul", "div"]} value={op} onChange={(v) => setOp(v as ArithmeticOp)} />}>
        <div className="row">
          <label className="field">A<input className="text-input" type="number" value={a} onChange={(e) => setA(parseNumberInput(e.target.value, a))} /></label>
          <label className="field">B<input className="text-input" type="number" value={b} onChange={(e) => setB(parseNumberInput(e.target.value, b))} /></label>
          <Segmented options={["4", "8", "16", "32"]} value={String(prefs.bitWidth)} onChange={(v) => update({ bitWidth: Number(v) as 4 | 8 | 16 | 32 })} />
        </div>
        <pre className="mono">{result.steps[0]?.rows.join("\n")}</pre>
        {result.divZero ? <p>Division by zero is undefined.</p> : <p>Unsigned {result.unsigned} · Signed {result.signed}{result.overflow ? " · overflow" : ""}</p>}
      </Card>
      <Card title="What the columns mean">
        <p className="muted">{result.steps[0]?.note}</p>
        {result.remainderPattern ? <p>Remainder {result.remainderPattern}</p> : null}
      </Card>
    </div>
  );
}

function SignedLab() {
  const { prefs, update, earn } = usePrefs();
  const [value, setValue] = useState(5);
  const [code, setCode] = useState<SignedCode>("twos");
  const width = prefs.bitWidth;
  const encoded = encodeSigned(value, width, code);
  const steps = twosNegationSteps(Math.abs(value), width);
  const range = code === "unsigned" ? unsignedRange(width) : code === "twos" ? twosRange(width) : signMagnitudeRange(width);
  return (
    <div className="grid cards-2">
      <Card title="Signed encodings" action={<Segmented options={["unsigned", "sign-magnitude", "ones", "twos"]} value={code} onChange={(v) => setCode(v as SignedCode)} />}>
        <div className="row">
          <input className="text-input" type="number" aria-label="Decimal value" value={value} onChange={(e) => setValue(parseNumberInput(e.target.value, value))} />
          <Segmented options={["4", "8", "16"]} value={String(Math.min(width, 16))} onChange={(v) => update({ bitWidth: Number(v) as 4 | 8 | 16 })} />
        </div>
        <p className="tiny">Range {range.min} → {range.max}. The left bit is the sign when the code is signed.</p>
        {encoded ? <Bits bits={encoded} onToggle={(index) => {
          const next = encoded.map((bit, i) => (i === index ? (bit ? 0 : 1) : bit)) as Array<0 | 1>;
          const decoded = decodeSigned(next, code);
          if (decoded !== null) { setValue(decoded); earn("twos"); }
        }} /> : <p>That value does not fit this code and width.</p>}
      </Card>
      <Card title="Negation animation">
        {(steps ?? []).map((step) => (
          <div key={step.label} style={{ marginBottom: 8 }}>
            <strong>{step.label}</strong>
            <div className="mono">{step.bits.join(" ")}</div>
            <div className="tiny">{step.note}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function FixedLab() {
  const [intBits, setIntBits] = useState(4);
  const [fracBits, setFracBits] = useState(4);
  const [signed, setSigned] = useState(false);
  const [text, setText] = useState("3.5");
  const point = useMemo(() => fixedFromValue(Number(text) || 0, intBits, fracBits, signed), [text, intBits, fracBits, signed]);
  const live = analyzeFixedPoint(point.bits, intBits, fracBits, signed);
  return (
    <Card title="Fixed-point word">
      <div className="row">
        <label className="field">Value<input className="text-input" value={text} onChange={(e) => setText(e.target.value)} /></label>
        <label className="field">Integer bits<input className="text-input" type="number" min={1} max={16} value={intBits} onChange={(e) => setIntBits(Math.max(1, parseNumberInput(e.target.value, intBits)))} /></label>
        <label className="field">Fraction bits<input className="text-input" type="number" min={1} max={16} value={fracBits} onChange={(e) => setFracBits(Math.max(1, parseNumberInput(e.target.value, fracBits)))} /></label>
        <span className="row"><Toggle on={signed} label="Signed" onChange={setSigned} tone="warn" /></span>
      </div>
      <div className="mono" style={{ margin: "10px 0" }}>
        {live.bits.map((bit, index) => <span key={index}>{bit}{index + 1 === live.pointAfter ? " · " : " "}</span>)}
      </div>
      <div className="row">
        <Metric label="Value" value={String(live.value)} />
        <Metric label="Precision" value={String(live.precision)} />
        <Metric label="Range" value={`${live.rangeMin} … ${live.rangeMax}`} />
      </div>
    </Card>
  );
}

function IeeeLab() {
  const [width, setWidth] = useState<32 | 64>(32);
  const [bits, setBits] = useState(numberToFloatBits(6.5, 32));
  const [text, setText] = useState("6.5");
  const parts = decodeFloatBits(bits);
  const expStart = 1;
  const fracStart = 1 + (width === 32 ? 8 : 11);
  return (
    <div className="grid">
      <Card title={`IEEE-754 ${width}-bit`} action={<Segmented options={["32", "64"]} value={String(width)} onChange={(v) => { const next = Number(v) as 32 | 64; setWidth(next); setBits(numberToFloatBits(floatBitsToNumber(bits), next)); }} />}>
        <div className="row">
          <input className="text-input" aria-label="Decimal float" value={text} onChange={(e) => { setText(e.target.value); const n = Number(e.target.value); if (e.target.value.trim() && Number.isFinite(n)) setBits(numberToFloatBits(n, width)); }} />
          {FLOAT_PRESETS.map((preset) => (
            <button key={preset.label} className="btn-ghost" onClick={() => { setBits(presetBits(preset.value, width)); setText(preset.label); }}>{preset.label}</button>
          ))}
        </div>
        <div className="bits" style={{ marginTop: 10 }}>
          {bits.split("").map((bit, index) => {
            const region = index < expStart ? "S" : index < fracStart ? "E" : "F";
            return <BitSwitch key={index} on={bit === "1"} label={region} onChange={() => setBits(toggleFloatBit(bits, index))} ariaLabel={`${region} bit ${index} is ${bit}`} />;
          })}
        </div>
      </Card>
      <div className="grid cards-4">
        <Metric label="Class" value={parts.classification} />
        <Metric label="Biased exp" value={String(parts.biasedExponent)} />
        <Metric label="True exp" value={parts.trueExponent === null ? "—" : String(parts.trueExponent)} />
        <Metric label="Value" value={parts.valueText} />
      </div>
      <Card title="Formula"><p className="expr" style={{ fontSize: 16 }}>{parts.formula}</p><p className="tiny">Sign {parts.sign} · exponent {parts.exponentBits} · fraction {parts.fractionBits.slice(0, 16)}{parts.fractionBits.length > 16 ? "…" : ""}</p></Card>
    </div>
  );
}

function CodesLab() {
  const [decimal, setDecimal] = useState("173");
  const [grayValue, setGrayValue] = useState(0);
  const [character, setCharacter] = useState("A");
  const bcd = toBcd(decimal);
  const excess = excess3FromDecimal(decimal);
  const rows = adjacentGray(4);
  const info = inspectCharacter(character);
  return (
    <div className="grid cards-2">
      <Card title="BCD and Excess-3">
        <input className="text-input" aria-label="Decimal digits" value={decimal} onChange={(e) => setDecimal(e.target.value.replace(/[^\d]/g, "").slice(0, 6))} />
        <p>BCD {bcd?.join(" ") ?? "Digits only"}</p>
        <p>Excess-3 {excess?.join(" ") ?? "—"} <span className="tiny">each BCD nibble plus 0011</span></p>
      </Card>
      <Card title="Gray wheel">
        <div className="bits">
          {rows.map((row) => (
            <button key={row.value} className={row.value === grayValue ? "bit on" : "bit"} onClick={() => setGrayValue(row.value)} aria-label={`binary ${row.binary}`}>{row.value}</button>
          ))}
        </div>
        <p className="mono">Binary {rows[grayValue]?.binary} · Gray {rows[grayValue]?.gray}</p>
        <p className="tiny">Neighbors, including the wrap from 15 to 0, differ by one bit.</p>
      </Card>
      <Card title="ASCII / Unicode">
        <input className="text-input" aria-label="Character" value={character} maxLength={2} onChange={(e) => setCharacter(e.target.value)} />
        {info ? <p className="mono">{info.character} · dec {info.decimal} · hex {info.hex} · {info.binary}<br />UTF-8 {info.utf8}</p> : null}
        <p className="tiny">{info?.note}</p>
      </Card>
    </div>
  );
}

function ParityLab() {
  const [bits, setBits] = useState<Array<0 | 1>>([1, 0, 1, 1, 0]);
  const [odd, setOdd] = useState(false);
  const parity = parityBit(bits, odd);
  const [sent, setSent] = useState<Array<0 | 1>>([...bits, parity]);
  const check = parityCheck(sent, odd);
  return (
    <Card title="Sender → transmission → receiver">
      <div className="row"><span>Data</span><Bits bits={bits} onToggle={(i) => {
        const next = bits.map((b, idx) => (idx === i ? (b ? 0 : 1) : b)) as Array<0 | 1>;
        setBits(next);
        setSent([...next, parityBit(next, odd)]);
      }} /></div>
      <div className="row"><Toggle on={odd} label="Odd parity" onChange={(next) => { setOdd(next); setSent([...bits, parityBit(bits, next)]); }} tone="primary" /></div>
      <p>Parity bit {parity}. Frame {sent.join("")}</p>
      <div className="row"><span>Flip a transmitted bit</span><Bits bits={sent} onToggle={(i) => setSent(flipBit(sent, i))} /></div>
      <p>{check.ok ? "Receiver parity matches." : `Mismatch. Expected parity ${check.expected}, received ${check.actual}.`}</p>
    </Card>
  );
}

function HammingLab() {
  const { earn } = usePrefs();
  const [data, setData] = useState<Bit[]>([1, 0, 1, 1]);
  const [word, setWord] = useState<Bit[]>(encodeHamming([1, 0, 1, 1]).bits);
  const result = syndromeOf(word);
  const sync = (next: Bit[]) => { setData(next); setWord(encodeHamming(next).bits); };
  return (
    <div className="grid cards-2">
      <Card title="Hamming(7,4)">
        <div className="row"><span>Data</span><Bits bits={data} kind="data" onToggle={(i) => sync(data.map((b, idx) => (idx === i ? (b ? 0 : 1) : b)) as Bit[])} /></div>
        <button className="btn-primary" onClick={() => setWord(encodeHamming(data).bits)}>Encode</button>
        <p className="tiny">Positions 1, 2, and 4 are parity. Data occupies 3, 5, 6, 7.</p>
        <Bits bits={word} kind="position" onToggle={(i) => { setWord(flipBit(word, i)); earn("hamming"); }} />
        <p>{result.explanation}</p>
        {result.flippedIndex !== null ? <p>Corrected word {result.corrected.join("")}</p> : <p>Syndrome {result.syndrome}</p>}
      </Card>
      <Card title="Parity groups">
        {result.groups.map((group) => (
          <p key={group.parityPosition}><strong>p{group.parityPosition}</strong> covers {group.covers.join(", ")} · {group.ok ? "holds" : "fails"}</p>
        ))}
        <p className="tiny">Example coverage of p1: {coverage(7, 1).join(", ")}</p>
      </Card>
    </div>
  );
}
