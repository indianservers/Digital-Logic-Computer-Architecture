const fs=require('fs'),ts=require('../node_modules/typescript');
for(const file of fs.readdirSync('src/studios/how-devices-work/advanced').filter(f=>/\.tsx?$/.test(f)&&f!=='parameters.ts')){
 const path='src/studios/how-devices-work/advanced/'+file,source=fs.readFileSync(path,'utf8'),tree=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true),edits=[];
 const walk=n=>{
  if(ts.isElementAccessExpression(n)&&!n.questionDotToken){const parent=n.parent,decl=ts.isVariableDeclaration(parent)&&parent.initializer===n&&ts.isIdentifier(parent.name)&&!['graph','value','v'].includes(parent.name.text),assignment=ts.isBinaryExpression(parent)&&parent.right===n&&ts.isIdentifier(parent.left)&&parent.operatorToken.kind===ts.SyntaxKind.EqualsToken;if(decl||assignment)edits.push([n.getStart(tree),n.end,`itemAt(${n.expression.getText(tree)}, ${n.argumentExpression.getText(tree)})`]);}
  if(ts.isArrayLiteralExpression(n)&&ts.isForOfStatement(n.parent))edits.push([n.end,n.end,' as const']);
  if(ts.isBindingElement(n)&&!n.initializer&&ts.isArrayBindingPattern(n.parent)&&ts.isVariableDeclaration(n.parent.parent)&&n.parent.parent.initializer?.getText(tree).endsWith('.visual'))edits.push([n.end,n.end,'=0']);
  ts.forEachChild(n,walk);
 };walk(tree);
 let changed=source;for(const [start,end,text]of edits.sort((a,b)=>b[0]-a[0]))changed=changed.slice(0,start)+text+changed.slice(end);
 if(changed!==source){if(!/import \{[^}]*\bitemAt\b[^}]*\} from/.test(changed)){if(changed.includes("import {parameterValue} from './parameters';"))changed=changed.replace("import {parameterValue} from './parameters';","import {parameterValue,itemAt} from './parameters';");else changed="import {itemAt} from './parameters';\n"+changed;}fs.writeFileSync(path,changed);}
}
