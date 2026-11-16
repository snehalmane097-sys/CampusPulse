const {test}=require('node:test'),assert=require('node:assert/strict');
const React=require('react'),{renderToString}=require('react-dom/server');
const {UI_COLORS}=require('../src/lib/designTokens.ts');
const lum=hex=>{const c=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
const contrast=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
test('new light palette provides readable text, buttons and three distinct status colors',()=>{
  assert.ok(contrast(UI_COLORS.text,UI_COLORS.canvas)>=7);
  assert.ok(contrast(UI_COLORS.muted,UI_COLORS.surface)>=4.5);
  assert.ok(contrast('#FFFFFF',UI_COLORS.primary)>=4.5);
  assert.equal(new Set([UI_COLORS.pending,UI_COLORS.progress,UI_COLORS.success]).size,3);
  const tint=hex=>'#'+hex.slice(1).match(/../g).map(v=>Math.round(parseInt(v,16)*.1+255*.9).toString(16).padStart(2,'0')).join('');
  for(const foreground of [UI_COLORS.pending,UI_COLORS.progress,UI_COLORS.success,UI_COLORS.accent,UI_COLORS.danger])assert.ok(contrast(foreground,tint(foreground))>=4.5,'status/priority label contrast');
});
test('landing has two login entry points, one existing credential form and no fabricated hotspots',t=>{
  const Module=require('module'),original=Module._load;
  t.mock.method(Module,'_load',function(request,...args){if(request==='next/navigation')return{useRouter:()=>({push(){}})};return original.call(this,request,...args);});
  const Component=require('../src/app/page.tsx').default,html=renderToString(React.createElement(Component));
  assert.match(html,/Student Login/);assert.match(html,/Admin Login/);assert.equal((html.match(/<form/g)||[]).length,1);
  assert.match(html,/autoComplete="username"/i);assert.match(html,/autoComplete="current-password"/i);assert.match(html,/Access follows the role/);
  assert.ok(!html.includes('ACTIVE HOTSPOTS'));assert.ok(!html.includes('Block A'));assert.match(html,/aria-hidden="true"/);
});
test('registration remains student registration with explicit field labels and password minimum',t=>{
  const Module=require('module'),original=Module._load;
  t.mock.method(Module,'_load',function(request,...args){if(request==='next/navigation')return{useRouter:()=>({push(){}})};return original.call(this,request,...args);});
  const Component=require('../src/app/register/page.tsx').default,html=renderToString(React.createElement(Component));
  assert.match(html,/for="register-name"/);assert.match(html,/for="register-email"/);assert.match(html,/minLength="10"/i);assert.match(html,/new-password/);assert.ok(!html.includes('Admin account'));
});
test('Campus Radar does not render building management and retains the same data endpoints and map owner',()=>{
  const fs=require('fs'),source=fs.readFileSync('src/components/CampusMap.tsx','utf8');
  assert.ok(!source.includes('BuildingManager'));assert.ok(!source.includes('identifying'));
  assert.match(source,/approvedCampusFeatures\(buildings,search\)/);assert.match(source,/api\/buildings\/analytics/);assert.match(source,/api\/grievances\/map/);assert.match(source,/<LeafletViewport>/);assert.match(source,/OSM_ATTRIBUTION/);
});
