import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {LABS} from '../../src/studios/how-devices-work/labs/data';
import {ADVANCED_LABS} from '../../src/studios/how-devices-work/advanced/data';
import {DEVICES,devicePath} from '../../src/studios/how-devices-work/catalogue';
import {componentDescription} from '../../src/studios/how-devices-work/labs/education';
import {GENERATED_PART_ART} from '../../src/studios/how-devices-work/generated-assets';
import {PURPOSES} from './purposes';
import {anatomySupplements,BUILD_PLANNING_FIELDS} from '../../src/studios/how-devices-work/anatomy-supplements';
import {BUILD_REFERENCES} from '../../src/studios/how-devices-work/build-references';

// Explicit equivalent names only. Keep technology/geometry variants separate.
const aliases:Record<string,string>={
 'adc':'analog-to-digital converter', 'analog to digital converter':'analog-to-digital converter',
 'analog-to-digital conversion':'analog-to-digital converter',
 'mcu':'microcontroller', 'microcontroller unit':'microcontroller',
 'dc dc converter':'dc-dc converter', 'dc/dc converter':'dc-dc converter',
 'infrared camera':'ir camera', 'infrared led':'ir led',
 'photodiodes':'photodiode', 'cooling fans':'cooling fan',
};
const normalize=(name:string)=>{const key=name.normalize('NFKC').toLowerCase().replace(/[–—]/g,'-').replace(/\s+/g,' ').trim();return aliases[key]??key;};
const parts=new Map<string,any>();
const usages:any[]=[];
const labs=[...LABS,...ADVANCED_LABS].sort((a,b)=>a.number-b.number);
for(const lab of labs){
 const entries=[...lab.parts.map(name=>({name,purpose:undefined as string|undefined,basis:'Existing educational inventory',source:undefined as string|undefined,quantity:'Design-specific',purchase:'Requires a selected design'})),
 ...anatomySupplements(lab.number).filter(p=>!lab.parts.includes(p.name)).map(p=>({name:p.name,purpose:p.purpose,basis:p.basis,source:'src/studios/how-devices-work/anatomy-supplements.ts',quantity:'Design-specific',purchase:'May already be inside a purchased assembly; confirm implementation'})),
 ...(BUILD_REFERENCES[lab.number]?.items??[]).map(p=>({name:p.name,purpose:p.purpose,basis:BUILD_REFERENCES[lab.number]!.title,source:BUILD_REFERENCES[lab.number]!.source,quantity:p.quantity,purchase:p.purchase}))];
 for(const [index,entry] of entries.entries()){
 const {name}=entry;
 const key=normalize(name);
 const id=`PART-${createHash('sha256').update(key).digest('hex').slice(0,12).toUpperCase()}`;
 const explicit=entry.purpose??('steps' in lab?lab.partFunctions?.[name]:componentDescription(lab,name));
 const generic=!explicit||explicit.includes('connects to the acquisition or control chain');
 const expanded=generic?PURPOSES.find(([pattern])=>pattern.test(name))?.[1]:undefined;
 const purpose=expanded??explicit??`Purpose requires component-level review in ${lab.device.name}; listed in the existing device hardware inventory.`;
 const image=GENERATED_PART_ART[lab.number]?.[name]??'';
 if(!parts.has(id))parts.set(id,{id,key,name,aliases:[],deviceIds:[],imagePath:`/devices/parts/${id}.webp`,imageStatus:'Not generated',existingImages:[]});
 const part=parts.get(id);
 if(!part.aliases.includes(name))part.aliases.push(name);
 if(!part.deviceIds.includes(lab.device.id))part.deviceIds.push(lab.device.id);
 if(image&&!part.existingImages.includes(image))part.existingImages.push(image);
 usages.push({deviceNumber:lab.number,deviceId:lab.device.id,device:lab.device.name,category:lab.device.category,partId:id,part:name,purpose,purposeStatus:expanded?'Expanded educational description':generic?'Needs detailed review':'Existing component description',scope:entry.basis,quantity:entry.quantity,purchase:entry.purchase,position:index+1,route:devicePath(lab.device),source:entry.source??(expanded?'tools/parts-catalogue/purposes.ts':'steps' in lab?lab.source:'src/studios/how-devices-work/labs/education.ts'),existingImage:image});
 }
}
const missing=DEVICES.filter(d=>!labs.some(l=>l.device.id===d.id)).map(d=>({id:d.id,name:d.name,route:devicePath(d)}));
const imageManifest=fs.existsSync('src/studios/how-devices-work/part-images.json')?JSON.parse(fs.readFileSync('src/studios/how-devices-work/part-images.json','utf8')):{byId:{},byUsage:{}};
for(const part of parts.values()){
 const art=imageManifest.byId[part.id];
 if(art)Object.assign(part,{imagePath:art.src,imageStatus:art.kind==='reference'?'Licensed component-family reference':'Generated representative illustration',imageCaption:art.caption,imageSource:art.sourceUrl??'Generated educational illustration',imageAuthor:art.attribution??'',imageLicense:art.license??'',imageFamily:art.family??''});
}
for(const usage of usages){
 const art=imageManifest.byUsage[`${usage.deviceId}::${usage.part}`]??imageManifest.byId[usage.partId];
 usage.anatomyImage=art?.src??usage.existingImage;
}
const registry={schemaVersion:2,idRule:'PART + first 12 uppercase SHA-256 characters of canonical component key. IDs are immutable once assigned; add aliases to existing records rather than renaming keys.',reuseRule:'One approved image per Part ID. Different sensor technology, physical form or geometry needs a separate ID; device-specific purpose stays in usages.',scope:'All 140 educational inventories reviewed; supporting components are design-dependent. Alternative documented builds are separate designs, not additions to the original shopping list. No complete manufacturer BOM is claimed.',buildPlanningFields:BUILD_PLANNING_FIELDS,buildReferences:BUILD_REFERENCES,parts:[...parts.values()].sort((a,b)=>a.key.localeCompare(b.key)),usages,missingDevices:missing};
fs.writeFileSync('src/studios/how-devices-work/parts-registry.json',JSON.stringify(registry,null,2)+'\n');
fs.writeFileSync('src/studios/how-devices-work/part-identities.json',JSON.stringify(Object.fromEntries(usages.map(u=>[`${u.deviceId}::${u.part}`,u.partId])),null,2)+'\n');
console.log(JSON.stringify({devices:labs.length,usages:usages.length,uniqueParts:parts.size,missing:missing.length,needsReview:usages.filter(u=>u.purposeStatus==='Needs detailed review').length}));
