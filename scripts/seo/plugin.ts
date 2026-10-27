import type { Plugin } from 'vite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { metadataFor, publicUrl, SITE_PAGES } from '../../src/seo/urls';

/** Serve permanent redirects for legacy bookmarks in development and vite preview. */
export function seoPlugin():Plugin {
  const middleware=(server:any)=>{server.middlewares.use((req:any,res:any,next:()=>void)=>{
    if(req.method!=='GET'&&req.method!=='HEAD')return next();
    const input=req.url??'/';
    if(!/^\/(?:$|\?|studios(?:\/|$)|architecture(?:\/|$)|textbook(?:\/|$)|encyclopedia(?:\/|$)|learn(?:\/|$)|practice(?:\/|$)|projects(?:\/|$)|notes(?:\/|$)|cheat-sheet(?:\/|$))/.test(input))return next();
    const target=publicUrl(input);
    if(target!==input){res.writeHead(301,{Location:target});res.end();return;}
    next();
  });};
  return {name:'logiclab-seo',configureServer:middleware,configurePreviewServer(server){
    middleware(server);
    // Vite's SPA fallback otherwise serves root HTML for extensionless nested URLs.
    server.middlewares.use(async(req,res,next)=>{
      if(req.method!=='GET'&&req.method!=='HEAD')return next();
      const meta=metadataFor(req.url??'/');
      if(!meta.record&&!SITE_PAGES[meta.path])return next();
      try {
        const html=await readFile(resolve(server.config.root,server.config.build.outDir,meta.path.slice(1),'index.html'),'utf8');
        res.statusCode=200;res.setHeader('Content-Type','text/html; charset=utf-8');
        res.end(req.method==='HEAD'?'':html);
      } catch(error) {if((error as NodeJS.ErrnoException).code==='ENOENT')return next();next(error as Error);}
    });
  },
    transformIndexHtml(html,context){
      if(!context.server)return html; // Production pages are generated after bundling.
      const meta=metadataFor(context.originalUrl??context.path);
      const origin=process.env.VITE_SITE_URL?.replace(/\/$/,'');
      return {html:html.replace(/<title>[\s\S]*?<\/title>/,'').replace(/<meta\s+name="description"[\s\S]*?\/?>/,''),tags:[
        {tag:'title',children:meta.title,injectTo:'head'},
        {tag:'meta',attrs:{name:'description',content:meta.description},injectTo:'head'},
        ...(origin?[{tag:'link',attrs:{rel:'canonical',href:origin+meta.path},injectTo:'head' as const}]:[]),
      ]};
    },
  };
}
