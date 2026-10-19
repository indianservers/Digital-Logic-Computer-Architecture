import { describe, expect, it } from "vitest";
import { THEORY_ARTICLES, THEORY_BY_ID, normalizeRoute, searchTheory, theoryForRoute } from "./catalogue";
import { CHAPTERS, CHAPTER_BY_ID, REFERENCES } from "./chapters";
import { ARCH_STUDIOS } from "../data/architecture";
import { ACA_LABS, acaRoute } from "../data/acaLabs";
import { implementedVlsiLabs, vlsiRoute } from "../data/vlsiLabs";
import { LAB_META, labPath } from "../studios/microcontroller/labs/registry";
import { PROJECT_LABS } from "../studios/microcontroller/projectData";
import { DEVICES, devicePath } from "../studios/how-devices-work/catalogue";
import tabs from "./tabMetadata.json";

describe("encyclopedia coverage and navigation",()=>{
  it("provides a contextual article for every current studio tab and catalogued lab",()=>{
    const routes=[...tabs.flatMap(s=>s.tabs.map(t=>`${s.path}?tab=${t.id}`)),...ARCH_STUDIOS.flatMap(s=>s.labs.map(l=>l.id==="overview"?s.path:`${s.path}/${l.id}`)),...ACA_LABS.map(l=>acaRoute(l.slug)),...implementedVlsiLabs().map(l=>vlsiRoute(l.slug)),...LAB_META.map(labPath),...PROJECT_LABS.map(l=>`/studios/microcontroller/project/${l.slug}`),...DEVICES.map(devicePath)];
    const missing=routes.filter(r=>{const [p="",q=""]=r.split("?");const a=theoryForRoute(p,q?`?${q}`:"");return !a || normalizeRoute(a.route)!==normalizeRoute(r);});
    expect(missing).toEqual([]);
  });
  it("has unique stable article ids and complete original chapters",()=>{
    expect(THEORY_BY_ID.size).toBe(THEORY_ARTICLES.length);
    expect(new Set(CHAPTERS.map(c=>c.id)).size).toBe(CHAPTERS.length);
    for(const a of THEORY_ARTICLES){
      expect(a.chapterIds.length,a.route).toBeGreaterThan(0);
      for(const id of a.chapterIds) expect(CHAPTER_BY_ID.has(id),`${a.route}: ${id}`).toBe(true);
    }
    for(const c of CHAPTERS){
      expect(c.paragraphs.length,c.id).toBeGreaterThanOrEqual(3);
      expect(c.example.length,c.id).toBeGreaterThanOrEqual(3);
      expect(c.pitfalls.length,c.id).toBeGreaterThan(0);
      expect(c.answer.length,c.id).toBeGreaterThan(15);
      for(const ref of c.references)expect(REFERENCES[ref],c.id).toBeDefined();
    }
  });
  it("preserves tab context, including device-based flip-flop selection",()=>{
    expect(theoryForRoute("/studios/interrupts","?tab=dma&unused=1")?.title).toBe("DMA");
    expect(theoryForRoute("/studios/number-systems","?tab=hamming")?.chapterIds).toContain("codes");
    expect(theoryForRoute("/studios/flip-flops","?tab=lab&device=jk")?.route).toBe("/studios/flip-flops?tab=jk");
  });
  it("searches specific concepts and filters by studio",()=>{
    expect(searchTheory("hamming").some(a=>a.route.includes("tab=hamming"))).toBe(true);
    expect(searchTheory("", "interrupts").every(a=>a.studio==="interrupts")).toBe(true);
    expect(searchTheory("zznoresultzz")).toEqual([]);
  });
  it("includes specialized mechanisms in the appropriate lab",()=>{
    expect(theoryForRoute("/studios/interrupts","?tab=dma")?.chapterIds).toContain("dma");
    expect(theoryForRoute("/studios/interrupts","?tab=priority")?.chapterIds).toContain("priority");
    expect(theoryForRoute("/studios/number-systems","?tab=ieee")?.chapterIds).toContain("floating");
  });
});
