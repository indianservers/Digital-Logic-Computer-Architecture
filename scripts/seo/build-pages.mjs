import { writeDiscovery } from './discovery.mjs';
import { createServer, loadEnv } from 'vite';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';

const server=await createServer({configFile:false,resolve:{alias:{'react-router-dom':resolve('node_modules/react-router-dom/dist/index.mjs')}},optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom'});
const escape=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
try {
  const {SEO_ROUTES,SITE_PAGES,metadataFor,publicUrl}=await server.ssrLoadModule('/src/seo/urls.ts');
  const {siteOrigin}=await server.ssrLoadModule('/src/seo/site.ts');
  const {machineNotes}=await server.ssrLoadModule('/src/theory/machineNotes.ts');
  const {pageData}=await server.ssrLoadModule('/src/seo/pageData.ts');
  const {LabOverview,SiteFAQ}=await server.ssrLoadModule('/src/theory/LabOverview.tsx');
  const {LabTheory}=await server.ssrLoadModule('/src/theory/TheoryReader.tsx');
  // Use the same React Router instance as Vite's SSR module graph.
  const {MemoryRouter}=await server.ssrLoadModule('react-router-dom');
  const template=await readFile('dist/index.html','utf8');
  const origin=siteOrigin(process.env.VITE_SITE_URL||loadEnv('production',process.cwd(),'').VITE_SITE_URL);
  if(origin&&!/^https?:\/\/[^/]+$/.test(origin))throw new Error('VITE_SITE_URL must be an absolute origin, e.g. https://your-domain.com');
  const urls=[...Object.keys(SITE_PAGES),...SEO_ROUTES.flatMap(record=>[record.url,record.url+'/theory'])];
  const redirects=[];
  const aliases=JSON.parse(await readFile('src/seo/aliases.json','utf8'));
  for(const [from,to] of Object.entries(aliases)){
    redirects.push({from,to,status:301},{from:from+'/theory',to:to+'/theory',status:301},{from:from+'?view=theory',to:to+'/theory',status:301});
  }
  const writes=[];
  for(const record of SEO_ROUTES){
    if(record.route!==record.url)redirects.push({from:record.route,to:record.url,status:301});
    redirects.push({from:record.route+(record.route.includes('?')?'&':'?')+'view=theory',to:record.url+'/theory',status:301});
    redirects.push({from:'/encyclopedia?article='+encodeURIComponent(record.id),to:record.url+'/theory',status:301});
  }
  redirects.push({from:'/?view=theory',to:'/textbook',status:301});
  for(const url of urls){
    const meta=metadataFor(url);
    const canonical=origin?origin+url:'';
    const {schema}=pageData(url,origin);
    const alternate=meta.record?`<link rel="alternate" type="text/markdown" title="${escape(meta.record.title)} — text version" href="${escape(origin+meta.record.url+'/theory.md')}">`:'';
    const head=`${alternate}<title>${escape(meta.title)}</title><meta name="description" content="${escape(meta.description)}"><meta name="robots" content="${meta.noindex?'noindex,follow':'index,follow'}">${canonical?`<link rel="canonical" href="${escape(canonical)}">`:''}<meta property="og:title" content="${escape(meta.title)}"><meta property="og:description" content="${escape(meta.description)}"><meta property="og:type" content="${meta.theory?'article':'website'}"><meta property="og:site_name" content="LogicLab">${canonical?`<meta property="og:url" content="${escape(canonical)}">`:''}<meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escape(meta.title)}"><meta name="twitter:description" content="${escape(meta.description)}"><script id="logiclab-seo-schema" type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>`;
    let content;
    if(meta.theory&&meta.record){
      const internal=new URL(meta.record.route,'https://logiclab.invalid');
      content=renderToString(createElement(MemoryRouter,{initialEntries:[meta.record.route]},createElement(LabTheory,{context:{pathname:internal.pathname,search:internal.search}})));
      // React Router on the static snapshot also needs public crawlable hrefs.
      content=content.replace(/href="(\/(?:studios|architecture)\/[^"#]*)"/g,(_,href)=>`href="${escape(publicUrl(href.replace(/&amp;/g,'&')))}"`);
    } else {
      const links=SEO_ROUTES.filter(r=>meta.record?r.studio===meta.record.studio:true);
      const companion=renderToString(createElement(MemoryRouter,null,meta.record?createElement(LabOverview,{id:meta.record.id}):meta.noindex?null:createElement(SiteFAQ)));
      content=`<main><h1>${escape(meta.title.replace(/ \| LogicLab$/,''))}</h1><p>${escape(meta.description)}</p>${companion}<nav aria-label="Textbook lessons">${links.map(r=>`<a href="${r.url}/theory">${escape(r.title)}</a>`).join('\n')}</nav></main>`;
    }
    content=content.replace(/href="(\/(?:studios|architecture)\/[^"#]*)"/g,(_,href)=>`href="${escape(publicUrl(href.replace(/&amp;/g,'&')))}"`);
    const html=template.replace(/<title>[\s\S]*?<\/title>/,'').replace(/<meta\s+name="description"[\s\S]*?\/?>/,'').replace('</head>',head+'</head>').replace('<div id="root"></div>',`<div id="root">${content}</div>`);
    const directory=url==='/'?'dist':join('dist',url.slice(1));
    writes.push((async()=>{await mkdir(directory,{recursive:true});await writeFile(join(directory,'index.html'),html);})());
    if(writes.length>=16)await Promise.all(writes.splice(0));
  }
  await Promise.all(writes);
  await writeFile('dist/seo-redirects.json',JSON.stringify(redirects,null,2));
  await writeDiscovery({origin,urls,metadataFor,routes:SEO_ROUTES,machineNotes});
  // Post-rendered root HTML must keep Workbox's revision in sync with its contents.
  const oldHash=createHash('md5').update(template).digest('hex');
  const newHash=createHash('md5').update(await readFile('dist/index.html')).digest('hex');
  const sw=await readFile('dist/sw.js','utf8');
  await writeFile('dist/sw.js',sw.replace(oldHash,newHash));
  console.log(`Generated ${urls.length} SEO HTML pages, including full textbook lesson content.`);
} finally {await server.close();}
