import {readFileSync,writeFileSync} from 'node:fs';
const rows=readFileSync('src/studios/builder/contestEnhancements.ts','utf8').split(/\r?\n/).filter(line=>/^\s*\["/.test(line)).map(line=>JSON.parse(line.trim().replace(/,$/,'')));
if(rows.length!==50)throw new Error(`Expected 50 enhancements, got ${rows.length}`);
const intro=`BUILD YOUR OWN CPU — 50 CONTEST ENHANCEMENTS

Implemented in the local studio at /architecture/builder/contest.
Open Component Library → Test Bench for actual component experiments.
Open Contest & Evidence → Model & Enhancements for this list in the application.

The system is an executable logic-level custom CPU simulator. Its editable graph is real input to execution. It is not a physical chip, manufacturer IC replica, FPGA synthesizer, certified standard ISA, concurrent pipeline, or hardware timing/power model. The independent reference uses separate BigInt execution and condition-flag semantics but shares the assembler and decoder. Accumulator and unified-memory programs use explicit final-state assertions instead of differential comparison.

Each test uses an independent reset copy; register, memory, PC, HALT and ALU-flag differences are checked after committed instructions. Source, actual encoded words, traces, assertions, cycle counts and hashes can be inspected and exported. CPI counts HALT as an instruction. All score contributions are equal-weight public test passes, not an official contest ranking.

Contest resource limits: 128 components, 512 wires, 64 tests, 1–2000 simulated cycles per test. Unsupported blocks, ambiguous architectures, unknown fallback, I/O and latency claims are blocked. Graph editing supports larger designs; these contest limits are disclosed explicitly.

ENHANCEMENTS AND VERIFICATION LOCATIONS

`;
const ending=`

VERIFICATION

90 targeted tests pass across contest, project/simulator, Blocks, arithmetic and architecture suites. TypeScript and production build are also checked. A broader part4 test still has its existing failure for 18 mobile/desktop curriculum routes, outside this CPU change.

Browser smoke test: the current 16-bit project passed 13/13 generated challenges; export → judge import → independent rerun reproduced the report exactly. All five executable template samples passed their documented result-of-12 assertions. Screenshots, a labeled verification-fixture submission and replayed report are retained alongside this file. The fixture is a software verification example, not a contest participant.

Hashes detect disagreement with the supplied manifest. They are not author signatures; a malicious person can recompute hashes. Judges should rerun packages with their own test suite and assess originality separately. The studio has no server registration, identity verification, private test server or public leaderboard.

RECOMMENDED CONTEST FLOW

1. Publish the permitted model capabilities and one common functional test contract before entries open.
2. Require a submission bundle, design notes, attribution and a short live explanation of the datapath.
3. Have judges rerun the imported design against the supplied suite and a separate organizer-authored suite. Import the project through the normal Project menu before running a different suite.
4. Judge correctness using actual expected-state assertions; assess originality and explanation manually. Use cycle counts only within comparable ISA/test/memory contracts. Do not award hardware-frequency, area, pipeline or power points for unmodeled behavior.
5. Archive the exact package and judge replay so disputed outcomes can be reproduced.

PRIMARY LEARNING REFERENCES

https://www.nand2tetris.org/project05 — educational CPU construction and supplied test programs.
https://www.ti.com/product/SN74HC157 — physical multiplexer documentation; no equivalence claim for the generic simulator MUX.
https://www.ti.com/product/SN74HC595 — physical serial shift-register documentation; generic parallel registers are not this part.

IMPLEMENTATION

src/engines/builder/contest.ts — test suite, independent reference, execution, hashes and judge verification.
src/engines/builder/componentContract.ts — behavior contracts and actual graph bench.
src/engines/builder/engineeringValidation.ts / validate.ts / isa.ts — structural and encoding checks.
src/studios/builder/ContestLab.tsx / ComponentWorkbench.tsx — contest and component interfaces.
src/engines/builder/contest.test.ts — independent regression cases including deliberately wrong graphs.
src/engines/digital/arithmetic.ts — logical shift at/above width corrected; rotations still wrap.
`;
writeFileSync('outputs/cpu-studio/contest/50-enhancements.txt',intro+rows.map(([area,title,where],i)=>`${i+1}. ${title}\n   Area: ${area}. Verify: ${where}.`).join('\n\n')+ending);
console.log('Wrote 50 numbered enhancements and contest verification notes.');
