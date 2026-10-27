import { Link } from "react-router-dom";
import { THEORY_BY_ID, theoryForRoute } from "./catalogue";
import { focusedArticle } from "./focus";
import { lessonPlan } from "./lessonPlans";
import { CHAPTER_BY_ID } from "./chapters";
import { LessonDiagram } from "./LessonDiagram";
import { LessonFAQ, SiteFAQ } from "./LessonFAQ";

/** Shared, visible simulator companion: also rendered as HTML for non-JavaScript readers. */
export function LabOverview({id,context}:{id?:string;context?:{pathname:string;search:string}}) {
  const source=id?THEORY_BY_ID.get(id):context?theoryForRoute(context.pathname,context.search):undefined;
  if(!source)return null;
  const article=focusedArticle(source);
  const plan=lessonPlan(article);
  const theory=article.route+(article.route.includes("?")?"&":"?")+"view=theory";
  const chapters=article.chapterIds.flatMap(id=>CHAPTER_BY_ID.has(id)?[CHAPTER_BY_ID.get(id)!]:[]);
  return <article className="lab-study-companion" aria-label={`${article.title} learning guide`}>
    <nav aria-label="Breadcrumb"><Link to="/">Home</Link> / <Link to="/studios">Studios</Link> / <span>{article.studioTitle}</span></nav>
    <h2>Explore {article.title}</h2><p>{article.introduction}</p>
    <section><h3>What you will learn</h3><ul>{(article.takeaways.length?article.takeaways:plan.concepts.map(([title,body])=>`${title}: ${body}`)).map((text,i)=><li key={i}>{text}</li>)}</ul></section>
    <LessonDiagram diagram={plan.diagram}/>
    <section><h3>Try a worked example</h3><ol>{plan.examples[0]?.steps.map((step,i)=><li key={i}>{step}</li>)}</ol></section>
    <section><h3>Check your understanding</h3><p>{plan.questions[0]?.question}</p><details><summary>Show explanation</summary><p>{plan.questions[0]?.answer}</p></details></section>
    <p><Link to={theory}>Read the complete {article.title} Theory & Textbook lesson →</Link></p>
    <section><h3>Assumptions and common mistakes</h3><ul>{chapters.flatMap(c=>c.pitfalls).slice(0,3).map((text,i)=><li key={i}>{text}</li>)}</ul><p>Use the lab’s displayed configuration and teaching assumptions. A simulation is not a substitute for a physical device specification.</p></section>
    <LessonFAQ article={article}/>
  </article>;
}
export {SiteFAQ};
