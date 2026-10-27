import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';

export async function writeDiscovery({origin,urls,metadataFor,routes,machineNotes}) {
  const escape=value=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const bots=['OAI-SearchBot','ChatGPT-User','Claude-SearchBot','Claude-User','PerplexityBot','Googlebot','Bingbot'];
  // Preserve the existing all-crawlers policy. Search access is not a training guarantee.
  await writeFile('dist/robots.txt',`# Public search and user-directed retrieval are welcome.\nUser-agent: *\nAllow: /\n\n${bots.map(bot=>`User-agent: ${bot}\nAllow: /\n`).join('\n')}\nSitemap: ${origin}/sitemap.xml\n`);
  await writeFile('dist/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.filter(url=>!metadataFor(url).noindex).map(url=>`<url><loc>${escape(origin+url)}</loc></url>`).join('')}</urlset>`);
  const groups=[...new Set(routes.map(r=>r.studio))];
  const slug=label=>label.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  await mkdir('dist/llms',{recursive:true});
  await writeFile('dist/llms.txt',`# LogicLab by AIMER Society\n\n> Interactive digital electronics and computer architecture learning, with focused textbook lessons, diagrams, solved examples, and practice questions.\n\nSimulations are teaching models, not physical-device specifications. This optional navigation index does not imply endorsement or guarantee inclusion in any search service.\n\n## Start here\n- [Studios](${origin}/studios): Browse interactive collections.\n- [Textbook](${origin}/textbook): Explore lessons.\n- [Sitemap](${origin}/sitemap.xml): All indexable public pages.\n\n## Studio lesson indexes\n${groups.map(group=>`- [${group}](${origin}/llms/${slug(group)}.txt)`).join('\n')}\n`);
  for(const group of groups)await writeFile(`dist/llms/${slug(group)}.txt`,`# ${group} — LogicLab\n\n${routes.filter(r=>r.studio===group).map(r=>`- [${r.title}](${origin}${r.url}/theory): ${r.description} Interactive lab: ${origin}${r.url} Text-only lesson: ${origin}${r.url}/theory.md`).join('\n')}\n`);
  const resources=[];
  const pending=[];
  const full=[];
  for(const route of routes){
    const {text,...resource}=machineNotes(route.id,origin);
    resources.push({...resource,id:route.id,description:route.description});
    full.push(text);
    const path=join('dist',route.url.slice(1),'theory.md');
    pending.push((async()=>{await mkdir(dirname(path),{recursive:true});await writeFile(path,text);})());
    if(pending.length>=16)await Promise.all(pending.splice(0));
  }
  await Promise.all(pending);
  await writeFile('dist/learning-resources.json',JSON.stringify({name:'LogicLab by AIMER Society',url:origin,description:'Public lesson directory. canonical_url identifies the HTML source; markdown_url is its text representation.',resources},null,2)+'\n');
  await writeFile('dist/llms-full.txt','# LogicLab — complete lesson text\n\nEach lesson identifies its own source URL and linked interactive lab. Individual Markdown versions are preferable when retrieving one topic.\n\n'+full.join('\n\n---\n\n'));
  // Advertise machine-readable representations through the ordinary public directory.
  const indexPath='dist/llms.txt';
  const {readFile}=await import('node:fs/promises');
  await writeFile(indexPath,(await readFile(indexPath,'utf8'))+`\n## Machine-readable resources\n- [Resource directory](${origin}/learning-resources.json): Titles, topics, source URLs, simulator URLs, and Markdown URLs for every lesson.\n- [Complete lesson text](${origin}/llms-full.txt): Combined public lessons; individual Markdown links are available in each studio index.\n`);
  await writeFile('dist/404.html','<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page not found | LogicLab</title><meta name="robots" content="noindex,follow"></head><body><main><h1>Page not found</h1><p>This address does not identify a published LogicLab lesson.</p><a href="/studios">Browse studios</a> · <a href="/textbook">Open the textbook</a></main></body></html>');
}
