import { THEORY_BY_ID } from './catalogue';
import { focusedArticle } from './focus';
import { lessonPlan } from './lessonPlans';
import { lessonFAQs } from './faqs';
import { CHAPTER_BY_ID, REFERENCES } from './chapters';
import { publicUrl } from '../seo/urls';
import { TERMS } from './referenceData';
import { FOCUSED_TERMS } from './focusedTerms';

/** A text representation of the public lesson, using the same examples and answers. */
export function machineNotes(id:string,origin:string) {
  const source=THEORY_BY_ID.get(id);
  if(!source)throw new Error('No lesson for '+id);
  const article=focusedArticle(source);
  const plan=lessonPlan(article);
  // Preserve the catalogue entry's canonical URL even when an overview selects a default lesson.
  const lab=origin+publicUrl(source.route).split(/[?#]/)[0];
  const canonical=lab+'/theory';
  const chapters=article.chapterIds.flatMap(id=>CHAPTER_BY_ID.has(id)?[CHAPTER_BY_ID.get(id)!]:[]);
  const refs=[...new Set(chapters.flatMap(c=>c.references))].flatMap(id=>REFERENCES[id]?[REFERENCES[id]!]:[]);
  const terms=[...new Map(chapters.flatMap(c=>FOCUSED_TERMS[c.id]??TERMS[c.id]??[])).entries()];
  const ordered=(items:string[])=>items.map((text,i)=>`${i+1}. ${text}`).join('\n');
  const text=[
    `# ${article.title}`,
    `Source: [${article.title} — LogicLab](${canonical})\nPublisher: AIMER Society\nStudio: ${article.studioTitle}\nInteractive lab: ${lab}\nCanonical lesson: ${canonical}`,
    article.introduction,
    '## Learning objectives',article.takeaways.map(item=>'- '+item).join('\n'),
    '## Concepts',...plan.concepts.map(([title,body])=>`### ${title}\n\n${body}`),
    `## Diagram: ${plan.diagram.title}`,ordered(plan.diagram.nodes.map(node=>`${node.label}: ${node.detail}`)),plan.diagram.note,
    '## Solved examples',...plan.examples.map(example=>`### ${example.title}\n\n${ordered(example.steps)}`),
    ...(article.details??[]).map(detail=>`## ${detail.title}\n\n${detail.body}`),
    ...chapters.map(chapter=>`## ${chapter.title}\n\n${chapter.paragraphs.join('\n\n')}\n\nKey relationship: ${chapter.equation}\n\nWorked example:\n${ordered(chapter.example)}\n\nCommon mistakes:\n${chapter.pitfalls.map(p=>'- '+p).join('\n')}`),
    '## Key terms',...terms.map(([term,definition])=>`- ${term}: ${definition}`),
    '## Practice questions',...plan.questions.map(q=>`### ${q.question}\n\n${q.answer}`),
    '## Try the experiment',ordered(article.guide.length?article.guide:plan.experiment),`[Open the interactive lab](${lab})`,
    ...(article.questions??[]).map(q=>`### ${q.question}\n\n${q.answer}`),
    '## Frequently asked questions',...lessonFAQs(article).map((q,index)=>`### ${q.question}\n\n${q.answer}\n\nSource: ${canonical}#lesson-faq-${index+1}`),
    '## References',...refs.map(ref=>`- [${ref.title}](${ref.url}): ${ref.note}`),
    '## Scope', 'These are educational simulations. Results depend on the stated model, configuration, word widths, and timing conventions. Consult device specifications for physical hardware.',
    `## Citation\n\nAIMER Society. “${article.title}.” LogicLab, ${article.studioTitle}. ${canonical}`,
  ].filter(Boolean).join('\n\n')+'\n';
  return {text,title:article.title,studio:article.studioTitle,topics:article.concepts,canonical_url:canonical,interactive_url:lab,markdown_url:canonical+'.md'};
}
