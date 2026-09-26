import { describe, expect, it } from "vitest";
import { ACA_LABS } from "../../../data/acaLabs";
import { LAB_GUIDE_LIST, LAB_GUIDES } from "./index";

const GENERIC = /to understand the concept/i;

describe("ACA lab guides", () => {
  it("covers every lab id exactly once", () => {
    expect(LAB_GUIDE_LIST).toHaveLength(31);
    expect(Object.keys(LAB_GUIDES).sort()).toEqual(ACA_LABS.map((lab) => lab.id).sort());
    const numbers = LAB_GUIDE_LIST.map((guide) => guide.labNumber).sort((a, b) => a - b);
    expect(numbers).toEqual(ACA_LABS.map((_, index) => index + 1));
  });

  it("keeps each guide specific and complete", () => {
    const aims = new Set<string>();
    for (const guide of LAB_GUIDE_LIST) {
      expect(guide.aim.length, guide.id).toBeGreaterThan(40);
      expect(GENERIC.test(guide.aim), guide.id).toBe(false);
      expect(aims.has(guide.aim), guide.id).toBe(false);
      aims.add(guide.aim);
      expect(guide.purpose.length, guide.id).toBeGreaterThan(20);
      expect(guide.prerequisites.length, guide.id).toBeGreaterThanOrEqual(2);
      expect(guide.learningObjectives.length, guide.id).toBeGreaterThanOrEqual(2);
      expect(guide.theory.length, guide.id).toBeGreaterThanOrEqual(2);
      expect(guide.keyTerms.length, guide.id).toBeGreaterThanOrEqual(2);
      expect(guide.assumptions.length, guide.id).toBeGreaterThanOrEqual(1);
      expect(guide.setup.length, guide.id).toBeGreaterThanOrEqual(1);
      expect(guide.procedure.length, guide.id).toBeGreaterThanOrEqual(4);
      expect(guide.controls.length, guide.id).toBeGreaterThanOrEqual(3);
      expect(guide.observations.length, guide.id).toBeGreaterThanOrEqual(3);
      expect(guide.formulas.length, guide.id).toBeGreaterThanOrEqual(1);
      expect(guide.expectedBehavior.length, guide.id).toBeGreaterThanOrEqual(2);
      expect(guide.resultInterpretation.length, guide.id).toBeGreaterThanOrEqual(1);
      expect(guide.misconceptions.length, guide.id).toBeGreaterThanOrEqual(2);
      expect(guide.variations.length, guide.id).toBeGreaterThanOrEqual(2);
      expect(guide.learningOutcomes.length, guide.id).toBeGreaterThanOrEqual(2);
      expect(guide.viva.length, guide.id).toBeGreaterThanOrEqual(5);
      expect(guide.viva.length, guide.id).toBeLessThanOrEqual(10);
      expect(guide.selfCheck.length, guide.id).toBeGreaterThanOrEqual(3);
      expect(guide.summary.length, guide.id).toBeGreaterThan(20);
      for (const formula of guide.formulas) {
        expect(formula.expression.length, `${guide.id} ${formula.name}`).toBeGreaterThan(3);
      }
      for (const item of guide.selfCheck) {
        expect(item.answer, guide.id).toBeGreaterThanOrEqual(0);
        expect(item.answer, guide.id).toBeLessThan(item.choices.length);
        expect(item.choices.length, guide.id).toBeGreaterThanOrEqual(2);
      }
      for (const item of guide.viva) {
        expect(item.answer.length, guide.id).toBeGreaterThan(8);
      }
    }
  });
});
