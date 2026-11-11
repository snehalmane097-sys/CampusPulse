const {test}=require('node:test');const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
process.env.JWT_SECRET='review-test-secret-more-than-thirty-two-characters';
const api=require('../src/lib/api.ts'),Attachment=require('../src/models/Attachment.ts').default,Grievance=require('../src/models/Grievance.ts').default,Outbox=require('../src/models/OutboxJob.ts').default,User=require('../src/models/User.ts').default;
const storage=require('../src/lib/storage.ts'),{cleanupEvidence,evidenceDeletionQuery,deletionDeadline}=require('../src/services/evidenceLifecycle.ts');
const {fenceJob,LeaseLostError,processScan,runOneJob}=require('../src/services/worker.ts');
const {NextRequest}=require('next/server');
test('legacy ownerless records never enqueue invalid personal notifications',async t=>{
  let writes=0;t.mock.method(require('../src/models/Notification.ts').default,'updateOne',async()=>{writes++;});t.mock.method(Outbox,'updateOne',async()=>{writes++;});
  await require('../src/services/notifications.ts').notify(null,'legacy','Update');assert.equal(writes,0);
});
test('early warnings include ownerless legacy reports alongside distinct known owners',()=>{
  const base={status:'Pending',createdAt:new Date(),category:'Network',location:'Block C'};
  const warnings=require('../src/lib/earlyWarning.ts').computeEarlyWarnings([{...base,student:'one'},{...base,student:'one'},{...base,student:null}]);assert.equal(warnings[0].reportCount,3);assert.equal(warnings[0].affectedStudents,2);
});
test('pending expiration that loses to completion never deletes evidence bytes',async t=>{
  t.mock.method(api,'transaction',async fn=>fn({}));t.mock.method(Attachment,'find',()=>({limit:async()=>[{_id:'a',grievance:'g',state:'pending',key:'quarantine/k',expiresAt:new Date(0)}]}));
  t.mock.method(Attachment,'findOneAndUpdate',async()=>null);let removed=0;t.mock.method(storage,'deleteObject',async()=>{removed++;});
  await cleanupEvidence();assert.equal(removed,0);
});
test('expired pending uploads become tombstones before deferred storage cleanup',async t=>{
  t.mock.method(api,'transaction',async fn=>fn({}));t.mock.method(Attachment,'find',()=>({limit:async()=>[{_id:'a',grievance:'g',state:'pending',key:'quarantine/k',expiresAt:new Date(0)}]}));
  let claimed; t.mock.method(Attachment,'findOneAndUpdate',async(q,u)=>{claimed={q,u};return {_id:'a'};});t.mock.method(Grievance,'updateOne',async()=>({}));let removed=false;t.mock.method(storage,'deleteObject',async()=>{removed=true;});
  await cleanupEvidence();assert.equal(claimed.q.state,'pending');assert.equal(claimed.u.state,'deleted');assert.ok(claimed.u.expiresAt>Date.now()+590000);assert.equal(removed,false);
});
test('student delete permission is checked against review state in the write predicate',()=>{
  assert.deepEqual(evidenceDeletionQuery({_id:'a'},{role:'student',userId:'u'}),{_id:'a',state:{$ne:'deleted'},uploader:'u',review:'pending'});
  assert.equal(evidenceDeletionQuery({_id:'a'},{role:'admin',userId:'u'}).review,undefined);
  assert.equal(deletionDeadline(new Date(3600000),0).getTime(),3600000);assert.equal(deletionDeadline(undefined,0).getTime(),600000);
});
test('production refuses evidence released by a misconfigured development worker',()=>{
  const {canReleaseEvidence}=require('../src/lib/evidencePolicy.ts');const a={state:'clean',cleanKey:'clean/key',scan:'development-unscanned'};assert.equal(canReleaseEvidence(a,true),false);assert.equal(canReleaseEvidence(a,false),true);assert.equal(canReleaseEvidence({...a,scan:'clean'},true),true);
});
test('private storage cannot be accidentally configured under public assets',()=>{
  const before=process.env.PRIVATE_DATA_DIR;process.env.PRIVATE_DATA_DIR='public/evidence';try{assert.throws(()=>storage.privateRoot(),/public assets/);}finally{if(before===undefined)delete process.env.PRIVATE_DATA_DIR;else process.env.PRIVATE_DATA_DIR=before;}
});
test('stale worker lease is rejected before result publication',async t=>{
  let predicate;t.mock.method(Outbox,'updateOne',async q=>{predicate=q;return {matchedCount:0};});await assert.rejects(fenceJob({_id:'job'},'stale',{}),LeaseLostError);assert.equal(predicate.state,'running');assert.equal(predicate.leaseToken,'stale');assert.ok(predicate.leaseUntil.$gt instanceof Date);
});
test('scan retry reuses its tracked candidate object after a storage failure',async t=>{
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');const a={_id:'a',grievance:'g',key:'quarantine/k',size:png.length,checksum:require('crypto').createHash('sha256').update(png).digest('hex'),mime:'image/png',state:'processing',save:async()=>{}};
  t.mock.method(api,'transaction',async fn=>fn({}));t.mock.method(Outbox,'updateOne',async()=>({matchedCount:1}));t.mock.method(Attachment,'findById',()=>{const p=Promise.resolve(a);p.session=async()=>a;return p;});t.mock.method(storage,'getObject',async()=>png);t.mock.method(require('../src/lib/scanner.ts'),'scan',async()=> 'clean');
  const keys=[];let first=true;t.mock.method(storage,'putObject',async key=>{keys.push(key);if(first){first=false;throw new Error('temporary storage outage');}});
  let committed;t.mock.method(Attachment,'findOneAndUpdate',async(q,u)=>{committed=u;return a;});t.mock.method(Grievance,'findById',()=>({session:async()=>null}));t.mock.method(storage,'deleteObject',async()=>{});
  await assert.rejects(processScan({_id:'job',payload:{attachment:'a'}},'token'));assert.ok(a.processingKey);await processScan({_id:'job',payload:{attachment:'a'}},'token');assert.equal(keys[0],keys[1]);assert.equal(committed.$set.cleanKey,keys[0]);assert.equal(committed.$unset.processingKey,1);
});
test('stale verification email is skipped instead of delivering an invalid code',async t=>{
  t.mock.method(Outbox,'findOneAndUpdate',async()=>({_id:'a',key:'verify',kind:'email',attempts:1,payload:{user:'u',verification:true,verificationHash:'old'}}));const updates=[];t.mock.method(Outbox,'updateOne',async(q,u)=>{updates.push(u);return {matchedCount:1};});t.mock.method(User,'findById',async()=>({email:'test@example.invalid'}));t.mock.method(require('../src/models/EmailVerificationToken.ts').default,'exists',async()=>null);let sent=false;t.mock.method(require('../src/lib/email.ts'),'sendEmail',async()=>{sent=true;});await runOneJob();assert.equal(sent,false);assert.equal(updates.at(-1).state,'skipped');
});
test('migration backfills missing fields individually and preserves disabled/opt-out records',async t=>{
  const calls=[];t.mock.method(User,'updateMany',async(q,u)=>{calls.push({q,u});});await require('../src/services/migration.ts').backfillMissingUserFields();assert.equal(calls.length,3);for(const {q,u}of calls){const field=Object.keys(u.$set)[0];assert.deepEqual(q,{[field]:{$exists:false}});assert.equal(Object.keys(u.$set).length,1);}
});
test('cookie-creating endpoints reject hostile origins even before a session exists',()=>{
  assert.throws(()=>api.assertSameOrigin(new NextRequest('http://localhost/api/auth/login',{method:'POST',headers:{origin:'https://attacker.invalid'}})),/origin/);
});
test('account switch revokes the previous session and disconnects its rooms',async t=>{
  const Session=require('../src/models/Session.ts').default,{signToken}=require('../src/lib/auth.ts');const old=signToken({userId:'a'.repeat(24),sessionId:'b'.repeat(24),role:'student',name:'Old'});let deleted,room,disconnected=false;
  t.mock.method(Session,'deleteOne',async q=>{deleted=q;});t.mock.method(Session,'create',async()=>({_id:'c'.repeat(24)}));global.__campuspulse_io={in:name=>{room=name;return {disconnectSockets:()=>{disconnected=true;}}}};
  try{const response=await require('../src/services/session.ts').loginResponse({_id:'d'.repeat(24),name:'New',role:'student'},old);assert.equal(deleted._id,'b'.repeat(24));assert.equal(room,'session:'+'b'.repeat(24));assert.equal(disconnected,true);assert.match(response.headers.get('set-cookie'),/HttpOnly/i);}finally{delete global.__campuspulse_io;}
});
test('refresh retains opened feed pages and removes duplicate IDs',async()=>{
  const seen=[];const result=await require('../src/lib/feedWindow.ts').readFeedWindow(async url=>{seen.push(url);return url.includes('cursor=')?{records:[{_id:'2'},{_id:'1'}],nextCursor:'1'}:{records:[{_id:'3'},{_id:'2'}],nextCursor:'2'};},'/api/items?unread=true','records',2);assert.deepEqual(result.records.map(r=>r._id),['3','2','1']);assert.equal(result.nextCursor,'1');assert.equal(seen[1],'/api/items?unread=true&cursor=2');
});
test('ClamAV refuses incomplete verdicts and closes during backpressure without hanging',async t=>{
  process.env.SCANNER_DRIVER='clamav';const net=require('net');
  t.mock.method(net,'createConnection',()=>{const socket=new EventEmitter();socket.setTimeout=()=>socket;socket.destroy=()=>socket.emit('close');socket.write=()=>{queueMicrotask(()=>socket.emit('close'));return false;};queueMicrotask(()=>socket.emit('connect'));return socket;});
  await assert.rejects(require('../src/lib/scanner.ts').scan(Buffer.from('data')),/closed/);
});
test('migration read-only connection disables implicit collection and index writes',()=>{
  const before=process.env.MIGRATION_READ_ONLY;process.env.MIGRATION_READ_ONLY='true';try{const options=require('../src/lib/mongodb.ts').databaseOptions();assert.equal(options.autoIndex,false);assert.equal(options.autoCreate,false);}finally{if(before===undefined)delete process.env.MIGRATION_READ_ONLY;else process.env.MIGRATION_READ_ONLY=before;}
});
test('cleanup failure does not stop subsequent queued jobs',async()=>{
  const {workerPass}=require('../src/services/workerLoop.ts');let jobs=0;const messages=[];const deps={job:async()=>{jobs++;return true;},cleanup:async()=>{throw new Error('storage offline');},wait:async()=>{},log:message=>messages.push(message)};const result=await workerPass(deps,0);await workerPass(deps,result.lastCleanup);assert.equal(jobs,2);assert.equal(messages.length,1);assert.match(messages[0],/cleanup failed/);
});
test('lost completion acknowledgement never deletes accepted evidence',async t=>{
  const beforeCrypto=global.crypto;t.mock.method(require('../src/lib/client.ts'),'api',async(url,method)=>{calls.push({url,method});if(url.endsWith('/attachments'))return{attachment:{_id:'a'},uploadUrl:'/upload'};if(url.endsWith('/complete'))throw new Error('acknowledgement lost');throw new Error('unexpected operation');});
  const calls=[];class Xhr{upload={};open(){}setRequestHeader(){}send(){this.status=204;queueMicrotask(()=>this.onload());}abort(){this.onabort();}}
  const before=global.XMLHttpRequest;global.XMLHttpRequest=Xhr;
  try{const file=new File([Buffer.from('fixture')],'fixture.png',{type:'image/png'});await assert.rejects(require('../src/components/EvidencePanel.tsx').uploadEvidence('g',file),/acknowledgement lost/);assert.ok(calls.some(c=>c.url.endsWith('/complete')));assert.ok(!calls.some(c=>c.method==='DELETE'));}finally{global.XMLHttpRequest=before;}
});
test('successful announcement batch resets retry budget',async t=>{
  const {fanOut}=require('../src/services/worker.ts'),Announcement=require('../src/models/Announcement.ts').default;const updates=[];t.mock.method(api,'transaction',async fn=>fn({}));t.mock.method(Outbox,'updateOne',async(q,u)=>{updates.push(u);return{matchedCount:1};});t.mock.method(Announcement,'findById',()=>({session:async()=>({_id:'ann',state:'published',audience:'students',message:'Update',title:'News'})}));t.mock.method(Announcement,'updateOne',async()=>({matchedCount:1}));t.mock.method(User,'find',()=>({sort(){return this;},limit(){return this;},select(){return this;},session:async()=>Array.from({length:100},(_,i)=>({_id:String(i)}))}));t.mock.method(require('../src/services/notifications.ts'),'notify',async()=>{});assert.equal(await fanOut({_id:'job',payload:{announcement:'ann'}},'lease'),false);assert.equal(updates.at(-1).state,'pending');assert.equal(updates.at(-1).attempts,0);
});
test('same-status PATCH does not emit duplicate transition events',async t=>{
  const actor={role:'admin',userId:'a'.repeat(24)};t.mock.method(api,'authenticate',async()=>actor);t.mock.method(api,'limit',async()=>{});t.mock.method(api,'transaction',async fn=>fn({}));t.mock.method(require('../src/services/access.ts'),'grievanceAccess',async()=>({_id:'b'.repeat(24),status:'Resolved',isAnonymous:true,student:'secret'}));t.mock.method(require('../src/services/lifecycle.ts'),'transition',async g=>g);let emitted=false;t.mock.method(require('../src/services/lifecycle.ts'),'emitTransition',()=>{emitted=true;});const response=await require('../src/app/api/grievances/[id]/route.ts').PATCH(new NextRequest('http://localhost/api/grievances/id',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'Resolved'})}),{params:Promise.resolve({id:'b'.repeat(24)})});assert.equal(response.status,200);assert.equal(emitted,false);assert.equal((await response.json()).grievance.student,undefined);
});
test('known example secrets cannot sign working sessions',()=>{
  const previous=process.env.JWT_SECRET;process.env.JWT_SECRET='replace-this-with-a-long-random-generated-secret';try{assert.throws(()=>require('../src/lib/auth.ts').signToken({userId:'a'.repeat(24),sessionId:'b'.repeat(24),name:'Test',role:'student'}),/placeholder/);}finally{process.env.JWT_SECRET=previous;}
});
test('expired session logout clears the cookie instead of getting stuck',async t=>{
  t.mock.method(api,'authenticate',async()=>{throw new api.ApiError(401,'Expired');});const response=await require('../src/app/api/auth/logout/route.ts').POST(new NextRequest('http://localhost/api/auth/logout',{method:'POST',headers:{cookie:'cp_session=expired',origin:'http://localhost'}}));assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/Max-Age=0/i);
});
test('orphan incident references fall back to a new incident instead of losing the link',async t=>{
  const Incident=require('../src/models/Incident.ts').default,{clusterAndScore}=require('../src/lib/incidentEngine.ts');
  const g={_id:'new',category:'Network',location:'Block C',department:'IT / Network',rawText:'wifi failure block c',priorityLabel:'High'};
  t.mock.method(Grievance,'find',()=>({sort(){return this;},limit(){return this;},session:async()=>[{...g,_id:'old',incident:'deleted-incident'}]}));t.mock.method(Incident,'findById',()=>({session:async()=>null}));t.mock.method(Incident,'create',async()=>[{_id:'replacement'}]);t.mock.method(Grievance,'updateMany',async()=>({}));assert.equal((await clusterAndScore(g,{})).incidentId,'replacement');
});
test('joining an incident does not steal reports already attached to another incident',async t=>{
  const Incident=require('../src/models/Incident.ts').default,{clusterAndScore}=require('../src/lib/incidentEngine.ts');
  const g={_id:'new',category:'Network',location:'Block C',department:'IT / Network',rawText:'wifi failure block c',priorityLabel:'High'},chosen={_id:'one',grievances:['first'],severityScore:40,save:async()=>{}};
  t.mock.method(Grievance,'find',()=>({sort(){return this;},limit(){return this;},session:async()=>[{...g,_id:'first',incident:'one'},{...g,_id:'other',incident:'two'}]}));t.mock.method(Incident,'findById',()=>({session:async()=>chosen}));t.mock.method(Grievance,'updateMany',async()=>({}));const scored=await clusterAndScore(g,{});assert.deepEqual(chosen.grievances,['first','new']);assert.equal(scored.affectedCount,2);
});
