import { describe, expect, it } from "vitest";
import { THEORY_ARTICLES } from "./catalogue";
import { focusedArticle } from "./focus";
import { lessonPlan, topicFor, CHAPTER_FLOWS } from "./lessonPlans";
import { CHAPTERS } from "./chapters";

describe("textbook editorial coverage",()=>{
  it("gives every lesson a diagram, worked solution, and explained questions",()=>{
    const report=THEORY_ARTICLES.map(source=>{
      const article=focusedArticle(source),plan=lessonPlan(article);
      expect(plan.diagram.nodes.length,article.route).toBeGreaterThanOrEqual(3);
      for(const node of plan.diagram.nodes){expect(node.label.length,article.route).toBeGreaterThan(0);expect(node.detail.length,article.route).toBeGreaterThan(10);}
      expect(plan.concepts.length,article.route).toBeGreaterThanOrEqual(2);
      expect(plan.examples.length,article.route).toBeGreaterThan(0);
      for(const example of plan.examples)expect(example.steps.length,article.route).toBeGreaterThanOrEqual(3);
      expect(plan.questions.length,article.route).toBeGreaterThanOrEqual(2);
      for(const question of plan.questions){expect(question.question.length,article.route).toBeGreaterThan(4);expect(question.answer.length,article.route).toBeGreaterThan(10);}
      return {route:article.route,title:article.title,kind:plan.kind,chapters:article.chapterIds,diagramNodes:plan.diagram.nodes.length,solvedSteps:plan.examples.reduce((n,e)=>n+e.steps.length,0),questions:plan.questions.length};
    });
    console.log(JSON.stringify({articles:report.length,mechanismTopics:report.filter(r=>r.kind==="topic").length,deviceScenarios:report.filter(r=>r.kind==="device").length,foundational:report.filter(r=>r.kind==="foundation").length}));
  });
  it("has a diagram path for every original chapter",()=>{
    expect(CHAPTERS.filter(c=>!CHAPTER_FLOWS[c.id]).map(c=>c.id)).toEqual([]);
  });
  it("keeps potentially ambiguous lab titles on the correct mechanism",()=>{
    const checks:Array<[string,string]>=[
      ["Watchdog Timer","watchdog"],["Program Counter, Stack & Stack Pointer","call-stack"],
      ["ADC Resolution & Quantization","adc"],["Analog Comparator","analog-comparator"],
      ["PWM Generator","pwm"],["I²C Communication","i2c"],
      ["CMOS Voltage Transfer Characteristic","cmos-inverter"],["NoC Visualization","interconnect"],
      ["False Sharing Visualizer","false-sharing"],["Branch Target Buffer Explorer","btb"],
    ];
    for(const [title,id] of checks){const article=THEORY_ARTICLES.find(a=>a.title===title)!;expect(article,title).toBeDefined();expect(topicFor({...article,chapterIds:[]})?.id,title).toBe(id);}
  });
});
