import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CHAPTER_BY_ID, REFERENCES } from "./chapters";
import { THEORY_ARTICLES, THEORY_BY_ID, searchTheory, theoryForRoute } from "./catalogue";
import type { TheoryArticle } from "./types";
import { COMPARISONS, TERMS } from "./referenceData";
import { focusedArticle } from "./focus";
import { FOCUSED_TERMS } from "./focusedTerms";
import { LabLesson } from "./LabLesson";
import { lessonPlan } from "./lessonPlans";
import "./theory.css";

const READABLE_ARTICLES=THEORY_ARTICLES.filter(a=>!a.route.includes("#")&&!["/studios/combinational?tab=canvas","/studios/truth-tables?tab=from-table"].includes(a.route));
const READABLE_IDS=new Set(READABLE_ARTICLES.map(a=>a.id));
type Props={ context?: {pathname:string;search:string}; onClose?:()=>void };
function savedIds(): string[] { try {const parsed:unknown=JSON.parse(localStorage.getItem("logiclab.theory.bookmarks") ?? "[]");return Array.isArray(parsed)?parsed.filter((v):v is string=>typeof v==="string"):[];} catch{return [];} }
export function TheoryReader({context,onClose}:Props) {
  const [params,setParams]=useSearchParams();
  const contextual=context?theoryForRoute(context.pathname,context.search):undefined;
  const [localId,setLocalId]=useState(contextual?.id ?? "");
  const id=context?localId:params.get("article") ?? "";
  const [query,setQuery]=useState("");
  const [studio,setStudio]=useState(contextual?.studio ?? "all");
  const [bookmarks,setBookmarks]=useState(savedIds);
  const [onlySaved,setOnlySaved]=useState(false);
  const article=THEORY_BY_ID.get(id);
  const studios=useMemo(()=>[...new Map(READABLE_ARTICLES.map(a=>[a.studio,a.studioTitle])).entries()].sort((a,b)=>a[1].localeCompare(b[1])),[]);
  const results=useMemo(()=>searchTheory(query,studio).filter(a=>READABLE_IDS.has(a.id)).filter(a=>!onlySaved || bookmarks.includes(a.id)),[query,studio,onlySaved,bookmarks]);
  function choose(a:TheoryArticle) { if(context) setLocalId(a.id);else {const next=new URLSearchParams(params);next.set("article",a.id);setParams(next);} }
  function toggleBookmark(a:TheoryArticle) {const next=bookmarks.includes(a.id)?bookmarks.filter(x=>x!==a.id):[...bookmarks,a.id];setBookmarks(next);try{localStorage.setItem("logiclab.theory.bookmarks",JSON.stringify(next));}catch{/* Reading remains available if storage is disabled. */}}
  return <div className={`textbook ${context?"textbook-in-dialog":"textbook-page"}`} onClickCapture={event=>{
    const link=(event.target as HTMLElement).closest("a");
    if(onClose && /^\/(studios|architecture)\//.test(link?.getAttribute("href")??"")) onClose();
  }}>
    <header className="textbook-top"><Link to="/encyclopedia" className="textbook-brand"><span aria-hidden="true">▤</span><div><strong>LogicLab Encyclopedia</strong><small>Understand the idea. Derive the result. Test it in the lab.</small></div></Link>{onClose?<button className="textbook-close" onClick={onClose} autoFocus aria-label="Close textbook">✕</button>:<Link to="/studios" className="textbook-link">Back to studios →</Link>}</header>
    <div className="textbook-layout">
      <aside className="textbook-library" aria-label="Theory library">
        <div className="textbook-library-head"><span className="textbook-eyebrow">THE COMPLETE LIBRARY</span><h2>Explore & understand</h2><p>{READABLE_ARTICLES.length} lab articles · {studios.length} studio collections</p><label>Search the encyclopedia<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Try DMA, Hamming, cache…"/></label><label>Studio<select value={studio} onChange={e=>setStudio(e.target.value)}><option value="all">All studios</option>{studios.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><button className={`textbook-saved ${onlySaved?"active":""}`} aria-pressed={onlySaved} onClick={()=>setOnlySaved(!onlySaved)}>☆ Saved reading ({bookmarks.length})</button></div>
        <p className="textbook-result-count" aria-live="polite">{results.length} articles</p>
        <nav className="textbook-results" aria-label="Articles">{results.map(a=><Link key={a.id} to={a.route+(a.route.includes("?")?"&":"?")+"view=theory"} className={a.id===id?"active":""} aria-current={a.id===id?"page":undefined}><small>{a.studioTitle}</small><strong>{a.title}</strong></Link>)}{!results.length&&<p className="textbook-empty">No articles match. Try another term or choose all studios.</p>}</nav>
      </aside>
      {article?<Article key={article.id} article={focusedArticle(article,false)} saved={bookmarks.includes(article.id)} onSave={()=>toggleBookmark(article)} onChoose={choose}/>:<div className="textbook-welcome"><span className="textbook-eyebrow">THEORY + EXPERIMENT</span><h1>A textbook beside every lab.</h1><p>Build understanding from first principles, then connect it to the circuit, trace, or machine in front of you. Choose a lab from the library to start reading.</p><div className="textbook-welcome-grid">{studios.map(([key,title])=><button key={key} onClick={()=>{setStudio(key);setQuery("");const a=READABLE_ARTICLES.find(a=>a.studio===key);if(a)choose(a);}}><span>{title}</span><small>{READABLE_ARTICLES.filter(a=>a.studio===key).length} articles →</small></button>)}</div></div>}
    </div>
  </div>;
}
export function LabTheory({context}:{context:{pathname:string;search:string}}) {
  const source=theoryForRoute(context.pathname,context.search);
  const [bookmarks,setBookmarks]=useState(savedIds);
  if(!source)return <div className="textbook textbook-focused textbook-loading"><h1>Theory & Textbook</h1><p>No lesson is mapped to this lab yet.</p></div>;
  const article=focusedArticle(source);
  function save(){const next=bookmarks.includes(article.id)?bookmarks.filter(id=>id!==article.id):[...bookmarks,article.id];setBookmarks(next);try{localStorage.setItem("logiclab.theory.bookmarks",JSON.stringify(next));}catch{/* Optional local persistence. */}}
  return <div className="textbook textbook-focused"><Article key={article.id} article={article} saved={bookmarks.includes(article.id)} onSave={save} onChoose={()=>{}} focused/></div>;
}
function Article({article:a,saved,onSave,focused=false}:{article:TheoryArticle;saved:boolean;onSave:()=>void;onChoose:(a:TheoryArticle)=>void;focused?:boolean}) {
  const plan=lessonPlan(a);
  const chapters=a.chapterIds.flatMap(id=>{const c=CHAPTER_BY_ID.get(id);return c?[c]:[];});
  const refs=[...new Set(chapters.flatMap(c=>c.references))];
  const terms=[...new Map(chapters.flatMap(c=>FOCUSED_TERMS[c.id]??TERMS[c.id]??[])).entries()];
  const related=focused?[]:THEORY_ARTICLES.filter(b=>b.studio===a.studio&&b.id!==a.id).slice(0,8);
  const wordCount=[a.introduction,...chapters.flatMap(c=>[...c.paragraphs,...c.example,...c.pitfalls,c.question,c.answer])].join(" ").split(/\s+/).length;
  return <div className="textbook-reading" key={a.id}>
    <article className="textbook-article">
      <header className="textbook-article-head"><span className="textbook-eyebrow">{a.studioTitle}</span><h1>{a.title}</h1><p className="textbook-deck">From the underlying principle to the behavior you can observe.</p><div className="textbook-meta"><span>{Math.max(3,Math.ceil(wordCount/180))} min read</span><span>{chapters.length} connected chapters</span><button onClick={onSave} aria-pressed={saved}>{saved?"★ Saved":"☆ Save reading"}</button><Link to={a.route}>Open interactive lab ↗</Link></div></header>
      <section id="textbook-overview"><h2>Start with the idea</h2><p>{a.introduction || `This lab brings together ${a.concepts.join(", ") || a.title}. The chapters below develop the principles needed to interpret its behavior.`}</p>{a.concepts.length>0&&<div className="textbook-tags">{a.concepts.map(c=><span key={c}>{c}</span>)}</div>}</section>
      <section className="textbook-objectives"><h2>What you should be able to explain</h2><ul>{(a.takeaways.length?a.takeaways:chapters.map(c=>c.question)).map((v,i)=><li key={i}>{v}</li>)}</ul></section>
      <LabLesson article={a}/>
      {!!a.details?.length&&<section id="textbook-specifics"><h2>Inside this lab: the mechanism in detail</h2>{a.details.map((detail,i)=><div key={i} className="textbook-detail"><h3>{detail.title}</h3><p>{detail.body}</p></div>)}</section>}
      {chapters.map((c,index)=>{const comparison=COMPARISONS[c.id];return <section key={c.id} id={`textbook-${c.id}`} className="textbook-chapter"><div className="textbook-chapter-heading"><span>{String(index+1).padStart(2,"0")}</span><h2>{c.title}</h2></div>{c.paragraphs.map((p,i)=><p key={i}>{p}</p>)}<div className="textbook-equation"><small>KEY RELATIONSHIP</small><code>{c.equation}</code></div>{comparison&&<div className="textbook-table-wrap"><table><caption>{comparison.title}</caption><thead><tr>{comparison.headings.map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{comparison.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=>j===0?<th scope="row" key={j}>{cell}</th>:<td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>}{!plan.examples.some(example=>example.steps.join(" ")===c.example.join(" "))&&<div className="textbook-example"><h3>Worked example</h3><ol>{c.example.map((step,i)=><li key={i}>{step}</li>)}</ol></div>}<div className="textbook-pitfalls"><h3>Common misunderstandings</h3><ul>{c.pitfalls.map((p,i)=><li key={i}>{p}</li>)}</ul></div></section>;})}
      {!!terms.length&&<section id="textbook-terms"><h2>Key terms, precisely defined</h2><dl className="textbook-glossary">{terms.map(([term,definition])=><div key={term}><dt>{term}</dt><dd>{definition}</dd></div>)}</dl></section>}
      {!!a.questions?.length&&<section id="textbook-lab-questions"><h2>Apply it to this lab</h2>{a.questions.map((q,i)=><div className="textbook-question" key={i}><h3>{q.question}</h3><details><summary>Reveal the explanation</summary><p>{q.answer}</p></details></div>)}</section>}
      <section id="textbook-experiment"><h2>Connect the theory to the lab</h2>{a.guide.length?<ol className="textbook-experiment">{a.guide.map((s,i)=><li key={i}>{s}</li>)}</ol>:<><p>Use the worked example above as a prediction before operating the simulation. Track its inputs, intermediate state, and final result; then change one assumption at a time.</p><ol><li>Record the initial configuration and calculate the expected result using the stated equation or rule.</li><li>Step the lab and compare each visible state change with your prediction.</li><li>Try a boundary case, then explain whether any difference comes from the concept, the configuration, or the model’s assumptions.</li></ol></>}<Link className="textbook-primary" to={a.route}>Try it in the interactive lab →</Link></section>
      <section id="textbook-reading"><h2>References & further reading</h2><p>These original study notes explain general principles. Use the lab’s documented teaching model for simulation details, and the relevant specification for a particular processor or device.</p><ul className="textbook-references">{refs.map(id=>{const r=REFERENCES[id];return r?<li key={id}><a href={r.url} target="_blank" rel="noreferrer">{r.title} ↗</a><p>{r.note}</p></li>:null;})}</ul>{a.studio==="interrupts"&&<details><summary>Additional tutorials suggested for this collection</summary><ul><li><a href="https://www.geeksforgeeks.org/computer-organization-architecture/io-interface-interrupt-dma-mode/" target="_blank" rel="noreferrer">GeeksforGeeks: I/O interface, interrupts and DMA</a></li><li><a href="https://algomaster.io/learn/operating-systems/device-controllers-interrupts-and-dma" target="_blank" rel="noreferrer">AlgoMaster: Device controllers, interrupts and DMA</a></li><li><a href="https://namastedev.com/blog/interrupts-dma-basics-2/" target="_blank" rel="noreferrer">NamasteDev: Interrupts & DMA basics</a></li></ul></details>}</section>
      {related.length>0&&<section id="textbook-related"><h2>Continue through this studio</h2><div className="textbook-related">{related.map(b=><Link key={b.id} to={b.route+(b.route.includes("?")?"&":"?")+"view=theory"}>{b.title}<span>Read chapter →</span></Link>)}</div></section>}
      <footer className="textbook-footer">LogicLab · Digital Electronics & Computer Architecture Encyclopedia</footer>
    </article>
    <aside className="textbook-toc" aria-label="On this page"><span className="textbook-eyebrow">ON THIS PAGE</span><a href="#textbook-overview">Start with the idea</a><a href="#textbook-lab-lesson">Diagram & solved example</a><a href="#textbook-practice">Practice questions</a><nav>{chapters.map((c,i)=><a key={c.id} href={`#textbook-${c.id}`}><span>{i+1}.</span>{c.title}</a>)}</nav>{!!terms.length&&<a href="#textbook-terms">Key terms</a>}<a href="#textbook-experiment">Explore in the lab</a><a href="#textbook-reading">Further reading</a><Link className="textbook-primary" to={a.route}>Open lab ↗</Link></aside>
  </div>;
}
