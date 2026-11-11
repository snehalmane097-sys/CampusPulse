const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const api = require('../src/lib/api.ts');
const { handleV2 } = require('../src/services/v2.ts');
const Grievance = require('../src/models/Grievance.ts').default;
const Notification = require('../src/models/Notification.ts').default;
const actor = { userId:'a'.repeat(24), role:'student', user:{}, name:'Student' };
function mockActor(t, value=actor) { t.mock.method(api,'authenticate',async(req,admin)=>{ if(admin && value.role!=='admin') throw new api.ApiError(403,'Administrator access required.');return value;});t.mock.method(api,'limit',async()=>{}); }
function req(method='GET',data) { return new NextRequest('http://localhost/api/test',{method,headers:{'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})}); }
test('notification inbox is always scoped to the signed-in recipient', async t=>{
  mockActor(t);let query;t.mock.method(Notification,'find',q=>{query=q;return {sort(){return this;},limit(){return this;},async lean(){return []}};});
  const res=await handleV2(req(),'notifications');assert.equal(res.status,200);assert.equal(query.user,actor.userId);
});
test('mark-read never updates another recipients notification', async t=>{
  mockActor(t);let query;t.mock.method(Notification,'updateMany',async q=>{query=q;});
  const res=await handleV2(req('PATCH'),'read',{id:'b'.repeat(24)});assert.equal(res.status,200);assert.equal(query.user,actor.userId);assert.equal(query._id,'b'.repeat(24));
});
test('student cannot read or attach evidence to a different student grievance', async t=>{
  mockActor(t);t.mock.method(Grievance,'findById',()=>({session:async()=>({student:'b'.repeat(24)})}));
  for(const operation of ['attachments','feedback','reopen']){const res=await handleV2(req(),operation,{id:'c'.repeat(24)});assert.equal(res.status,403);}
});
test('student cannot publish campus announcements or inspect delivery failures', async t=>{
  mockActor(t);assert.equal((await handleV2(req('POST',{}),'announcements')).status,403);assert.equal((await handleV2(req(),'delivery')).status,403);assert.equal((await handleV2(req(),'satisfaction')).status,403);
});
test('feedback cannot be submitted for unresolved grievances', async t=>{
  mockActor(t);t.mock.method(api,'transaction',async fn=>fn({}));t.mock.method(Grievance,'findById',()=>({session:async()=>({_id:'c'.repeat(24),student:actor.userId,status:'In Progress'})}));
  assert.equal((await handleV2(req('POST',{rating:5}),'feedback',{id:'c'.repeat(24)})).status,409);
});
test('fractional and out-of-range ratings are rejected before feedback creation',async t=>{
  mockActor(t);t.mock.method(api,'transaction',async fn=>fn({}));t.mock.method(Grievance,'updateOne',async()=>({}));t.mock.method(Grievance,'findById',()=>({session:async()=>({_id:'c'.repeat(24),student:actor.userId,status:'Resolved',resolutionCycle:1})}));
  for(const rating of [0,6,1.5,'5'])assert.equal((await handleV2(req('POST',{rating}),'feedback',{id:'c'.repeat(24)})).status,400);
});
test('feedback and reopening indexes prevent duplicate cycle records',()=>{
  const Feedback=require('../src/models/ResolutionFeedback.ts').default,Reopen=require('../src/models/ReopenRequest.ts').default;
  assert.ok(Feedback.schema.indexes().some(([fields,options])=>fields.grievance===1&&fields.cycle===1&&options.unique));assert.ok(Reopen.schema.indexes().some(([,options])=>options.unique&&options.partialFilterExpression?.state==='pending'));
});
test('invalid resource IDs are returned as client errors',async t=>{
  mockActor(t);assert.equal((await handleV2(req('PATCH'),'read',{id:'not-an-id'})).status,400);
});
