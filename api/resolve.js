import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const routes=require('../src/seo/routes.json');
const aliases=require('../src/seo/aliases.json');
const byId=new Map(routes.map(r=>[r.id,r]));
const byRoute=new Map(routes.map(r=>[r.route,r]));

/** Filesystem pages/assets are served first; only legacy or unknown URLs reach here. */
export default function resolvePage(req,res) {
  const url=new URL(req.url,'https://digital.aimersociety.com');
  if(url.searchParams.has('__path')){url.pathname='/'+url.searchParams.get('__path');url.searchParams.delete('__path');}
  const rawPath=url.pathname.replace(/\/+$/,'')||'/';
  const path=aliases[rawPath]??rawPath;
  const article=url.searchParams.get('article');
  const tab=url.searchParams.get('tab');
  const record=(article?byId.get(article):undefined)??byRoute.get(path+(tab?'?tab='+encodeURIComponent(tab):''))??byRoute.get(path);
  if(record) {
    const theory=article||url.searchParams.get('view')==='theory';
    for(const key of ['article','view',...(record.route.includes('?')?['tab']:[])])url.searchParams.delete(key);
    const extra=url.searchParams.toString();
    const destination=record.url+(theory?'/theory':'')+(extra?'?'+extra:'');
    if(destination!==url.pathname+url.search){res.writeHead(308,{Location:destination});res.end();return;}
  }
  res.writeHead(404,{'Content-Type':'text/html; charset=utf-8','X-Robots-Tag':'noindex, follow'});
  res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,follow"><title>Page not found | LogicLab</title></head><body><main><h1>Page not found</h1><p>This address does not identify a published lesson.</p><a href="/studios">Browse studios</a> · <a href="/textbook">Open the textbook</a></main></body></html>');
}
