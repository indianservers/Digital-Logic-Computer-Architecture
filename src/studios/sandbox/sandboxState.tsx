import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AluOp } from "../../engines/digital/arithmetic";
import { aluNum } from "../../engines/builder/sim";
import {
  bn,
  breakpointHit,
  cacheRead,
  connectCircuit,
  cpuStep,
  DEBUG_PROGRAM,
  HISTORY_PROGRAM,
  demoCpu,
  demoHistory,
  demoMesi,
  emptyCache,
  evaluateCircuit,
  fullAdderCircuit,
  hx,
  LIBRARY,
  mesiAccess,
  PAGES,
  readHex,
  rippleCircuit,
  SIMPLE_PROGRAM,
  type Circuit,
  type CpuSnapshot,
  type Part,
  type PartKind,
  type SandboxBreakpoint,
  type SandboxPage,
} from "./sandboxModel";
export function useSandboxState(page: SandboxPage) {
  const navigate = useNavigate();
  const [circuit, setCircuit] = useState<Circuit>(rippleCircuit),
    [past, setPast] = useState<Circuit[]>([]),
    [future, setFuture] = useState<Circuit[]>([]),
    [a, setA] = useState(5),
    [b, setB] = useState(3),
    [cin, setCin] = useState(0),
    [selected, setSelected] = useState("FA1"),
    [tool, setTool] = useState("Select"),
    [connection, setConnection] = useState<{
      from: string;
      out: string;
    } | null>(null),
    [zoom, setZoom] = useState(100),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [search, setSearch] = useState(""),
    [workspace, setWorkspace] = useState("Build"),
    [running, setRunning] = useState(false),
    [speed, setSpeed] = useState(1),
    [tick, setTick] = useState(0),
    [notice, setNotice] = useState(""),
    [saveState, setSaveState] = useState("Saved"),
    [bottom, setBottom] = useState(""),
    [showPins, setShowPins] = useState(true),
    [testResult, setTestResult] = useState<{
      pass: boolean;
      count: number;
      message: string;
    } | null>(null),
    [projectName, setProjectName] = useState("");
  const [operandA, setOperandA] = useState(5),
    [operandB, setOperandB] = useState(3),
    [operation, setOperation] = useState<AluOp>("ADD"),
    [reg3, setReg3] = useState(8),
    [micro, setMicro] = useState(1),
    [writeback, setWriteback] = useState(true),
    [width, setWidth] = useState(8),
    [signed, setSigned] = useState(false),
    [libItem, setLibItem] = useState("8-bit ALU"),
    [extraPorts, setExtraPorts] = useState<string[]>([]),
    [libTests, setLibTests] = useState<
      {
        operation: string;
        a: number;
        b: number;
        y: number;
        expected: number;
        pass: boolean;
      }[]
    >([]);
  const [cache, setCache] = useState(
      () => cacheRead(emptyCache(), 32, 4).cache,
    ),
    [cacheLines, setCacheLines] = useState(8),
    [blockSize, setBlockSize] = useState(4),
    [address, setAddress] = useState("0x0024"),
    [accesses, setAccesses] = useState<
      {
        address: number;
        hit: boolean;
        index: number;
        tag: number;
        data: number[];
        kind: string;
      }[]
    >([
      {
        address: 32,
        hit: false,
        index: 0,
        tag: 1,
        data: [58, 127, 17, 144],
        kind: "Compulsory miss",
      },
    ]),
    [sequence, setSequence] = useState(["0x0020", "0x0024", "0x0020"]),
    [accessCursor, setAccessCursor] = useState(1);
  const [mesi, setMesi] = useState(demoMesi),
    [coreAddress, setCoreAddress] = useState(["0x1000", "0x1000"]),
    [coreValue, setCoreValue] = useState(["0x2B", "0x2A"]),
    [coreOp, setCoreOp] = useState<("read" | "write")[]>(["write", "read"]),
    [mesiLog, setMesiLog] = useState([
      {
        cycle: 0,
        core: 0,
        op: "Read",
        address: 4096,
        value: 42,
        bus: "Cache miss → BusRd → Memory → Core 0 (state: S)",
      },
      {
        cycle: 1,
        core: 1,
        op: "Read",
        address: 4096,
        value: 42,
        bus: "BusRd (snoop hit in Core 0) → Core 1 (state: S)",
      },
      {
        cycle: 2,
        core: 0,
        op: "Write",
        address: 4096,
        value: 43,
        bus: "BusUpgr → Invalidate Core 1 → Core 0 (state: M), Core 1 (state: I)",
      },
    ]);
  const [program, setProgram] = useState(
      page === "breaks"
        ? DEBUG_PROGRAM
        : page === "history"
          ? HISTORY_PROGRAM
          : SIMPLE_PROGRAM,
    ),
    [cpu, setCpu] = useState(() =>
      page === "history"
        ? demoHistory().at(-1)!.cpu
        : demoCpu(page === "breaks"),
    ),
    [stage, setStage] = useState(4),
    [history, setHistory] = useState<CpuSnapshot[]>(demoHistory),
    [historyIndex, setHistoryIndex] = useState(6),
    [historical, setHistorical] = useState(true),
    [breakpoints, setBreakpoints] = useState<SandboxBreakpoint[]>([
      { id: "pc", enabled: true, signal: "PC", operator: "==", value: 6 },
      {
        id: "write",
        enabled: true,
        signal: "Memory write",
        operator: "==",
        value: 32,
      },
      { id: "reg", enabled: true, signal: "R3", operator: "==", value: 8 },
    ]),
    [breakSignal, setBreakSignal] = useState<SandboxBreakpoint["signal"]>("PC"),
    [breakOperator, setBreakOperator] =
      useState<SandboxBreakpoint["operator"]>("=="),
    [breakValue, setBreakValue] = useState("0x00000000"),
    [pausedReason, setPausedReason] = useState("Write watchpoint at 0x20"),
    [ignoreBreak, setIgnoreBreak] = useState(false);
  const [counter, setCounter] = useState(6),
    [counterSamples, setCounterSamples] = useState(
      Array.from({ length: 10 }, (_, i) => i % 16),
    ),
    [probes, setProbes] = useState([
      "CLK",
      "Q0",
      "Q1",
      "Q2",
      "Q3",
      "count[3:0]",
    ]),
    [hiddenProbes, setHiddenProbes] = useState<string[]>([]),
    [selectedProbe, setSelectedProbe] = useState("count[3:0]"),
    [trigger, setTrigger] = useState(6),
    [triggerEnabled, setTriggerEnabled] = useState(true),
    [cursorA, setCursorA] = useState(2),
    [cursorB, setCursorB] = useState(6),
    [probeName, setProbeName] = useState("count[3:0]"),
    [probeRadix, setProbeRadix] = useState("Hexadecimal"),
    [templateIndex, setTemplateIndex] = useState(0),
    [templateA, setTemplateA] = useState(1),
    [templateB, setTemplateB] = useState(1),
    [templateCin, setTemplateCin] = useState(0);
  const [templateGateLabel, setTemplateGateLabel] = useState("XOR1"),
    [templateDelay, setTemplateDelay] = useState(1);
  const drag = useRef<{
    id: string;
    x: number;
    y: number;
    px: number;
    py: number;
  } | null>(null);
  const pageRef = useRef(page);
  const loaded = useRef(false);
  const graph = evaluateCircuit(circuit, a, b, cin);
  const arithmetic = aluNum(operandA, operandB, operation, width);
  const selectedPart = circuit.parts.find((p) => p.id === selected);
  const currentAddress = readHex(address) ?? 36;
  const activePage = PAGES.find((p) => p.id === page)!;
  function go(next: SandboxPage) {
    setRunning(false);
    setNotice("");
    setSearch("");
    setBottom("");
    setConnection(null);
    setProjectName("");
    navigate(`/architecture/sandbox/${next}`);
  }
  useEffect(() => {
    if (pageRef.current === page) return;
    pageRef.current = page;
    setRunning(false);
    setConnection(null);
    setZoom(100);
    setPan({ x: 0, y: 0 });
    if (page === "breaks" || page === "history") {
      setCpu(page === "history" ? demoHistory().at(-1)!.cpu : demoCpu(true));
      setProgram(page === "history" ? HISTORY_PROGRAM : DEBUG_PROGRAM);
      setStage(3);
      setHistory(demoHistory());
      setHistoryIndex(6);
      setHistorical(page === "history");
      setPausedReason(page === "breaks" ? "Write watchpoint at 0x20" : "");
    } else if (page === "cpu") {
      setCpu(demoCpu());
      setProgram(SIMPLE_PROGRAM);
      setStage(4);
    }
    setSelected(
      page === "circuit"
        ? circuit.parts.some((p) => p.id === "FA1")
          ? "FA1"
          : (circuit.parts[0]?.id ?? "")
        : page === "datapath"
          ? "ALU"
          : page === "multicore"
            ? "Core 0"
            : "",
    );
  }, [page]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("architecture-sandbox-project-v3");
      if (raw) {
        const saved = JSON.parse(raw) as { circuit: Circuit };
        if (
          saved.circuit?.parts?.every(
            (p) =>
              typeof p.id === "string" &&
              Number.isFinite(p.x) &&
              Number.isFinite(p.y),
          ) &&
          saved.circuit?.wires
        )
          setCircuit(saved.circuit);
      }
    } catch {
      setNotice("Saved project could not be loaded; opened a fresh adder.");
    }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    setSaveState("Saving…");
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(
          "architecture-sandbox-project-v3",
          JSON.stringify({ circuit }),
        );
        setSaveState("Saved");
      } catch {
        setSaveState("Save unavailable");
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [circuit]);
  function updateCircuit(next: Circuit, record = true) {
    if (record) {
      setPast((p) => [...p.slice(-39), circuit]);
      setFuture([]);
    }
    setCircuit(next);
    setTestResult(null);
  }
  function undo() {
    const last = past[past.length - 1];
    if (!last) return;
    setFuture((f) => [circuit, ...f]);
    setPast((p) => p.slice(0, -1));
    setCircuit(last);
  }
  function redo() {
    const next = future[0];
    if (!next) return;
    setPast((p) => [...p, circuit]);
    setFuture((f) => f.slice(1));
    setCircuit(next);
  }
  function patchPart(id: string, patch: Partial<Part>, record = true) {
    updateCircuit(
      {
        ...circuit,
        parts: circuit.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      },
      record,
    );
  }
  function removePart(id = selected) {
    updateCircuit({
      parts: circuit.parts.filter((p) => p.id !== id),
      wires: circuit.wires.filter((w) => w.from !== id && w.to !== id),
    });
    setSelected("");
  }
  function insertPart(kind: PartKind, x = 380, y = 480) {
    const item = LIBRARY.find((p) => p.kind === kind);
    const id = `${kind}-${Date.now()}`;
    const part: Part = {
      id,
      kind,
      label: item?.label ?? kind,
      x,
      y,
      delay: 1,
      width: ["alu", "register", "memory", "mux"].includes(kind) ? 8 : 1,
      value: 0,
      op: "ADD",
    };
    updateCircuit({ ...circuit, parts: [...circuit.parts, part] });
    setSelected(id);
    setNotice(
      `${part.label} inserted. Drag to position; use Wire to connect ports.`,
    );
  }
  function portClick(id: string, port: string, output: boolean) {
    if (tool === "Probe") {
      if (!probes.includes(`${id}.${port}`))
        setProbes((p) => [...p, `${id}.${port}`]);
      setNotice(`Probe attached to ${id}.${port}`);
      return;
    }
    if (tool !== "Wire") {
      setSelected(id);
      return;
    }
    if (output) {
      setConnection({ from: id, out: port });
      setNotice(`Choose an input port to connect ${id}.${port}.`);
    } else if (connection) {
      const result = connectCircuit(
        circuit,
        connection.from,
        connection.out,
        id,
        port,
      );
      if (result.error) setNotice(result.error);
      else {
        updateCircuit(result.circuit);
        setNotice("Connection added.");
      }
      setConnection(null);
    }
  }
  function testCircuit() {
    let count = 0;
    const bits = circuit.parts.some((p) => p.id === "Sum") ? 1 : 4,
      limit = 1 << bits,
      mask = limit - 1;
    for (let aa = 0; aa < limit; aa++)
      for (let bb = 0; bb < limit; bb++)
        for (let cc = 0; cc < 2; cc++) {
          const output = evaluateCircuit(circuit, aa, bb, cc);
          if (
            output.sum !== ((aa + bb + cc) & mask) ||
            output.carry !== (aa + bb + cc) >>> bits
          ) {
            setTestResult({
              pass: false,
              count,
              message: `Failed at A=${aa}, B=${bb}, Cin=${cc}. Check the wiring.`,
            });
            return;
          }
          count++;
        }
    setTestResult({
      pass: true,
      count,
      message: `All ${count} input combinations passed.`,
    });
  }
  function readMemory() {
    const addr = readHex(address);
    if (addr === null) {
      setNotice("Enter a valid 16-bit address.");
      return;
    }
    const result = cacheRead(cache, addr, blockSize);
    setCache(result.cache);
    setAccesses((items) => [
      ...items.slice(-39),
      {
        address: addr,
        hit: result.hit,
        index: result.index,
        tag: result.tag,
        data: result.data,
        kind: result.kind,
      },
    ]);
    setNotice(`${result.kind}: ${hx(addr, 4)} → cache line ${result.index}`);
    const next = (accessCursor + 1) % sequence.length;
    setAccessCursor(next);
    setTick((t) => t + 1);
  }
  function rewindMemory() {
    const previous = accesses.slice(0, -1);
    let rebuilt = emptyCache(cacheLines);
    for (const access of previous)
      rebuilt = cacheRead(rebuilt, access.address, blockSize).cache;
    setCache(rebuilt);
    setAccesses(previous);
    setAccessCursor((i) => (i + sequence.length - 1) % sequence.length);
    setAddress(
      hx(previous.at(-1)?.address ?? readHex(sequence[0] ?? "0") ?? 0, 4),
    );
    setTick((t) => Math.max(0, t - 1));
  }
  function nextMemory() {
    const addr = readHex(sequence[accessCursor] ?? address);
    if (addr === null) {
      setNotice("Invalid address in access sequence.");
      setRunning(false);
      return;
    }
    const result = cacheRead(cache, addr, blockSize);
    setCache(result.cache);
    setAddress(hx(addr, 4));
    setAccesses((items) => [
      ...items.slice(-39),
      {
        address: addr,
        hit: result.hit,
        index: result.index,
        tag: result.tag,
        data: result.data,
        kind: result.kind,
      },
    ]);
    setAccessCursor((i) => (i + 1) % sequence.length);
    setTick((t) => t + 1);
  }
  function transact(core: number) {
    const addr = readHex(coreAddress[core] ?? ""),
      value = readHex(coreValue[core] ?? "", 255);
    if (addr === null || value === null) {
      setNotice("Enter a valid 16-bit address and 8-bit value.");
      return;
    }
    const next = mesiAccess(mesi, core, coreOp[core]!, addr, value);
    setMesi(next);
    setMesiLog((l) => [
      ...l.slice(-39),
      {
        cycle: l.length,
        core,
        op: coreOp[core] === "write" ? "Write" : "Read",
        address: addr,
        value: next.cores[core]!.value,
        bus: `${next.bus} → Core ${core} (${next.cores[core]!.state})`,
      },
    ]);
    setSelected(`Core ${core}`);
    setTick((t) => t + 1);
  }
  function commitInstruction(force = false) {
    try {
      if (cpu.halted) {
        setRunning(false);
        setNotice("CPU halted. Reset to run again.");
        return;
      }
      if (page === "breaks" && !force && !ignoreBreak) {
        const hit = breakpointHit(cpu, program, breakpoints);
        if (hit) {
          setPausedReason(`${hit.signal} ${hit.operator} ${hx(hit.value)}`);
          setRunning(false);
          setWorkspace("Debug");
          return;
        }
      }
      const next = cpuStep(cpu, program);
      setCpu(next);
      setHistory((h) => [
        ...h.slice(-63),
        {
          cycle: next.cycle,
          cpu: next,
          event: next.lastWrite ? "Write Memory" : "Write Back",
          instruction: next.last,
        },
      ]);
      setPausedReason("");
      setIgnoreBreak(false);
      if (next.halted) {
        setRunning(false);
        setNotice("HALT reached.");
      }
      setTick((t) => t + 1);
    } catch (error) {
      setRunning(false);
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }
  function step() {
    setTick((t) => t + 1);
    if (page === "circuit") {
      const next = (a + 1) & 15;
      setA(next);
      setCircuit((c) => ({
        ...c,
        parts: c.parts.map((p) =>
          p.kind === "clock"
            ? { ...p, value: p.value ? 0 : 1 }
            : p.kind === "counter"
              ? { ...p, value: (p.value + 1) & 15 }
              : p.kind === "register"
                ? {
                    ...p,
                    value: (() => {
                      const w = c.wires.find(
                        (w) => w.to === p.id && w.input === "A",
                      );
                      return w
                        ? (graph.output(w.from, w.out) ?? p.value)
                        : p.value;
                    })(),
                  }
                : p,
        ),
      }));
    } else if (page === "datapath") {
      const next = (micro + 1) % 3;
      setMicro(next);
      if (next === 2) {
        if (writeback) setReg3(arithmetic.y);
        else {
          setNotice("Writeback is disconnected. Connect ALU.Y to MUX input 0.");
          setRunning(false);
        }
      }
    } else if (page === "memory") nextMemory();
    else if (page === "multicore") transact(tick % 2);
    else if (page === "cpu" || page === "breaks") {
      const next = (stage + 1) % 5;
      setStage(next);
      if (next === 4) commitInstruction();
    } else if (page === "history") {
      if (historical) {
        setHistoryIndex((i) => Math.min(history.length - 1, i + 1));
      } else commitInstruction(true);
    } else if (page === "probes") {
      const next = (counter + 1) & 15;
      setCounter(next);
      setCounterSamples((samples) => [...samples.slice(-31), next]);
      setCursorB(counterSamples.length);
      if (triggerEnabled && next === trigger) {
        setRunning(false);
        setNotice(`Trigger: count == ${trigger}`);
      }
    } else if (page === "library") runLibraryTests();
    else {
      setTemplateA((templateA + 1) & 1);
      if (templateA === 1) setTemplateB((templateB + 1) & 1);
    }
  }
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => stepRef.current(), 650 / speed);
    return () => window.clearInterval(timer);
  }, [running, speed]);
  function reset() {
    setRunning(false);
    setTick(0);
    setNotice("");
    setPausedReason("");
    setA(5);
    setB(3);
    setCin(0);
    setMicro(0);
    setCounter(0);
    setCounterSamples([0]);
    setCursorB(0);
    setStage(0);
    setCpu({
      ...demoCpu(page === "breaks" || page === "history"),
      pc: 0,
      cycle: 0,
      registers: Array<number>(32).fill(0),
      memory: {},
      halted: false,
    });
    setCache(emptyCache(cacheLines));
    setAccesses([]);
    setAccessCursor(0);
    setMesi({
      ...demoMesi(),
      cores: [
        { state: "I", address: 4096, value: 0 },
        { state: "I", address: 4096, value: 0 },
      ],
      memory: { 4096: 42 },
      bus: "Idle",
      previous: ["I", "I"],
    });
    setMesiLog([]);
  }
  function runLibraryTests() {
    const result1 = aluNum(operandA, operandB, operation, width),
      result2 = aluNum(operandA, operandB, "AND", width);
    setLibTests([
      {
        operation,
        a: operandA,
        b: operandB,
        y: result1.y,
        expected: expectedAlu(operandA, operandB, operation, width),
        pass: result1.y === expectedAlu(operandA, operandB, operation, width),
      },
      {
        operation: "AND",
        a: operandA,
        b: operandB,
        y: result2.y,
        expected: operandA & operandB,
        pass: result2.y === (operandA & operandB),
      },
    ]);
    setNotice("Component tests completed.");
  }
  function addBreakpoint() {
    const value = readHex(breakValue);
    if (value === null) {
      setNotice("Invalid breakpoint value.");
      return;
    }
    setBreakpoints((p) => [
      ...p,
      {
        id: `bp${Date.now()}`,
        signal: breakSignal,
        operator: breakOperator,
        value,
        enabled: true,
      },
    ]);
  }
  function branchHistory() {
    const item = history[historyIndex];
    if (!item) return;
    setCpu(structuredClone(item.cpu));
    setHistory((h) => h.slice(0, historyIndex + 1));
    setHistorical(false);
    setNotice(
      `Branched from cycle ${item.cycle}. New execution uses this snapshot.`,
    );
  }
  function exportTrace() {
    const rows = [
      "cycle,clock,Q0,Q1,Q2,Q3,count",
      ...counterSamples.map(
        (n, i) =>
          `${i},${i % 2},${n & 1},${(n >> 1) & 1},${(n >> 2) & 1},${(n >> 3) & 1},${n}`,
      ),
    ];
    download("sandbox-trace.csv", rows.join("\n"), "text/csv");
  }
  function download(name: string, content: string, type = "application/json") {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function loadTemplate(index = templateIndex) {
    if (index === 1) {
      setCircuit(rippleCircuit());
      go("circuit");
    } else if (index === 2) go("probes");
    else if (index === 3) go("cpu");
    else if (index === 4) go("memory");
    else if (index === 5) go("multicore");
    else {
      setCircuit(fullAdderCircuit(templateGateLabel, templateDelay));
      setA(1);
      setB(1);
      setCin(0);
      go("circuit");
      setProjectName("1-bit Full Adder");
    }
    setNotice(
      "Editable template loaded. Every component and wire can be changed.",
    );
  }
  return {
    templateGateLabel,
    setTemplateGateLabel,
    templateDelay,
    setTemplateDelay,
    rewindMemory,
    loadTemplate,
    page,
    go,
    activePage,
    circuit,
    setCircuit,
    updateCircuit,
    patchPart,
    removePart,
    insertPart,
    past,
    future,
    undo,
    redo,
    a,
    setA,
    b,
    setB,
    cin,
    setCin,
    selected,
    setSelected,
    selectedPart,
    tool,
    setTool,
    connection,
    setConnection,
    portClick,
    zoom,
    setZoom,
    pan,
    setPan,
    search,
    setSearch,
    workspace,
    setWorkspace,
    running,
    setRunning,
    speed,
    setSpeed,
    tick,
    setTick,
    step,
    reset,
    notice,
    setNotice,
    saveState,
    bottom,
    setBottom,
    showPins,
    setShowPins,
    testResult,
    testCircuit,
    graph,
    projectName,
    setProjectName,
    drag,
    operandA,
    setOperandA,
    operandB,
    setOperandB,
    operation,
    setOperation,
    arithmetic,
    reg3,
    setReg3,
    micro,
    setMicro,
    writeback,
    setWriteback,
    width,
    setWidth,
    signed,
    setSigned,
    libItem,
    setLibItem,
    extraPorts,
    setExtraPorts,
    libTests,
    runLibraryTests,
    cache,
    setCache,
    cacheLines,
    setCacheLines,
    blockSize,
    setBlockSize,
    address,
    setAddress,
    currentAddress,
    accesses,
    setAccesses,
    sequence,
    setSequence,
    accessCursor,
    setAccessCursor,
    readMemory,
    nextMemory,
    mesi,
    setMesi,
    coreAddress,
    setCoreAddress,
    coreValue,
    setCoreValue,
    coreOp,
    setCoreOp,
    mesiLog,
    setMesiLog,
    transact,
    program,
    setProgram,
    cpu,
    setCpu,
    stage,
    setStage,
    history,
    setHistory,
    historyIndex,
    setHistoryIndex,
    historical,
    setHistorical,
    commitInstruction,
    breakpoints,
    setBreakpoints,
    breakSignal,
    setBreakSignal,
    breakOperator,
    setBreakOperator,
    breakValue,
    setBreakValue,
    addBreakpoint,
    pausedReason,
    setPausedReason,
    ignoreBreak,
    setIgnoreBreak,
    branchHistory,
    counter,
    setCounter,
    counterSamples,
    setCounterSamples,
    probes,
    setProbes,
    hiddenProbes,
    setHiddenProbes,
    selectedProbe,
    setSelectedProbe,
    trigger,
    setTrigger,
    triggerEnabled,
    setTriggerEnabled,
    cursorA,
    setCursorA,
    cursorB,
    setCursorB,
    probeName,
    setProbeName,
    probeRadix,
    setProbeRadix,
    exportTrace,
    download,
    templateIndex,
    setTemplateIndex,
    templateA,
    setTemplateA,
    templateB,
    setTemplateB,
    templateCin,
    setTemplateCin,
    bn,
    hx,
  };
}
export const SandboxContext = createContext<ReturnType<
  typeof useSandboxState
> | null>(null);
export function useSandbox() {
  const context = useContext(SandboxContext);
  if (!context) throw new Error("Sandbox context is missing");
  return context;
}

function expectedAlu(a: number, b: number, op: string, width: number) {
  const mask = (1 << width) - 1;
  const n =
    op === "ADD"
      ? a + b
      : op === "SUB"
        ? a - b
        : op === "AND"
          ? a & b
          : op === "OR"
            ? a | b
            : op === "XOR"
              ? a ^ b
              : op === "SHL"
                ? a << 1
                : a >>> 1;
  return n & mask;
}
