import type { ContestReport } from "./contest";
export interface ScoreRules {name:string;requiredTests:string[];tieBreak:"cycles"|"components"|"none";}
export const DEFAULT_RULES:ScoreRules={name:"Build Your Own CPU",requiredTests:[],tieBreak:"cycles"};
export function scoreEvidence(report:ContestReport,rules:ScoreRules,components:number){
 const missing=rules.requiredTests.filter(id=>!report.results.some(r=>r.id===id&&r.status==="pass"));const incomplete=report.results.length!==report.total||report.results.some(r=>r.status==="cancelled");const blocked=report.results.some(r=>r.status==="blocked")||report.findings.some(f=>f.level==="error");
 return {eligible:!missing.length&&!incomplete&&!blocked,disqualification:[...missing.map(id=>`Required test ${id} did not pass`),...(incomplete?["Incomplete run"]:[]),...(blocked?["Blocked model or test"]:[])],correctness:report.total?100*report.passed/report.total:0,cyclesOnPassedTests:report.results.filter(r=>r.status==="pass").reduce((sum,r)=>sum+r.cycles,0),components,tieBreak:rules.tieBreak,comparison:"Compare eligible entries on the same engine and suite: higher correctness first; ties use lower chosen metric. Performance comparisons require the same passed tests. No physical speed or area claim."};
}
