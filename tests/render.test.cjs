const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {renderToString}=require('react-dom/server');
test('evidence panel renders supported media, privacy guidance and uploader',()=>{
  const Component=require('../src/components/EvidencePanel.tsx').default;
  const html=renderToString(React.createElement(Component,{grievanceId:'a'.repeat(24),admin:false}));
  assert.match(html,/Upload evidence/);assert.match(html,/application\/pdf/);assert.match(html,/video\/mp4/);assert.match(html,/File contents can reveal identity/);
});
test('notification center renders accessible inbox entry',()=>{
  const Component=require('../src/components/NotificationCenter.tsx').default;
  const html=renderToString(React.createElement(Component,{}));assert.match(html,/Notifications, 0 unread/);assert.match(html,/Inbox/);
});
test('admin campus hub exposes drafts, audience selection, reopening and satisfaction',()=>{
  const Component=require('../src/components/CampusHub.tsx').default;
  const html=renderToString(React.createElement(Component,{admin:true,onOpenGrievance:()=>{}}));
  for(const label of ['Create draft','Student department','Service department','Reopening review queue','Department satisfaction'])assert.ok(html.includes(label));
});
test('student campus hub never renders announcement publishing controls',()=>{
  const Component=require('../src/components/CampusHub.tsx').default;
  const html=renderToString(React.createElement(Component,{admin:false,onOpenGrievance:()=>{}}));assert.match(html,/Campus announcements/);assert.ok(!html.includes('Create draft'));assert.ok(!html.includes('Reopening review queue'));
});
