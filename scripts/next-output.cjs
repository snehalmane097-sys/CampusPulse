const { PHASE_DEVELOPMENT_SERVER } = require("next/constants");
function outputDirectory(phase, env = process.env) {
  // Dev compilers and production builds must never write the same manifests/chunks.
  const production = env.NEXT_BUILD_DIR || ".next";
  if (!/^\.next(?:-[a-zA-Z0-9_-]+)?$/.test(production) || production.toLowerCase() === ".next-dev") {
    throw new Error("NEXT_BUILD_DIR must be a dedicated .next or .next-<suffix> directory, excluding reserved .next-dev.");
  }
  return phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : production;
}
module.exports = { outputDirectory };
