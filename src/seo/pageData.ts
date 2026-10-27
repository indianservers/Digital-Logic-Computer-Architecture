import { THEORY_BY_ID } from '../theory/catalogue';
import { focusedArticle } from '../theory/focus';
import { lessonFAQs, SITE_FAQS } from '../theory/faqs';
import { metadataFor } from './urls';
import { PUBLISHER, SITE_NAME } from './site';

export function pageData(path:string,origin:string) {
  const meta=metadataFor(path);
  const source=meta.record?THEORY_BY_ID.get(meta.record.id):undefined;
  const article=source?focusedArticle(source):undefined;
  const faqs=article?lessonFAQs(article):!meta.noindex?SITE_FAQS:[];
  const url=origin+meta.path;
  const crumbs=[{name:'Home',url:origin+'/'},...(meta.record?[{name:'Studios',url:origin+'/studios'}]:[]),...(meta.path!=='/'?[{name:meta.title.replace(/ \| LogicLab$/,''),url}]:[])];
  return {faqs,schema:{'@context':'https://schema.org','@graph':[
    {'@type':'Organization','@id':origin+'/#organization',name:PUBLISHER,url:'https://aimersociety.com'},
    {'@type':'WebSite','@id':origin+'/#website',name:SITE_NAME,url:origin+'/',publisher:{'@id':origin+'/#organization'},inLanguage:'en'},
    {'@type':meta.theory?'LearningResource':'WebPage','@id':url+'#page',name:meta.title,description:meta.description,url,inLanguage:'en',isPartOf:{'@id':origin+'/#website'},publisher:{'@id':origin+'/#organization'},breadcrumb:{'@id':url+'#breadcrumbs'},...(meta.record&&meta.theory?{encoding:{'@type':'MediaObject',encodingFormat:'text/markdown',contentUrl:origin+meta.record.url+'/theory.md',about:{'@id':origin+meta.record.url+'/theory#page'}}}:{}),...(meta.theory?{learningResourceType:'Lesson',educationalUse:'Self-study',...(article?{teaches:article.concepts}:{})}:{})},
    {'@type':'BreadcrumbList','@id':url+'#breadcrumbs',itemListElement:crumbs.map((crumb,index)=>({'@type':'ListItem',position:index+1,name:crumb.name,item:crumb.url}))},
    ...(faqs.length?[{'@type':'FAQPage','@id':url+'#faq',isPartOf:{'@id':url+'#page'},mainEntity:faqs.map(q=>({'@type':'Question',name:q.question,acceptedAnswer:{'@type':'Answer',text:q.answer}}))}]:[]),
  ]}};
}
