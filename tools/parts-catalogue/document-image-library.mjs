import fs from 'node:fs';
const manifest=JSON.parse(fs.readFileSync('src/studios/how-devices-work/part-images.json','utf8'));
const assets=[...new Map([...Object.values(manifest.byId),...Object.values(manifest.byUsage)].map(p=>[p.src,p])).values()];
const generated=fs.readdirSync('tools/parts-catalogue').filter(f=>/^generated-.*\.json$/.test(f)&&f!=='generated-image-prompts.json').map(f=>JSON.parse(fs.readFileSync(`tools/parts-catalogue/${f}`,'utf8').replace(/^\uFEFF/,'')));
fs.writeFileSync('tools/parts-catalogue/generated-image-prompts.json',JSON.stringify({tool:'Built-in image_gen',transparentBackground:true,assets:generated},null,2)+'\n');
const md=`# Reusable anatomy image library\n\n${Object.keys(manifest.byId).length} stable part IDs are linked to ${assets.length} distinct images. Device-specific INS and SONAR artwork takes priority. Original anatomy content remains intact.\n\nImages are representative educational examples, not model-specific purchase specifications. A functional label can represent circuitry integrated into a shared board. Component-family reuse does not imply physical interchangeability.\n\nNew illustrations were created with the built-in ImageGen tool. Recorded prompts and output paths are in [generated-image-prompts.json](./generated-image-prompts.json). The initial enclosure and radio module illustrations used briefs for an open electronics enclosure with mounting screws/standoffs and a shielded RF transceiver PCB with SMA connector, respectively. Full-resolution sources stay intact; WebP copies are delivery previews.\n\nLicensed Wikimedia references retain authors, source URLs and licences below and on each expanded anatomy card.\n\n| Family / caption | Asset | Author | Source | Licence |\n|---|---|---|---|---|\n`;
const clean=s=>String(s??'').replaceAll('|',' / ').replaceAll('\n',' ');
const rows=assets.map(a=>`| ${clean(a.family??a.caption)} | ${a.src} | ${clean(a.attribution??'Generated illustration')} | ${a.sourceUrl?`[Wikimedia Commons](${a.sourceUrl})`:(a.src.startsWith('/device-labs/')?'Existing device artwork':'Built-in ImageGen')} | ${a.licenseUrl?`[${a.license}](${a.licenseUrl})`:clean(a.license??'Generated')} |`).join('\n');
fs.writeFileSync('tools/parts-catalogue/image-library.md',md+rows+'\n');
console.log({parts:Object.keys(manifest.byId).length,distinctImages:assets.length,newRecordedPrompts:generated.length});


