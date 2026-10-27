import { useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { Router, createPath, parsePath, type Navigator, type To } from 'react-router-dom';
import { siteOrigin } from './site';
import { internalUrl, metadataFor, publicUrl } from './urls';

function readLocation(){
  const value=parsePath(internalUrl(location.pathname+location.search+location.hash));
  return {pathname:value.pathname??'/',search:value.search??'',hash:value.hash??'',state:history.state?.usr??null,key:history.state?.key??'default'};
}
function href(to:To){return publicUrl(typeof to==='string'?to:createPath(to));}

/** The browser shows readable URLs; existing lab components retain their stable route IDs. */
export default function SeoRouter({children}:{children:ReactNode}) {
  const [current,setCurrent]=useState(readLocation);
  const navigator=useMemo<Navigator>(()=>({
    createHref:href,
    go:delta=>history.go(delta),
    push:(to,state)=>{history.pushState({usr:state,key:crypto.randomUUID()},'',href(to));setCurrent(readLocation());},
    replace:(to,state)=>{history.replaceState({usr:state,key:crypto.randomUUID()},'',href(to));setCurrent(readLocation());},
  }),[]);
  useLayoutEffect(()=>{
    const update=()=>setCurrent(readLocation());
    window.addEventListener('popstate',update);
    const canonical=publicUrl(location.pathname+location.search+location.hash);
    if(canonical!==location.pathname+location.search+location.hash)history.replaceState(history.state,'',canonical);
    return ()=>window.removeEventListener('popstate',update);
  },[]);
  useLayoutEffect(()=>{
    const meta=metadataFor(current.pathname+current.search);
    const origin=siteOrigin(import.meta.env.VITE_SITE_URL);
    const canonical=origin+meta.path;
    document.title=meta.title;
    const tag=(name:string,content:string,property=false)=>{const attr=property?'property':'name';let node=document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);if(!node){node=document.createElement('meta');node.setAttribute(attr,name);document.head.append(node);}node.content=content;};
    tag('description',meta.description);tag('robots',meta.noindex?'noindex,follow':'index,follow');
    tag('og:title',meta.title,true);tag('og:description',meta.description,true);tag('og:url',canonical,true);tag('og:type',meta.theory?'article':'website',true);tag('og:site_name','LogicLab',true);
    tag('twitter:card','summary');tag('twitter:title',meta.title);tag('twitter:description',meta.description);
    let link=document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');if(!link){link=document.createElement('link');link.rel='canonical';document.head.append(link);}link.href=canonical;
    let alternate=document.head.querySelector<HTMLLinkElement>('link[rel="alternate"][type="text/markdown"]');
    if(meta.record){if(!alternate){alternate=document.createElement('link');alternate.rel='alternate';alternate.type='text/markdown';document.head.append(alternate);}alternate.href=origin+meta.record.url+'/theory.md';alternate.title=meta.record.title+' — text version';}else alternate?.remove();
    let schema=document.getElementById('logiclab-seo-schema');if(!schema){schema=document.createElement('script');schema.id='logiclab-seo-schema';schema.setAttribute('type','application/ld+json');document.head.append(schema);}
    let active=true;
    import('./pageData').then(({pageData})=>{if(active)schema!.textContent=JSON.stringify(pageData(current.pathname+current.search,origin).schema);});
    return ()=>{active=false;};
  },[current.pathname,current.search]);
  return <Router location={current} navigator={navigator}>{children}</Router>;
}
