import records from './routes.json';

export const SEO_ROUTES = records;
const byRoute = new Map(records.map(record => [record.route, record]));
const byUrl = new Map(records.map(record => [record.url, record]));
const byId = new Map(records.map(record => [record.id, record]));
const bases = records.filter(record => !record.route.includes('?')).sort((a,b)=>b.url.length-a.url.length);
export const SITE_PAGES:Record<string,{title:string;description:string}> = {
  '/':{title:'Digital Electronics & Computer Architecture Labs | LogicLab',description:'Learn digital electronics and computer architecture with interactive circuits, processor simulations, and step-by-step textbook lessons.'},
  '/textbook':{title:'Digital Electronics & Computer Architecture Textbook | LogicLab',description:'Explore textbook lessons with diagrams, solved examples, and practice questions for every digital electronics and computer architecture lab.'},
  '/encyclopedia':{title:'Digital Electronics & Computer Architecture Encyclopedia | LogicLab',description:'Browse the complete collection of studio-specific lessons on logic circuits, memory, processors, VLSI, and embedded systems.'},
  '/studios':{title:'Interactive Digital Electronics & Architecture Studios | LogicLab',description:'Explore interactive studios for number systems, logic gates, memory, processors, VLSI, and embedded systems.'},
  '/learn':{title:'Digital Electronics & Computer Architecture Learning Path | LogicLab',description:'Follow a structured learning path from binary numbers and logic gates to processor design and computer architecture.'},
  '/practice':{title:'Digital Electronics Practice Questions & Exercises | LogicLab',description:'Test your understanding of binary numbers, logic circuits, memory, and processors with interactive practice exercises.'},
  '/projects':{title:'Digital Electronics & Embedded Systems Projects | LogicLab',description:'Apply digital electronics and computer architecture concepts through practical circuit and embedded systems projects.'},
  '/cheat-sheet':{title:'Digital Electronics Formulas & Reference Cheat Sheet | LogicLab',description:'Review essential digital electronics formulas, logic identities, number representations, and computer architecture concepts.'},
  '/notes':{title:'My Digital Electronics Study Notes | LogicLab',description:'Keep your personal notes while learning digital electronics and computer architecture in LogicLab.'},
};

/** Convert public paths back to the existing simulator's route contract. */
export function internalUrl(input:string):string {
  const u=new URL(input,'https://logiclab.invalid');
  let path=u.pathname.replace(/\/+$/,'')||'/';
  if(path==='/textbook'){path='/';u.searchParams.set('view','theory');}
  else {
    const theory=path.endsWith('/theory');
    const record=byUrl.get(theory?path.slice(0,-7):path);
    if(record){
      const original=new URL(record.route,u.origin);
      path=original.pathname;
      original.searchParams.forEach((value,key)=>u.searchParams.set(key,value));
      if(theory)u.searchParams.set('view','theory');
    } else {
      const parent=bases.find(record=>path.startsWith(record.url+'/'));
      if(parent)path=parent.route+path.slice(parent.url.length);
    }
  }
  return path+query(u.searchParams)+u.hash;
}
function query(params:URLSearchParams){const value=params.toString();return value?'?'+value:'';}

/** All Link hrefs and history writes pass through this single canonical mapping. */
export function publicUrl(input:string):string {
  const u=new URL(internalUrl(input),'https://logiclab.invalid');
  const article=u.searchParams.get('article');
  const selected=article?(byId.get(article)??(article.includes('#')?byRoute.get('/'+article.split('#')[0]):article==='studios/combinational/canvas'?byRoute.get('/studios/combinational?tab=basic'):article==='studios/truth-tables/from-table'?byRoute.get('/studios/truth-tables?tab=from-expr'):undefined)):undefined;
  if(selected){u.pathname=selected.route.split('?')[0]!;u.search='';new URL(selected.route,u.origin).searchParams.forEach((v,k)=>u.searchParams.set(k,v));u.searchParams.set('view','theory');}
  const theory=u.searchParams.get('view')==='theory';
  if(u.pathname==='/studios/truth-tables'&&u.searchParams.get('tab')==='from-table')u.searchParams.set('tab','from-expr');
  if(u.pathname==='/studios/combinational'&&u.searchParams.get('tab')==='canvas')u.searchParams.set('tab','basic');
  const tab=u.searchParams.get('tab');
  const device=u.pathname==='/studios/flip-flops'?u.searchParams.get('device'):null;
  const tabKey=device?(device==='d'?'dff':device):tab;
  const record=byRoute.get(u.pathname+(tabKey?'?tab='+encodeURIComponent(tabKey):''))??byRoute.get(u.pathname);
  let path=record?.url??u.pathname;
  if(!record){const parent=bases.find(r=>u.pathname.startsWith(r.route+'/'));if(parent)path=parent.url+u.pathname.slice(parent.route.length);}
  // Unknown selections remain in the query so old/custom labs can still resolve them.
  if(record?.route.includes('?')){u.searchParams.delete('tab');if(device)u.searchParams.delete('device');}
  if(theory){path=u.pathname==='/'?'/textbook':path+'/theory';u.searchParams.delete('view');}
  if(u.pathname==='/studios/aca')path='/studios/advanced-computer-architecture'+(theory?'/theory':'');
  return path+query(u.searchParams)+u.hash;
}

export function metadataFor(input:string) {
  const publicPath=publicUrl(input).split(/[?#]/)[0]!;
  const theory=publicPath.endsWith('/theory');
  const record=byUrl.get(theory?publicPath.slice(0,-7):publicPath);
  const page=SITE_PAGES[publicPath];
  const title=page?.title??(record?`${record.title}${theory?' — Theory & Textbook':''} | LogicLab`:`${publicPath.split('/').filter(Boolean).at(-1)?.replace(/-/g,' ')??'Page'} | LogicLab`);
  const description=page?.description??record?.description??'Explore interactive digital electronics and computer architecture lessons in LogicLab.';
  return {title,description,path:publicPath,theory,record,noindex:publicPath==='/notes'||(!page&&!record)};
}
