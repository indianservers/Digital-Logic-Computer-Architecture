import { Link } from "react-router-dom";
import { useState } from "react";
import { lessonFAQs, SITE_FAQS, type LessonFAQ } from "./faqs";
import type { TheoryArticle } from "./types";
export function FAQList({items}:{items:LessonFAQ[]}) {
  const [query,setQuery]=useState("");
  const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visible=items.map((item,index)=>({...item,index})).filter(item=>terms.every(term=>`${item.question} ${item.answer}`.toLowerCase().includes(term)));
  return <section className="lesson-faq" id="lesson-faq" aria-labelledby="lesson-faq-heading"><div className="lesson-faq-header"><div><span className="lesson-faq-eyebrow">LAB QUESTIONS & TROUBLESHOOTING</span><h2 id="lesson-faq-heading">Frequently asked questions</h2></div><span className="lesson-faq-count">{items.length} answers</span></div>{items.length>8&&<div className="lesson-faq-search"><label>Find an answer<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search questions and answers…"/></label><span role="status">{visible.length} of {items.length} questions</span></div>}{visible.map(item=><details id={`lesson-faq-${item.index+1}`} key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}{visible.length===0&&<div className="lesson-faq-empty"><p>No matching questions. Try another term or browse all answers.</p><button type="button" onClick={()=>setQuery("")}>Clear search</button></div>}</section>;
}
export function LessonFAQ({article}:{article:TheoryArticle}) {
  return <><FAQList key={article.id} items={lessonFAQs(article)}/><p><Link to={article.route}>Try {article.title} in the interactive lab →</Link></p></>;
}
export function SiteFAQ(){return <FAQList items={SITE_FAQS}/>;}
