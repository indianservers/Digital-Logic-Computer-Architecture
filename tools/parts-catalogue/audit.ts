import fs from 'node:fs';
import {LABS} from '../../src/studios/how-devices-work/labs/data';
import {ADVANCED_LABS} from '../../src/studios/how-devices-work/advanced/data';
import {GENERATED_PART_ART} from '../../src/studios/how-devices-work/generated-assets';
const rows=[...LABS,...ADVANCED_LABS].map(l=>({number:l.number,device:l.device.name,parts:l.parts,flow:l.device.signalFlow,missingArtworkParts:Object.keys(GENERATED_PART_ART[l.number]??{}).filter(p=>!l.parts.includes(p))}));
fs.writeFileSync('tools/parts-catalogue/inventory-audit.json',JSON.stringify(rows,null,2));
console.log(rows.map(l=>`${l.number} ${l.device}: ${l.parts.join(' | ')}${l.missingArtworkParts.length?'\nMISSING: '+l.missingArtworkParts.join(' | '):''}`).join('\n'));
