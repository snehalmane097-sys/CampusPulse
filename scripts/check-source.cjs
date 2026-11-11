// Dependency-free syntax/diagnostic check. This does not claim to replace ESLint.
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
let errors = 0;
function visit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) visit(file);
    else if (/\.tsx?$/.test(file)) {
      const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      for (const diagnostic of source.parseDiagnostics) { errors++; console.error(file, ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")); }
    }
  }
}
visit("src"); visit("scripts");
if (errors) process.exitCode = 1; else console.log("TypeScript source syntax check passed (not ESLint).");
