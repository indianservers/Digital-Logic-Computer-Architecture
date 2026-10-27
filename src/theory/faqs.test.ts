import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { THEORY_ARTICLES } from "./catalogue";
import { lessonFAQs } from "./faqs";
import { focusedFAQs } from "./focusedFAQs";
import { FAQList } from "./LessonFAQ";

describe("expanded relevant lab FAQs", () => {
  it("provides at least ten substantive unique answers for every lab", () => {
    for (const article of THEORY_ARTICLES) {
      const faqs = lessonFAQs(article);
      expect(faqs.length, article.route).toBeGreaterThanOrEqual(10);
      expect(new Set(faqs.map(faq=>faq.question.toLowerCase())).size,article.route).toBe(faqs.length);
      for(const faq of faqs){
        expect(faq.answer.length,`${article.route}: ${faq.question}`).toBeGreaterThan(40);
        expect(faq.answer).not.toMatch(/undefined|\[object Object\]/);
      }
      expect(faqs.some(faq=>faq.question.includes("controlled comparison")),article.route).toBe(true);
    }
  });
  it("keeps topic troubleshooting specific and does not turn register renaming into a storage lab", () => {
    const article = (route:string)=>THEORY_ARTICLES.find(a=>a.route===route)!;
    const thermal = article("/architecture/mobile/power-thermal");
    expect(focusedFAQs(thermal).some(f=>f.answer.includes("5 °C"))).toBe(true);
    const dma = THEORY_ARTICLES.find(a=>a.route.includes("interrupts")&&a.route.includes("dma"))!;
    expect(focusedFAQs(dma).some(f=>f.question.includes("stale data"))).toBe(true);
    const renaming = THEORY_ARTICLES.find(a=>/renam/i.test(a.title))!;
    expect(focusedFAQs(renaming).some(f=>f.answer.includes("latch"))).toBe(false);
    const pc = THEORY_ARTICLES.find(a=>/program counter/i.test(a.title))!;
    expect(focusedFAQs(pc).some(f=>f.question.includes("prescaler"))).toBe(false);
    const vector = {...THEORY_ARTICLES[0]!,title:"Vector processing",route:"/architecture/accelerator/vector"};
    expect(focusedFAQs(vector).some(f=>f.question.includes("pending interrupt"))).toBe(false);
  });
  it("server-renders every answer and exposes a labelled search for longer lists", () => {
    const faqs = lessonFAQs(THEORY_ARTICLES[0]!);
    const html = renderToStaticMarkup(createElement(FAQList,{items:faqs}));
    expect(html).toContain('type="search"');
    expect(html).toContain("Find an answer");
    expect((html.match(/<details /g)??[]).length).toBe(faqs.length);
    expect(html).toContain(`${faqs.length} answers`);
  });
});
