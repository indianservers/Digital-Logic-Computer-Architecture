import { useSearchParams } from "react-router-dom";
import { usePrefs } from "../../store/prefs";
import { PageTablePanel, ProtectPanel, TlbPanel, TranslatePanel, TwoLevelPanel } from "./vmPanels";

const TABS = [
  { id: "translate", label: "Translate" },
  { id: "table", label: "Page Table" },
  { id: "tlb", label: "TLB" },
  { id: "levels", label: "Two-level" },
  { id: "protect", label: "Protection" },
] as const;

const ALIAS: Record<string, string> = {
  "page-table": "table",
  "two-level": "levels",
  protection: "protect",
};

export function VmStudio() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const aliased = raw ? ALIAS[raw] ?? raw : "translate";
  const tab = TABS.some((item) => item.id === aliased) ? aliased : "translate";
  const { prefs } = usePrefs();

  function setTab(id: string) {
    const next = new URLSearchParams(params);
    next.set("tab", id);
    setParams(next);
  }

  return (
    <div className="vmx">
      <div className="vmx-tabs" role="tablist" aria-label="Virtual memory labs">
        {TABS.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? "on" : ""} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <div hidden={tab !== "translate"} inert={tab !== "translate" ? true : undefined}>
        <TranslatePanel explain={prefs.explain} />
      </div>
      <div hidden={tab !== "table"} inert={tab !== "table" ? true : undefined}>
        <PageTablePanel explain={prefs.explain} />
      </div>
      <div hidden={tab !== "tlb"} inert={tab !== "tlb" ? true : undefined}>
        <TlbPanel explain={prefs.explain} />
      </div>
      <div hidden={tab !== "levels"} inert={tab !== "levels" ? true : undefined}>
        <TwoLevelPanel explain={prefs.explain} />
      </div>
      <div hidden={tab !== "protect"} inert={tab !== "protect" ? true : undefined}>
        <ProtectPanel explain={prefs.explain} />
      </div>
    </div>
  );
}
