import { useState } from "react";
import { useStudioTab } from "../../layout/useStudioTab";
import { Button, Card, ExplainBar, Metric, parseNumberInput } from "../../design-system/ui";
import { installPage, splitAddress, translate, translateTwoLevel, type PageEntry, type TlbEntry } from "../../engines/arch/vm";
import { StudioFrame } from "../../layout/StudioFrame";
import { VM_LESSONS, lessonOf } from "../../data/studioLessons";
import { saveRecord } from "../../store/projects";
import { usePrefs } from "../../store/prefs";

const EMPTY: PageEntry = { frame: 0, valid: false, read: false, write: false, exec: false };
const TABS = [
  { id: "translate", label: "Translate" },
  { id: "table", label: "Page Table" },
  { id: "tlb", label: "TLB" },
  { id: "levels", label: "Two-level" },
  { id: "protect", label: "Protection" },
];

export function VmStudio() {
  const [tab, setTab] = useStudioTab(TABS, "translate");
  const [pageBits, setPageBits] = useState(8);
  const [virtualAddress, setVirtual] = useState("103");
  const [access, setAccess] = useState<"read" | "write" | "exec">("read");
  const [table, setTable] = useState<PageEntry[]>([EMPTY, { frame: 4, valid: true, read: true, write: false, exec: false }, EMPTY, EMPTY]);
  const [tlb, setTlb] = useState<TlbEntry[]>([]);
  const [note, setNote] = useState("Translate a virtual address.");
  const { prefs } = usePrefs();
  const address = Number.parseInt(virtualAddress, 16);
  const parts = Number.isFinite(address) ? splitAddress(address, pageBits) : { vpn: 0, offset: 0 };
  const directory: Array<PageEntry[] | null> = [null, [EMPTY, EMPTY, { frame: 5, valid: true, read: true, write: true, exec: false }]];

  function run() {
    if (!Number.isFinite(address)) {
      setNote("Enter a hexadecimal virtual address.");
      return;
    }
    const stepped = translate(address, pageBits, table, tlb, access);
    setTlb(stepped.tlb);
    setNote(stepped.result.explain);
  }

  const lesson = lessonOf(VM_LESSONS, tab, "translate");
  return (
    <StudioFrame icon="map" title="Virtual Memory" description="A virtual address is a page number plus an offset. The TLB and page table supply the frame. This lab is not an operating system." tabs={TABS} tab={tab} onTab={setTab} guide={lesson.guide} takeaways={lesson.takeaways} theory={lesson.theory}>
      {prefs.explain ? <ExplainBar what={note} why={`VPN ${parts.vpn} · offset ${parts.offset}.`} notice="Widths here are lab settings. They are not a claim about a particular processor." /> : null}
      <div className="row">
        <input className="text-input" aria-label="Virtual address hex" value={virtualAddress} onChange={(event) => setVirtual(event.target.value)} />
        <input className="text-input" aria-label="Page offset bits" type="number" value={pageBits} onChange={(event) => setPageBits(Math.max(1, parseNumberInput(event.target.value, pageBits)))} />
        <Button onClick={() => setAccess("read")}>Read</Button>
        <Button onClick={() => setAccess("write")}>Write</Button>
        <Button variant="primary" onClick={run}>Translate</Button>
        <Button onClick={() => void saveRecord({ id: "vm-lab", kind: "arch", name: "Virtual memory", data: JSON.stringify({ virtualAddress, pageBits, table }), updated: Date.now() })}>Save</Button>
      </div>
      {tab === "translate" ? <Card title="Path"><p>Virtual address → TLB → page table → physical address → RAM.</p><p>{note}</p><Metric label="TLB entries" value={String(tlb.length)} /></Card> : null}
      {tab === "table" ? (
        <Card title="VPN, frame, valid, permissions">
          <table className="data">
            <thead><tr><th>VPN</th><th>Frame</th><th>Valid</th><th>R</th><th>W</th><th>X</th></tr></thead>
            <tbody>
              {table.map((entry, vpn) => (
                <tr key={vpn} className={vpn === parts.vpn ? "active" : ""}>
                  <td>{vpn}</td><td>{entry.frame}</td><td>{entry.valid ? "yes" : "no"}</td><td>{entry.read ? "R" : "—"}</td><td>{entry.write ? "W" : "—"}</td><td>{entry.exec ? "X" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button onClick={() => { setTable(installPage(table, 2, 7)); setNote("Installed VPN 2 in frame 7."); }}>Install missing page</Button>
        </Card>
      ) : null}
      {tab === "tlb" ? (
        <Card title="Lookaside buffer">
          {tlb.length === 0 ? <p>No TLB entry yet. A translation miss fills one slot.</p> : tlb.map((entry) => <p key={entry.vpn}>VPN {entry.vpn} → frame {entry.frame}</p>)}
          <Button onClick={() => { setTlb([]); setNote("TLB cleared. The next translation must read the page table."); }}>Flush TLB</Button>
        </Card>
      ) : null}
      {tab === "levels" ? (
        <Card title="Directory, then table">
          <p>{translateTwoLevel(99, 4, 2, 2, directory, "read").explain}</p>
          <p className="tiny">Address 0x63 uses page offset bits 4, directory bits 2, and table bits 2.</p>
        </Card>
      ) : null}
      {tab === "protect" ? <Card title="Read-only page"><p>VPN 1 is readable and not writable. Choose Write, then Translate, to raise the protection fault.</p><p>Current access: {access}</p></Card> : null}
    </StudioFrame>
  );
}
