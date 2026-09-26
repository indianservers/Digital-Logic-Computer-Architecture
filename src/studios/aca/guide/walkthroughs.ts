import type { LabWalkthrough } from "./types";

export const WALKTHROUGHS: Record<string, LabWalkthrough> = {
  "data-hazards": {
    howToUse: [
      "Start on the default RAW chain. Press Reset, then Step. Play runs the same timeline.",
      "The controls that change the result are Enable Data Forwarding, Auto Insert Stalls, Load Example, the move arrows, Auto Schedule, and Reset Order.",
      "Reset returns the cycle clock to the start of the current sequence. Reset Order restores the sequence you last loaded.",
    ],
    observe: [
      "Pipeline Execution Timeline cells: IF, ID, EX, MEM, WB, and STALL.",
      "Hazard Detector: the register name, the earlier instruction, and the later instruction.",
      "The forwarding sentence under the timeline: which register travels, and from which instruction to which.",
      "Stall cycles and CPI in Results & Insights.",
    ],
    experiments: [
      { title: "RAW without forwarding", steps: ["Load Example: RAW chain.", "Turn Enable Data Forwarding off.", "Reset and Step through the timeline.", "Read the STALL cells on the consumer rows."] },
      { title: "Enable forwarding", steps: ["Turn Enable Data Forwarding back on.", "Reset and Step the same chain.", "Compare stall cycles and total cycles with the previous run."] },
      { title: "Load-use", steps: ["Load Example: Load-use.", "Leave forwarding on.", "Find the bubble between LW and the ADD that reads the loaded register."] },
      { title: "Reorder an independent instruction", steps: ["On Load-use, move the independent ADD up with the row arrows.", "Reset and Step.", "Press Auto Schedule and compare original cycles with the safe schedule."] },
      { title: "Name dependences", steps: ["Load Example: WAR and WAW.", "Select the WAR pill, then the WAW pill.", "Confirm those edges are listed and that this pipeline inserts no stall for them."] },
    ],
    expected: [
      "Forwarding removes the waiting on an ALU result that is already in EX/MEM. It does not remove the one bubble on a load used by the next instruction.",
      "Moving an independent instruction into a gap can hide a stall. Auto Schedule refuses a move that would break a RAW, WAR, WAW, or memory edge.",
      "WAR and WAW stay visible in the detector. This in-order pipeline does not stall for them.",
    ],
    why: [
      "The pipeline overlaps IF, ID, EX, MEM, and WB. A consumer in EX needs the producer’s value before WB has written the register file.",
      "Forwarding bypasses that writeback for an ALU result. A load value exists only after MEM.",
      "Scheduling fills the bubble with independent work. The architectural result stays the same only when the move is legal.",
    ],
    challenge: "Build a short sequence that stalls with forwarding off, loses some of those stalls with forwarding on, and shortens further when you move an independent instruction between a producer and a consumer. Use Add instruction and the arrows. Compare stall cycles after each change.",
    check: [
      "Why does forwarding help a RAW dependence without removing every hazard?",
      "What makes a move with the arrows legal for Auto Schedule?",
      "Where does a STALL cell come from on the timeline?",
    ],
    links: [
      { id: "timeline", label: "Watch the timeline" },
      { id: "hazards", label: "Watch the hazard detector" },
      { id: "forward", label: "Watch forwarding" },
    ],
    checklist: ["Step the default RAW chain", "Toggle Enable Data Forwarding", "Read stall cycles and the forwarding path", "Finish the scheduling challenge"],
  },
  scoreboard: {
    howToUse: [
      "Choose a Load Example, then Reset and Step one cycle at a time.",
      "Read three tables together: Instruction Status, Functional Unit Status, and Register Result Status.",
      "Integer units and Multiply latency change structural waiting. Show Data Hazards and Show Structural Conflicts only filter the Hazard Monitor.",
    ],
    observe: [
      "Instruction Status: Issue, Read, Execute, Write, and the state word.",
      "Functional Unit Status: Busy, Fi, Fj, Fk, Qj, Qk, and remaining cycles.",
      "Register Result Status: which unit will write each register.",
      "Hazard Monitor labels: RAW, WAR, WAW, or Structural.",
    ],
    experiments: [
      { title: "RAW", steps: ["Load Example: Load / multiply chain.", "Step until an instruction is Issued but Read is still empty.", "Look at Qj or Qk on its unit. That source is not ready."] },
      { title: "WAW", steps: ["Load Example: WAW on x1.", "Step while the first write of x1 is unfinished.", "The second write should stay out of Issue."] },
      { title: "WAR", steps: ["Load Example: WAR on x8.", "Step until the later write of x8 has finished execution.", "Its Write column stays empty while the earlier reader still needs x8."] },
      { title: "One multiplier", steps: ["Load Example: One multiplier.", "Set Integer units aside and watch the second MUL.", "Show Structural Conflicts on. The second multiply waits because the multiplier is busy."] },
    ],
    expected: [
      "A RAW blocks Read operands, not the whole machine.",
      "A WAW blocks Issue of the later writer. A WAR delays Write result of the later writer.",
      "Two multiplies with one multiplier produce a structural wait even when their registers are independent.",
    ],
    why: [
      "The scoreboard tracks who will write each register and which unit is busy. It does not rename, so a second write of the same name must wait.",
      "Read operands waits for sources. Write result waits until no earlier instruction still has to read the destination.",
    ],
    challenge: "Edit the instruction list so one sequence contains a RAW pair, a second write of the same destination, and two MUL instructions. Step it. For each blocked instruction, name the stage: Issue, Read, or Write.",
    check: [
      "What is the difference between a RAW wait and a WAR wait on this scoreboard?",
      "Why can an instruction show Issue and still have an empty Read column?",
      "Why can Execute finish while Write is still blank?",
    ],
    links: [
      { id: "status", label: "Watch instruction status" },
      { id: "units", label: "Watch functional units" },
      { id: "regs", label: "Watch register results" },
    ],
    checklist: ["Step the load / multiply chain", "Load the WAW and WAR examples", "Read Qj or Qk on a waiting unit", "Name the blocked stage in your own sequence"],
  },
  tomasulo: {
    howToUse: [
      "Pick an Example Program, or edit the instruction list. Reset, then Step through issue.",
      "Click a cycle and read the reservation-station row: Busy, Op, Vj, Vk, Qj, Qk.",
      "Leave Show Tags and Show CDB on when you want to see the broadcast. Add stations and Multiply latency change capacity and timing.",
    ],
    observe: [
      "Which station is Busy and which operation it holds.",
      "Vj/Vk when the source is already a value, and Qj/Qk when it is still a producer tag.",
      "Qi in Register File / Tag Status.",
      "Common Data Bus: cycle, tag, value, and destination. One result bus, so two finished stations do not broadcast in the same cycle.",
    ],
    experiments: [
      { title: "Tag instead of a value", steps: ["Choose Dependent Chain.", "Step until the consumer is in a station.", "Confirm Qj or Qk holds the producer tag rather than a finished value."] },
      { title: "CDB wakeup", steps: ["Keep stepping until Common Data Bus shows that tag.", "Watch the matching Q field become a V field."] },
      { title: "Independent instructions", steps: ["Choose Independent Instructions.", "Step and watch two stations stay busy without waiting on each other’s tags."] },
      { title: "One shared CDB", steps: ["Choose CDB Contention.", "Step until two adds are ready.", "They broadcast on different cycles."] },
    ],
    expected: [
      "A consumer waits on a tag. When that tag is broadcast, matching Qj/Qk entries are replaced by the value.",
      "Independent instructions progress together while units are free.",
      "A second result that is ready in the same cycle waits for the next free CDB cycle.",
    ],
    why: [
      "Tomasulo keeps the dependence in the reservation station, not in a central scoreboard stall.",
      "The register’s Qi tag is a rename: a later write can take a new tag, so a WAR or WAW on the architectural name does not block the earlier reader.",
    ],
    challenge: "Edit the instruction list so one ADD.D writes F4 and at least two later instructions read F4. Step until that station broadcasts. Both consumers should clear the matching Q field from the same tag.",
    check: [
      "What is stored in Qj or Qk?",
      "When does a Q field become a V field?",
      "Why can a later write of the same register proceed while an earlier reader still holds the old tag?",
    ],
    links: [
      { id: "stations", label: "Watch reservation stations" },
      { id: "cdb", label: "Watch the CDB" },
    ],
    checklist: ["Step Dependent Chain until a tag appears", "Watch that tag broadcast on the CDB", "Run Independent Instructions", "Wake two consumers from one producer"],
  },
  "register-renaming": {
    howToUse: [
      "Press Load Example. Select a row to follow that instruction in the rename map.",
      "Enable Register Renaming compares the scoreboard timeline with the renamed timeline. Turn it off to see the name stalls return.",
      "Physical registers is 2, 4, or 10. Show Rename Map hides the table. It does not turn renaming off.",
    ],
    observe: [
      "False Dependences: WAW, WAR, and RAW counts, and which instruction pair shares the name.",
      "Rename Map: architectural name and its current physical register.",
      "Instruction Mapping: architectural destination versus physical destination.",
      "Free list length. A physical register returns only when it is no longer the current mapping and nothing in this program still reads it.",
    ],
    experiments: [
      { title: "Name conflict before renaming", steps: ["Load Example.", "Turn Enable Register Renaming off.", "Read the WAW and WAR cards and the longer before-renaming timeline."] },
      { title: "Different physical destinations", steps: ["Turn renaming on.", "Select the two writes of the same architectural register.", "Their physical destinations should differ."] },
      { title: "RAW remains", steps: ["Select the instruction that reads the produced register.", "Its physical source should be the producer’s physical destination, not a new name."] },
      { title: "Free list", steps: ["Set Physical registers to 2.", "If the status says rename stalled, the free list cannot allocate another destination.", "Set it back to 10 and Step until a name returns to the free list."] },
    ],
    expected: [
      "Renaming removes the WAW and WAR stalls in this example. The RAW wait remains.",
      "A too-small physical pool stalls allocation. Retirement has to free a name before another destination can be renamed.",
    ],
    why: [
      "The architectural name is reused. Each write needs its own physical register so the earlier value stays available to its readers.",
      "A consumer still needs that value, so the RAW edge is copied onto the physical source.",
    ],
    challenge: "On the loaded example, point to one WAW, one WAR, and one RAW in False Dependences. After renaming, say which of the three still forces a wait, using the physical source and destination columns.",
    check: [
      "Why does a second write of x1 stop looking like a WAW after renaming?",
      "Why does the RAW remain?",
      "When is an old physical register safe to put back on the free list?",
    ],
    links: [
      { id: "map", label: "Watch the rename map" },
      { id: "free", label: "Watch the free list" },
    ],
    checklist: ["Load the example with renaming off", "Turn renaming on and compare cycles", "Read one physical destination", "Name which dependence remains"],
  },
  "reorder-buffer": {
    howToUse: [
      "The instruction stream is editable. Reset, then Step. Watch the ROB state words: Issued, Executing, Waiting to Commit, Committed, Flushed.",
      "Reorder buffer entries, Issue width, Commit width, and the ALU, multiply, and memory counts change how much work is in flight.",
      "Inject a precise exception uses the Faulting instruction menu. Show Pipeline Animation does not change the cycle count.",
    ],
    observe: [
      "Reorder Buffer: which entry is oldest, and which younger entry is already Waiting to Commit.",
      "Writeback versus Next commit. A writeback is not a commit.",
      "Committed so far, and the dispatch-stalled sentence when the ROB is full.",
      "Flushed instructions after the exception is on.",
    ],
    experiments: [
      { title: "Finish out of order", steps: ["Leave the default stream.", "Step until SUB, which does not depend on the load, reaches Waiting to Commit.", "The load can still be unfinished at the head."] },
      { title: "Retire in order", steps: ["Keep stepping.", "SUB should not become Committed while an older entry is still incomplete."] },
      { title: "Commit width", steps: ["Set Commit width to 1 and note how many entries retire on a cycle when several are ready.", "Set Commit width to 4, Reset, and Step. More than one ready head can retire together."] },
      { title: "Precise exception", steps: ["Turn Inject a precise exception on.", "Choose ADD as the faulting instruction.", "Reset and Step. Older work may commit. ADD and younger entries show Flushed."] },
    ],
    expected: [
      "Execution and writeback may finish out of program order.",
      "Architectural commit still starts at the ROB head.",
      "A fault flushes the chosen instruction and every younger entry. Older committed entries stay.",
    ],
    why: [
      "The ROB holds results until they are the oldest fault-free instruction. That is what keeps exceptions precise.",
      "Commit width only retires entries that are already ready at the head. It does not let a younger instruction pass an unfinished older one.",
    ],
    challenge: "Using the default stream, show SUB waiting behind the load. Then turn the exception on, choose ADD, and Step until every younger entry is Flushed while any older committed result remains.",
    check: [
      "Why can a completed younger instruction not commit immediately?",
      "What does a precise exception preserve?",
      "What is the ROB head responsible for?",
    ],
    links: [
      { id: "rob", label: "Watch the ROB" },
      { id: "flush", label: "Watch flush" },
    ],
    checklist: ["Step until a younger instruction is Waiting to Commit", "Raise commit width and compare", "Inject an exception on ADD", "Confirm younger entries are Flushed"],
  },
  "branch-predictor": {
    howToUse: [
      "Type T and N in Branch Trace Input, or press a preset chip: Simple Loop, Alternating, Mostly Taken, Mostly Not Taken.",
      "Step one branch at a time. The history row shows the prediction and whether it matched.",
      "1-bit initial and 2-bit initial set the starting state. Reset after you change them.",
    ],
    observe: [
      "1-bit state: Taken or Not taken, before the outcome updates it.",
      "2-bit state: Strongly or Weakly taken or not taken.",
      "Prediction History: predicted direction, actual direction, and correct or miss for each predictor.",
      "Accuracy Comparison for the branches seen so far.",
    ],
    experiments: [
      { title: "Always taken", steps: ["Clear the trace and type T T T T T.", "Set both predictors to a taken start.", "Step. Both should stay taken after the first confirmed T."] },
      { title: "Loop exit", steps: ["Press Simple Loop, or type T T T T N.", "Step to the N.", "Both miss that exit if they were predicting taken."] },
      { title: "Re-entry", steps: ["Type T T T T N T T T T N.", "Reset and Step through the first N and the next T.", "The 1-bit predictor follows the N, so the next T misses. A strongly taken 2-bit counter can stay taken after one N."] },
      { title: "Where 1-bit can win", steps: ["Press Alternating.", "Reset and Step the whole trace.", "Compare the two accuracy numbers. The 2-bit counter is not ahead on every pattern."] },
    ],
    expected: [
      "One unusual outcome flips a 1-bit predictor. A 2-bit counter moves only one step, so a single loop exit does not reverse a strong preference.",
      "On a strict alternation, that extra step can cost more mispredictions than the 1-bit predictor.",
    ],
    why: [
      "The second bit is hysteresis. The counter needs two disagreeing outcomes to cross from taken to not taken, or the other way.",
      "That helps a loop that is usually taken. It hurts a pattern that really does switch every time.",
    ],
    challenge: "Find a short T/N pattern, using Alternating or your own trace, where the 1-bit accuracy is higher than the 2-bit accuracy at the end of the run.",
    check: [
      "What does hysteresis mean for the 2-bit counter?",
      "Why can a 2-bit predictor miss the exit of a taken loop?",
      "Why is the 2-bit predictor not always the more accurate one?",
    ],
    links: [
      { id: "predictors", label: "Watch both predictors" },
      { id: "history", label: "Watch prediction history" },
    ],
    checklist: ["Step Simple Loop through the N", "Compare the next T on both predictors", "Run Alternating", "Record which predictor has fewer misses"],
  },
  "correlating-predictor": {
    howToUse: [
      "Load Example chooses the trace. The rows below it edit PC, instruction text, and T or N.",
      "Global history bits, Local history bits, and Pattern table entries change the index. Reset after a change, then Step.",
      "Show Global History, Show Local History, and Show Bimodal hide panels. They do not disable those predictors.",
    ],
    observe: [
      "Global History Register bits. The newest outcome is the low bit: 1 taken, 0 not taken.",
      "The gshare index sentence: PC XOR GHR, masked to the pattern table.",
      "The selected PHT counter, the prediction, and the update.",
      "The aliasing sentence when another PC has already trained that same PHT entry.",
    ],
    experiments: [
      { title: "A correlated pair", steps: ["Load Example: Correlated pair.", "Step both branches.", "Watch the GHR change after the first outcome and the second branch index with that history."] },
      { title: "Gshare index", steps: ["On any step, read the PC bits, the GHR, and the XOR index under Correlating Predictor.", "Change Global history bits and Step again. The index width follows the control."] },
      { title: "Aliasing", steps: ["Load Example: Aliasing.", "Step until the page says two branches interfere on one PHT entry.", "Those branches are training the same counter."] },
      { title: "History length", steps: ["On Correlated pair, run once with 2 global history bits and once with 8.", "Compare gshare accuracy in Accuracy Analyzer. More history is not automatically better when the table is small."] },
    ],
    expected: [
      "A second branch can be predicted from the previous outcome when its PHT entry is indexed with that history.",
      "Two PCs that land on the same entry overwrite each other’s counter. That is aliasing, not a property of the branch itself.",
    ],
    why: [
      "Gshare mixes the PC and the GHR so the same branch can use different counters for different recent paths.",
      "The table is finite, so different pairs of PC and history can collide.",
    ],
    challenge: "On Correlated pair, record gshare accuracy. Then load Aliasing with the same table size and find a step whose aliasing sentence names another PC. Say which run was helped by history and which run was hurt by sharing a counter.",
    check: [
      "What does the GHR store?",
      "Why does gshare XOR the PC with the history?",
      "What is predictor aliasing on this page?",
    ],
    links: [
      { id: "ghr", label: "Watch the GHR" },
      { id: "pht", label: "Watch the PHT" },
    ],
    checklist: ["Step Correlated pair", "Read one PC XOR GHR index", "Load Aliasing and find a shared PHT entry", "Change history bits and compare accuracy"],
  },
  "branch-target-buffer": {
    howToUse: [
      "Choose a Trace. Reset and Step. Each step is one lookup.",
      "Branch PC is a separate lookup into the current sets. It shows index and tag without waiting for the trace.",
      "Organization is direct-mapped or 2-way. Replacement policy applies when there are two ways. Enable BTB turns allocation off when it is off.",
    ],
    observe: [
      "Index bits and tag for the PC being looked up.",
      "The selected set, the way, the valid bit, and the stored target.",
      "Hit or miss text.",
      "On a miss, fetch continues at PC+4. On a hit that is taken, fetch uses the stored target.",
    ],
    experiments: [
      { title: "First lookup", steps: ["Choose Hot loop.", "Reset. The first Step is a miss if that PC is not installed yet.", "Read the miss sentence and the empty valid bit."] },
      { title: "Repeat lookup", steps: ["Step until the same PC appears again.", "The set should now be valid, and the lookup should hit."] },
      { title: "Same set, different tags", steps: ["Choose Conflict misses.", "Step and watch different PCs select the same set.", "A direct-mapped organization has one way, so the new tag replaces the old one."] },
      { title: "Replacement", steps: ["Set Organization to 2-way and Policy to Least recently used.", "Choose Associative replacement.", "Step until a way is overwritten. That row is the victim."] },
    ],
    expected: [
      "A hit returns the target stored with the matching tag. It does not decide taken or not taken.",
      "A miss allocates when the BTB is enabled. A full set evicts a victim according to the policy.",
    ],
    why: [
      "Direction prediction answers taken or not. The BTB answers where fetch should go if the branch is predicted taken.",
      "Index selects the set. Tag tells which PC owns the entry. Two PCs can share an index and still be different branches.",
    ],
    challenge: "Using Conflict misses and direct-mapped organization, Step until a useful target is replaced. Then switch to 2-way and run Associative replacement. Name the set and the victim way that changed.",
    check: [
      "What is the difference between the index and the tag?",
      "Why can two branch PCs land in the same set?",
      "What does fetch do after a BTB miss?",
    ],
    links: [
      { id: "sets", label: "Watch the sets" },
      { id: "lookup", label: "Watch the lookup" },
    ],
    checklist: ["Step a first-time miss", "Step the repeat hit", "Run Conflict misses", "Name a replaced way"],
  },
  "tournament-predictor": {
    howToUse: [
      "Load example, or edit the Branch trace as lines of PC and T or N.",
      "Step one branch. Read Local Predictor, Global Predictor, and Chooser before you look at Accuracy Statistics.",
      "Hiding a panel does not disable that component. The final prediction still uses the chooser.",
    ],
    observe: [
      "Local prediction and global prediction for this PC.",
      "Chooser state before and after the branch.",
      "The disagreement sentence. The chooser moves only when exactly one of local or global was right.",
      "Running accuracy for local, global, bimodal, and the tournament choice. Bimodal is not a chooser input.",
    ],
    experiments: [
      { title: "Both agree", steps: ["Load Locally predictable.", "Step a branch whose local and global predictions match.", "The chooser sentence should say it does not move."] },
      { title: "Local is the better component", steps: ["Stay on Locally predictable and Step to the end.", "Compare local accuracy with global accuracy."] },
      { title: "Global is the better component", steps: ["Load Globally correlated.", "Reset and Step.", "Watch the chooser move toward global on a disagreement that global got right."] },
      { title: "Chooser learning", steps: ["Load Phase change.", "Step until the chooser-after state differs from chooser-before.", "That step should be one where local and global disagreed."] },
    ],
    expected: [
      "Agreement leaves the chooser where it was.",
      "A repeated disagreement moves the chooser toward the component that was right.",
      "The accuracy leader can change across traces. There is no permanent winner.",
    ],
    why: [
      "Local history fits a branch with its own pattern. Global history fits a branch that depends on the previous outcome.",
      "The chooser is a meta-state. If both components are wrong, or both are right, it has no new evidence.",
    ],
    challenge: "On Phase change, find the first branch where chooser-after differs from chooser-before. Record local, global, and the actual T or N for that line, and say which component the chooser moved toward.",
    check: [
      "When is the chooser allowed to move?",
      "Why keep both a local and a global predictor?",
      "What happens to the chooser if both components are wrong?",
    ],
    links: [
      { id: "chooser", label: "Watch the chooser" },
      { id: "local", label: "Watch the local predictor" },
    ],
    checklist: ["Step a branch where local and global agree", "Run Globally correlated", "Find a chooser move on Phase change", "Write why it moved"],
  },
  "speculative-execution": {
    howToUse: [
      "Load example, or edit Speculative program. Predictor type and Initial counter set the guess. Initial counter applies to the 1-bit and 2-bit modes.",
      "Enable speculation, Branch resolution latency, and Speculative window decide how much work fetch starts before the branch resolves.",
      "Reset after a control change. Step until the event line names the resolution. Highlight Misprediction marks the wrong path. It does not change the counts.",
    ],
    observe: [
      "Speculative column: Yes while the instruction is on a predicted path.",
      "Squashed versus committed on the selected row.",
      "Checkpoint / Register Snapshot, including the corrected PC when redirect is set.",
      "Squashed count and wasted cycles in the results.",
    ],
    experiments: [
      { title: "Correct speculation", steps: ["Load Correct speculation.", "Leave Enable speculation on.", "Step to the end. Speculative work should be kept, and the squashed count should stay at zero."] },
      { title: "Misprediction", steps: ["Load Single misprediction.", "Step until the recovery rule’s wrong-path rows are squashed.", "Older committed results stay."] },
      { title: "Later resolution", steps: ["On Single misprediction, set Branch resolution latency to 6.", "Reset and Step.", "More instructions can show Speculative before the flush."] },
      { title: "Speculation off", steps: ["Turn Enable speculation off.", "Reset and Step the same program.", "Fetch waits for the branch, so the wrong-path squashes disappear and the run is the non-speculative one."] },
      { title: "Window size", steps: ["Turn speculation on.", "Compare Speculative window 2 with window 8 on a mispredicted example.", "A larger window can hold more wrong-path instructions."] },
    ],
    expected: [
      "A correct prediction keeps the fetched work.",
      "A wrong prediction squashes the younger wrong-path instructions and refetches from the corrected PC.",
      "A longer resolution latency lets more speculative instructions enter before that squash.",
    ],
    why: [
      "Fetch would otherwise stall until the branch result is known. The predictor supplies a path, and the checkpoint is what makes the guess reversible.",
      "Anything fetched under the wrong prediction is not architectural state.",
    ],
    challenge: "On Single misprediction, run once with Branch resolution latency 0 and once with 6. Force the same misprediction by keeping the example. Compare the squashed count.",
    check: [
      "What does the Speculative column mean?",
      "What does the checkpoint restore after a misprediction?",
      "Why can a longer branch-resolution latency increase the squashed count?",
    ],
    links: [
      { id: "stream", label: "Watch the instruction stream" },
      { id: "checkpoint", label: "Watch the checkpoint" },
    ],
    checklist: ["Run Correct speculation", "Run Single misprediction", "Raise branch resolution latency", "Compare the squashed counts"],
  },
  superscalar: {
    howToUse: [
      "Load an example. Widths are Fetch, Decode, Dispatch, Execute, and Retire, each from 1 to 4. There is no separate issue or rename width.",
      "Scalar (1), Dual Issue (2), and Quad Issue (4) set every stage together. The + and − buttons change one stage.",
      "Reset, then Step. IPC in the explorer is instructions retired divided by the cycles you have stepped.",
    ],
    observe: [
      "Each stage width, and which stage is narrower than the others.",
      "Lane cells: IF, ID, DIS, EX, MEM, WB, and bubbles.",
      "How many instructions are in the narrow stage on the current cycle.",
      "Superscalar IPC versus the scalar run.",
    ],
    experiments: [
      { title: "Narrow front end", steps: ["Load Independent instructions.", "Press Quad Issue (4).", "Lower only Fetch to 1.", "Reset and Step. Later stages stay wide, but they cannot receive more than Fetch supplies."] },
      { title: "Narrow dispatch", steps: ["Set Fetch and Decode to 4.", "Set Dispatch to 1 and leave Execute and Retire at 4.", "Step and watch instructions wait to enter dispatch."] },
      { title: "Narrow retire", steps: ["Set Fetch through Execute to 4 and Retire to 1.", "Step. Completed instructions still retire one per cycle."] },
      { title: "Balanced widths", steps: ["Press Quad Issue (4) on Independent instructions.", "Reset and compare IPC with the Retire-1 run.", "Then load Dependency chain at width 4. IPC stays near 1 because each instruction waits for the previous result."] },
    ],
    expected: [
      "A wider stage does not raise IPC while another stage is narrower.",
      "The width strip names the narrowest stage. If every width is equal, it says the machine is balanced. Dependences can still hold IPC near 1.",
    ],
    why: [
      "This model issues and retires in order. Throughput is the narrowest stage along that path, and also any RAW dependence the program still has.",
    ],
    challenge: "On Independent instructions, set Fetch to 4 and Retire to 1. Read the width strip and name the limiting stage before you read the IPC number. Then change only Retire and compare IPC.",
    check: [
      "Why does a 4-wide fetch stage not imply IPC 4?",
      "What is the difference between a stage width and the IPC you measured?",
      "Which stage should you widen first when it is the only narrow one?",
    ],
    links: [
      { id: "widths", label: "Highlight the widths" },
      { id: "pipeline", label: "Highlight the pipeline" },
    ],
    checklist: ["Step Independent instructions at width 4", "Narrow one stage", "Read the bottleneck on the width strip", "Raise that stage and compare IPC"],
  },
  "issue-queue": {
    howToUse: [
      "Load an example, then Step until several rows are in the issue queue.",
      "Instruction window size is 4, 8, 16, or 32. Issue width is 1, 2, or 4. Functional units are the three mixes in the menu.",
      "Ready means every source is available. Selected means this cycle’s issue choice. Those are different columns.",
    ],
    observe: [
      "Queue rows: instruction, Ready, age, and Selected.",
      "Source tags still waiting on a producer.",
      "How many ready instructions were not selected.",
      "Issued instructions and IPC under the queue.",
    ],
    experiments: [
      { title: "Dependency wakeup", steps: ["Load RAW chain.", "Step until a consumer shows Ready: No.", "Keep stepping. It becomes ready only after the producer completes."] },
      { title: "Ready but not selected", steps: ["Load Competing ALU instructions.", "Set Issue width to 1.", "Step. More than one instruction can be Ready while only one is Selected."] },
      { title: "One ALU", steps: ["Stay on Competing ALU instructions.", "Set Functional units to 1 Load, 1 ALU, 1 MUL.", "Ready ALU instructions still wait for that one unit."] },
      { title: "Larger window", steps: ["Load Mixed dependency graph.", "Run window 4, then window 16, with the same issue width.", "A larger window can hold an independent instruction that a small window has not admitted yet."] },
    ],
    expected: [
      "Not-ready and ready-but-not-selected are different waits.",
      "Issue width and the functional-unit mix both cap how many ready instructions leave the queue.",
    ],
    why: [
      "The queue searches for instructions whose sources are ready and whose unit is free. Oldest ready is the selection rule on this page.",
    ],
    challenge: "Set Issue width to 1 on Competing ALU instructions. Step until at least two instructions are not ready and at least two are ready. Say which ones are waiting for a producer and which ones are waiting for the issue slot.",
    check: [
      "What makes a waiting instruction become ready?",
      "Why can a ready instruction stay in the queue?",
      "What can a larger window hold that a window of 4 might not?",
    ],
    links: [
      { id: "queue", label: "Focus the issue queue" },
      { id: "select", label: "Focus selection" },
    ],
    checklist: ["Step the RAW chain until a consumer wakes", "Set issue width to 1", "Find a ready instruction that is not selected", "Compare window 4 and window 16"],
  },
  "physical-register-file": {
    howToUse: [
      "Load an example or edit the instruction stream. Physical registers is 8, 10, 12, 16, 24, 32, 48, or 64.",
      "Step through rename. The RAT is the speculative map. The commit map updates only when the instruction retires.",
      "Show RAT Updates and Show Free List Changes are display toggles. They do not allocate registers.",
    ],
    observe: [
      "Architectural destination and the new physical register.",
      "The previous physical mapping, which stays live until commit.",
      "Free-list count.",
      "Rename stalls in the status line.",
      "A register returning to the free list when reclaimed increases.",
    ],
    experiments: [
      { title: "Room to rename", steps: ["Load WAR removed by renaming.", "Set Physical registers to 32.", "Step. Each write gets a destination and rename does not stall."] },
      { title: "Shrink the file", steps: ["Set Physical registers to 8 on the same example.", "Reset and Step. Watch the free count fall."] },
      { title: "Exhaust the free list", steps: ["Load Free-list exhaustion.", "Keep the file at 8.", "Step until the status says rename stalled."] },
      { title: "Reclamation", steps: ["Load Commit-map recovery.", "Step through commit.", "The reclaimed count rises when an old physical register returns. It does not return at writeback."] },
    ],
    expected: [
      "A smaller file stalls rename sooner.",
      "Commit releases an obsolete mapping. The next rename can then continue.",
    ],
    why: [
      "Every new architectural write needs a free physical destination. The old name stays allocated until the overwriting instruction commits, so older readers and recovery still see it.",
    ],
    challenge: "On Free-list exhaustion, raise Physical registers until the run finishes with zero rename stalls. Then drop the size by one step in the menu and Step to the cycle whose event says rename stalled.",
    check: [
      "Why is the old physical register not freed at rename?",
      "Which event makes reclamation safe?",
      "Why can the physical register file limit throughput even when the program has no RAW?",
    ],
    links: [
      { id: "free", label: "Show the free list" },
      { id: "rat", label: "Show the RAT" },
    ],
    checklist: ["Rename with a large file", "Shrink to 8", "Hit a rename stall", "Watch a reclaim on commit"],
  },
  "load-store-queue": {
    howToUse: [
      "Load an example or edit the memory instructions. Step one cycle at a time.",
      "Load queue and Store queue are 1, 2, 4, or 8. Ordering policy is Wait for unknown older stores, Speculative load bypass, or Predictor.",
      "Load address delay applies after you edit the memory program, and it delays loads. Enable Store-to-Load Forwarding and Detect Load-Store Violations change the result. Partial byte and half forwarding is not applied.",
    ],
    observe: [
      "Load-queue and store-queue rows, in program order.",
      "Addresses that are still ?.",
      "A Forwarded load and the store it names.",
      "Replay count when a younger load conflicts with an older store that resolves later.",
      "The full-queue sentence when a new memory instruction cannot allocate.",
    ],
    experiments: [
      { title: "No conflict", steps: ["Load Non-conflicting out-of-order load.", "Step. The younger load uses a different address from the older store."] },
      { title: "Store-to-load forwarding", steps: ["Load Store-to-load forwarding.", "Leave forwarding on.", "Step until a load is Forwarded from the store queue."] },
      { title: "Unknown older store", steps: ["Load Unknown older store.", "Set Ordering policy to Wait for unknown older stores and Step. The younger load waits.", "Reset, set Speculative load bypass, and Step again."] },
      { title: "Violation and replay", steps: ["Load Memory violation and replay.", "Leave Detect Load-Store Violations on. The example selects Speculative load bypass.", "Step until the replay count increases."] },
      { title: "Queue full", steps: ["Set Load queue size and Store queue size to 1.", "Add another load or store in the instruction box.", "Step until the page says a queue is full."] },
    ],
    expected: [
      "A matching older store can supply the load without reading memory.",
      "A bypassed load replays if that store’s address later matches.",
    ],
    why: [
      "The queues keep memory order while addresses are still unknown. Forwarding is safe only when the address and the value are the ones the load must see.",
    ],
    challenge: "Load Memory violation and replay. Step until a load is speculative while an older store address is still unknown, then continue until that address matches and the replay count moves.",
    check: [
      "When can a load pass an older store?",
      "What must be known before a store can forward?",
      "Why does the load replay instead of keeping the value it already used?",
    ],
    links: [
      { id: "forward", label: "Highlight the forwarding path" },
      { id: "replay", label: "Show the replay" },
    ],
    checklist: ["Forward a store to a load", "Wait under Conservative", "Replay the violation example", "Fill a queue of size 1"],
  },
  "memory-disambiguation": {
    howToUse: [
      "Load one example. The predictor menu is Conservative, Always Bypass, 2-bit Saturating Counter, or Store Set Predictor.",
      "Reset between policies so the counts start over. Confidence threshold applies to the predictors.",
      "Enable Load Bypassing and Treat Unknown Addresses as Independent change whether a load may pass an unresolved store. Use Store Queue for Forwarding supplies a known matching store.",
    ],
    observe: [
      "The decision on the latest load: wait, bypass, or forward.",
      "Loads that waited and loads that bypassed.",
      "Replay count when a bypassed load later matches a store.",
      "The same instruction text under two policies.",
    ],
    experiments: [
      { title: "Conservative", steps: ["Load Conservative-policy stress.", "Choose Conservative.", "Reset and Step. Loads wait while an older store address is unknown."] },
      { title: "Always bypass", steps: ["Stay on that example.", "Choose Always Bypass and turn Enable Load Bypassing on.", "Reset and Step. Independent loads move sooner. A real match still replays."] },
      { title: "Predictor", steps: ["Load Predictor-learning case.", "Choose 2-bit Saturating Counter.", "Step through both iterations. The second copy of the load PC can be more cautious after a replay."] },
      { title: "Two costs", steps: ["On No memory conflicts, compare Conservative waits with Always Bypass.", "On Frequent same-address dependence, compare replays. Waiting was useful on the second example."] },
    ],
    expected: [
      "Conservative avoids violations and can leave independent loads waiting.",
      "Always Bypass exposes more overlap and pays a replay when the guess is wrong.",
      "A predictor is not automatically best. It only helps when past matches predict the next one.",
    ],
    why: [
      "The load’s address and the older store’s address are often unknown at the same time, so the machine cannot yet prove independence.",
    ],
    challenge: "Find one example where Conservative records more waits than Always Bypass and does not need those waits, and another where Always Bypass records at least one replay. Use the waited, bypassed, and replay counts on the page.",
    check: [
      "What is still unknown when the disambiguator chooses wait or bypass?",
      "Why is a replay more than a wasted guess?",
      "When can a predictor beat both fixed policies?",
    ],
    links: [
      { id: "policy", label: "Focus the policy" },
      { id: "replay", label: "Show replays" },
    ],
    checklist: ["Run Conservative on the stress example", "Run Always Bypass on the same example", "Step the predictor-learning case", "Compare waits and replays"],
  },
  "execution-ports": {
    howToUse: [
      "Load an example. The port matrix shows which instruction class each port accepts. Click a port or a class to outline the legal cells.",
      "Scheduling policy is in the menu. Enable Port Scheduling uses issue width 3. Turning it off uses issue width 1.",
      "Each port lists its classes. Click a class to add or remove it. Disable clears that port. Restore ports puts the original map back.",
    ],
    observe: [
      "The class of each instruction and the port it was given.",
      "Busy cycles and idle cycles per port.",
      "Port stalls versus dependency stalls.",
      "Throughput (IPC) and the bottleneck name in Results.",
    ],
    experiments: [
      { title: "Spread the mix", steps: ["Load Mixed ALU and load.", "Step. Integer ALU can use port 0 or 1. Loads use port 3. Read the busy-cycle line."] },
      { title: "One port for the class", steps: ["Load Multiply-heavy.", "Integer multiply starts on port 1 only.", "Step and compare port 1 with ports that have no multiply class."] },
      { title: "Disable a port", steps: ["On Multiply-heavy, press Disable under P1.", "Reset and Step. Multiplies have nowhere to run until you Restore ports or add int-mul elsewhere."] },
      { title: "Move the class", steps: ["Restore ports.", "Turn on int-mul for P0 as well as P1.", "Reset and compare IPC with the one-port run."] },
      { title: "Two policies", steps: ["Load Port contention.", "Run First available, then Least contended, on the same mix.", "First available can place an ADD on the multiply port and leave the MUL waiting."] },
    ],
    expected: [
      "An idle port does not help an instruction whose class is missing from that port.",
      "Changing the class buttons changes where the scheduler is allowed to send the operation.",
    ],
    why: [
      "Each port has a fixed set of classes. Throughput is the compatible ports, not the number of ports on the diagram.",
    ],
    challenge: "Load Multiply-heavy and read Busy cycles. One port should be busy while others stay idle. Then add int-mul to a second port and compare throughput. Restore ports when you are done.",
    check: [
      "Why can a port be idle while an instruction is waiting?",
      "What is port contention on this page?",
      "Why does the instruction mix change which port is the bottleneck?",
    ],
    links: [
      { id: "ports", label: "Focus the ports" },
      { id: "matrix", label: "Focus the capability map" },
    ],
    checklist: ["Run Mixed ALU and load", "Run Multiply-heavy", "Disable P1 and compare", "Add int-mul to a second port"],
  },
  mesi: {
    howToUse: [
      "Choose MSI or MESI, then a Load example or Issue Memory Operation from a core onto a cache line.",
      "Step one event at a time. Number of cores is 2 or 4.",
      "Show Coherence Traffic and Highlight Cache Line only change what is drawn.",
    ],
    observe: [
      "The state of the selected line in each core: M, E, S, or I. MSI has no E.",
      "The bus name on the current event: BusRd, BusRdX, BusUpgr, or Silent.",
      "Invalidations when a write hits a line that other cores hold.",
      "Writeback when a Modified line is read by someone else.",
    ],
    experiments: [
      { title: "First read", steps: ["Load Private data.", "Reset. Step the first read under MESI, then repeat under MSI.", "MESI installs Exclusive. MSI installs Shared."] },
      { title: "Local write from Exclusive", steps: ["Stay on Private data under MESI.", "Step the write from the same core.", "The log says Exclusive to Modified, and the bus is Silent."] },
      { title: "Shared reads", steps: ["Load Read sharing.", "Step until two cores hold the line.", "Both copies are Shared."] },
      { title: "Write after sharing", steps: ["Load Upgrade.", "Step the write.", "The other copy is invalidated. MESI uses BusUpgr when the writer already had a shared copy."] },
    ],
    expected: [
      "MESI avoids a bus transaction on the first write of a line that only one cache holds clean.",
      "MSI does not have that Exclusive state, so the same first write is a bus upgrade.",
    ],
    why: [
      "Exclusive means this cache is the only clean holder. A local write can become Modified without finding other copies to invalidate.",
    ],
    challenge: "Run Private data once in MSI and once in MESI. Point to the write that is Silent under MESI and a bus transaction under MSI.",
    check: [
      "How is Exclusive different from Shared?",
      "When does this lab show BusUpgr?",
      "Why must other Shared copies be invalidated before a write?",
    ],
    links: [
      { id: "lines", label: "Highlight the cache line" },
      { id: "bus", label: "Highlight the bus event" },
    ],
    checklist: ["Compare the first read in MSI and MESI", "Step the silent E to M write", "Share a line across two cores", "Invalidate the other copy"],
  },
  moesi: {
    howToUse: [
      "Pick a Quick Example or add a Read, Write, or Evict from a core.",
      "Step the trace. The memory line says stale or current.",
      "This page is MOESI. The comparison sentence names what MESI would write back on the same accesses.",
    ],
    observe: [
      "Each core’s state: M, O, E, S, or I.",
      "Which core is the owner.",
      "Whether memory is stale.",
      "A cache-to-cache transfer on a remote read of a dirty line.",
      "A writeback when the owner is evicted.",
    ],
    experiments: [
      { title: "Dirty sharing", steps: ["Choose M to O remote read.", "Step the write, then the remote read.", "The writer becomes Owned, the reader becomes Shared, and memory stays stale."] },
      { title: "Another reader", steps: ["Choose O plus multiple sharers.", "Step until two cores are Shared beside the owner."] },
      { title: "Write the line back", steps: ["Choose Owner eviction.", "Step the evict.", "Memory becomes current because the owner wrote the dirty block back."] },
      { title: "Same pattern, other protocol", steps: ["Read the results sentence that compares MOESI writebacks with MESI on this trace.", "MESI updates memory when the dirty line is shared. MOESI can leave that writeback until eviction."] },
    ],
    expected: [
      "A dirty line can be shared. One cache remains the Owner, and memory can stay stale.",
      "Evicting the owner is what makes memory current on the eviction example.",
    ],
    why: [
      "Owned means this cache holds the newest dirty copy and may supply it to sharers. Memory is not updated on that share.",
    ],
    challenge: "Using O plus multiple sharers, Step until one cache is O, another is S, and memory says stale. Then load Owner eviction and Step until memory says current.",
    check: [
      "What does Owned mean on this page?",
      "Why can memory be stale while a core is Shared?",
      "Which cache writes the block back?",
    ],
    links: [
      { id: "owner", label: "Highlight the owner" },
      { id: "memory", label: "Highlight memory" },
    ],
    checklist: ["Reach Owned plus Shared", "Confirm memory is stale", "Evict the owner", "See memory become current"],
  },
  "directory-coherence": {
    howToUse: [
      "Load an example or Issue Request. Read and Write use the requesting core and the block address.",
      "Number of cores is 4 or 8. A single reader is Shared here. There is no Exclusive state.",
      "Step one request at a time and read the directory owner and sharer list before the next write.",
    ],
    observe: [
      "Directory state, owner, and sharer list for the line.",
      "The requester on the current message.",
      "Invalidation targets. Cores that are not sharers are not on that list.",
      "Messages avoided versus a broadcast, next to the invalidation count.",
    ],
    experiments: [
      { title: "One reader", steps: ["Load Cold read.", "Step. The directory records that core as a sharer."] },
      { title: "Several sharers", steps: ["Load Multiple readers.", "Step each read. Sharer ids accumulate. A core that has not read is absent."] },
      { title: "Write with sharers", steps: ["Load Shared line, then a writer.", "Step the write.", "Invalidations name the listed sharers."] },
      { title: "Move the owner", steps: ["Load Ownership migration.", "Step each write and watch the owner field change."] },
    ],
    expected: [
      "A write invalidates the sharers the directory stored, not every core in the machine.",
      "Messages avoided versus a broadcast rises when some cores never held the line.",
    ],
    why: [
      "The directory remembers the owner and the sharers, so the next request can be sent only to those nodes.",
    ],
    challenge: "Load Multiple readers so three cores share the line. The fourth core is not a sharer. Issue a write from that core, Step, and compare the invalidation count with the number of cores.",
    check: [
      "What does the directory store for a line?",
      "Why keep a sharer list instead of a single owner bit?",
      "What does messages avoided versus a broadcast mean on this page?",
    ],
    links: [
      { id: "directory", label: "Show directory sharers" },
      { id: "messages", label: "Show the messages" },
    ],
    checklist: ["Record one sharer", "Add more readers", "Write and read the invalidation targets", "Watch the owner move"],
  },
  "false-sharing": {
    howToUse: [
      "Press False sharing or True sharing. The example menu also includes Separate cache lines and Padded counters. Iterations sets how many writes to run.",
      "Add cache-line padding between variables moves the next variable onto another line of the selected size. Line size is 32, 64, or 128 bytes.",
      "Step. A local hit, a cold fill, and an ownership transfer have different costs printed in the status card. Those are lab units.",
    ],
    observe: [
      "Which variables sit on the highlighted line.",
      "The owner before and after a transfer.",
      "Invalidations, migrations, and estimated cycles.",
      "False-sharing events versus true-sharing events.",
    ],
    experiments: [
      { title: "Same line", steps: ["Choose False sharing and leave padding off.", "Step a write from each core.", "Ownership moves even though the variables are different."] },
      { title: "More writes", steps: ["Raise Iterations.", "Reset and Step. Invalidations and migrations climb with the alternating writes."] },
      { title: "Pad the line", steps: ["Turn on Add cache-line padding between variables.", "Reset and run the same iterations.", "Migrations should fall once the variables no longer share a line."] },
      { title: "True sharing", steps: ["Choose True sharing and turn padding off.", "The transfers remain, because both cores write the same variable."] },
    ],
    expected: [
      "Padding removes the ping-pong only when it puts the variables on different lines.",
      "True sharing still transfers the line. Padding does not remove a real shared variable.",
    ],
    why: [
      "The protocol moves a whole cache line. Two independent variables on that line look like one shared block.",
    ],
    challenge: "On False sharing, raise Iterations until migrations are obvious. Then turn padding on, keep the same iterations, and record the new migration count. That padding is the control that separates the variables.",
    check: [
      "Why is this sharing called false?",
      "What does the protocol move, the variable or the line?",
      "Why can padding cut transfers without removing any of the writes?",
    ],
    links: [
      { id: "line", label: "Show the cache-line boundary" },
      { id: "traffic", label: "Show the transfers" },
    ],
    checklist: ["Run false sharing without padding", "Raise iterations", "Turn padding on and compare migrations", "Contrast with true sharing"],
  },
  "coherence-traffic": {
    howToUse: [
      "Choose a Workload. Private data, True sharing, False sharing, and Ping-pong ownership are the comparison set.",
      "Reset, then Step. Messages so far counts only the events you have reached.",
      "A control message is estimated at 8 bytes. A data payload is one 64-byte line. Those are separate numbers.",
      "Reset before you change the workload. Record Messages so far and Estimated bytes, then run the next pattern.",
    ],
    observe: [
      "The latest message: source, destination, and whether it carries data bytes.",
      "Messages so far, average bytes per message, and invalidation share.",
      "Which cores appear in the per-core traffic.",
      "The hot line: messages, invalidations, and migrations.",
    ],
    experiments: [
      { title: "Private access", steps: ["Load Private data.", "Reset and Step to the end.", "Write down Messages so far. One core touches its own line."] },
      { title: "True sharing", steps: ["Reset. Load True sharing.", "Step the write, the other core’s read, and the later write.", "The messages are required: both cores use the same data."] },
      { title: "False sharing", steps: ["Reset. Load False sharing.", "The page says two counters, 8 bytes apart, share a 64-byte line.", "Compare Messages so far with Private data."] },
      { title: "Ping-pong", steps: ["Reset. Load Ping-pong ownership.", "Step each write.", "Ownership moves between the two cores, and each move can carry a line."] },
    ],
    expected: [
      "Private data stays quieter than a line that several cores write.",
      "False sharing and ping-pong raise message count and data bytes without adding more useful shared results.",
    ],
    why: [
      "The protocol moves a cache line. A control message and a 64-byte data payload are different costs, and a write ping-pong pays both.",
    ],
    challenge: "Step Private data, True sharing, False sharing, and Ping-pong ownership to the end. Record Messages so far and Estimated bytes after each Reset. Name the busiest pattern, then switch that pattern to Private data and compare the drop.",
    check: [
      "Why does false sharing create traffic when the variables are different?",
      "What is the difference between a message and the data bytes on that message?",
      "Why is a write ping-pong expensive?",
    ],
    links: [
      { id: "counters", label: "Show the traffic counters" },
      { id: "log", label: "Show the event log" },
    ],
    checklist: ["Record private traffic", "Run true sharing", "Compare false sharing", "Step the ping-pong writes"],
  },
  "snooping-vs-directory": {
    howToUse: [
      "Pick one Workload. Both columns run that same request list.",
      "Leave Snooping (bus-based) and Directory-based on. Step one request at a time.",
      "Read Snoop messages and Directory messages. Reset before you change the workload or the core count.",
      "Number of cores is 4, 8, 16, or 32. Latency figures are lab units, not a chip’s cycle time.",
    ],
    observe: [
      "Who the snoop column names, versus who the directory column names.",
      "Broadcasts and directory lookups.",
      "Snoop messages and directory messages on this trace.",
      "How those message counts grow when you raise the core count on a sparse trace.",
    ],
    experiments: [
      { title: "One miss", steps: ["Load Private data.", "Reset and Step the first read.", "The snoop side probes other caches. The directory side looks up the line."] },
      { title: "Several sharers, then a write", steps: ["Load One writer, many sharers.", "Step the reads, then the write.", "Compare a broadcast invalidation with invalidations sent to the recorded sharers."] },
      { title: "More cores", steps: ["Load Sparse sharing.", "Note the two message counts at 8 cores.", "Set Number of cores to 32, Reset, and compare. The sharer count of the trace does not grow with the machine."] },
      { title: "Same list, both organizations", steps: ["Stay on one workload.", "Step to the end with both toggles on.", "The values match. The fan-out does not."] },
    ],
    expected: [
      "Snooping contacts caches because they watch the shared interconnect.",
      "The directory uses the owner and the sharer list, so a quiet core is not on that list.",
      "Directory coherence still sends messages. It does not remove coherence.",
    ],
    why: [
      "Snooping has no central sharer list, so a request is visible broadly. The directory stores who holds the line and sends the next request there.",
    ],
    challenge: "Load Sparse sharing so only a few cores hold the line. Step to the end and compare Snoop messages with Directory messages. Then set Number of cores to 32 and record both counts again.",
    check: [
      "What does the directory store that lets it skip a broadcast?",
      "Why does snooping get harder as the core count grows?",
      "Does the directory column ever show zero messages on a write to a shared line?",
    ],
    links: [
      { id: "flow", label: "Show both message paths" },
      { id: "counts", label: "Show the message counts" },
    ],
    checklist: ["Step one miss on both columns", "Write after several sharers", "Raise the core count", "Record both message totals"],
  },
  mshr: {
    howToUse: [
      "Load an example. Number of MSHRs is 1, 2, 4, or 8. Blocking and Non-blocking are separate buttons.",
      "Enable Hit-Under-Miss and Enable Miss-Under-Miss when you want those overlaps. Reset after you change them.",
      "Step until an MSHR row is busy. Memory latency is the fill time, from 1 to 64.",
      "Merged and Exhaustion events are printed in the status line. Peak memory-level parallelism is the outstanding-miss peak.",
    ],
    observe: [
      "Busy MSHR rows and the block they name.",
      "Outstanding misses and any request that is queued because no MSHR is free.",
      "Merged count when a second load joins a block already missing.",
      "Hits finished while a miss is still outstanding.",
      "Exhaustion events and whether the cache is blocked.",
    ],
    experiments: [
      { title: "One miss", steps: ["Load Single miss.", "Choose Blocking.", "Step until the fill completes. Nothing else issues during that miss."] },
      { title: "Two blocks", steps: ["Load Two independent misses.", "Choose Non-blocking, set MSHRs to 4, and turn Miss-Under-Miss on.", "Step. Two MSHR rows can be busy at once."] },
      { title: "Same block", steps: ["Load Merged same-line misses.", "Step the second load of that line.", "Merged increases. A second memory request is not started."] },
      { title: "Fill the table", steps: ["Load MSHR exhaustion.", "The example uses 1 MSHR.", "Step until the status says the next miss cannot allocate."] },
    ],
    expected: [
      "Other requests continue only while a free MSHR, or a merge into an existing one, can track them.",
      "A full MSHR table stalls the next new block even if the cache is non-blocking.",
    ],
    why: [
      "An MSHR remembers an outstanding miss and the loads waiting for that block. Two loads of one block share that record. A new block needs a free row.",
    ],
    challenge: "On High memory-level parallelism, use 4 MSHRs and leave Miss-Under-Miss on. Step until Peak memory-level parallelism is above 1 and Exhaustion events are still 0. Then set Number of MSHRs to 1, Reset, and Step to the first exhaustion.",
    check: [
      "What does one MSHR row remember?",
      "Why do two misses to the same block share a request?",
      "Why does a full MSHR table stall a non-blocking cache?",
    ],
    links: [
      { id: "mshr", label: "Show the MSHR table" },
      { id: "outstanding", label: "Show outstanding misses" },
    ],
    checklist: ["Step a single blocking miss", "Overlap two blocks", "Merge a second load", "Fill the MSHR table"],
  },
  prefetching: {
    howToUse: [
      "Load an example, then press Next-line, Stride, Stream, or Correlation. Reset after you change the prefetcher.",
      "Degree is 1 to 4. Distance is 1 to 4. Confidence is 0 to 1. Queue size is 1 to 16.",
      "This page fixes miss latency at 0, so Late stays 0. A next-line prefetch is installed before the following demand.",
      "Read Useful, Pollution events, and Wasted prefetch bytes. Demand bytes and prefetch bytes are separate.",
    ],
    observe: [
      "D marks on the demand stream and P marks on prefetches.",
      "A green useful hit: the demand found a line the prefetcher installed.",
      "Pollution events and wasted prefetch bytes.",
      "Accuracy and coverage against the no-prefetch misses of the same trace.",
    ],
    experiments: [
      { title: "Sequential stream", steps: ["Load Sequential. It selects Next-line.", "Step through several demands.", "Useful should climb. Late stays 0."] },
      { title: "Irregular stream", steps: ["Load Irregular. The example turns the prefetcher off.", "Note demand misses.", "Press Next-line, Reset, and compare Useful with the sequential run."] },
      { title: "Look farther ahead", steps: ["Stay on Sequential with Next-line.", "Raise Degree from 1 to 4.", "Reset and compare Wasted prefetch bytes with degree 1."] },
      { title: "Pollution", steps: ["Load Random seeded or Phase changing.", "Raise Degree and leave Enable Prefetch Filtering off.", "Read Pollution events. Turn filtering on, Reset, and compare."] },
    ],
    expected: [
      "A regular stream gives the next-line prefetcher useful hits.",
      "An irregular stream lowers accuracy. Extra degree can raise wasted bytes even when some prefetches are correct.",
      "Late is not a result you can create here. The status card says why.",
    ],
    why: [
      "A prefetch helps only when the line is the one the program will touch and it is installed before that touch. This model installs it immediately, so the remaining cost is unused lines and extra bytes.",
    ],
    challenge: "On Sequential, find a Degree where Useful is high and Wasted prefetch bytes stay low. Then raise Degree to 4 on Random seeded and record the increase in Pollution events or wasted bytes.",
    check: [
      "What has to be true for a prefetch to count as useful?",
      "Why does Late stay 0 on this page?",
      "How can a prefetch that matches a later address still hurt?",
    ],
    links: [
      { id: "stream", label: "Show the demand stream" },
      { id: "counts", label: "Show useful and wasted" },
    ],
    checklist: ["Step Sequential with Next-line", "Compare Irregular", "Raise Degree and read wasted bytes", "Turn filtering on and off"],
  },
  "dram-controller": {
    howToUse: [
      "Load a trace. The request table shows bank, row, and Hit, Conflict, or Closed.",
      "Policy is FCFS or FR-FCFS. Reset when you change it. Both policies run on the same addresses.",
      "Commands on a conflict are PRE, then ACT, then RD or WR. A hit issues RD or WR only.",
      "There is no address editor. Change locality by loading another trace with the same request count.",
    ],
    observe: [
      "The open row in the row buffer.",
      "Hit, Conflict, or Closed on the selected request.",
      "PRE, ACT, RD, and WR in the command strip.",
      "Queue wait and the latency comparison between FCFS and FR-FCFS.",
    ],
    experiments: [
      { title: "Row hits", steps: ["Load All row hits.", "Step. The open row stays put.", "The command strip does not insert PRE and ACT for every request."] },
      { title: "Row conflicts", steps: ["Load Repeated row conflicts.", "Step a request that names a different row in that bank.", "You should see PRE, then ACT, before the read."] },
      { title: "Other banks", steps: ["Load Different banks.", "Step. Requests can be in different banks, so one bank’s precharge does not block the others."] },
      { title: "FCFS and FR-FCFS", steps: ["Load FR-FCFS advantage.", "Run FCFS and note the service order.", "Reset, choose FR-FCFS, and Step. A younger request to the open row can go before an older conflict."] },
    ],
    expected: [
      "A hit skips activate. A conflict pays precharge and activate.",
      "FR-FCFS raises row hits by serving a ready open-row request first. The older conflict waits.",
    ],
    why: [
      "The bank keeps one row open. Reading that row again does not repeat PRE and ACT. Closing it does.",
    ],
    challenge: "Load Repeated row conflicts and count conflict rows. Then load All row hits, which has the same number of requests, and count hits. On FR-FCFS advantage, say which request FR-FCFS serves ahead of program order.",
    check: [
      "What is a row-buffer hit on this page?",
      "Why does a conflict show PRE and ACT?",
      "Why can FR-FCFS finish sooner than FCFS on the same addresses?",
    ],
    links: [
      { id: "queue", label: "Show the request queue" },
      { id: "commands", label: "Show PRE and ACT" },
    ],
    checklist: ["Step All row hits", "Step Repeated row conflicts", "Compare Different banks", "Run FCFS and FR-FCFS"],
  },
  "memory-consistency": {
    howToUse: [
      "Choose a litmus test. Store buffering is the two-thread example with X = 1; r1 = Y and Y = 1; r2 = X.",
      "Press Sequential consistency, Total store order, Weak ordering, or Acquire / release. The outcome table rebuilds immediately.",
      "Fence after core 0 store, Fence after core 0 load, and the same two switches for core 1 insert fences. Reset is not required for the table, but Reset restarts the interleaving.",
      "Manual interleaving lists the legal next actions. The builder accepts lines such as 0: X = 1 and 1: r1 = X.",
    ],
    observe: [
      "Allowed and Forbidden rows, and the register values in each outcome.",
      "The same program’s allowed counts under SC and under TSO, printed under the table.",
      "Store-buffer occupancy while you step Total store order.",
      "Which outcomes disappear after a fence.",
    ],
    experiments: [
      { title: "Store buffering", steps: ["Load Store buffering.", "Select Sequential consistency and count Allowed.", "Select Total store order. An outcome that is Forbidden under SC can be Allowed under TSO."] },
      { title: "Add fences", steps: ["Stay on Store buffering and Total store order.", "Turn on Fence after core 0 store and Fence after core 1 store.", "Read the Allowed count again."] },
      { title: "Weaker model", steps: ["Load Load buffering.", "Compare Sequential consistency with Weak ordering.", "Weak ordering permits more reorderings. Acquire / release is a narrower fence."] },
      { title: "Your own test", steps: ["Type a two-thread program in the builder, one operation per line, prefixed with 0: or 1:.", "If the page reports a line error, fix that line before you trust the table.", "Compare Sequential consistency and Weak ordering on that text."] },
    ],
    expected: [
      "The allowed set depends on the model and on the fences, not on a different program result you typed.",
      "A fence removes outcomes. It does not add them.",
    ],
    why: [
      "Total store order lets a load of a different address pass a store that is still in that core’s buffer. Sequential consistency does not. A fence drains that buffer before later operations.",
    ],
    challenge: "On Store buffering, find one outcome that is Allowed under Total store order and Forbidden under Sequential consistency. Then turn on the two store fences and show that outcome leave the Allowed set.",
    check: [
      "What order does sequential consistency keep?",
      "What is sitting in the store buffer under TSO?",
      "Why can a fence change the Allowed column without changing the instructions?",
    ],
    links: [
      { id: "outcomes", label: "Show allowed outcomes" },
      { id: "buffers", label: "Show the store buffers" },
    ],
    checklist: ["Count SC outcomes on store buffering", "Count TSO outcomes", "Add the two store fences", "Try Weak ordering on load buffering"],
  },
  "atomic-operations": {
    howToUse: [
      "Press a primitive: Test-and-set, Compare-and-swap, Fetch-and-add, Load-linked / store-conditional, Ticket lock, or Non-atomic increment.",
      "Thread count, Critical section cycles, Non-critical cycles, and Rounds are the workload. Reset after you change them.",
      "Step and read each thread’s phase, ticket, acquires, fails, and wait.",
      "The bar chart compares TAS and the ticket lock at 2, 4, and 8 threads with think time 0. That chart is not the live thread count until you set it.",
    ],
    observe: [
      "Lock value, counter, next ticket, and serving.",
      "Which thread acquires and which thread fails.",
      "Wait and the wait standard deviation.",
      "The printed TAS order versus the ticket order.",
    ],
    experiments: [
      { title: "Test-and-set", steps: ["Load TAS lock, high contention, or set Test-and-set with 4 threads and Non-critical cycles 0.", "Step several attempts.", "A thread that just released the lock can acquire it again."] },
      { title: "Compare-and-swap", steps: ["Press Compare-and-swap and load CAS counter.", "Step. A CAS succeeds only when the counter still holds the expected value."] },
      { title: "Fetch-and-add", steps: ["Press Fetch-and-add.", "Step one increment per thread.", "Each success returns a different old value, so the counter does not lose an update."] },
      { title: "LL/SC", steps: ["Press Load-linked / store-conditional.", "Step until a failure.", "Another write cleared the reservation, so the store-conditional did not commit."] },
      { title: "Ticket lock", steps: ["Press Ticket lock and set 4 threads.", "Step until several threads have tickets.", "Serving advances in ticket order. Compare that order with the TAS sentence."] },
    ],
    expected: [
      "TAS can re-grant the lock to the same thread. The ticket lock serves tickets in order.",
      "A failed CAS or SC leaves the shared value unchanged.",
    ],
    why: [
      "Each primitive is one indivisible update. The lock algorithm is whatever it does with the old value: spin, take a ticket, or retry.",
    ],
    challenge: "Set 4 threads and Non-critical cycles to 0. Run Test-and-set and record the acquire order in the results sentence. Reset, switch to Ticket lock, and record serving order. Say which order a later thread can predict.",
    check: [
      "Why can test-and-set hand the lock back to the thread that just released it?",
      "What makes a store-conditional fail?",
      "What does the serving ticket enforce?",
    ],
    links: [
      { id: "lock", label: "Show the lock" },
      { id: "threads", label: "Show the threads" },
    ],
    checklist: ["Step TAS under contention", "Step a CAS success and a miss", "Step fetch-and-add", "Compare ticket order"],
  },
  amdahl: {
    howToUse: [
      "Core buttons are 1, 2, 4, 8, 16, 32, and 64. Sweep core counts plays along that list.",
      "Serial fraction, Communication cost, Synchronization cost, Barrier count, and Load imbalance are the sliders and fields.",
      "Include communication and Include synchronization add those terms. At 1 core both overheads are 0, so speedup starts at 1.",
      "Read speedup and efficiency for the selected core count. Efficiency is speedup divided by the core count.",
    ],
    observe: [
      "Serial time, parallel time, communication, and synchronization in the breakdown.",
      "Speedup and the ideal line, if Show ideal is on.",
      "Efficiency for the highlighted core count.",
      "The pure Amdahl limit printed on the Limit card. Overhead is extra.",
    ],
    experiments: [
      { title: "Almost no serial work", steps: ["Load Ideal parallel workload.", "Turn communication and synchronization off.", "Select 1, then 2, then 4. Speedup should track the core count."] },
      { title: "More serial work", steps: ["Load 10% serial fraction.", "Keep overheads off.", "Step the core buttons upward. Speedup flattens under the limit on the Limit card."] },
      { title: "Communication", steps: ["Load Communication-heavy, or keep a 5% serial fraction and turn Include communication on.", "Raise Communication cost.", "Efficiency falls while the serial fraction stays put."] },
      { title: "More cores", steps: ["Stay on 10% serial fraction with overheads off.", "Select 32 and read speedup. Select 64 and read it again.", "The second step is smaller than the first."] },
    ],
    expected: [
      "Only the parallel share shrinks as cores are added.",
      "Serial work sets a ceiling. Communication and synchronization sit on top of that ceiling.",
    ],
    why: [
      "Time is serial work plus parallel work divided by cores, plus the communication and barrier terms when those switches are on.",
    ],
    challenge: "Find a serial fraction where speedup at 64 cores is less than 10% above speedup at 32 cores, with communication and synchronization off. Then turn communication on and see the same core step fall further. Say which term you changed.",
    check: [
      "What number on the Limit card is the pure Amdahl ceiling?",
      "Why does efficiency drop when speedup grows slower than the core count?",
      "Why can communication matter when the serial fraction is already small?",
    ],
    links: [
      { id: "curve", label: "Show the speedup curve" },
      { id: "split", label: "Show serial and parallel time" },
    ],
    checklist: ["Scale the ideal workload", "Raise the serial fraction", "Add communication", "Compare 32 cores with 64"],
  },
  roofline: {
    howToUse: [
      "Load a Roofline example, or type Operations and Bytes transferred. Arithmetic intensity is operations divided by bytes.",
      "Peak compute and Memory bandwidth are the machine. The ridge point is peak compute divided by bandwidth.",
      "Cache blocking halves the bytes. Extra reuse removes 20% of the bytes. Neither changes peak compute.",
      "Read Bound type: memory, compute, or near the ridge.",
    ],
    observe: [
      "Arithmetic intensity and attainable performance.",
      "The sloped memory roof and the flat compute roof.",
      "The ridge point, in FLOP/byte.",
      "Which side of the ridge the workload sits on.",
    ],
    experiments: [
      { title: "Low intensity", steps: ["Load SAXPY or Vector add.", "Leave both reuse switches off.", "Bound type should be memory. The point sits under the sloped roof."] },
      { title: "More reuse", steps: ["Turn on Extra reuse, then Cache blocking.", "Bytes fall and arithmetic intensity rises. Peak compute is unchanged."] },
      { title: "Cross the ridge", steps: ["Load Dense matrix multiply, or keep raising intensity by lowering Bytes transferred.", "Stop when Bound type says compute."] },
      { title: "Move the roofs", steps: ["Note the ridge point.", "Raise Memory bandwidth and read the ridge again. It moves left.", "Raise Peak compute. The flat roof moves up and the ridge moves right."] },
    ],
    expected: [
      "A low-intensity point is limited by bandwidth times arithmetic intensity.",
      "Past the ridge, attainable performance stops at peak compute.",
      "Raising peak compute does not lift a point that is still under the memory roof.",
    ],
    why: [
      "The machine can supply either the compute peak or bandwidth times arithmetic intensity, whichever is smaller.",
    ],
    challenge: "Start from SAXPY or Vector add so Bound type is memory. Do not change Peak compute. Turn on Cache blocking, Extra reuse, or lower Bytes transferred until Bound type says compute. Record the arithmetic intensity and the ridge point.",
    check: [
      "What is arithmetic intensity on this page?",
      "What does the ridge point mark?",
      "Why can a higher peak compute leave a memory-bound point where it is?",
    ],
    links: [
      { id: "chart", label: "Show the roofline" },
      { id: "ridge", label: "Show the ridge point" },
    ],
    checklist: ["Place a memory-bound point", "Turn on reuse", "Cross the ridge", "Move bandwidth and read the ridge"],
  },
  "cpi-ipc": {
    howToUse: [
      "Load a CPI example. The stack is Useful, Front-end, Branch, Execution, Cache, and Memory.",
      "IPC is 1 / CPI for the instruction count on the page.",
      "Branch stall reduction and Memory stall reduction cut those two buckets from 0% to 100%. L1 miss rate and Memory ratio change the cache and memory terms directly.",
      "Read IPC before and IPC after. The stack names the largest bucket.",
    ],
    observe: [
      "Each bucket’s CPI contribution.",
      "Total CPI and IPC.",
      "Which bucket the stack highlights as largest.",
      "How IPC moves when you cut the large bucket versus a small one.",
    ],
    experiments: [
      { title: "Branches", steps: ["Load Branch heavy.", "Note the Branch CPI.", "Move Branch stall reduction to the right and read IPC after."] },
      { title: "Cache", steps: ["Load Cache sensitive.", "Lower L1 miss rate.", "The Cache slice shrinks. Branch stall reduction does not do that job."] },
      { title: "Memory", steps: ["Load Memory bound.", "Move Memory stall reduction and compare IPC with the branch-heavy run’s improvement."] },
      { title: "Largest slice", steps: ["On Memory bound, read which slice is largest.", "Cut that source.", "Then reset the cut and instead cut Branch stall reduction by the same percent. Compare the two IPC changes."] },
    ],
    expected: [
      "Cutting the largest bucket moves IPC more than cutting a small one by the same percent.",
      "IPC rises when CPI falls. The stack shows which term you actually changed.",
    ],
    why: [
      "CPI is the useful term plus the stall terms. A stall term that is already near zero cannot repay a big optimization.",
    ],
    challenge: "On Memory bound, raise IPC using only Memory stall reduction. Record how far you moved it. Reset that slider and try to match the same IPC with only Branch stall reduction. The stack says which attempt is working on the dominant term.",
    check: [
      "How does this page relate CPI and IPC?",
      "Why does cutting a small slice change IPC less?",
      "What can you see in the stack that one CPI number hides?",
    ],
    links: [
      { id: "stack", label: "Show the CPI stack" },
      { id: "ipc", label: "Show IPC before and after" },
    ],
    checklist: ["Read the largest slice", "Cut branch stalls", "Cut memory stalls", "Compare the two IPC changes"],
  },
  "performance-counters": {
    howToUse: [
      "Load a Counter workload. You cannot type a raw instruction or miss count. The profile supplies them.",
      "Step the samples. Interval IPC uses the change in instructions and the change in cycles since the previous sample.",
      "Read IPC, CPI, L1 MPKI, LLC MPKI, and Bandwidth. Stall shares are exclusive slices of the cycle count in this model.",
      "Press Save run, load a second workload, and press Save run again. Saved runs compares the columns.",
    ],
    observe: [
      "Instructions and cycles in the raw table.",
      "IPC and CPI for the interval.",
      "L1 MPKI: misses per thousand instructions, not the raw miss count.",
      "Bandwidth and the memory share of stalls.",
      "Two saved columns with different MPKI and bandwidth.",
    ],
    experiments: [
      { title: "IPC", steps: ["Load Compute heavy.", "Read IPC. It is instructions divided by cycles for this profile.", "Load Front-end heavy and read IPC again. The formula did not change. The inputs did."] },
      { title: "MPKI", steps: ["Load Cache friendly and read L1 MPKI.", "Load Streaming memory.", "L1 MPKI rises because misses grew relative to instructions, not because you typed a miss count."] },
      { title: "Bandwidth", steps: ["On Streaming memory, read Bandwidth.", "Load Compute heavy and read it again.", "Bandwidth follows bytes and time in the profile."] },
      { title: "Stall share", steps: ["On Streaming memory, read the memory stall share in the derive strip.", "Load Compute heavy.", "The memory share drops even if you only glance at IPC."] },
      { title: "Two saved runs", steps: ["Save Compute heavy.", "Load Streaming memory and save again.", "In Saved runs, compare IPC, L1 MPKI, and Bandwidth. IPC alone is the wrong diagnosis."] },
    ],
    expected: [
      "A derived metric moves only when the profile changes an input of that formula.",
      "Compute heavy and Streaming memory do not have the same IPC. MPKI and bandwidth are what separate them.",
    ],
    why: [
      "MPKI divides misses by instructions so a longer run is comparable. IPC divides instructions by cycles and says nothing about which stall produced those cycles.",
    ],
    challenge: "Save Compute heavy and Streaming memory. In Saved runs, point to the column with the higher L1 MPKI and the higher bandwidth. Say why those two numbers, not IPC, identify the memory-heavy sample.",
    check: [
      "Why divide misses by instructions to get MPKI?",
      "Why is a similar IPC not enough to call two runs the same bottleneck?",
      "What does a high L1 MPKI together with a high memory stall share suggest?",
    ],
    links: [
      { id: "derived", label: "Show IPC and MPKI" },
      { id: "raw", label: "Show the raw counters" },
    ],
    checklist: ["Read IPC on two workloads", "Compare L1 MPKI", "Compare bandwidth", "Save both runs"],
  },
};
