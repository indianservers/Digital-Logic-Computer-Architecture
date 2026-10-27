import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';

// Build a lightweight routing index from the same catalogue used by the textbook.
const server = await createServer({ configFile:false, optimizeDeps:{noDiscovery:true,include:[]}, server:{ middlewareMode:true }, appType:'custom' });
try {
  const { THEORY_ARTICLES } = await server.ssrLoadModule('/src/theory/catalogue.ts');
  const aliases = {fde:'fetch-decode-execute',rtl:'register-transfer-language',kmap:'karnaugh-map',vm:'virtual-memory',io:'input-output',fsm:'finite-state-machines',alu:'arithmetic-logic-unit',aca:'advanced-computer-architecture',hetero:'heterogeneous-computing',soc:'system-on-chip',cpu8:'8-bit-cpu',cpu16:'16-bit-cpu',compare:'processor-comparison'};
  const names = {'/studios/fde?tab=rtl':'register-transfers','/studios/fde?tab=signals':'control-signals','/studios/fde?tab=cycle':'instruction-cycle','/studios/number-systems?tab=convert':'number-base-conversion','/studios/number-systems?tab=ieee':'ieee-754-floating-point','/studios/number-systems?tab=hamming':'hamming-code','/studios/memory?tab=array':'ram-memory-array'};
  const slug = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const used = new Set();
  const records = THEORY_ARTICLES.filter(a=>!a.route.includes("#")&&!["/studios/combinational?tab=canvas","/studios/truth-tables?tab=from-table"].includes(a.route)).map(a => {
    const [path, search=''] = a.route.split('?');
    const parts=path.split('/');
    if(aliases[parts[2]])parts[2]=aliases[parts[2]];
    const tab=new URLSearchParams(search).get('tab');
    let url=parts.join('/')+(tab?'/'+(names[a.route]??slug(a.title)??tab):'');
    if(used.has(url))url+='-'+slug(tab??a.id);
    if(used.has(url))throw new Error('SEO URL collision: '+url);
    used.add(url);
    const expanded={'/studios/fde?tab=rtl':'Register Transfers','/studios/fde?tab=signals':'Control Signals','/studios/fde?tab=cycle':'Instruction Cycle','/studios/number-systems?tab=hamming':'Hamming Code Error Correction','/studios/number-systems?tab=ieee':'IEEE 754 Floating Point','/studios/memory?tab=array':'RAM Memory Array'};
    const label=expanded[a.route]??a.title;
    const duplicate=THEORY_ARTICLES.filter(b=>b.title===a.title&&b.studio===a.studio).length>1;
    const category=a.studio==='how-devices-work'&&duplicate?path.split('/')[3]:null;
    const title=label+(category?' ('+category[0].toUpperCase()+category.slice(1)+')':'')+(label===a.studioTitle?'':' | '+a.studioTitle);
    const description=(a.introduction||'Explore '+a.title+' with interactive diagrams, worked examples, and practice questions.').replace(/\s+/g,' ').trim();
    return {route:a.route,url,title,description:description.length>158?description.slice(0,155).replace(/\s+\S*$/,'')+'…':description,id:a.id,studio:a.studioTitle};
  });
  await mkdir('src/seo',{recursive:true});
  await writeFile('src/seo/routes.json',JSON.stringify(records,null,2)+'\n');
  console.log('Generated SEO routes for '+records.length+' labs and studios.');
} finally { await server.close(); }
