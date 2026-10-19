// Refresh after adding a studio tab or local teaching note.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const paths = { cpu: 'cpu-blocks', 'flip-flops': 'flip-flops' };
const records = [];
function literal(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.filter(ts.isPropertyAssignment).map(p => [p.name.text, literal(p.initializer)]));
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) return literal(node.expression);
  return undefined;
}
for (const folder of fs.readdirSync(path.join(root, 'src/studios'))) {
  const dir = path.join(root, 'src/studios', folder);
  if (!fs.statSync(dir).isDirectory()) continue;
  let tabs = [], lessons;
  for (const file of fs.readdirSync(dir).filter(f => /\.(ts|tsx)$/.test(f) && !f.endsWith('.test.ts'))) {
    const source = ts.createSourceFile(file, fs.readFileSync(path.join(dir, file), 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name)) {
        if (/^(TABS|LOGIC_GATE_TABS|PAGES|PAGE_TABS|CHIPS)$/.test(node.name.text)) {
          const value = literal(node.initializer);
          if (Array.isArray(value) && value.every(v => v && typeof v.id === 'string' && typeof v.label === 'string')) tabs.push(...value.map(({id,label}) => ({id,label})));
        }
        if (node.name.text === 'LESSONS') lessons = literal(node.initializer);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  tabs = [...new Map(tabs.map(t => [t.id,t])).values()];
  if (tabs.length) records.push({ path: '/studios/' + (paths[folder] || folder), tabs, lessons: lessons || {} });
}
fs.writeFileSync(path.join(root, 'src/theory/tabMetadata.json'), JSON.stringify(records, null, 2) + '\n');
console.log(`Indexed ${records.length} tab-based studios and ${records.reduce((n,r) => n+r.tabs.length, 0)} tabs.`);
