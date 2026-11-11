const {test}=require('node:test'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const React=require('react'),{renderToString}=require('react-dom/server');
const {chartState,chartTotal,chartLabel}=require('../src/lib/chartData.ts');
test('Recharts element detector recognizes App Router React 19 elements and fragments',()=>{
  const runtime=require('next/dist/compiled/react'),req=createRequire(require.resolve('recharts/package.json')),detector=req('react-is');
  assert.equal(detector.isElement(runtime.createElement('div')),true);
  assert.equal(detector.isFragment(runtime.createElement(runtime.Fragment)),true);
});
test('genuine empty data is distinguished from invalid chart data',()=>{
  assert.equal(chartState([]),'empty');assert.equal(chartState([{count:0}]),'empty');assert.equal(chartState([{count:3}]),'ready');
  for(const value of [null,undefined,[{count:'3'}],[{count:-1}],[{count:NaN}],[{count:Infinity}],[null]])assert.equal(chartState(value),'invalid');
  assert.equal(chartState([],45),'mismatch');assert.equal(chartState([{count:44}],45),'mismatch');assert.equal(chartState([{count:45}],45),'ready');assert.equal(chartState([],0),'empty');
});
test('chart labels preserve counts and name missing legacy fields honestly',()=>{
  assert.equal(chartLabel(null,'Uncategorized'),'Uncategorized');assert.equal(chartLabel('undefined','Unspecified priority'),'Unspecified priority');assert.equal(chartLabel(' Network ','Uncategorized'),'Network');
  assert.equal(chartTotal([{count:12},{count:3}]),15);
});
test('both distribution charts expose truthful empty and invalid states',()=>{
  const {CategoryChart,PriorityChart}=require('../src/components/AnalyticsCharts.tsx');
  assert.match(renderToString(React.createElement(CategoryChart,{data:[]})),/No grievance category data yet/);
  assert.match(renderToString(React.createElement(PriorityChart,{data:[]})),/No grievance priority data yet/);
  assert.match(renderToString(React.createElement(CategoryChart,{data:[{category:'Network',count:null}]})),/Chart data is invalid or unavailable/);
  assert.match(renderToString(React.createElement(PriorityChart,{data:[],expectedTotal:45})),/Chart totals do not match the report count/);
});
test('count summaries consume API rows without injecting synthetic distributions',()=>{
  const {CategoryChart,PriorityChart}=require('../src/components/AnalyticsCharts.tsx');
  const category=renderToString(React.createElement(CategoryChart,{data:[{category:'Network',count:7},{category:'Electrical',count:2}]}));
  const priority=renderToString(React.createElement(PriorityChart,{data:[{priority:'Medium',count:4},{priority:'High',count:5}]}));
  assert.match(category,/Total reports: (?:<!-- -->)?9/);assert.ok(category.includes('Network'));assert.ok(priority.includes('Medium'));assert.match(priority,/Total reports: (?:<!-- -->)?9/);
});
test('satellite keys are encoded, trimmed, optional and never fall through to an unlicensed provider',()=>{
  const {satelliteTiles}=require('../src/lib/mapTiles.ts'),keys=['NEXT_PUBLIC_MAPTILER_KEY','NEXT_PUBLIC_SATELLITE_TILE_URL','NEXT_PUBLIC_SATELLITE_ATTRIBUTION'],before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  try {
    for(const k of keys)delete process.env[k];
    process.env.NEXT_PUBLIC_MAPTILER_KEY='   ';assert.equal(satelliteTiles(),null);
    // This is a nonfunctional test string, not a provider credential.
    process.env.NEXT_PUBLIC_MAPTILER_KEY=' test token&value ';
    const layer=satelliteTiles();assert.match(layer.url,/https:\/\/api\.maptiler\.com\/tiles\/satellite-v2\/\{z\}\/\{x\}\/\{y\}\.jpg\?key=test%20token%26value/);
    assert.match(layer.attribution,/MapTiler/);
  }finally{for(const k of keys){if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];}}
});
