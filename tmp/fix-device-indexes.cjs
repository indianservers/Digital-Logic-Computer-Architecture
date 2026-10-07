const ts=require('../node_modules/typescript'),fs=require('fs');
const grouped=new Map();
for(const m of fs.readFileSync('.codex-device-audit/phase2/typescript-errors.txt','utf8').matchAll(/^(src\/studios\/how-devices-work\/advanced\/[^\r\n(]+)\((\d+),(\d+)\): error/gm)){if(!grouped.has(m[1]))grouped.set(m[1],[]);grouped.get(m[1]).push([+m[2],+m[3]]);}
let count=0;
for(const [path,locations]of grouped){
 const source=fs.readFileSync(path,'utf8'),tree=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true),nodes=[];
 const walk=n=>{if(ts.isElementAccessExpression(n)&&!n.questionDotToken)nodes.push(n);ts.forEachChild(n,walk);};walk(tree);
 const selected=new Set();
 for(const [line,col]of locations){const pos=tree.getPositionOfLineAndCharacter(line-1,col-1);for(const n of nodes)if(n.getStart(tree)<=pos&&n.end>pos)selected.add(n);}
 if(!selected.size)continue;
 const children=n=>{const replacements=[...selected].filter(c=>c!==n&&c.getStart(tree)>=n.getStart(tree)&&c.end<=n.end&&!([...selected].some(p=>p!==n&&p!==c&&p.getStart(tree)>=n.getStart(tree)&&p.end<=n.end&&p.getStart(tree)<=c.getStart(tree)&&p.end>=c.end)));let text=source.slice(n.getStart(tree),n.end);for(const c of replacements.sort((a,b)=>b.getStart(tree)-a.getStart(tree)))text=text.slice(0,c.getStart(tree)-n.getStart(tree))+render(c)+text.slice(c.end-n.getStart(tree));return text;};
 const render=n=>{let ancestor=n;while(ts.isArrayLiteralExpression(ancestor.parent)||ts.isParenthesizedExpression(ancestor.parent))ancestor=ancestor.parent;const parent=ancestor.parent,isWrite=ts.isBinaryExpression(parent)&&parent.left===ancestor&&parent.operatorToken.kind>=ts.SyntaxKind.FirstAssignment&&parent.operatorToken.kind<=ts.SyntaxKind.LastAssignment||ts.isPostfixUnaryExpression(parent)||ts.isPrefixUnaryExpression(parent);count++;if(isWrite)return children(n)+'!';return `itemAt(${selected.has(n.expression)?render(n.expression):children(n.expression)}, ${selected.has(n.argumentExpression)?render(n.argumentExpression):children(n.argumentExpression)})`;};
 const roots=[...selected].filter(n=>![...selected].some(p=>p!==n&&p.getStart(tree)<=n.getStart(tree)&&p.end>=n.end));let changed=source;
 for(const n of roots.sort((a,b)=>b.getStart(tree)-a.getStart(tree)))changed=changed.slice(0,n.getStart(tree))+render(n)+changed.slice(n.end);
 if(changed.includes("import {parameterValue} from './parameters';"))changed=changed.replace("import {parameterValue} from './parameters';","import {parameterValue,itemAt} from './parameters';");else if(!/import \{[^}]*\bitemAt\b[^}]*\} from '.\/parameters'/.test(changed))changed="import {itemAt} from './parameters';\n"+changed;
 fs.writeFileSync(path,changed);
}
console.log(`Checked model-entry reads added: ${count}`);
