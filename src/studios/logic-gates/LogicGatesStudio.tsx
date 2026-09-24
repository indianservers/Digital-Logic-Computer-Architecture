import { LogicGatesBoard, LOGIC_GATE_TABS } from "./LogicGatesBoard";
import { useStudioTab } from "../../layout/useStudioTab";
import { usePrefs } from "../../store/prefs";

export function LogicGatesStudio() {
  const [tab, setTab] = useStudioTab(LOGIC_GATE_TABS, "build");
  const { prefs, update } = usePrefs();
  return <LogicGatesBoard tab={tab} onTab={setTab} notes={prefs.notes} onNotes={(notes) => update({ notes })} />;
}
