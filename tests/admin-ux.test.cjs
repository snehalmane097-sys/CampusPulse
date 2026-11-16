const {test}=require('node:test'),assert=require('node:assert/strict');
const React=require('react'),{renderToString}=require('react-dom/server');
const {originLabels,complaintTitle}=require('../src/lib/complaintPresentation.ts');
const {evidenceScanLabel,evidenceReviewLabel}=require('../src/lib/evidencePresentation.ts');
const fixture={_id:'a'.repeat(24),rawText:'Network issue reported in laboratory\nFull original description',priorityLabel:'High',category:'Network',status:'Pending',department:'IT / Network',location:'AIML lab',building:'b'.repeat(24),createdAt:'2026-11-15T10:00:00Z'};
test('origin presentation never guesses from routing, text, location or a bare building reference',()=>{
  assert.deepEqual(originLabels(fixture),{department:'Not verified',building:'Not verified'});
  assert.equal(complaintTitle(fixture.rawText),'Network issue reported in laboratory');assert.ok(complaintTitle('a'.repeat(200)).length<=110);
});
test('Admin card has one View Complaint action, clear origins and no status controls',()=>{
  const Card=require('../src/components/AdminGrievanceCard.tsx').default;
  const html=renderToString(React.createElement(Card,{grievance:fixture,onOpen:()=>{}}));
  assert.equal((html.match(/<button/g)||[]).length,1);assert.match(html,/View Complaint/);assert.match(html,/Origin department/);assert.match(html,/Not verified/);assert.ok(!html.includes('IT / Network'));assert.ok(!html.includes('Full original description'));
  const verified=renderToString(React.createElement(Card,{grievance:{...fixture,origin:{department:'Verified test department',building:{displayName:'Approved fixture building'}}},onOpen:()=>{}}));assert.match(verified,/Verified test department/);assert.match(verified,/Approved fixture building/);
});
test('detail presentation retains full source text and uses only explicit verified origin',()=>{
  const Details=require('../src/components/ComplaintDetails.tsx').default,html=renderToString(React.createElement(Details,{grievance:fixture}));
  assert.match(html,/Full original description/);assert.equal((html.match(/Not verified/g)||[]).length,2);assert.ok(!html.includes('IT / Network'));
});
test('evidence presentation distinguishes development scanning, pending review, accepted and rejected',()=>{
  assert.match(evidenceScanLabel({scan:'development-unscanned',state:'clean'}),/Not scanned/);assert.equal(evidenceScanLabel({scan:'clean',state:'clean'}),'Malware scan passed');assert.match(evidenceScanLabel({scan:'infected',state:'rejected'}),/blocked/);
  assert.equal(evidenceReviewLabel('pending'),'Pending review');assert.equal(evidenceReviewLabel('accepted'),'Accepted');assert.equal(evidenceReviewLabel('rejected'),'Rejected');
});
test('Student status history excludes internal notes and actor identifiers',()=>{
  const {sanitizeGrievanceForStudent,sanitizeGrievanceForAdmin}=require('../src/lib/sanitize.ts');const g={isAnonymous:true,student:'hidden-owner',history:[{status:'Pending',actor:'hidden-admin',note:'Internal investigation',at:'2026-11-15'}]};
  const student=sanitizeGrievanceForStudent(g),admin=sanitizeGrievanceForAdmin(g);assert.equal(student.history[0].note,undefined);assert.equal(student.history[0].actor,undefined);assert.equal(admin.history[0].note,'Internal investigation');assert.equal(admin.history[0].actor,undefined);assert.equal(admin.student,undefined);
});
test('workspace review has one status selector and one save action; resolved status stays locked',()=>{
  const Review=require('../src/components/ComplaintStatusReview.tsx').default;
  const html=renderToString(React.createElement(Review,{grievance:fixture,onSaved:async()=>{}}));
  assert.equal((html.match(/<select/g)||[]).length,1);assert.equal((html.match(/<button/g)||[]).length,1);assert.match(html,/Investigation note/);assert.match(html,/Save complaint update/);
  const resolved=renderToString(React.createElement(Review,{grievance:{...fixture,status:'Resolved'},onSaved:async()=>{}}));assert.match(resolved,/<select[^>]*disabled/);assert.match(resolved,/approved reopening request/);
});
