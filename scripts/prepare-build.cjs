// Next owns only dedicated generated output. Prepare its route directory tree serially:
// concurrent worker mkdir calls fail intermittently with EPERM on this Windows workspace.
const fs = require("node:fs");
const path = require("node:path");
const { PHASE_PRODUCTION_BUILD } = require("next/constants");
const { outputDirectory } = require("./next-output.cjs");
function prepareBuild(root, env = process.env) {
  root = fs.realpathSync(root);
  const name = outputDirectory(PHASE_PRODUCTION_BUILD, env);
  const target = path.resolve(root, name);
  if (path.dirname(target) !== root || !name.startsWith(".next")) throw new Error("Unsafe build output path.");
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw new Error("Refusing linked build output.");
  fs.rmSync(target, { recursive: true, force: true });
  const dirs = new Set(["cache", "types", "server", "server/pages", "server/chunks", "static/chunks", "static/chunks/pages", "server/app/_not-found", "types/app/_not-found", "static/chunks/app/_not-found"]);
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) visit(file);
      else if (/^(page|route)\.(tsx?|jsx?)$/.test(entry.name)) {
        const relative = path.relative(path.join(root, "src/app"), dir);
        for (const prefix of ["server/app", "types/app", "static/chunks/app"]) dirs.add(path.join(prefix, relative));
      }
    }
  }
  visit(path.join(root, "src/app"));
  fs.mkdirSync(target, { recursive: true });
  for (const dir of dirs) fs.mkdirSync(path.join(target, dir), { recursive: true });
  return name;
}
if (require.main === module) {
  require("@next/env").loadEnvConfig(process.cwd());
  console.log("Prepared clean production output: " + prepareBuild(process.cwd()));
}
module.exports = { prepareBuild };
