import { CHAPTER_BY_ID } from "./chapters";
import { lessonPlan } from "./lessonPlans";
import type { TheoryArticle } from "./types";
import { focusedFAQs } from "./focusedFAQs";

export interface LessonFAQ {question:string; answer:string}
/** Answers use the same focused teaching model as the visible lesson, never promotional claims. */
export function lessonFAQs(article:TheoryArticle):LessonFAQ[] {
  const plan=lessonPlan(article);
  const chapters=article.chapterIds.flatMap(id=>CHAPTER_BY_ID.has(id)?[CHAPTER_BY_ID.get(id)!]:[]);
  const first=plan.concepts[0];
  const example=plan.examples[0];
  const primary=chapters[0];
  const flow=plan.diagram.nodes.map(node=>node.label).join(" → ");
  const candidates:LessonFAQ[]=[
    {question:`What does the ${article.title} lab explain?`,answer:[article.introduction,first?`${first[0]}: ${first[1]}`:""].filter(Boolean).join(" ")},
    ...plan.questions.slice(0,3),
    ...focusedFAQs(article),
    {question:`How can I work through a ${article.title} example?`,answer:example?`${example.title}. ${example.steps.map((step,i)=>`${i+1}. ${step}`).join(" ")}`:article.guide.join(" ")},
    {question:`What should I watch out for when studying ${article.title}?`,answer:primary?.pitfalls.slice(0,3).join(" ") || plan.diagram.note},
    {question:`What should I understand before running ${article.title}?`,answer:[first?.[1],primary?.equation].filter(Boolean).join(" ")},
    {question:`What signal or state sequence should I follow in ${article.title}?`,answer:`Follow this lesson’s sequence: ${flow}. ${plan.diagram.note}`},
    {question:`Which intermediate results should I check in the ${article.title} worked example?`,answer:example?`Use the worked example’s checkpoints: ${example.steps.slice(0,3).join(" ")} Compare intermediate values before relying on the final result.`:plan.concepts.map(([title,body])=>`${title}: ${body}`).join(" ")},
    {question:`How should I set up a controlled comparison in ${article.title}?`,answer:`Start with the lesson’s procedure: ${plan.experiment.length?plan.experiment.join(" "):example?.steps[0]??article.introduction} Record the initial configuration, change one input, and keep the remaining settings and observation time fixed. Compare ${plan.diagram.nodes.at(-1)?.label??"the output"} with your prediction.`},
    {question:`What should I be able to explain after completing ${article.title}?`,answer:article.takeaways.length?article.takeaways.slice(0,3).join(" "):plan.concepts.map(([title,body])=>`${title}: ${body}`).join(" ")},
  ];
  return [...new Map(candidates.filter(q=>q.answer.trim()).map(q=>({...q,answer:q.answer.length<80&&first?`${q.answer} ${first[1]}`:q.answer})).map(q=>[q.question,q])).values()];
}
export const SITE_FAQS:LessonFAQ[]=[
  {question:"Where can I learn digital electronics and computer architecture through interactive labs?",answer:"LogicLab by AIMER Society brings together browser-based studios for number systems, Boolean logic, memory, processors, VLSI, and embedded systems. Choose a studio, read its Theory & Textbook lesson, and compare a worked example with the interactive teaching model."},
  {question:"How should I use the textbook and simulator together?",answer:"Start with a lesson’s diagram and solved example. Write down the expected intermediate values, open the matching lab, and compare the observed result. Change one input at a time and use the practice questions to explain what happened."},
  {question:"Do these simulations replace physical hardware or device specifications?",answer:"These labs are educational models. Their configured word widths, timing, and assumptions determine their results. Use real device documentation and suitable hardware measurements when designing or validating a physical system."},
  {question:"Can I link directly to an individual lab or theory lesson?",answer:"Yes. Each published lab has a readable public URL and a matching /theory lesson URL. You can share the lesson itself rather than sending someone through the home page."},
];
