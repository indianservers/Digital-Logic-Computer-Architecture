import fs from 'node:fs';
const manifest=JSON.parse(fs.readFileSync('src/studios/how-devices-work/part-images.json','utf8'));
const registry=JSON.parse(fs.readFileSync('src/studios/how-devices-work/parts-registry.json','utf8'));
const missing=registry.parts.filter(p=>!manifest.byId[p.id]);
const errors=[];
const sources=new Set([...Object.values(manifest.byId),...Object.values(manifest.byUsage)].flatMap(art=>[art.src,art.thumbnail,art.preview].filter(Boolean)));
for(const src of sources){
 const file='public'+src;
 if(!fs.existsSync(file)){errors.push(file);continue;}
 const data=fs.readFileSync(file);
 if(data.length<100||!(data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||data[0]===255&&data[1]===216||data.subarray(0,4).toString()==='RIFF'))errors.push('Invalid image '+file);
}
if(missing.length||errors.length)throw new Error(JSON.stringify({uncoveredParts:missing.map(p=>p.name),errors}));
console.log(`${registry.parts.length} unique part IDs / ${registry.usages.length} device usages: all images present and valid.`);
