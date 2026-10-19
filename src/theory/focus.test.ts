import { describe, expect, it } from "vitest";
import { LAB_CHAPTERS, focusedArticle } from "./focus";
import { theoryForRoute, THEORY_ARTICLES } from "./catalogue";
import { CHAPTER_BY_ID } from "./chapters";

describe("focused textbook lessons",()=>{
  it("keeps selected lab content separate from the full library",()=>{
    const a=theoryForRoute("/studios/number-systems","?tab=hamming&view=theory")!;
    expect(focusedArticle(a).chapterIds).toEqual(["hamming-detail"]);
    const dma=theoryForRoute("/studios/interrupts","?tab=dma&view=theory")!;
    expect(focusedArticle(dma).chapterIds).toEqual(["dma"]);
  });
  it("maps every curated lesson to existing chapters",()=>{
    for(const [route,ids] of Object.entries(LAB_CHAPTERS)){
      const [path="",query=""]=route.split("?");
      expect(theoryForRoute(path,`?${query}`),route).toBeDefined();
      for(const id of ids)expect(CHAPTER_BY_ID.has(id),`${route}: ${id}`).toBe(true);
    }
  });
  it("provides a focused lesson for every article",()=>{
    for(const article of THEORY_ARTICLES)expect(focusedArticle(article).chapterIds.length,article.route).toBeGreaterThan(0);
  });
  it("uses a dedicated lesson for each memory technology",()=>{
    for(const tab of ["array","sram","dram","rom","eeprom","flash","addressing","organization"]){
      const a=focusedArticle(theoryForRoute("/studios/memory",`?tab=${tab}`)!);
      expect(a.route).toBe(`/studios/memory?tab=${tab}`);
      expect(a.chapterIds).toHaveLength(1);
      expect(a.chapterIds[0]).toMatch(/-detail$/);
    }
  });
});
