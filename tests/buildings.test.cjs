const {test}=require('node:test'),assert=require('node:assert/strict');
const {buildingInput,buildingLabel,searchableFeature,approvedCampusFeatures,buildingReportFilter,managedFeature}=require('../src/lib/buildings.ts');
const {CAMPUS_FEATURES}=require('../src/lib/campusMap.ts');
test('metadata requires a real non-campus OSM feature and validated admin supplied identity',()=>{
  assert.equal(managedFeature('way/unknown'),undefined);assert.equal(managedFeature('way/213874316'),undefined);
  const feature=CAMPUS_FEATURES.find(f=>f.properties.category==='building');assert.ok(managedFeature(feature.id));
  const fields=buildingInput({displayName:'  Test Fixture Name  ',approved:true});assert.equal(fields.nameKey,'test fixture name');assert.equal(fields.category,'Other');
  for(const data of [{displayName:'',approved:true},{displayName:'a',approved:'yes'},{displayName:'a',approved:true,category:'Invented'},{displayName:'a',approved:true,description:'x'.repeat(1201)},{displayName:3,approved:false}])assert.throws(()=>buildingInput(data));
});
test('unidentified geometry has no technical student label and only approved custom names are searchable',()=>{
  const feature=CAMPUS_FEATURES.find(f=>f.properties.category==='building'&&!f.properties.name);
  assert.equal(buildingLabel(feature,[]),null);assert.equal(searchableFeature(feature,[]),false);
  const record={featureId:feature.id,displayName:'Test fixture supplied name',approved:false};
  assert.equal(searchableFeature(feature,[record]),false);assert.equal(buildingLabel(feature,[record]),null);
  record.approved=true;assert.equal(searchableFeature(feature,[record]),true);assert.equal(buildingLabel(feature,[record]),record.displayName);
});
test('public facilities exclude source-only names and drafts even in Admin map search',()=>{
  assert.deepEqual(approvedCampusFeatures([]),[]);
  const sourceNamed=CAMPUS_FEATURES.find(f=>f.properties.name&&f.properties.category!=='campus');
  assert.equal(searchableFeature(sourceNamed,[]),false);
  const feature=CAMPUS_FEATURES.find(f=>f.properties.category==='building');
  const rows=[{featureId:feature.id,displayName:'Approved fixture name',code:'TEST',category:'Academic',approved:true},{featureId:sourceNamed.id,displayName:'Draft fixture name',code:'',category:'Other',approved:false}];
  assert.deepEqual(approvedCampusFeatures(rows).map(f=>f.id),[feature.id]);assert.equal(approvedCampusFeatures(rows,'TEST').length,1);assert.equal(approvedCampusFeatures(rows,'Draft').length,0);
});
test('assignment endpoint requires Admin authorization',async t=>{
  const api=require('../src/lib/api.ts'),{NextRequest}=require('next/server');
  t.mock.method(api,'authenticate',async(_req,admin)=>{assert.equal(admin,true);throw new api.ApiError(403,'Administrator access required.');});
  assert.equal((await require('../src/app/api/grievances/[id]/building/route.ts').PATCH(new NextRequest('http://localhost/api/grievances/id/building',{method:'PATCH'}),{params:Promise.resolve({id:'a'.repeat(24)})})).status,403);
});
test('map and building aggregate share strict status, priority, category and inclusive UTC day filters',()=>{
  const query=buildingReportFilter(new URLSearchParams({status:'open',priority:'High',category:'Network',from:'2026-11-01',to:'2026-11-02'}));
  assert.deepEqual(query.status,{$ne:'Resolved'});assert.equal(query.priorityLabel,'High');assert.equal(query.category,'Network');
  assert.equal(query.createdAt.$gte.toISOString(),'2026-11-01T00:00:00.000Z');assert.equal(query.createdAt.$lt.toISOString(),'2026-11-03T00:00:00.000Z');
  for(const params of [{status:'deleted'},{priority:'Urgent'},{category:'$where'},{from:'2026-02-30'},{to:'bad'},{from:'2026-11-02',to:'2026-11-01'}])assert.throws(()=>buildingReportFilter(new URLSearchParams(params)));
});
test('building management rejects non-admin callers at the server boundary',async t=>{
  const api=require('../src/lib/api.ts'),{NextRequest}=require('next/server');
  t.mock.method(api,'authenticate',async(_req,admin)=>{assert.equal(admin,true);throw new api.ApiError(403,'Administrator access required.');});
  assert.equal((await require('../src/app/api/buildings/route.ts').POST(new NextRequest('http://localhost/api/buildings',{method:'POST'}))).status,403);
  assert.equal((await require('../src/app/api/buildings/[id]/route.ts').PATCH(new NextRequest('http://localhost/api/buildings/id',{method:'PATCH'}),{params:{id:'a'.repeat(24)}})).status,403);
});
test('aggregate and building metadata require a valid session',async t=>{
  const api=require('../src/lib/api.ts'),{NextRequest}=require('next/server');t.mock.method(api,'authenticate',async()=>{throw new api.ApiError(401,'Sign in');});
  assert.equal((await require('../src/app/api/buildings/analytics/route.ts').GET(new NextRequest('http://localhost/api/buildings/analytics'))).status,401);
  assert.equal((await require('../src/app/api/buildings/route.ts').GET(new NextRequest('http://localhost/api/buildings'))).status,401);
});
