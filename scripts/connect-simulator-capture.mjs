import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import ts from "typescript";

// State readers are explicit source-level hooks, not runtime React internals.
// Run after adding a stateful lab or changing its source to refresh source fingerprints.
const root = path.resolve("src/studios");
const manifest = [];
function names(binding) {
  if (ts.isIdentifier(binding)) return [binding.text];
  return binding.elements.flatMap(item => ts.isBindingElement(item) ? names(item.name) : []);
}
function scan(file) {
  if (!/\.tsx?$/.test(file) || /\.test\./.test(file)) return;
  let text = fs.readFileSync(file, "utf8");
  const original = text;
  text = text.replace(/^import \{ useSimulatorCapture \} from "[^"]+";\r?\n/m, "")
    .replace(/^\s{2}useSimulatorCapture\("studios\/[^\n]+\);\r?\n\r?\n/gm, "");
  const relative = path.relative(root, file).replaceAll("\\", "/");
  if (/\/(shared|ui|guide|animation)\//.test("/" + relative) ||
      /^(widgets|learning|shell|StudioFrame|studioUi|guide|NumbersChrome)\.tsx$/.test(path.basename(file))) {
    if (text !== original) fs.writeFileSync(file, text);
    return;
  }
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edits = [];
  function visit(node) {
    if ((ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && node.body && ts.isBlock(node.body)) {
      const name = node.name?.getText(tree) || (ts.isVariableDeclaration(node.parent) ? node.parent.name.getText(tree) : "");
      if (/^[A-Z]|^useLab$/.test(name)) {
        const values = [];
        for (const statement of node.body.statements) {
          if (!ts.isVariableStatement(statement)) continue;
          for (const declaration of statement.declarationList.declarations) {
            const call = declaration.initializer;
            if (!call || !ts.isCallExpression(call) || !/^use[A-Z]/.test(call.expression.getText(tree))) continue;
            const hook = call.expression.getText(tree);
            if (/useEffect|useLayoutEffect|useCallback|useNavigate|useParams|useLocation|useSearchParams|usePrefs|useContext|useId|useSimulatorCapture/.test(hook)) continue;
            let bindings = names(declaration.name);
            if (ts.isArrayBindingPattern(declaration.name)) bindings = bindings.slice(0, 1);
            for (const value of bindings) {
              if (/^(query|notes|open|menu|notice|show[A-Z]|checked|resetKey)$/.test(value)) continue;
              values.push(hook === "useRef" ? value + ": " + value + ".current" : value);
            }
          }
        }
        if (values.length) {
          const source = path.relative(path.resolve("src"), file).replaceAll("\\", "/") + ":" + name;
          const version = crypto.createHash("sha256").update(text.replace(/\s+/g, " ")).digest("hex").slice(0, 12);
          edits.push({ pos: node.body.getStart(tree) + 1, text: '\n  useSimulatorCapture(' + JSON.stringify(source) + ', () => ({ ' + values.join(", ") + ' }), ' + JSON.stringify(version) + ');\n' });
          manifest.push({ source, version, fields: values });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  if (!edits.length) return;
  for (const edit of edits.sort((a, b) => b.pos - a.pos)) text = text.slice(0, edit.pos) + edit.text + text.slice(edit.pos);
  let target = path.relative(path.dirname(file), path.resolve("src/layout/SimulatorCapture")).replaceAll("\\", "/");
  if (!target.startsWith(".")) target = "./" + target;
  text = 'import { useSimulatorCapture } from "' + target + '";\n' + text;
  fs.writeFileSync(file, text);
}
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) walk(file); else scan(file);
  }
}
walk(root);
fs.mkdirSync("output/experiment-capture", { recursive: true });
fs.writeFileSync("output/experiment-capture/registrations.json", JSON.stringify(manifest, null, 2));
console.log("Connected " + manifest.length + " state readers across " + new Set(manifest.map(m => m.source.split("/")[1])).size + " studio directories.");
