import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {imageFamily} from './image-families.mjs';
const registry=JSON.parse(fs.readFileSync('src/studios/how-devices-work/parts-registry.json','utf8'));
const commons=JSON.parse(fs.readFileSync('tools/parts-catalogue/commons-images.json','utf8'));
const families=JSON.parse(fs.readFileSync('tools/parts-catalogue/image-queries.json','utf8'));
const reject=fs.existsSync('tools/parts-catalogue/rejected-images.json')?JSON.parse(fs.readFileSync('tools/parts-catalogue/rejected-images.json','utf8')):[];
const INS='/device-labs/generated/063-inertial-navigation-system';
const SONAR='/device-labs/generated/011-sonar';
const generated={
 'Gyroscope':{src:`${INS}/gyroscope-assembly.png`,caption:'Representative gyroscope assembly'},
 'Inertial measurement unit':{src:`${INS}/accelerometer-assembly.png`,caption:'Representative inertial sensor hardware'},
 'Analog to digital converter board':{src:`${INS}/adc-interface.png`,caption:'Representative analog-to-digital conversion interface'},
 'Processor and control circuit board':{src:`${INS}/processor-board.png`,caption:'Example processor board; this function may share a board with other functions'},
 'Memory circuit board':{src:`${INS}/memory-v2.png`,caption:'Representative memory hardware'},
 'Power supply module':{src:`${INS}/power-supply.png`,caption:'Representative power conversion module'},
 'Electronic interface board':{src:`${INS}/data-bus-interface.png`,caption:'Example electronic data interface board'},
 'Sonar transducer':{src:`${SONAR}/transducer.png`,caption:'Representative acoustic transducer'},
 'Analog amplifier circuit board':{src:`${SONAR}/receive-amplifier.png`,caption:'Example analog signal amplification board'},
 'Mechanical enclosure and fasteners':{src:'/devices/parts/generated/enclosure-and-mounting-hardware.png',caption:'Example electronics enclosure and mounting hardware'},
};
if(fs.existsSync('public/devices/parts/generated/radio-transceiver-module.png'))generated['Radio transceiver module']={src:'/devices/parts/generated/radio-transceiver-module.png',caption:'Representative radio transceiver module'};
for(const file of fs.readdirSync('tools/parts-catalogue').filter(f=>/^generated-.*\.json$/.test(f)&&f!=='generated-image-prompts.json')){
 const entry=JSON.parse(fs.readFileSync(`tools/parts-catalogue/${file}`,'utf8').replace(/^\uFEFF/,''));
 const family=Object.keys(families).find(f=>f.toLowerCase().replace(/[^a-z0-9]+/g,'-')===file.replace(/^generated-|\.json$/g,''));
 if(family){const {prompt,...art}=entry;generated[family]=art;}
}
const byId={},byUsage={},review=[];
for(const part of registry.parts){
 const family=imageFamily(part.key),photo=commons[family];
 const existing=part.existingImages.find(src=>fs.existsSync('public'+src));
 let art;
 if(existing)art={src:existing,kind:'illustration',caption:'Representative standalone component illustration'};
 else if(generated[family]&&fs.existsSync('public'+generated[family].src))art={...generated[family],kind:'illustration'};
 else if(photo?.src&&!reject.includes(family)&&fs.existsSync('public'+photo.src))art=photo;
 if(art)byId[part.id]={...art,family};
 else review.push({id:part.id,part:part.name,family});
}
// Generic names can have different physical implementations. Device-specific art wins.
for(const usage of registry.usages){
 if(usage.existingImage&&fs.existsSync('public'+usage.existingImage))byUsage[`${usage.deviceId}::${usage.part}`]={src:usage.existingImage,kind:'illustration',caption:'Representative standalone component illustration'};
 if(usage.part==='Receiver'&&usage.deviceNumber!==53&&generated['RF front end circuit'])byUsage[`${usage.deviceId}::${usage.part}`]={...generated['RF front end circuit'],family:'RF front end circuit',kind:'illustration'};
}
for(const art of [...Object.values(byId),...Object.values(byUsage)]){
 const hash=createHash('sha256').update(art.src).digest('hex').slice(0,16);
 for(const [field,suffix] of [['thumbnail','thumb'],['preview','preview']]){
  const src=`/devices/parts/previews/${hash}-${suffix}.webp`;
  if(fs.existsSync('public'+src))art[field]=src;
 }
}
fs.writeFileSync('src/studios/how-devices-work/part-images.json',JSON.stringify({byId,byUsage},null,2)+'\n');
fs.writeFileSync('tools/parts-catalogue/image-coverage.json',JSON.stringify({total:registry.parts.length,covered:Object.keys(byId).length,missing:review},null,2)+'\n');
const gallery=[...new Map(Object.values(byId).map(p=>[p.src,p])).values()];
fs.writeFileSync('tools/parts-catalogue/image-review-data.json',JSON.stringify(gallery,null,2));
console.log(JSON.stringify({uniqueParts:registry.parts.length,covered:Object.keys(byId).length,missing:review.length,downloadedFamilies:gallery.length}));
