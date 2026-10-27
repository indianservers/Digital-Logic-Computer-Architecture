import { base, check, copy, event, metric, milliseconds, num, range, sample, select, toggle, yes, type Model, type Params, type Simulation } from "./model";

export const fsm: Model = {
  number: 45, subtitle: "Explicit states drive interlocked outputs.", objective: "Sequence safe traffic phases, latch pedestrian demand, and inject an interlock fault.",
  defaults: { green: 1000, yellow: 300, clearance: 200, emergency: false, interlock: true }, controls: [range("green", "Green duration", 200, 2000, 100, "ms"), range("yellow", "Yellow duration", 100, 500, 50, "ms"), range("clearance", "All-red clearance", 100, 500, 50, "ms"), toggle("emergency", "Emergency stop", true), toggle("interlock", "Output interlock enabled")], stepMs: 50,
  plots: [{ label: "NS green", min: 0, max: 1 }, { label: "EW green", min: 0, max: 1 }, { label: "Crossing request", min: 0, max: 1 }],
  create: () => base({ state: 0, elapsed: 0, cycles: 0, pedestrian: 0, served: 0, violations: 0, ns: 0, ew: 0 }),
  step: (s, p, ms) => milliseconds(s, p, ms, (o, cfg) => {
    const v = o.values, states = ["ALL RED → NS", "NS GREEN", "NS YELLOW", "ALL RED → EW", "EW GREEN", "EW YELLOW"], durations = [num(cfg, "clearance"), num(cfg, "green"), num(cfg, "yellow"), num(cfg, "clearance"), num(cfg, "green"), num(cfg, "yellow")];
    if (yes(cfg, "emergency")) { v.state = 0; v.elapsed = 0; v.ns = 0; v.ew = 0; o.phase = "Emergency: all red"; sample(o, 0, 0, v.pedestrian!); return; }
    v.elapsed!++;
    if (v.elapsed! >= durations[v.state!]!) { const prev = v.state!; v.state = (prev + 1) % 6; v.elapsed = 0; if (v.state === 0) v.cycles!++; if ((v.state === 0 || v.state === 3) && v.pedestrian) { v.pedestrian = 0; v.served!++; event(o, "Crossing service", "Demand serviced during all-red clearance"); } event(o, "FSM transition", states[prev] + " → " + states[v.state]); }
    v.ns = +(v.state === 1); v.ew = +(v.state === 4);
    if (!yes(cfg, "interlock") && (v.state === 1 || v.state === 4) && v.elapsed! < 20) { v.ns = 1; v.ew = 1; v.violations!++; }
    o.phase = states[v.state!]!; sample(o, v.ns!, v.ew!, v.pedestrian!);
  }),
  actions: [{ id: "pedestrian", label: "Request crossing" }], action: (s) => { const o = copy(s); o.values.pedestrian = 1; event(o, "Pedestrian button", "Demand latched until clearance"); return o; },
  metrics: (s) => [metric("State", s.phase), metric("Full cycles", s.values.cycles!), metric("Demand served", s.values.served!), metric("Unsafe overlap", s.values.violations!, "ms"), metric("NS / EW green", s.values.ns + " / " + s.values.ew)],
  checks: (s) => [check("Run a full cycle", s.values.cycles! > 0, "Run through both approaches and clearance phases."), check("Serve a pedestrian request", s.values.served! > 0, "Request a crossing during green."), check("Prevent conflicting outputs", s.values.cycles! > 0 && s.values.violations === 0, "Enable the output interlock.")],
  guide: ["Observe GPIO transitions through a full cycle.", "Request a crossing during green.", "Assert emergency and confirm both green outputs drop.", "Reset without the interlock and measure overlap."], expected: "One approach is green at a time; requests wait for all-red clearance; emergency forces all-red.", equation: "Invariant: NOT (NS_GREEN AND EW_GREEN)", limitation: "Teaching controller only. Disabling the interlock deliberately injects 20 ms conflicting outputs at green transitions.", presets: [{ label: "Safe controller", params: { interlock: true } }, { label: "Interlock fault", params: { interlock: false } }],
};

function scheduleTick(o: Simulation, cfg: Params, preemptive: boolean) {
  const v = o.values, periods = [20, num(cfg, "period"), 50], costs = [2, num(cfg, "cost"), 4];
  for (const job of o.jobs) if (!job.missed && o.time >= job.deadline && job.remaining > 0) { job.missed = true; v.misses!++; event(o, "Deadline missed", "T" + (job.task + 1) + "; job " + job.id); }
  for (let task = 0; task < 3; task++) if (o.time % periods[task]! === 0) { const job = { id: v.nextId!++, task, released: o.time, deadline: o.time + periods[task]!, remaining: costs[task]!, missed: false }; o.jobs.push(job); v.releases!++; event(o, "Task release", "T" + (task + 1) + ", deadline " + job.deadline + " ms"); }
  if (o.jobs.length > 200) { o.finished = true; o.phase = "Overload: 200 pending jobs"; event(o, "Overload stop", o.phase); return; }
  const previous = o.jobs.find((job) => job.id === v.running), roundRobin = cfg.policy === "Round robin";
  let picked = previous;
  if (!previous || (preemptive && !roundRobin)) picked = [...o.jobs].sort((a, b) => a.task - b.task || a.released - b.released)[0];
  if (preemptive && roundRobin && (!previous || v.quantum! >= num(cfg, "quantum"))) { const ready = [...o.jobs].sort((a, b) => a.task - b.task || a.released - b.released); picked = ready.find((job) => job.task > v.lastTask!) ?? ready[0]; v.quantum = 0; }
  if (picked) {
    if (previous && previous.id !== picked.id) { v.preemptions!++; event(o, "Preemption", "T" + (previous.task + 1) + " → T" + (picked.task + 1)); }
    v.running = picked.id; v.lastTask = picked.task; v.quantum!++; picked.remaining--; v.busy!++;
    if (!picked.remaining) { v.completed!++; v["done" + picked.task] = (v["done" + picked.task] ?? 0) + 1; v.maxResponse = Math.max(v.maxResponse!, o.time + 1 - picked.released); event(o, "Task complete", "T" + (picked.task + 1) + "; response " + (o.time + 1 - picked.released) + " ms"); o.jobs = o.jobs.filter((job) => job.id !== picked.id); v.running = -1; v.quantum = 0; }
    o.phase = "T" + (picked.task + 1) + " executing"; sample(o, +(picked.task === 0), +(picked.task === 1), +(picked.task === 2));
  } else { o.phase = "Idle"; v.running = -1; sample(o, 0, 0, 0); }
}

function scheduler(number: number, preemptive: boolean): Model {
  return {
    number, subtitle: preemptive ? "Ready queues and preemption under a fixed tick." : "Periodic work shares one cooperative CPU.", objective: "Measure execution budgets, response times, deadline misses, and scheduling decisions.",
    defaults: { period: 10, cost: 3, policy: "Fixed priority", quantum: 2 }, controls: [range("period", "T2 sample period", 5, 30, 1, "ms"), range("cost", "T2 execution budget", 1, 20, 1, "ms"), ...(preemptive ? [select("policy", "Scheduling policy", ["Fixed priority", "Round robin"]), range("quantum", "Round-robin quantum", 1, 5, 1, "ms")] : [])], stepMs: 1,
    plots: [{ label: "T1 LED", min: 0, max: 1 }, { label: "T2 sample", min: 0, max: 1 }, { label: "T3 log", min: 0, max: 1 }],
    create: () => base({ nextId: 0, running: -1, lastTask: -1, quantum: 0, releases: 0, completed: 0, misses: 0, busy: 0, maxResponse: 0, preemptions: 0, done0: 0, done1: 0, done2: 0 }),
    step: (s, p, ms) => milliseconds(s, p, ms, (o, cfg) => scheduleTick(o, cfg, preemptive)),
    metrics: (s, p) => [metric("CPU demand", ((2 / 20 + num(p, "cost") / num(p, "period") + 4 / 50) * 100).toFixed(1), "%"), metric("Completed jobs", s.values.completed!), metric("Deadline misses", s.values.misses!), metric("Max response", s.values.maxResponse!, "ms"), metric("Preemptions", s.values.preemptions!), metric("Pending jobs", s.jobs.length)],
    checks: (s) => [check("Observe at least 100 ms", s.time >= 100, "Compare multiple releases of every periodic task."), check("Complete all three task types", [0, 1, 2].every((task) => s.values["done" + task]! > 0), "T1 = 2/20 ms; T2 configurable; T3 = 4/50 ms."), check("Meet deadlines", s.time >= 100 && s.values.misses === 0, "Reduce T2 execution time or increase its period. Utilization alone does not guarantee deadlines.")],
    guide: ["Step through release, selection, and completion.", "Run 100 ms and inspect response times.", "Increase T2 execution cost to create overload.", preemptive ? "Compare fixed priority with round-robin slices." : "Observe a long cooperative job delaying newly ready work."], expected: preemptive ? "T1 has highest priority; ready higher-priority work preempts lower-priority work. Round-robin rotates ready tasks." : "A cooperative job completes before another can run. Long jobs block shorter-period work.", equation: "CPU demand U = Σ execution time / period", limitation: "One CPU, 1 ms tick, zero switch overhead, implicit deadlines, bounded 200-job queue. These are scheduler models, not an RTOS binary.", presets: [{ label: "Schedulable", params: { cost: 3, period: 10 } }, { label: "Overloaded", params: { cost: 15, period: 10 } }],
  };
}
export const cooperative = scheduler(46, false);
export const rtos = scheduler(47, true);

export const synchronization: Model = {
  number: 48, subtitle: "A read–modify–write spans multiple instructions.", objective: "Reproduce lost updates, then serialize access with a mutex or binary semaphore.",
  defaults: { primitive: "None", iterations: 4, capacity: 1, release: true }, controls: [select("primitive", "Primitive", ["None", "Mutex", "Semaphore"]), range("iterations", "Increments per task", 2, 10), range("capacity", "Semaphore capacity", 1, 2), toggle("release", "Release resource after write")], stepMs: 1,
  plots: [{ label: "Task A running", min: 0, max: 1 }, { label: "Task B running", min: 0, max: 1 }, { label: "Resource occupancy", min: 0, max: 2 }],
  create: () => base({ counter: 0, operations: 0, aStage: 0, bStage: 0, aDone: 0, bDone: 0, aRead: 0, bRead: 0, aHeld: 0, bHeld: 0, turn: 0, occupied: 0, blocked: 0 }, [0]),
  step: (s, p, ms) => milliseconds(s, p, ms, (o, cfg) => {
    const v = o.values, limit = num(cfg, "iterations"), capacity = cfg.primitive === "Mutex" ? 1 : num(cfg, "capacity"), protectedAccess = cfg.primitive !== "None";
    if (v.aDone! >= limit && v.bDone! >= limit) { o.finished = true; o.phase = "Both workers complete"; return; }
    let chosen = -1;
    for (let attempt = 0; attempt < 2; attempt++) { const task = (v.turn! + attempt) % 2, k = task === 0 ? "a" : "b"; if (v[k + "Done"]! >= limit) continue; if (v[k + "Stage"] === 0 && protectedAccess && v.occupied! >= capacity) continue; chosen = task; break; }
    if (chosen < 0) { v.blocked!++; o.phase = "Blocked: resource not released"; sample(o, 0, 0, v.occupied!); if (v.blocked! >= 3) { o.finished = true; event(o, "Deadlock", "No runnable worker can acquire the resource"); } return; }
    const k = chosen === 0 ? "a" : "b"; v.turn = 1 - chosen;
    if (v[k + "Stage"] === 0) { if (protectedAccess) { v.occupied!++; v[k + "Held"] = 1; } v[k + "Read"] = v.counter!; v[k + "Stage"] = 1; event(o, "READ", k.toUpperCase() + " local ← " + v.counter); }
    else { v.counter = v[k + "Read"]! + 1; v.operations!++; v[k + "Done"]!++; v[k + "Stage"] = 0; if (protectedAccess && yes(cfg, "release")) { v.occupied!--; v[k + "Held"] = 0; } event(o, "WRITE", k.toUpperCase() + " shared ← " + v.counter); }
    o.memory[0] = v.counter!; o.phase = "Worker " + k.toUpperCase() + (v[k + "Stage"] ? ": read complete" : ": write complete"); sample(o, +(chosen === 0), +(chosen === 1), v.occupied!);
  }),
  metrics: (s) => [metric("Shared counter", s.values.counter!), metric("Completed increments", s.values.operations!), metric("Lost updates", s.values.operations! - s.values.counter!), metric("A / B completed", s.values.aDone + " / " + s.values.bDone), metric("Resource occupied", s.values.occupied!)],
  checks: (s, p) => [check("Finish both workers", s.values.operations === 2 * num(p, "iterations"), "Each task performs its configured number of increments."), check("Prevent lost updates", s.values.operations! > 0 && s.values.counter === s.values.operations, "Use exclusive access. A semaphore with capacity 2 is not exclusive."), check("Release the resource", p.primitive !== "None" && s.values.operations === 2 * num(p, "iterations") && s.values.occupied === 0, "Every take needs a release.")],
  guide: ["Run without synchronization; inspect interleaved reads and writes.", "Compare operation count with the counter.", "Reset with a mutex and repeat.", "Try semaphore capacity 2, then disable release."], expected: "Interleaved reads lose increments. A mutex or capacity-1 semaphore serializes the critical section.", equation: "Lost updates = completed increments − final counter", limitation: "Two deterministic workers and a round-robin instruction schedule, with one shared resource.", presets: [{ label: "Race", params: { primitive: "None", release: true } }, { label: "Mutex repair", params: { primitive: "Mutex", release: true } }, { label: "Missing release", params: { primitive: "Mutex", release: false } }],
};

export const inversion: Model = {
  number: 49, subtitle: "A blocked task depends on its low-priority lock owner.", objective: "Measure high-priority response with and without priority inheritance.",
  defaults: { inheritance: false, medium: 8, hold: 6 }, controls: [toggle("inheritance", "Priority inheritance"), range("medium", "Medium CPU burst", 4, 30, 1, "ms"), range("hold", "Low lock-hold work", 5, 15, 1, "ms")], stepMs: 1,
  plots: [{ label: "Low task", min: 0, max: 1 }, { label: "Medium task", min: 0, max: 1 }, { label: "High task", min: 0, max: 1 }],
  create: (p) => base({ low: num(p, "hold"), medium: num(p, "medium"), high: 1, owner: 0, highBlocked: 0, donation: 0, highResponse: -1, highWait: 0, mediumAtHighCompletion: 0 }),
  step: (s, p, ms) => milliseconds(s, p, ms, (o, cfg) => {
    const v = o.values; if (o.time === 0) event(o, "Lock acquired", "Low-priority L owns mutex");
    if (o.time >= 2 && v.high! > 0 && v.owner === 0) { if (!v.highBlocked) event(o, "High blocks", "H released at 2 ms; waits for L"); v.highBlocked = 1; v.highWait!++; if (yes(cfg, "inheritance") && !v.donation) { v.donation = 1; event(o, "Priority donation", "L inherits H priority"); } }
    let task = -1;
    if (o.time >= 2 && v.high! > 0 && v.owner !== 0) task = 2;
    else if (v.low! > 0 && v.donation) task = 0;
    else if (o.time >= 3 && v.medium! > 0) task = 1;
    else if (v.low! > 0) task = 0;
    if (task === 0) { v.low!--; if (!v.low) { v.owner = -1; v.donation = 0; event(o, "Mutex released", "L restores base priority; H becomes ready"); } }
    if (task === 1) v.medium!--;
    if (task === 2) { v.high = 0; v.highBlocked = 0; v.highResponse = o.time + 1 - 2; v.mediumAtHighCompletion = v.medium!; event(o, "High complete", "Response " + v.highResponse + " ms"); }
    o.phase = task < 0 ? "All work complete" : ["Low L", "Medium M", "High H"][task]!; sample(o, +(task === 0), +(task === 1), +(task === 2)); if (task < 0) o.finished = true;
  }),
  metrics: (s) => [metric("H response", s.values.highResponse! < 0 ? "Pending" : s.values.highResponse!, "ms"), metric("H blocked", s.values.highWait!, "ms"), metric("L / M work left", s.values.low + " / " + s.values.medium, "ms"), metric("Effective L priority", s.values.donation ? "Inherited high" : "Base low")],
  checks: (s) => [check("Observe H blocked", s.events.some((e) => e.event === "High blocks"), "H releases at 2 ms; M at 3 ms."), check("Observe priority donation", s.events.some((e) => e.event === "Priority donation"), "Enable inheritance and reset."), check("Finish H before M drains", s.values.highResponse! > 0 && s.values.mediumAtHighCompletion! > 0, "Record M work remaining when H completes.")],
  guide: ["Run without inheritance; record H response.", "Reset with inheritance enabled.", "Inspect donation and mutex release.", "Increase M burst; compare both runs."], expected: "Without inheritance M preempts L. With inheritance L runs at H priority until unlock.", equation: "H response = completion timestamp − 2 ms release", limitation: "One mutex, three scripted jobs, zero context-switch cost; not a multi-lock kernel.", presets: [{ label: "Priority inversion", params: { inheritance: false } }, { label: "Inheritance repair", params: { inheritance: true } }],
};
