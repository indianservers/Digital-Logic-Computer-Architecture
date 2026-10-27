import { publicUrl } from '../seo/urls';
import { metadataFor } from '../seo/urls';
import { useLocation } from 'react-router-dom';
import { siteOrigin } from '../seo/site';
import type { TheoryArticle } from './types';

export function LessonCitation({article}:{article:TheoryArticle}) {
  const location=useLocation();
  const meta=metadataFor(location.pathname+location.search);
  const path=(meta.record?.url??publicUrl(article.route).split(/[?#]/)[0])+'/theory';
  const canonical=siteOrigin(import.meta.env.VITE_SITE_URL)+path;
  return <section id="lesson-citation"><h2>Cite or share this lesson</h2><p>AIMER Society. “{article.title}.” LogicLab, {article.studioTitle}.</p><p><a href={canonical}>{canonical}</a></p><p><a href={path+'.md'}>Read the text-only Markdown version</a> · <a href="/learning-resources.json">Browse the learning resource index</a></p></section>;
}
