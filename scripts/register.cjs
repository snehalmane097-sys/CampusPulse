// Use the already installed TypeScript compiler for operator scripts and Node tests.
const ts = require("typescript");
const fs = require("fs");
const path = require("path");
const Module = require("module");
const original = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith("@/")) request = path.join(process.cwd(), "src", request.slice(2));
  return original.call(this, request, parent, ...rest);
};
require.extensions[".ts"] = function (module, filename) {
  const result = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
  module._compile(result.outputText, filename);
};
require.extensions[".tsx"] = require.extensions[".ts"];
require("@next/env").loadEnvConfig(process.cwd());

if (process.argv.some(v => /migrate-v2\.ts$/.test(v))) process.env.MIGRATION_READ_ONLY = "true";
