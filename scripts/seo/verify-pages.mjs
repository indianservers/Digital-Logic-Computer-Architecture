import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const routes=JSON.parse(await readFile('src/seo/routes.json','utf8'));
const titles=new Set();
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
  assert.ok(!html.match(/href="\/(studios|architecture)\/[^"#]*\?(tab|view)=/),url+' uses public lesson links');
  if(theory){
    for(const section of ['textbook-lab-lesson','textbook-solved-0','textbook-practice'])assert.ok(html.includes('id="'+section+'"'),url+' renders '+section);
    assert.ok(html.includes('<svg'),url+' renders its diagram');
  }
  pages++;
}
const corePages=['/','/textbook','/encyclopedia','/studios','/learn','/practice','/projects','/cheat-sheet','/notes'];
await Promise.all([...routes.flatMap(record=>[verify(record,false),verify(record,true)]),...corePages.map(url=>verify({url},false))]);
const redirects=JSON.parse(await readFile('dist/seo-redirects.json','utf8'));
assert.ok(redirects.every(r=>r.from!==r.to),'Redirects cannot point to themselves');
const report={verifiedPages:pages,textbookLessons:routes.length,uniqueTitles:titles.size,redirects:redirects.length};
await mkdir('output/seo',{recursive:true});
await writeFile('output/seo/build-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
