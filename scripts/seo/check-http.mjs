import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';

const origin=(process.argv[2]||'http://localhost:7566').replace(/\/$/,'');
assert.match(origin,/^https?:\/\/[^/]+$/);
const routes=JSON.parse(await readFile('src/seo/routes.json','utf8'));
const core=['/','/textbook','/encyclopedia','/studios','/learn','/practice','/projects','/cheat-sheet','/notes'];
const paths=[...core,...routes.flatMap(r=>[r.url,r.url+'/theory'])];
const failures=[];
let checked=0;
let checkedMarkdown=0;
async function request(path,options={}){
  const res=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(30000),...options});
  const body=await res.text();return {res,body};
}
const queue=[...paths];
await Promise.all(Array.from({length:8},async()=>{while(queue.length){const path=queue.shift();try{
  const {res,body}=await request(path);
  assert.equal(res.status,200,path+' HTTP 200');
  assert.match(res.headers.get('content-type')??'',/text\/html/);
  assert.ok(body.includes('rel="canonical"')&&body.includes('logiclab-seo-schema'),path+' page-specific HTML');
  if(path!=='/notes')assert.ok(body.includes('id="lesson-faq"'),path+' crawlable FAQ');
  if(path.endsWith('/theory'))assert.ok(body.includes('textbook-solved-0'),path+' solved example');
  checked++;
}catch(error){failures.push(String(error));}}}));
for(const path of ['/not-a-published-page','/studios/not-a-studio','/architecture/builder/not-a-lab']){
  try{const {res,body}=await request(path);assert.equal(res.status,404,path);assert.ok(body.includes('noindex'));}catch(error){failures.push(String(error));}
}
for(const path of ['/robots.txt','/sitemap.xml','/llms.txt','/llms-full.txt','/learning-resources.json']){
  try{const {res,body}=await request(path);assert.equal(res.status,200,path);assert.ok(body.length>100);assert.ok(!body.includes('<div id="root"'));}catch(error){failures.push(String(error));}
}
for(const record of routes){
  try{const {res,body}=await request(record.url+'/theory.md');assert.equal(res.status,200);assert.ok(body.includes('Canonical lesson:')&&body.includes('## Citation'),record.url+' source text');assert.ok(!body.includes('<div id="root"'));checkedMarkdown++;}catch(error){failures.push(String(error));}
}
for(const bot of ['OAI-SearchBot','ChatGPT-User','Claude-SearchBot','Claude-User','PerplexityBot']){
  try{const {res,body}=await request(routes[0].url+'/theory',{headers:{'User-Agent':bot}});assert.equal(res.status,200,bot);assert.ok(body.includes('textbook-solved-0'));}catch(error){failures.push(String(error));}
}
for(const record of routes.filter(r=>r.route!==r.url).slice(0,20)){
  try{const {res}=await request(record.route);assert.ok([301,308].includes(res.status),record.route+' redirects');assert.equal(res.headers.get('location'),record.url);}catch(error){failures.push(String(error));}
}
const root=await request('/');
for(const asset of [...root.body.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(m=>m[1])){
  try{const {res,body}=await request(asset);assert.equal(res.status,200,asset);assert.ok(!body.includes('<div id="root"'));}catch(error){failures.push(String(error));}
}
const report={origin,checkedPages:checked,expectedPages:paths.length,checkedMarkdownLessons:checkedMarkdown,failures};
await mkdir('output/seo',{recursive:true});await writeFile('output/seo/http-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
if(failures.length)process.exitCode=1;
