const ts = require('../node_modules/typescript');
const fs = require('fs');
const log = fs.readFileSync('.codex-device-audit/phase2/typescript-errors.txt', 'utf8');
const grouped = new Map();
for (const m of log.matchAll(/^(src\/studios\/how-devices-work\/advanced\/[^\r\n(]+)\((\d+),(\d+)\): error/gm)) {
  if (!grouped.has(m[1])) grouped.set(m[1], []);
  grouped.get(m[1]).push([Number(m[2]), Number(m[3])]);
}
let total=0;
for (const [path, locations] of grouped) {
  const source = fs.readFileSync(path, 'utf8');
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const nodes=[];
  const walk=n=>{if(ts.isPropertyAccessExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='p')nodes.push(n);ts.forEachChild(n,walk);};
  walk(tree);
  const selected=new Map();
  for(const [line,column] of locations){const pos=tree.getPositionOfLineAndCharacter(line-1,column-1);const n=nodes.find(n=>n.getStart(tree)<=pos&&n.end>pos);if(n)selected.set(n.getStart(tree),n);}
  if(!selected.size)continue;
  let changed=source;
  for(const n of [...selected.values()].sort((a,b)=>b.getStart(tree)-a.getStart(tree))){changed=changed.slice(0,n.getStart(tree))+`parameterValue(p, '${n.name.text}')`+changed.slice(n.end);total++;}
  changed="import {parameterValue} from './parameters';\n"+changed;
  fs.writeFileSync(path,changed);
}
console.log(`Checked parameter reads added: ${total}`);
