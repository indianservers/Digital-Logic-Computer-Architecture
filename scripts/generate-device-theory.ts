import { mkdirSync, writeFileSync } from "node:fs";
import { THEORY_ARTICLES } from "../src/theory/catalogue";
import { focusedArticle } from "../src/theory/focus";
import { lessonPlan } from "../src/theory/lessonPlans";
import { LABS, initialValues } from "../src/studios/how-devices-work/labs/data";
import { simulate } from "../src/studios/how-devices-work/labs/engine";
import { ADVANCED_LABS, initialAdvancedValues } from "../src/studios/how-devices-work/advanced/data";
import { simulateAdvanced } from "../src/studios/how-devices-work/advanced/engine";
import { devicePath } from "../src/studios/how-devices-work/catalogue";

  mkdirSync("output/theory-audit",{recursive:true});
  writeFileSync("output/theory-audit/inventory.json",JSON.stringify(THEORY_ARTICLES.map(a=>focusedArticle(a)),null,2));
  writeFileSync("output/theory-audit/coverage.json",JSON.stringify(THEORY_ARTICLES.map(source=>{const article=focusedArticle(source),plan=lessonPlan(article);return {route:article.route,title:article.title,kind:plan.kind,chapters:article.chapterIds,diagramNodes:plan.diagram.nodes.length,solvedSteps:plan.examples.reduce((n,e)=>n+e.steps.length,0),questions:plan.questions.length};}),null,2));
  const examples=[...LABS.map(lab=>{
    const values=initialValues(lab),mode=lab.modes[0]??"";
    const control=lab.controls.find(c=>c.max>c.min);
    const changed={...values};if(control)changed[control.key]=control.initial<control.max?Math.min(control.max,control.initial+Math.max(control.step,Math.round((control.max-control.min)/10/control.step)*control.step)):control.min;
    return {route:devicePath(lab.device),mode,inputs:lab.controls.map(c=>({label:c.label,value:c.initial,unit:c.unit})),change:control?{label:control.label,from:control.initial,to:changed[control.key],unit:control.unit}:null,before:simulate(lab,values,mode,false,5,"measure").metrics,after:simulate(lab,changed,mode,false,5,"measure").metrics,fault:simulate(lab,values,mode,true,5,"measure").metrics,faultStatus:simulate(lab,values,mode,true,5,"measure").status,principle:lab.principle,flow:lab.device.signalFlow,question:lab.fault};
  }),...ADVANCED_LABS.map(lab=>{
    const values=initialAdvancedValues(lab),mode=lab.modes[0]??"";
    const control=lab.controls.find(c=>c.max>c.min);
    const changed={...values};if(control)changed[control.key]=control.initial<control.max?Math.min(control.max,control.initial+Math.max(control.step,Math.round((control.max-control.min)/10/control.step)*control.step)):control.min;
    return {route:devicePath(lab.device),mode,inputs:lab.controls.map(c=>({label:c.label,value:c.initial,unit:c.unit})),change:control?{label:control.label,from:control.initial,to:changed[control.key],unit:control.unit}:null,before:simulateAdvanced(lab,values,mode,5,false).metrics,after:simulateAdvanced(lab,changed,mode,5,false).metrics,fault:simulateAdvanced(lab,values,mode,5,true).metrics,faultStatus:simulateAdvanced(lab,values,mode,5,true).status,principle:lab.principle,flow:lab.steps.map(([label,detail])=>`${label}: ${detail}`),question:lab.quiz[0],answer:lab.quiz[1]};
  })];
  writeFileSync("src/theory/deviceExamples.json",JSON.stringify(examples,null,2));
