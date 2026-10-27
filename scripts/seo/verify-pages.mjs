import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const routes=JSON.parse(await readFile('src/seo/routes.json','utf8'));
const titles=new Set();
const canonicals=new Set();
let faqCount=0;
let pages=0;
async function verify(record,theory){
  const url=record.url+(theory?'/theory':'');
  const html=await readFile(join('dist',url.slice(1),'index.html'),'utf8');
  const head=html.split('</head>')[0];
  const title=head.match(/<title>(.*?)<\/title>/s)?.[1];
  assert.ok(title,url+' has a title');
  assert.ok(!titles.has(title),'Duplicate title: '+title);
  titles.add(title);
  assert.equal((head.match(/<title>/g)??[]).length,1,url+' has one title');
  assert.equal((head.match(/name="description"/g)??[]).length,1,url+' has one description');
  assert.ok(head.includes('application/ld+json'),url+' has structured metadata');
  const canonical=head.match(/rel="canonical" href="([^"]+)"/)?.[1];
  assert.ok(canonical&&/^https?:\/\//.test(canonical),url+' has an absolute canonical');
  assert.ok(!canonicals.has(canonical),'Duplicate canonical: '+canonical);
  canonicals.add(canonical);
  assert.ok(canonical.endsWith(url==='/'?'/':url),url+' canonical matches its page');
  const schema=JSON.parse(head.match(/id="logiclab-seo-schema"[^>]*>(.*?)<\/script>/s)?.[1]??'null');
  assert.ok(schema?.['@graph']?.some(node=>node['@type']==='BreadcrumbList'),url+' has breadcrumbs');
  const faq=schema['@graph'].find(node=>node['@type']==='FAQPage');
  if(url!=='/notes'){
    assert.ok(faq?.mainEntity.length>=4,url+' has substantive FAQs');
    assert.ok(html.includes('id="lesson-faq"'),url+' displays its FAQs');
    const visible=html.split('</head>')[1];
    const plain=visible.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
    for(const q of faq.mainEntity){assert.ok(plain.includes(q.name),url+' displays FAQ question');assert.ok(plain.includes(q.acceptedAnswer.text),url+' displays FAQ answer');faqCount++;}
  }
  assert.ok(!html.match(/href="\/(studios|architecture)\/[^"#]*\?(tab|view)=/),url+' uses public lesson links');
  if(theory){
    assert.ok(head.includes('rel="alternate" type="text/markdown"'),url+' advertises text representation');
    const markdown=await readFile(join('dist',record.url.slice(1),'theory.md'),'utf8');
    assert.ok(markdown.includes(canonical),url+' text version identifies its HTML source');
    for(const section of ['## Solved examples','## Frequently asked questions','## Citation'])assert.ok(markdown.includes(section),url+' text version includes '+section);
    for(const section of ['textbook-lab-lesson','textbook-solved-0','textbook-practice'])assert.ok(html.includes('id="'+section+'"'),url+' renders '+section);
    assert.ok(html.includes('<svg'),url+' renders its diagram');
  }
  pages++;
}
const corePages=['/','/textbook','/encyclopedia','/studios','/learn','/practice','/projects','/cheat-sheet','/notes'];
await Promise.all([...routes.flatMap(record=>[verify(record,false),verify(record,true)]),...corePages.map(url=>verify({url},false))]);
const redirects=JSON.parse(await readFile('dist/seo-redirects.json','utf8'));
assert.ok(redirects.every(r=>r.from!==r.to),'Redirects cannot point to themselves');
const sitemap=await readFile('dist/sitemap.xml','utf8');
const locations=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match=>match[1]);
assert.equal(new Set(locations).size,pages-1,'Every indexable page is listed once');
for(const canonical of canonicals)if(new URL(canonical).pathname!=='/notes')assert.ok(locations.includes(canonical),'Sitemap includes '+canonical);
assert.ok(!locations.some(url=>new URL(url).pathname==='/notes'),'Private notes excluded');
const robots=await readFile('dist/robots.txt','utf8');
const resources=JSON.parse(await readFile('dist/learning-resources.json','utf8'));
assert.equal(resources.resources.length,routes.length,'Machine directory covers every lesson');
assert.equal(new Set(resources.resources.map(r=>r.canonical_url)).size,routes.length,'Machine directory has unique sources');
assert.ok((await readFile('dist/llms-full.txt','utf8')).includes('## Citation'),'Full text collection contains source attribution');
assert.ok(robots.includes('Sitemap: '),'Robots advertises sitemap');
for(const bot of ['OAI-SearchBot','ChatGPT-User','Claude-SearchBot','Claude-User'])assert.ok(robots.includes('User-agent: '+bot+'\nAllow: /'),bot+' can retrieve pages');
assert.ok((await readFile('dist/llms.txt','utf8')).includes('/llms/'),'AI navigation index exists');
const report={verifiedPages:pages,textbookLessons:routes.length,uniqueTitles:titles.size,canonicalUrls:canonicals.size,sitemapUrls:locations.length,visibleFAQs:faqCount,markdownLessons:resources.resources.length,redirects:redirects.length};
await mkdir('output/seo',{recursive:true});
await writeFile('output/seo/build-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
