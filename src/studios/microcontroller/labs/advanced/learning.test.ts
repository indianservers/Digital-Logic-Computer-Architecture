import { describe, expect, it } from "vitest";
import lessons from "../../../../data/microcontrollerLearning.json";
import { THEORY_ARTICLES } from "../../../../theory/catalogue";
import { lessonPlan } from "../../../../theory/lessonPlans";
import { modelByNumber } from "./models";
import type { Params, Readout } from "./model";

interface Snapshot { number: number; baseline: Params; comparison: Params; budgetMs: number; before: { metrics: Readout[] }; after: { metrics: Readout[] } }
describe("simulator-derived Microcontroller lessons", () => {
  it("provides relevant worked examples for all 22 new labs", () => {
    expect(lessons).toHaveLength(22);
    for (const lesson of lessons) {
      const article = THEORY_ARTICLES.find((item) => item.route === lesson.route)!;
      expect(article, lesson.route).toBeDefined();
      expect(article.introduction).toBe(lesson.objective);
      const plan = lessonPlan(article);
      expect(plan.diagram.nodes.map((node) => node.label)).toEqual(lesson.flow);
      expect(plan.examples[0]?.steps).toEqual(lesson.example);
      expect(plan.questions[0]?.answer).toBe(lesson.questions[0]!.answer);
    }
  });
  it("reproduces every generated baseline and comparison measurement from the live engine", () => {
    const snapshots = lessons.filter((lesson) => lesson.number <= 54) as unknown as Snapshot[];
    for (const snapshot of snapshots) {
      const model = modelByNumber(snapshot.number)!;
      for (const [p, expected] of [[snapshot.baseline, snapshot.before.metrics], [snapshot.comparison, snapshot.after.metrics]] as const) {
        let state = model.create(p);
        if ([43, 45, 50].includes(model.number)) state = model.action!(state, p, model.number === 43 ? "dip" : model.number === 45 ? "pedestrian" : "start");
        state = model.step(state, p, snapshot.budgetMs);
        expect(model.metrics(state, p), String(snapshot.number)).toEqual(expected);
      }
    }
  });
});
