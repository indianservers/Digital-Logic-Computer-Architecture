import fs from 'node:fs/promises';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
const data=JSON.parse(await fs.readFile('src/studios/how-devices-work/parts-registry.json','utf8'));
const out='outputs/01a11cc4-c71e-7d32-8be9-5a124f85c861';
const wb=Workbook.create();
function sheet(name,title,note,headers,rows,widths){
 const s=wb.worksheets.add(name);s.showGridLines=false;
 const last=String.fromCharCode(64+headers.length),end=rows.length+5;
 s.getRange(`A1:${last}${end}`).format.font={name:'Arial',size:10};
 s.getRange(`A1:E1`).merge();s.getRange('A1').values=[[title]];
 s.getRange(`A1:${last}1`).format={fill:'#0F766E',font:{name:'Arial',size:15,bold:true,color:'#FFFFFF'},rowHeight:32};
 s.getRange(`A2:E3`).merge();s.getRange('A2').values=[[note]];
 s.getRange(`A2:${last}3`).format={wrapText:true,rowHeight:26,verticalAlignment:'center',font:{name:'Arial',size:10,color:'#475569'}};
 s.getRange(`A5:${last}${end}`).values=[headers,...rows];
 s.getRange(`A5:${last}5`).format={fill:'#134E4A',font:{name:'Arial',bold:true,color:'#FFFFFF'},rowHeight:28,wrapText:true};
 s.getRange(`A6:${last}${end}`).format={wrapText:true,verticalAlignment:'top',rowHeight:55};
 widths.forEach((w,i)=>s.getRange(`${String.fromCharCode(65+i)}:${String.fromCharCode(65+i)}`).format.columnWidth=w);
 rows.forEach((row,i)=>{const lines=Math.max(...row.map((v,j)=>Math.ceil(String(v??'').length/(widths[j]*0.9))));s.getRange(`A${i+6}:${last}${i+6}`).format.rowHeight=Math.max(32,lines*14+10);});
 s.tables.add(`A5:${last}${end}`,true,name.replace(/ /g,'')+'Table');
 s.freezePanes.freezeRows(5);s.freezePanes.freezeColumns(name==='Device Parts'?3:2);
 return s;
}
const parts=data.parts;
sheet('Device Parts','How Devices Work — Device Parts',
 `${new Set(data.usages.map(u=>u.deviceId)).size} devices • ${data.usages.length} entries • ${parts.length} unique part IDs. Filter Scope to separate original inventories, design-dependent support items and documented alternative builds. A complete purchase BOM is not validated for every device.`,
 ['Device No.','Device','Part','Part ID','Purpose in Device','Category','Scope / Build Design','Quantity','Purchase / Integration Note','Description Basis','Device Route','Purpose Source','Anatomy Image'],
 data.usages.map(u=>[u.deviceNumber,u.device,u.part,u.partId,u.purpose,u.category,u.scope,u.quantity,u.purchase,u.purposeStatus,u.route,u.source,u.anatomyImage??u.existingImage]),
 [12,32,30,25,85,16,50,22,80,32,48,60,50]);
sheet('Unique Parts','Reusable Parts — Image Library',
 'Part IDs remain stable. Representative family images can serve related IDs; device-specific artwork takes priority. Image Path is the current shared anatomy asset. Images are representative component-family examples, with device-specific overrides preserved. Keep distinct technologies and physical forms separate; add aliases without changing assigned IDs.',
 ['Part ID','Canonical Part','Source Names / Aliases','Used by Devices','Device Count','Shared Image Path','Image Status','Existing Image Candidates','Generation Brief','Image Caption','Image Source','Image Author','Image Licence'],
 parts.map(p=>[p.id,p.key,p.aliases.join(' | '),p.deviceIds.map(id=>data.usages.find(u=>u.deviceId===id).device).join(' | '),p.deviceIds.length,p.imagePath,p.imageStatus,p.existingImages.join(' | '),`Isolated educational component illustration: ${p.name}. Show its physical form and visible connections on a neutral background, without device-specific branding. Reference role: ${data.usages.find(u=>u.partId===p.id).purpose} ${/logic|analysis|mapper|processing|supervisor|encoder/i.test(p.name)?'This entry may be a logical function or assembly; confirm its intended physical representation before generation.':''}`,p.imageCaption??'',p.imageSource??'',p.imageAuthor??'',p.imageLicense??'']),
 [25,32,45,85,14,52,35,75,100,65,65,55,24]);
const devices=[...new Set(data.usages.map(u=>u.deviceId))];
sheet('Device Coverage','Device Coverage & Reuse Rules',
 'All 140 inventories reviewed and retained. Added supporting assembly guides on every device. Purchase validation requires a chosen design, quantities, MPNs, electrical/mechanical compatibility, wiring, firmware and acceptance tests. Documented alternatives use their own inventories.',
 ['Device No.','Device','Category','Part Entries','Distinct Part IDs','Device Route','Build Status','Documented Alternative','Parts Reference','Assembly / Software Guide'],
 devices.map(id=>{const us=data.usages.filter(u=>u.deviceId===id);const ref=data.buildReferences[us[0].deviceNumber];return [us[0].deviceNumber,us[0].device,us[0].category,us.length,new Set(us.map(u=>u.partId)).size,us[0].route,ref?'Documented educational alternative; original design not validated':'Component guide; model-specific BOM required',ref?.title??'Not selected',ref?.source??'',ref?.assemblySource??''];}),
 [12,38,18,16,20,65,70,65,65,65]);
wb.recalculate();
await fs.mkdir(out,{recursive:true});
for(const name of ['Device Parts','Unique Parts','Device Coverage']){
 const img=await wb.render({sheetName:name,range:name==='Device Parts'?'A1:E9':name==='Unique Parts'?'A1:E9':'A1:F9',scale:1.3,format:'png'});
 await fs.writeFile(`${out}/${name.replaceAll(' ','-')}-preview.png`,new Uint8Array(await img.arrayBuffer()));
}
console.log((await wb.inspect({kind:'sheet,table',maxChars:2000,tableMaxRows:2,tableMaxCols:3})).ndjson);
await (await SpreadsheetFile.exportXlsx(wb)).save(`${out}/How-Devices-Work-Parts-Catalogue.xlsx`);
console.log('Saved workbook.');


