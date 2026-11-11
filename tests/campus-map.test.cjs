const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const maps=require('../src/lib/campusMap.ts');
const {ownMap}=require('../src/lib/mapLifecycle.ts');

test('map ownership survives effect replay and repeated mount/unmount without private Leaflet fields',()=>{
  const node={initialized:false};let creates=0,removes=0;
  const create=()=>{assert.equal(node.initialized,false);node.initialized=true;creates++;return{remove(){assert.equal(node.initialized,true);node.initialized=false;removes++;}};};
  for(let i=0;i<30;i++){const cleanup=ownMap(create,()=>{});cleanup();cleanup();}
  assert.equal(creates,30);assert.equal(removes,30);assert.equal(node.initialized,false);
  assert.throws(()=>ownMap(create,()=>{throw Error('setup failure');}),/setup failure/);assert.equal(node.initialized,false);
});
test('old ref closure reproduces the observed duplicate initialization while effect ownership releases before replay',()=>{
  let initialized=false;const context=null;
  const oldRef=node=>{if(node&&context===null){if(initialized)throw Error('Map container is already initialized.');initialized=true;}};
  oldRef({});oldRef(null);assert.throws(()=>oldRef({}),/already initialized/);
});
test('campus geometry has real source identifiers; legacy fictional positions are not mapped',()=>{
  assert.deepEqual(maps.CAMPUS_CENTER,[18.464,73.868]);assert.equal(maps.coordsFor('Block A'),null);assert.equal(maps.coordsFor('Unspecified'),null);assert.equal(maps.coordsFor('Imaginary building'),null);
  assert.ok(maps.coordsFor('VIT Library'));const ids=new Set();
  for(const f of maps.CAMPUS_FEATURES){assert.match(f.id,/^(way|node)\/\d+$/);assert.ok(!ids.has(f.id));ids.add(f.id);assert.ok(maps.validCoordinates(...maps.featurePoint(f)));assert.ok(f.properties.sourceUrl.startsWith('https://www.openstreetmap.org/'));}
  assert.ok(maps.CAMPUS_FEATURES.some(f=>f.properties.name==='VIT Canteen'&&f.properties.tags['disused:amenity']));
});
test('coordinate validation rejects malformed or remote pins and never trusts source or unknown facility IDs',()=>{
  for(const v of [{lat:NaN,lng:73.868},{lat:'18.464',lng:73.868},{lat:91,lng:73.868},{lat:0,lng:0},{lat:18.464,lng:73.868,featureId:'made-up'}])assert.throws(()=>maps.validateMapLocation(v));
  assert.equal(maps.validateMapLocation(undefined),undefined);
  assert.deepEqual(maps.validateMapLocation({lat:18.464,lng:73.868,source:'osm-feature',student:'secret'}),{lat:18.464,lng:73.868,source:'user-selected'});
  const library=maps.CAMPUS_FEATURES.find(f=>f.properties.name==='VIT Library'),point=maps.featurePoint(library);
  assert.equal(maps.validateMapLocation({lat:point[0],lng:point[1],featureId:library.id}).source,'osm-feature');
  assert.throws(()=>maps.validateMapLocation({lat:18.464,lng:73.868,featureId:library.id}),/do not match/);
});
const fixture=(id,status='Pending',priority='High')=>({_id:id,rawText:'Anonymous synthetic test',category:'Network',location:'Unspecified',status,priorityLabel:priority,isAnonymous:true,createdAt:new Date().toISOString(),mapLocation:{lat:18.464,lng:73.868}});
test('map filters and overlap groups operate only on real coordinates',()=>{
  const rows=[fixture('a'),fixture('b','Resolved','Low'),{...fixture('c'),mapLocation:undefined}];
  assert.equal(maps.filterReports(rows,{category:'Network',priority:'High',status:'open'}).length,2);
  assert.equal(maps.filterReports(rows,{category:'Electrical',priority:'',status:''}).length,0);
  assert.equal(maps.filterReports(rows,{category:'',priority:'',status:'Resolved'}).length,1);
  const g=maps.clusterReports(rows,17);assert.equal(g.length,1);assert.equal(g[0].reports.length,2);assert.equal(g[0].lat,18.464);assert.equal(g[0].lng,73.868);
  assert.equal(maps.reportCoordinates({...fixture('x'),mapLocation:{lat:999,lng:1}}),null);
});
test('satellite configuration is optional, uses licensed configurable HTTPS XYZ and rejects Google patterns',()=>{
  const keys=['NEXT_PUBLIC_MAPTILER_KEY','NEXT_PUBLIC_SATELLITE_TILE_URL','NEXT_PUBLIC_SATELLITE_ATTRIBUTION'],before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const {satelliteTiles}=require('../src/lib/mapTiles.ts');
  try{for(const k of keys)delete process.env[k];assert.equal(satelliteTiles(),null);
    process.env.NEXT_PUBLIC_SATELLITE_TILE_URL='https://tiles.example.org/{z}/{x}/{y}.jpg';assert.equal(satelliteTiles(),null);
    process.env.NEXT_PUBLIC_SATELLITE_ATTRIBUTION='Licensed test provider';assert.match(satelliteTiles().url,/example.org/);
    process.env.NEXT_PUBLIC_SATELLITE_TILE_URL='https://google.com/{z}/{x}/{y}';assert.equal(satelliteTiles(),null);
    process.env.NEXT_PUBLIC_SATELLITE_TILE_URL='https://';assert.equal(satelliteTiles(),null);
    process.env.NEXT_PUBLIC_MAPTILER_KEY='public-origin-restricted-key';assert.match(satelliteTiles().url,/satellite-v2/);
  }finally{for(const k of keys){if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];}}
});
test('student and admin map API enforces scope and strips identity/evidence fields even for anonymous records',async t=>{
  const api=require('../src/lib/api.ts'),Model=require('../src/models/Grievance.ts').default,{GET}=require('../src/app/api/grievances/map/route.ts'),{NextRequest}=require('next/server');let query;
  let actor={role:'student',userId:'a'.repeat(24)};t.mock.method(api,'authenticate',async()=>actor);
  t.mock.method(Model,'find',q=>{query=q;return{select(){return this;},sort(){return this;},limit(){return this;},lean:async()=>[{...fixture('b'.repeat(24)),student:'secret',history:[{actor:'hidden'}],attachments:['private'],processingKey:'secret'}]};});
  let res=await GET(new NextRequest('http://localhost/api/grievances/map'));assert.equal(res.status,200);assert.equal(query.student,actor.userId);let r=(await res.json()).reports[0];
  for(const key of ['student','history','attachments','processingKey'])assert.equal(r[key],undefined);
  actor={...actor,role:'admin'};res=await GET(new NextRequest('http://localhost/api/grievances/map'));assert.equal(query.student,undefined);r=(await res.json()).reports[0];assert.equal(r.student,undefined);assert.equal(r.isAnonymous,true);
});
test('map endpoint returns unauthorized failures instead of leaking a feed',async t=>{
  const api=require('../src/lib/api.ts');t.mock.method(api,'authenticate',async()=>{throw new api.ApiError(401,'Sign in');});const res=await require('../src/app/api/grievances/map/route.ts').GET(new(require('next/server').NextRequest)('http://localhost/api/grievances/map'));assert.equal(res.status,401);
});
test('report POST rejects invalid optional map pins before creating grievance records',async t=>{
  const api=require('../src/lib/api.ts');t.mock.method(api,'authenticate',async()=>({role:'student',userId:'a'.repeat(24)}));t.mock.method(api,'limit',async()=>{});
  const req=new(require('next/server').NextRequest)('http://localhost/api/grievances',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rawText:'Synthetic report',mapLocation:{lat:0,lng:0}})});
  const res=await require('../src/app/api/grievances/route.ts').POST(req);assert.equal(res.status,400);
});
test('container stays stable across tile styles, uses public cleanup and preserves Strict Mode',()=>{
  const source=fs.readFileSync('src/components/CampusMap.tsx','utf8'),viewport=fs.readFileSync('src/components/LeafletViewport.tsx','utf8');
  assert.match(source,/<LeafletViewport>/);assert.doesNotMatch(source,/<LeafletViewport[^>]*key=/);assert.match(source,/key=\{style\+tileVersion\}/);assert.match(viewport,/ownMap/);
  assert.doesNotMatch(viewport,/_leaflet|setTimeout/);assert.equal(require('../next.config.js')(require('next/constants').PHASE_DEVELOPMENT_SERVER).reactStrictMode,true);
});
test('map UI renders both role controls with Leaflet adapters stubbed (not browser acceptance)',t=>{
  const Module=require('module'),original=Module._load,React=require('react'),{renderToString}=require('react-dom/server');
  const layer=({children})=>React.createElement('div',null,children),fakeMap={getZoom:()=>17,getCenter:()=>({lat:18.464,lng:73.868})};
  t.mock.method(Module,'_load',function(request,...args){if(request==='leaflet/dist/leaflet.css')return{};if(request==='leaflet')return{divIcon:()=>({}),CircleMarker:class{}};if(request==='react-leaflet')return{CircleMarker:layer,GeoJSON:layer,Marker:layer,Popup:layer,TileLayer:layer,Tooltip:layer,useMap:()=>fakeMap,useMapEvents:()=>fakeMap};if(request==='./LeafletViewport')return{__esModule:true,default:layer};return original.call(this,request,...args);});
  const Component=require('../src/components/CampusMap.tsx').default;
  for(const admin of [false,true]){const html=renderToString(React.createElement(Component,{admin,onLocationConfirm:()=>{}}));for(const label of ['VIT Bibwewadi campus','Standard','Satellite','Search campus buildings','Map grievance status','Confirm selected location','not an official surveyed boundary'])assert.ok(html.includes(label),label);}
});
