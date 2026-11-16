const {test}=require("node:test"),assert=require("node:assert/strict");
const {PHASE_DEVELOPMENT_SERVER:dev,PHASE_PRODUCTION_BUILD:build,PHASE_PRODUCTION_SERVER:production}=require("next/constants");
const {outputDirectory}=require("../scripts/next-output.cjs");
test("development output is isolated from the default production build and server",()=>{
  assert.equal(outputDirectory(dev,{}),".next-dev");assert.equal(outputDirectory(build,{}),".next");assert.equal(outputDirectory(production,{}),".next");
});
test("explicit production output stays consistent at build/start without changing development",()=>{
  const env={NEXT_BUILD_DIR:".next-v2"};assert.equal(outputDirectory(dev,env),".next-dev");assert.equal(outputDirectory(build,env),".next-v2");assert.equal(outputDirectory(production,env),".next-v2");
});
test("unsafe output paths and the reserved development directory fail explicitly",()=>{
  for(const value of [".next-dev",".NEXT-DEV","src",".","..","../outside","C:/temp/output","node_modules",".git",".next/../src"])assert.throws(()=>outputDirectory(build,{NEXT_BUILD_DIR:value}),/dedicated/);
});
test("phase configuration preserves strict mode, security headers and clean output",async()=>{
  const config=require("../next.config.js");
  for(const phase of [dev,build,production]){const c=config(phase);assert.equal(c.reactStrictMode,true);assert.equal(c.cleanDistDir,phase===dev);const headers=await c.headers();assert.ok(headers[0].headers.some(h=>h.key==="Content-Security-Policy"));assert.ok(headers[0].headers.some(h=>h.key==="X-Content-Type-Options"));}
});
test("build preparation replaces only dedicated generated output and creates route directories serially",()=>{
  const fs=require("node:fs"),path=require("node:path"),os=require("node:os");
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"campuspulse-output-test-"));
  try {
    for(const dir of ["src/app/api/example",".next",".next-dev",".private-data"])fs.mkdirSync(path.join(root,dir),{recursive:true});
    for(const file of ["src/app/api/example/route.ts",".next/stale.js",".next-dev/keep.txt",".private-data/keep.txt"])fs.writeFileSync(path.join(root,file),"fixture");
    const {prepareBuild}=require("../scripts/prepare-build.cjs");
    assert.equal(prepareBuild(root,{}),".next");
    assert.equal(fs.existsSync(path.join(root,".next/stale.js")),false);
    assert.ok(fs.existsSync(path.join(root,".next/types/app/api/example")));
    assert.ok(fs.existsSync(path.join(root,".next/server/app/api/example")));
    assert.ok(fs.existsSync(path.join(root,".next-dev/keep.txt")));
    assert.ok(fs.existsSync(path.join(root,".private-data/keep.txt")));
    assert.ok(fs.existsSync(path.join(root,"src/app/api/example/route.ts")));
    assert.throws(()=>prepareBuild(root,{NEXT_BUILD_DIR:"src"}),/dedicated/);
    assert.equal(prepareBuild(root,{}),".next");
  } finally {
    if(!path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep))throw new Error("Unsafe fixture cleanup.");
    fs.rmSync(root,{recursive:true,force:true});
  }
});
