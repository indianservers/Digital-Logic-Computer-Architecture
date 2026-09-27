import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../../design-system/icons";
import { usePrefs } from "../../store/prefs";
import { BusPanel } from "./bus";
import { TransferPanel } from "./transfer";
import { Mark } from "./ui";
import { WordPanel } from "./word";

const TABS = [
  { id: "transfer", label: "Transfer" },
  { id: "bus", label: "Bus" },
  { id: "word", label: "Control Word" },
] as const;

const ALIAS: Record<string, string> = { "control-word": "word" };

const PAGE: Record<string, { guide: string[]; takeaways: string[]; quote: string; by: string; next: string; nextTab: string; nextLabel: string }> = {
  transfer: {
    guide: ["Set register values.", "Choose an operation.", "Step and observe the transfer.", "Check which registers changed."],
    takeaways: ["RTL describes data movement.", "Only one bus driver is active at a time.", "The write happens on the step edge.", "Registers can be sources or destinations."],
    quote: "Everything in a computer happens by moving data.",
    by: "David Patterson",
    next: "See how the shared bus works.",
    nextTab: "bus",
    nextLabel: "Bus operations",
  },
  bus: {
    guide: ["Select a source register.", "See it drive the bus.", "Optionally load a destination register.", "Try a second driver and resolve the conflict."],
    takeaways: ["A shared bus has a single driver.", "Bus conflicts must be avoided.", "Any register can place its value on the bus.", "The bus carries data, not the operation."],
    quote: "Good architecture is invisible when it works.",
    by: "Gordon Bell",
    next: "See how control signals drive operations.",
    nextTab: "word",
    nextLabel: "Control word",
  },
  word: {
    guide: ["Select an operation.", "See the control word bits.", "Select a signal and read what it enables.", "Generate the word and watch the write edge."],
    takeaways: ["A control word drives the datapath.", "Each field selects a specific function.", "The ALU operation is encoded.", "Register write happens on the clock edge."],
    quote: "Simplicity is the ultimate sophistication.",
    by: "Leonardo da Vinci",
    next: "Apply what you learned on a transfer.",
    nextTab: "transfer",
    nextLabel: "Back to Transfer",
  },
};

export function RtlStudio() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const aliased = raw ? ALIAS[raw] ?? raw : "transfer";
  const tab = TABS.some((item) => item.id === aliased) ? aliased : "transfer";
  const page = PAGE[tab] ?? PAGE.transfer;
  const { prefs } = usePrefs();
  if (!page) return null;

  function setTab(id: string) {
    const next = new URLSearchParams(params);
    next.set("tab", id);
    setParams(next);
  }

  return (
    <div className="rtx">
      <header className="rtx-head">
        <div>
          <h1><Mark kind="file" /> Register Transfer</h1>
          <p>Move a value from registers through the ALU and back. A shared bus accepts one driver.</p>
        </div>
        <Link className="rtx-back" to="/"><Icon name="back" size={14} /> Back to Path</Link>
      </header>
      <div className="rtx-tabs" role="tablist" aria-label="Register transfer">
        {TABS.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? "on" : ""} onClick={() => setTab(item.id)}>{item.label}</button>
        ))}
      </div>
      <div className="rtx-grid">
        <div className="rtx-main">
          <div hidden={tab !== "transfer"} inert={tab !== "transfer" ? true : undefined}><TransferPanel explain={prefs.explain} /></div>
          <div hidden={tab !== "bus"} inert={tab !== "bus" ? true : undefined}><BusPanel explain={prefs.explain} /></div>
          <div hidden={tab !== "word"} inert={tab !== "word" ? true : undefined}><WordPanel explain={prefs.explain} /></div>
        </div>
        <aside className="rtx-side">
          <section>
            <h2><Mark kind="book" /> Studio Guide</h2>
            <ol>{page.guide.map((item, index) => <li key={item}><span>{index + 1}</span>{item}</li>)}</ol>
          </section>
          <section className="takes">
            <h2><Mark kind="bulb" /> Key Takeaways</h2>
            <ul>{page.takeaways.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <blockquote><p>“{page.quote}”</p><cite>— {page.by}</cite></blockquote>
          <section className="next">
            <h2>Next up</h2>
            <p>{page.next}</p>
            <button type="button" onClick={() => setTab(page.nextTab)}>{page.nextLabel} →</button>
          </section>
        </aside>
      </div>
    </div>
  );
}
