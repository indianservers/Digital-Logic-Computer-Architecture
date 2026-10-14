// Delivery-size copies only; source images and full-resolution downloads stay intact.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const images=JSON.parse(await fs.readFile('src/studios/how-devices-work/part-images.json','utf8'));
const sources=[...new Set([...Object.values(images.byId),...Object.values(images.byUsage)].map(p=>p.src))];
await fs.mkdir('public/devices/parts/previews',{recursive:true});
for(const src of sources){
 const id=createHash('sha256').update(src).digest('hex').slice(0,16);
 const thumb=`public/devices/parts/previews/${id}-thumb.webp`;
 const preview=`public/devices/parts/previews/${id}-preview.webp`;
 try{await fs.access(thumb);await fs.access(preview);}catch{
  await sharp('public'+src).resize({width:320,height:240,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toFile(thumb);
  await sharp('public'+src).resize({width:960,height:720,fit:'inside',withoutEnlargement:true}).webp({quality:86}).toFile(preview);
 }
}
console.log(`Prepared web previews for ${sources.length} distinct images.`);
