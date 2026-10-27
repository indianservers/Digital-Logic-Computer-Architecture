import { LessonDiagram } from "./LessonDiagram";
import { lessonPlan } from "./lessonPlans";
import type { TheoryArticle } from "./types";

export function LabLesson({article}:{article:TheoryArticle}) {
  const plan=lessonPlan(article);
  return <section id="textbook-lab-lesson" className="textbook-lab-lesson">
    <h2>Understand {article.title}</h2>
    <p className="lesson-scope">This lesson follows the selected lab. Read the mechanism, predict each step, then use the experiment to check your reasoning.</p>
    <div className="lesson-concepts">{plan.concepts.map(([title,body])=><section key={title}><h3>{title}</h3><p>{body}</p></section>)}</div>
    <LessonDiagram key={article.id} diagram={plan.diagram}/>
    {plan.examples.map((example,index)=><section className="textbook-example lesson-solved" id={`textbook-solved-${index}`} key={index}><span className="textbook-eyebrow">SOLVED EXAMPLE · GIVEN → METHOD → RESULT</span><h3>{example.title}</h3><ol>{example.steps.map((step,i)=><li key={i}>{step}</li>)}</ol></section>)}
    <section id="textbook-practice"><h2>Questions to test your understanding</h2><p>Try each question before revealing its explanation. Use the diagram and the intermediate values to justify your answer.</p>{plan.questions.map((q,index)=><div className="textbook-question" key={`${index}-${q.question}`}><h3>{index+1}. {q.question}</h3><details><summary>Show answer and reasoning</summary><p>{q.answer}</p></details></div>)}</section>
  </section>;
}
