import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../design-system/icons";
import { maskToMinterms, termFromMask } from "../../engines/kmap/quine";
import { useStudioTab } from "../../layout/useStudioTab";
import { CircuitView, inputRecord } from "./CircuitView";
import { KMapBoard } from "./KMapBoard";
import {
  answerMatches, applyExpression, blank, cycle, derive, invertCells, latexOf, paint, parseSpec,
  plainPos, plainSop, practiceSet, presets, randomCells, resizeDrops, resizeState, teach, validateGroup, validateNames,
  type Cell, type FnState, type Format,
} from "./logic";
import { TruthGrid } from "./TruthGrid";

const TABS = [
  { id: "from-expr", label: "Truth Table", icon: "table" as const },
  { id: "kmap", label: "Karnaugh Map", icon: "map" as const },
  { id: "min", label: "Minimization", icon: "sheet" as const },
  { id: "circuits", label: "Circuits", icon: "gate" as const },
  { id: "compare", label: "Compare", icon: "grid" as const },
  { id: "practice", label: "Practice", icon: "practice" as const },
  { id: "notes", label: "Notes", icon: "book" as const },
  { id: "from-table", label: "Truth Table", icon: "table" as const },
];
const VISIBLE = TABS.filter((tab) => tab.id !== "from-table");
const NOTES_KEY = "logiclab.truth.notes.v1";
const STARTER: FnState = { names: ["A", "B", "C"], output: "F", extras: [], cells: [0, 1, 1, 0, 1, 1, 0, 1] };

export function TruthStudio() {
  const [tab, setTab] = useStudioTab(TABS, "from-expr");
  const view = tab === "from-table" ? "from-expr" : tab;
  const [fn, setFn] = useState<FnState>(STARTER);
  const past = useRef<FnState[]>([]);
  const future = useRef<FnState[]>([]);
  const [format, setFormat] = useState<Format>("table");
  const [exprText, setExprText] = useState("A'·B'·C + A'·B·C' + A·B'·C' + A·B'·C + A·B·C");
  const [specText, setSpecText] = useState("F(A,B,C) = Σm(1,2,4,5,7)");
  const [inputError, setInputError] = useState("");
  const [nameError, setNameError] = useState("");
  const [groupMode, setGroupMode] = useState<"auto" | "manual">("auto");
  const [manual, setManual] = useState<string[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [rows, setRows] = useState<number[]>([]);
  const [hover, setHover] = useState<number | null>(null);
  const [activeMask, setActiveMask] = useState<string | null>(null);
  const [groupError, setGroupError] = useState("");
  const [density, setDensity] = useState<"learn" | "expert">("learn");
  const [open, setOpen] = useState({ guide: true, canon: true, chart: true, takes: false });
  const [sim, setSim] = useState(0);
  const [copied, setCopied] = useState("");
  const [grouped, setGrouped] = useState(false);
  const [visited, setVisited] = useState<string[]>([]);
  const [level, setLevel] = useState<"Easy" | "Medium" | "Hard">("Easy");
  const [problem, setProblem] = useState(0);
  const [answer, setAnswer] = useState("");
  const [hintOn, setHintOn] = useState(false);
  const [stepOn, setStepOn] = useState(false);
  const [solutionOn, setSolutionOn] = useState(false);
  const [verdict, setVerdict] = useState("");
  const [menu, setMenu] = useState(false);
  const [notes, setNotes] = useState(() => localStorage.getItem(NOTES_KEY) ?? "");
  const specFocus = useRef(false);
  const exprFocus = useRef(false);

  const model = useMemo(() => derive(fn), [fn]);
  const steps = useMemo(() => teach(model), [model]);
  const groups = groupMode === "manual" ? manual : model.sop.selected.map((im) => im.mask);
  const exercises = practiceSet().filter((item) => item.level === level);
  const exercise = exercises[problem % Math.max(exercises.length, 1)] ?? practiceSet()[0]!;
  const learn = density === "learn";

  useEffect(() => { localStorage.setItem(NOTES_KEY, notes); }, [notes]);
  useEffect(() => {
    if (specFocus.current) return;
    setSpecText(format === "maxterms" ? plainPos(model) : plainSop(model));
  }, [format, model]);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const redo = (event.ctrlKey || event.metaKey) && (event.key === "y" || (event.shiftKey && event.key.toLowerCase() === "z"));
      const undoKey = (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z";
      if (redo) { event.preventDefault(); redoNow(); }
      else if (undoKey) { event.preventDefault(); undoNow(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function commit(next: FnState) {
    setFn((current) => {
      past.current.push(current);
      if (past.current.length > 80) past.current.shift();
      future.current = [];
      return next;
    });
    setActiveMask(null);
    setManual((current) => current.filter((mask) => maskToMinterms(mask).every((index) => next.cells[index] !== 0)));
  }

  function undoNow() {
    setFn((current) => {
      const prev = past.current.pop();
      if (!prev) return current;
      future.current.push(current);
      return prev;
    });
  }
  function redoNow() {
    setFn((current) => {
      const next = future.current.pop();
      if (!next) return current;
      past.current.push(current);
      return next;
    });
  }

  function editCell(index: number) {
    commit({ ...fn, cells: fn.cells.map((cell, i) => (i === index ? cycle(cell) : cell)) });
    setGroupError("");
  }

  function changeCount(count: number) {
    if (resizeDrops(fn, count) && !window.confirm("This removes rows you already edited. Continue?")) return;
    commit(resizeState(fn, count));
    setManual([]);
    setPicked([]);
    setRows([]);
    setNameError("");
  }

  function rename(index: number, name: string) {
    const names = fn.names.map((current, i) => (i === index ? name : current));
    const problemName = validateNames(names);
    setNameError(problemName ?? "");
    if (!problemName) commit({ ...fn, names });
  }

  function applySpec(text: string) {
    const parsed = parseSpec(text, fn.names.length);
    if (parsed.error || parsed.cells.length !== fn.cells.length) {
      setInputError(parsed.error ?? "That list does not match this table.");
      return;
    }
    commit({ ...fn, names: parsed.names ?? fn.names, cells: parsed.cells });
    setInputError("");
    setManual([]);
  }

  function applyExpr(text: string) {
    const parsed = applyExpression(text, fn.names);
    if (parsed.error || !parsed.state) {
      setInputError(parsed.error ?? "That expression could not be read.");
      return;
    }
    const drops = parsed.state.names.length < fn.names.length && fn.cells.some((cell) => cell !== 0);
    if (drops && !window.confirm("This expression uses fewer variables and replaces the table. Continue?")) return;
    commit(parsed.state);
    setInputError("");
    setManual([]);
  }

  function createGroup(indexes: number[]) {
    const result = validateGroup(fn.cells, indexes, fn.names.length);
    if (!result.ok) {
      setGroupError(result.reason);
      return;
    }
    setGroupError("");
    setManual((current) => current.includes(result.mask) ? current : [...current, result.mask]);
    setPicked([]);
    setGrouped(true);
    setGroupMode("manual");
  }

  function copy(id: string, text: string) {
    void navigator.clipboard?.writeText(text);
    setCopied(id);
  }

  function visit(id: string) {
    setTab(id);
    setVisited((current) => current.includes(id) ? current : [...current, id]);
  }

  const stage = [
    { label: "Build truth table", done: fn.cells.some((cell) => cell !== 0) },
    { label: "Inspect K-map", done: visited.includes("kmap") || hover !== null },
    { label: "Create groups", done: grouped },
    { label: "Minimize", done: visited.includes("min") || visited.includes("circuits") },
    { label: "Compare circuits", done: visited.includes("compare") },
  ];
  const values = inputRecord(fn.names, sim);

  const workbench = (
    <div className={`twb ${learn ? "learn" : "expert"}`}>
      <section className="lgx-card twb-table">
        <div className="lgx-card-bar"><h3><Icon name="table" size={15} /> Truth Table Editor</h3></div>
        <div className="ttx-controls">
          <label>Variables
            <select aria-label="Variable count" value={fn.names.length} onChange={(event) => changeCount(Number(event.target.value))}>
              {[2, 3, 4, 5].map((count) => <option key={count} value={count}>{count}</option>)}
            </select>
          </label>
          <label>Input Format
            <select aria-label="Input format" value={format} onChange={(event) => { setFormat(event.target.value as Format); setInputError(""); }}>
              <option value="table">Truth Table</option>
              <option value="expression">Boolean Expression</option>
              <option value="minterms">Minterms</option>
              <option value="maxterms">Maxterms</option>
            </select>
          </label>
          <label>Preset
            <select aria-label="Example function" value="" onChange={(event) => {
              const preset = presets(fn.names.length).find((item) => item.id === event.target.value);
              if (!preset) return;
              if (fn.cells.some((cell) => cell !== 0) && !window.confirm("Replace the current function with this example?")) return;
              commit(preset.state);
              setManual([]);
              setInputError("");
            }}>
              <option value="">Examples</option>
              {presets(fn.names.length).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>
        {format === "expression" ? (
          <label className="twb-entry">Boolean expression
            <textarea aria-label="Boolean expression" value={exprText} onFocus={() => { exprFocus.current = true; }} onBlur={() => { exprFocus.current = false; applyExpr(exprText); }} onChange={(event) => setExprText(event.target.value)} />
          </label>
        ) : null}
        {format === "minterms" || format === "maxterms" ? (
          <label className="twb-entry">{format === "minterms" ? "Minterms" : "Maxterms"}
            <textarea
              aria-label={format === "minterms" ? "Minterm list" : "Maxterm list"}
              value={specText}
              onFocus={() => { specFocus.current = true; }}
              onBlur={(event) => { specFocus.current = false; applySpec(event.currentTarget.value); }}
              onChange={(event) => {
                const text = event.target.value;
                setSpecText(text);
                const parsed = parseSpec(text, fn.names.length);
                if (!parsed.error && parsed.cells.length === fn.cells.length) applySpec(text);
              }}
            />
          </label>
        ) : null}
        {inputError ? <p className="cwb-error" role="alert">{inputError}</p> : null}
        {nameError ? <p className="cwb-error" role="alert">{nameError}</p> : null}
        {learn ? <p className="tiny">Click F values to cycle: 0 → 1 → X. Input combinations stay fixed.</p> : null}
        <div className="ttx-fills">
          <button type="button" onClick={() => commit({ ...fn, cells: paint(fn.cells, [], 0) })}>Set All 0</button>
          <button type="button" onClick={() => commit({ ...fn, cells: paint(fn.cells, [], 1) })}>Set All 1</button>
          <button type="button" onClick={() => commit({ ...fn, cells: paint(fn.cells, [], "X") })}>Set All X</button>
          <button type="button" onClick={() => commit({ ...fn, cells: invertCells(fn.cells) })}>Invert Output</button>
          <button type="button" onClick={() => commit({ ...fn, cells: fn.cells.map((cell) => (cell === "X" ? 0 : cell)) })}>Clear Don't Cares</button>
          <button type="button" onClick={() => commit({ ...fn, cells: randomCells(fn.cells) })}>Randomize</button>
          <button type="button" onClick={() => { commit(blank(fn.names.length, fn.names)); setManual([]); }}>Reset</button>
          <button type="button" onClick={undoNow}>Undo</button>
          <button type="button" onClick={redoNow}>Redo</button>
        </div>
        {rows.length ? (
          <div className="ttx-fills">
            <span>Selected rows</span>
            {([0, 1, "X"] as Cell[]).map((value) => (
              <button key={String(value)} type="button" onClick={() => { commit({ ...fn, cells: paint(fn.cells, rows, value) }); setRows([]); }}>Set {value}</button>
            ))}
          </div>
        ) : null}
        <TruthGrid
          state={fn}
          hover={hover}
          selected={rows}
          onHover={setHover}
          onCycle={editCell}
          onRename={rename}
          onFocusRow={setHover}
          onToggleRow={(index, extend) => {
            setRows((current) => {
              if (!extend || current.length === 0) return current.includes(index) ? current.filter((item) => item !== index) : [...current, index];
              const anchor = current[current.length - 1] ?? index;
              const [start, end] = anchor < index ? [anchor, index] : [index, anchor];
              const range = Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
              return [...new Set([...current, ...range])];
            });
          }}
        />
      </section>

      <section className="lgx-card twb-expr">
        <button type="button" className="twb-fold" aria-expanded={open.canon} onClick={() => setOpen((current) => ({ ...current, canon: !current.canon }))}>
          <span className="ttx-fx">f(x)</span> Generated Expressions
        </button>
        {open.canon ? (
          <>
            <CopyRow label="Minterms" text={plainSop(model)} id="sum" copied={copied} onCopy={copy} />
            <CopyRow label="Maxterms" text={plainPos(model)} id="prod" copied={copied} onCopy={copy} />
            <CopyRow label="Canonical SOP" text={model.canonicalSop} id="sop" copied={copied} onCopy={copy} />
            <CopyRow label="Canonical POS" text={model.canonicalPos} id="pos" copied={copied} onCopy={copy} />
            <div className="ttx-fills">
              <button type="button" onClick={() => copy("plain", `${plainSop(model)}\n${model.canonicalSop}\n${plainPos(model)}\n${model.canonicalPos}`)}>Copy plain text</button>
              <button type="button" onClick={() => copy("tex", `\\[${latexOf(model.canonicalSop)}\\]`)}>Copy LaTeX</button>
            </div>
          </>
        ) : null}
      </section>

      <section className="lgx-card twb-map">
        <div className="lgx-card-bar"><h3><Icon name="map" size={15} /> Karnaugh Map</h3></div>
        <div className="ttx-fills">
          <button type="button" className={groupMode === "auto" ? "on" : ""} onClick={() => { setGroupMode("auto"); setGrouped(true); setGroupError(""); }}>Auto Group</button>
          <button type="button" className={groupMode === "manual" ? "on" : ""} onClick={() => setGroupMode("manual")}>Manual Group</button>
          <button type="button" onClick={() => { setGroupMode("auto"); setGrouped(true); setActiveMask(null); }}>Find Optimal Groups</button>
          {groupMode === "manual" ? <button type="button" onClick={() => createGroup(picked)}>Create Group</button> : null}
          {groupMode === "manual" ? <button type="button" onClick={() => { setManual([]); setPicked([]); }}>Clear Groups</button> : null}
        </div>
        {learn ? <p className="tiny">Gray-code neighbors differ by one variable, so a pair drops one literal. Groups wrap because opposite edges are also one bit apart. A power-of-two group drops one literal each time it doubles.</p> : null}
        <KMapBoard
          names={fn.names}
          cells={fn.cells}
          groups={groups}
          hover={hover}
          activeMask={activeMask}
          manual={groupMode === "manual"}
          groupError={groupError}
          onHover={setHover}
          onCycle={editCell}
          onTogglePick={(index) => setPicked((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index])}
          onCreate={createGroup}
        />
        {picked.length ? <p className="tiny">Selected cells: {picked.map((index) => `m${index}`).join(", ")}</p> : null}
      </section>

      <aside className="lgx-card lgx-guide twb-guide">
        <button type="button" className="twb-fold" aria-expanded={open.guide} onClick={() => setOpen((current) => ({ ...current, guide: !current.guide }))}>Studio Guide</button>
        {open.guide ? (
          <ol>
            {stage.map((item, index) => {
              const current = !item.done && stage.slice(0, index).every((step) => step.done);
              return <li key={item.label} className={item.done ? "done" : current ? "now" : ""}><span className="step-no">{item.done ? "✓" : current ? "●" : "○"}</span><span>{item.label}</span></li>;
            })}
          </ol>
        ) : null}
      </aside>

      <div className="twb-lower">
        <section className="lgx-card">
          <h3>Prime Implicants</h3>
          <ul className="twb-primes">
            {model.sop.implicants.map((im) => {
              const term = termFromMask(im.mask, fn.names);
              return (
                <li key={im.mask}>
                  <button type="button" className={activeMask === im.mask ? "on" : ""} onClick={() => setActiveMask(activeMask === im.mask ? null : im.mask)} onMouseEnter={() => setActiveMask(im.mask)} onMouseLeave={() => setActiveMask(null)}>
                    <b>{term}</b>
                    <span>covers {im.minterms.filter((index) => fn.cells[index] === 1).map((index) => `m${index}`).join(", ") || "no required 1"}</span>
                    <span>{[...im.mask].filter((bit) => bit !== "-").length === 1 ? "1 literal" : `${[...im.mask].filter((bit) => bit !== "-").length} literals`}</span>
                    <em className={im.essential ? "yes" : ""}>{im.essential ? "Essential" : "Non-essential"}</em>
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" className="twb-fold" aria-expanded={open.chart} onClick={() => setOpen((current) => ({ ...current, chart: !current.chart }))}>Prime Implicant Chart</button>
          {open.chart ? (
            <div className="twb-scroll">
              <table className="ttx-table twb-chart">
                <thead>
                  <tr><th>Implicant</th>{model.minterms.map((index) => <th key={index}>m{index}</th>)}</tr>
                </thead>
                <tbody>
                  {model.sop.implicants.map((im) => (
                    <tr key={im.mask} className={im.essential ? "essential" : ""}>
                      <th>{termFromMask(im.mask, fn.names)}</th>
                      {model.minterms.map((index) => <td key={index}>{im.minterms.includes(index) ? "●" : ""}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
        <section className="lgx-card">
          <h3>Minimized Expression</h3>
          <p className="ttx-formula">SOP: {model.sop.expression}</p>
          <p className="ttx-formula">POS: {model.pos}</p>
          {model.covers.length > 1 ? model.covers.map((cover, index) => <p key={cover.expression}>Equivalent Solution {index + 1}: {cover.expression}</p>) : <p className="tiny">This cover is the minimum found.</p>}
          <div className="ttx-stats">
            <span>Before {model.literalsBefore} literals, {model.termsBefore} terms</span>
            <span className="cut">After {model.literalsAfter} literals, {model.termsAfter} terms</span>
            <span>Gates {model.gatesBefore} → {model.gatesAfter}</span>
            <span>{model.reduction}% fewer literals</span>
          </div>
          {model.equivalent ? <p className="ttx-ok">Equivalent for all {fn.cells.filter((cell) => cell !== "X").length} defined input combinations.</p> : <p className="cwb-error">Mismatch on rows {model.mismatches.join(", ")}.</p>}
        </section>
        <section className="lgx-card">
          <h3>Step by Step</h3>
          <ol className="ttx-steps">
            {steps.map((step, index) => <li key={step}><b>{index + 1}</b><span>{step}</span></li>)}
          </ol>
        </section>
      </div>
    </div>
  );

  return (
    <div className="lgx ttx">
      <header className="lgx-head">
        <div className="lgx-title">
          <span className="lgx-mark"><Icon name="table" size={22} /></span>
          <div>
            <h1>Truth Tables & Logic Minimization</h1>
            <p>Edit one function. The table, K-map, expressions, and circuit stay in step.</p>
          </div>
        </div>
        <div className="lgx-actions">
          <div className="ttx-seg" role="group" aria-label="Workspace density">
            <button type="button" className={learn ? "on" : ""} onClick={() => setDensity("learn")}>Learn</button>
            <button type="button" className={!learn ? "on" : ""} onClick={() => setDensity("expert")}>Expert</button>
          </div>
          <button className="lgx-share" onClick={() => void navigator.clipboard?.writeText(window.location.href)}>Share</button>
          <button className="lgx-more" aria-label="More actions" onClick={() => setMenu((value) => !value)}>•••</button>
          {menu ? <div className="lgx-menu"><button onClick={() => { commit(STARTER); setManual([]); setMenu(false); }}>Reset example</button></div> : null}
          <Link to="/" className="lgx-back"><Icon name="back" size={14} /> Back to Path</Link>
        </div>
      </header>
      <div className="lgx-tabs" role="tablist">
        {VISIBLE.map((item) => (
          <button key={item.id} role="tab" aria-selected={view === item.id} className={view === item.id ? "on" : ""} onClick={() => visit(item.id)}>
            <Icon name={item.icon} size={14} /> {item.label}
          </button>
        ))}
      </div>
      {view === "from-expr" ? workbench : null}
      {view === "kmap" ? <section className="lgx-card ttx-focus"><KMapBoard names={fn.names} cells={fn.cells} groups={groups} hover={hover} activeMask={activeMask} manual={groupMode === "manual"} groupError={groupError} onHover={setHover} onCycle={editCell} onTogglePick={(index) => setPicked((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index])} onCreate={createGroup} /></section> : null}
      {view === "min" ? (
        <section className="lgx-card ttx-focus">
          <p className="ttx-formula">{model.sop.expression}</p>
          <ol className="ttx-steps">{steps.map((step, index) => <li key={step}><b>{index + 1}</b><span>{step}</span></li>)}</ol>
        </section>
      ) : null}
      {view === "circuits" ? <CircuitView expression={model.sop.expression} names={fn.names} values={values} title="Minimized SOP" onToggle={(name) => setSim((bits) => bits ^ (1 << (fn.names.length - 1 - fn.names.indexOf(name))))} /> : null}
      {view === "compare" ? (
        <section className="lgx-card">
          <div className="ttx-pair">
            <CircuitView expression={model.canonicalSop} names={fn.names} values={values} title="Canonical SOP" onToggle={(name) => setSim((bits) => bits ^ (1 << (fn.names.length - 1 - fn.names.indexOf(name))))} />
            <CircuitView expression={model.sop.expression} names={fn.names} values={values} title="Minimized SOP" onToggle={(name) => setSim((bits) => bits ^ (1 << (fn.names.length - 1 - fn.names.indexOf(name))))} />
          </div>
          <div className="ttx-stats">
            <span>Gates {model.gatesBefore} → {model.gatesAfter}</span>
            <span>Literals {model.literalsBefore} → {model.literalsAfter}</span>
            <span>Terms {model.termsBefore} → {model.termsAfter}</span>
          </div>
          {model.equivalent ? <p className="ttx-ok">Equivalent for all {fn.cells.filter((cell) => cell !== "X").length} defined input combinations.</p> : <p className="cwb-error">Mismatch on rows {model.mismatches.join(", ")}.</p>}
        </section>
      ) : null}
      {view === "practice" ? (
        <section className="lgx-card ttx-practice">
          <div className="ttx-seg">
            {(["Easy", "Medium", "Hard"] as const).map((item) => <button key={item} type="button" className={level === item ? "on" : ""} onClick={() => { setLevel(item); setProblem(0); setVerdict(""); setHintOn(false); setStepOn(false); setSolutionOn(false); }}>{item}</button>)}
          </div>
          <p>{exercise.prompt}</p>
          <label>Your minimized SOP
            <input aria-label="Practice answer" value={answer} onChange={(event) => setAnswer(event.target.value)} />
          </label>
          <div className="ttx-actions">
            <button type="button" onClick={() => setVerdict(answerMatches(answer, exercise.names, exercise.minterms, exercise.donts) ?? "Correct. That is a minimum.")}>Check Answer</button>
            <button type="button" onClick={() => setHintOn(true)}>Hint</button>
            <button type="button" onClick={() => setStepOn(true)}>Show Next Step</button>
            <button type="button" onClick={() => setSolutionOn(true)}>Reveal Solution</button>
            <button type="button" onClick={() => { setProblem((value) => value + 1); setAnswer(""); setVerdict(""); setHintOn(false); setStepOn(false); setSolutionOn(false); }}>Next</button>
          </div>
          {hintOn ? <p className="tiny">{exercise.hint}</p> : null}
          {stepOn ? <p className="tiny">{exercise.step}</p> : null}
          {solutionOn ? <p className="ttx-ok">{exercise.step}</p> : null}
          {verdict ? <p className={verdict.startsWith("Correct") ? "ttx-ok" : "cwb-error"}>{verdict}</p> : null}
        </section>
      ) : null}
      {view === "notes" ? (
        <section className="lgx-card lgx-focus">
          <h3><Icon name="book" size={16} /> Notes</h3>
          <textarea aria-label="Truth table notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Write the grouping you used." />
        </section>
      ) : null}
      {learn && view === "from-expr" ? (
        <section className="lgx-card">
          <button type="button" className="twb-fold" aria-expanded={open.takes} onClick={() => setOpen((current) => ({ ...current, takes: !current.takes }))}>Key Takeaways</button>
          {open.takes ? <ul className="cmb-takes"><li>A don't care may join a group, and it is never required to be 1.</li><li>Essential implicants are the only cover for at least one minterm.</li><li>Two different sums can both be minimal. The chart shows which primes you still have to choose.</li></ul> : null}
        </section>
      ) : null}
    </div>
  );
}

function CopyRow({ label, text, id, copied, onCopy }: { label: string; text: string; id: string; copied: string; onCopy: (id: string, text: string) => void }) {
  return (
    <p className="twb-copyline">
      <span>{label}</span>
      <b>{text}</b>
      <button type="button" onClick={() => onCopy(id, text)}>{copied === id ? "Copied" : "Copy"}</button>
    </p>
  );
}
