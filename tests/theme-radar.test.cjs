const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {resolveTheme,THEME_INIT}=require('../src/lib/theme.ts');
const {buildingReportFilter}=require('../src/lib/buildings.ts');
test('theme initialization restores persisted choice before paint and honors OS fallback',()=>{
  for(const [saved,os,expected] of [['dark',false,'dark'],['light',true,'light'],[null,true,'dark'],['invalid',false,'light']]){
    const document={documentElement:{dataset:{}}};
    vm.runInNewContext(THEME_INIT,{document,localStorage:{getItem:()=>saved},matchMedia:()=>({matches:os})});
    assert.equal(document.documentElement.dataset.theme,expected);assert.equal(resolveTheme(saved,os),expected);
  }
  const document={documentElement:{dataset:{}}};vm.runInNewContext(THEME_INIT,{document,localStorage:{getItem(){throw Error('denied')}},matchMedia:()=>({matches:true})});assert.equal(document.documentElement.dataset.theme,'dark');
});
test('department filter uses only exact origin field and composes with status and priority',()=>{
  assert.deepEqual(buildingReportFilter(new URLSearchParams('originDepartment=AIML&status=Pending&priority=High')),{originDepartment:'AIML',status:'Pending',priorityLabel:'High'});
  assert.throws(()=>buildingReportFilter(new URLSearchParams({originDepartment:'x'.repeat(121)})));
});
test('department API scopes students server-side and exposes aggregate fields only',async t=>{
  const api=require('../src/lib/api.ts'),Grievance=require('../src/models/Grievance.ts').default,{NextRequest}=require('next/server');
  const actor={role:'student',userId:'a'.repeat(24)};
  t.mock.method(api,'authenticate',async()=>actor);
  let pipeline;
  t.mock.method(Grievance,'aggregate',async stages=>{pipeline=stages;return [{department:'AIML',total:2,pending:1,inProgress:1,resolved:0,highPriority:1}];});
  const route=require('../src/app/api/grievances/departments/route.ts');
  const response=await route.GET(new NextRequest('http://localhost/api/grievances/departments?status=Pending&originDepartment=AIML'));
  assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
  assert.equal(String(pipeline[0].$match.student),actor.userId);assert.equal(pipeline[0].$match.status,'Pending');assert.equal(pipeline[0].$match.department,undefined);
  assert.equal(pipeline[1].$group._id.$ifNull[0],'$originDepartment');
  const projected=pipeline.at(-1).$project;assert.deepEqual(Object.keys(projected).sort(),['_id','department','total','pending','inProgress','resolved','highPriority'].sort());
  actor.role='admin';await route.GET(new NextRequest('http://localhost/api/grievances/departments'));assert.equal(pipeline[0].$match.student,undefined);
  t.mock.method(api,'authenticate',async()=>{throw new api.ApiError(401,'Sign in');});
  assert.equal((await route.GET(new NextRequest('http://localhost/api/grievances/departments'))).status,401);
});
