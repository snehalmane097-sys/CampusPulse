const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
process.env.JWT_SECRET = 'test-only-secret-with-more-than-thirty-two-characters';
const { NextRequest } = require('next/server');
const api = require('../src/lib/api.ts');
const auth = require('../src/lib/auth.ts');
const policy = require('../src/lib/uploadPolicy.ts');
const storage = require('../src/lib/storage.ts');
const { scan } = require('../src/lib/scanner.ts');
const { sendEmail } = require('../src/lib/email.ts');
const { sanitizeGrievanceForAdmin } = require('../src/lib/sanitize.ts');
const { classifyGrievance } = require('../src/lib/classification.ts');
const { jaccardSimilarity, isLikelyDuplicate } = require('../src/lib/similarity.ts');
const { nextResolutionCycle } = require('../src/services/lifecycle.ts');
const { announcementAudience, handleV2 } = require('../src/services/v2.ts');
const { stripImageMetadata } = require('../src/services/worker.ts');
const checksum = 'a'.repeat(64);

test('classification keeps category, location and routing behavior', () => {
  assert.deepEqual(classifyGrievance('WiFi is down in Block C'), { category: 'Network', location: 'Block C', department: 'IT / Network' });
  assert.equal(classifyGrievance('Something unusual happened').category, 'Other');
});
test('duplicate detection requires known matching locations', () => {
  const report = { category: 'Network', location: 'Block C', rawText: 'wifi broken block c' };
  assert.equal(isLikelyDuplicate(report, report), true);
  assert.equal(isLikelyDuplicate(report, { ...report, location: 'Unspecified' }), false);
  assert.equal(isLikelyDuplicate(report, { ...report, category: 'Other' }), false);
  assert.equal(jaccardSimilarity('', ''), 0);
});
test('anonymous DTO removes identity and history actors without mutating source', () => {
  const source = { student: 'secret-owner', isAnonymous: true, history: [{ actor: 'admin-id', status: 'Resolved' }] };
  const dto = sanitizeGrievanceForAdmin(source);
  assert.equal(dto.student, undefined); assert.equal(dto.history[0].actor, undefined); assert.equal(source.student, 'secret-owner');
});
test('nonanonymous reports retain ownership for existing admin behavior', () => assert.equal(sanitizeGrievanceForAdmin({ student: 'owner', isAnonymous: false }).student, 'owner'));
test('rating cycles advance only on a new resolution', () => {
  assert.equal(nextResolutionCycle(0, 'Pending', 'Resolved'), 1);
  assert.equal(nextResolutionCycle(1, 'Resolved', 'Resolved'), 1);
  assert.equal(nextResolutionCycle(1, 'Resolved', 'In Progress'), 1);
  assert.equal(nextResolutionCycle(1, 'In Progress', 'Resolved'), 2);
});
test('JWT accepts only signed issued sessions and rejects tampering', () => {
  const token = auth.signToken({ userId: 'a'.repeat(24), name: 'Student', role: 'student', sessionId: 'b'.repeat(24) });
  assert.equal(auth.verifyToken(token).userId, 'a'.repeat(24));
  assert.equal(auth.verifyToken(token + 'tampered'), null);
  assert.equal(auth.verifyToken('not-a-token'), null);
});
test('JWT rejects wrong audience and expired tokens', () => {
  const jwt = require('jsonwebtoken');
  for (const options of [{ audience: 'wrong', expiresIn: 60 }, { audience: 'campuspulse', expiresIn: -1 }]) {
    const token = jwt.sign({ userId: 'a'.repeat(24), role: 'student' }, process.env.JWT_SECRET, { issuer: 'campuspulse', ...options });
    assert.equal(auth.verifyToken(token), null);
  }
});
test('input validation rejects object coercion, unbounded text and malformed IDs', () => {
  assert.throws(() => api.text({ $ne: '' }, 'Email'), /characters/);
  assert.throws(() => api.text('a'.repeat(2010), 'Message'), /characters/);
  assert.throws(() => api.id('invalid'), /Invalid/);
  assert.equal(api.id('a'.repeat(24)), 'a'.repeat(24));
});
test('JSON parser enforces content type, object shape and size', async () => {
  const req = value => new NextRequest('http://localhost/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: value });
  await assert.rejects(api.body(req('[]')), /JSON object/);
  await assert.rejects(api.body(req('{bad')), /JSON object/);
  await assert.rejects(api.body(req(JSON.stringify({ value: 'x'.repeat(33000) }))), /too large/);
  await assert.rejects(api.body(new NextRequest('http://localhost/api/test', { method: 'POST', body: '{}' })), /Content-Type/);
});
for (const mime of Object.keys(policy.FILE_LIMITS)) test('upload policy allows bounded ' + mime, () => assert.doesNotThrow(() => policy.validateUpload(mime, 1024, checksum)));
test('upload policy rejects dangerous formats, oversize, fractional size and invalid hashes', () => {
  for (const mime of ['image/svg+xml','text/html','application/x-msdownload']) assert.throws(() => policy.validateUpload(mime, 10, checksum));
  assert.throws(() => policy.validateUpload('image/png', 11 * 1048576, checksum));
  assert.throws(() => policy.validateUpload('image/png', 1.5, checksum));
  assert.throws(() => policy.validateUpload('image/png', 50, 'bad-hash'));
});
test('magic-byte detection does not accept client-declared HTML as an image', () => {
  assert.equal(policy.detectedMime(Buffer.from('<html>bad</html>')), null);
  assert.equal(policy.detectedMime(Buffer.from('%PDF-1.7')), 'application/pdf');
});
test('metadata stripping removes JPEG identity metadata and keeps scan payload', () => {
  const segment = Buffer.from([0xff,0xe1,0,6,1,2,3,4]);
  const image = Buffer.concat([Buffer.from([0xff,0xd8]), segment, Buffer.from([0xff,0xda,0,2,9,9])]);
  assert.deepEqual(stripImageMetadata(image, 'image/jpeg'), Buffer.from([0xff,0xd8,0xff,0xda,0,2,9,9]));
});
test('corrupt metadata structures are rejected rather than read out of bounds', () => assert.throws(() => stripImageMetadata(Buffer.from([0xff,0xd8,0xff,0xe1,0xff,0xff]), 'image/jpeg')));
test('audience filters distinguish academic and service departments', () => {
  assert.deepEqual(announcementAudience({ audience:'academic-department', department:'CS' }), { role:'student', academicDepartment:'CS' });
  assert.deepEqual(announcementAudience({ audience:'service-department', department:'IT / Network' }), { role:'admin', department:'IT / Network' });
  assert.deepEqual(announcementAudience({ audience:'campus' }), {});
});
test('every new operation rejects unauthenticated access before database access', async () => {
  for (const op of ['notifications','unread','preferences','announcements','attachments','access','review','feedback','reopen','reopen-list','reopen-decision','satisfaction','delivery']) {
    const res = await handleV2(new NextRequest('http://localhost/api/test'), op, { id:'a'.repeat(24), attachmentId:'a'.repeat(24) }); assert.equal(res.status, 401, op);
  }
});
test('cookie-authenticated mutation rejects cross-origin requests before database access', async () => {
  const token = auth.signToken({ userId:'a'.repeat(24), sessionId:'b'.repeat(24), name:'Student',role:'student' });
  const req = new NextRequest('http://localhost/api/test', { method:'POST', headers:{ cookie:'cp_session='+token, origin:'https://attacker.invalid' } });
  await assert.rejects(api.authenticate(req), /origin/);
});
test('session role is loaded from database rather than trusted from JWT', async t => {
  const db = require('../src/lib/mongodb.ts'), User = require('../src/models/User.ts').default, Session = require('../src/models/Session.ts').default;
  t.mock.method(db, 'dbConnect', async () => {}); t.mock.method(User, 'findById', async () => ({ _id:'a'.repeat(24), role:'student', name:'Student' })); t.mock.method(Session, 'findOne', async () => ({ _id:'b'.repeat(24) }));
  const token = auth.signToken({ userId:'a'.repeat(24), sessionId:'b'.repeat(24), name:'Former admin',role:'admin' });
  await assert.rejects(api.authenticate(new NextRequest('http://localhost/api/test', { headers:{ cookie:'cp_session='+token } }), true), /Administrator/);
});
test('revoked session is rejected even with valid JWT', async t => {
  const db = require('../src/lib/mongodb.ts'), User = require('../src/models/User.ts').default, Session = require('../src/models/Session.ts').default;
  t.mock.method(db, 'dbConnect', async () => {}); t.mock.method(User, 'findById', async () => ({ role:'student' })); t.mock.method(Session, 'findOne', async () => null);
  const token = auth.signToken({ userId:'a'.repeat(24), sessionId:'b'.repeat(24), name:'Student',role:'student' });
  await assert.rejects(api.authenticate(new NextRequest('http://localhost/api/test', { headers:{ cookie:'cp_session='+token } })), /session has ended/);
});
test('S3 signatures encode object keys and temporary credentials without exposing secrets', () => {
  Object.assign(process.env, { AWS_REGION:'us-east-1', S3_BUCKET:'test-bucket', AWS_ACCESS_KEY_ID:'AKIDEXAMPLE', AWS_SECRET_ACCESS_KEY:'secret-test-only', AWS_SESSION_TOKEN:'token/+=' });
  const signed = new URL(storage.signedS3Url('PUT','quarantine/a file+name',120,new Date('2026-01-01T00:00:00Z')));
  assert.equal(signed.pathname,'/test-bucket/quarantine/a%20file%2Bname'); assert.equal(signed.searchParams.get('X-Amz-Expires'),'120'); assert.equal(signed.searchParams.get('X-Amz-Security-Token'),'token/+='); assert.match(signed.searchParams.get('X-Amz-Signature'),/^[a-f\d]{64}$/); assert.ok(!signed.href.includes('secret-test-only'));
  delete process.env.AWS_SESSION_TOKEN;
});
test('local evidence is private, immutable and path traversal is rejected', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'campuspulse-test-')); process.env.PRIVATE_DATA_DIR = dir; process.env.STORAGE_DRIVER='local';
  try { const key=storage.newKey('quarantine'); await storage.putObject(key,Buffer.from('evidence'),'text/plain'); assert.equal((await storage.getObject(key,8)).toString(),'evidence'); await assert.rejects(storage.putObject(key,Buffer.from('overwrite'),'text/plain')); await assert.rejects(storage.getObject('../secret',100)); await assert.rejects(storage.getObject(key,2)); await storage.deleteObject(key); }
  finally { assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep)); await fs.rm(dir,{recursive:true,force:true}); }
});
test('development scan is explicitly unscanned and detects EICAR fixture', async () => {
  process.env.SCANNER_DRIVER='development'; assert.equal(await scan(Buffer.from('safe fixture')),'development-unscanned'); assert.equal(await scan(Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')),'infected');
});
test('ClamAV loopback transport handles clean/infected results', async t => {
  const net=require('node:net'); process.env.SCANNER_DRIVER='clamav';
  for(const result of ['OK','Eicar FOUND']) {
    const server=net.createServer(socket=>{let data=Buffer.alloc(0);socket.on('data',chunk=>{data=Buffer.concat([data,chunk]);if(data.length>=10+4+7+4){assert.equal(data.subarray(0,10).toString(),'zINSTREAM\0');assert.equal(data.readUInt32BE(10),7);socket.end('stream: '+result+'\0');}});});
    await new Promise(r=>server.listen(0,'127.0.0.1',r));process.env.CLAMAV_PORT=String(server.address().port);process.env.CLAMAV_HOST='127.0.0.1';
    try { assert.equal(await scan(Buffer.from('fixture')),result==='OK'?'clean':'infected'); }
    catch(e) { if (e.code==='EACCES' || e.code==='EPERM') { t.skip('Execution sandbox denies loopback TCP; real ClamAV transport remains unverified.'); return; } throw e; }
    finally { await new Promise(r=>server.close(r)); }
  }
});
test('ClamAV adapter framing and fail-closed behavior with an in-process socket double',async t=>{
  const net=require('node:net'),{EventEmitter}=require('node:events');process.env.SCANNER_DRIVER='clamav';
  let written=[];
  t.mock.method(net,'createConnection',()=>{const socket=new EventEmitter();socket.setTimeout=()=>socket;socket.destroy=e=>socket.emit('error',e);socket.write=data=>{written.push(Buffer.from(data));if(Buffer.isBuffer(data)&&data.length===4&&data.readUInt32BE(0)===0)queueMicrotask(()=>{socket.emit('data',Buffer.from('stream: OK\0'));socket.emit('end');});return true;};queueMicrotask(()=>socket.emit('connect'));return socket;});
  assert.equal(await scan(Buffer.from('fixture')),'clean');assert.equal(written[0].toString(),'zINSTREAM\0');assert.equal(written[1].readUInt32BE(0),7);assert.equal(written[1].subarray(4).toString(),'fixture');
});
test('S3 POST policy fixes checksum, size and key to the reserved evidence',()=>{
  Object.assign(process.env,{AWS_REGION:'us-east-1',S3_BUCKET:'test-bucket',AWS_ACCESS_KEY_ID:'AKIDEXAMPLE',AWS_SECRET_ACCESS_KEY:'test-secret'});
  const upload=storage.s3UploadPolicy('quarantine/fixed','image/png',123,checksum,new Date('2026-01-01T00:00:00Z'));
  const policy=JSON.parse(Buffer.from(upload.fields.policy,'base64').toString());
  assert.ok(policy.conditions.some(c=>Array.isArray(c)&&c[0]==='content-length-range'&&c[1]===123&&c[2]===123));assert.equal(upload.fields.key,'quarantine/fixed');assert.equal(upload.fields['x-amz-checksum-sha256'],Buffer.from(checksum,'hex').toString('base64'));assert.equal(policy.expiration,'2026-01-01T00:05:00.000Z');
});
test('production refuses development storage, scanner and email alternatives', async () => {
  const previous=process.env.NODE_ENV;process.env.NODE_ENV='production';process.env.STORAGE_DRIVER='local';process.env.SCANNER_DRIVER='development';process.env.EMAIL_DRIVER='development';
  try { assert.throws(()=>storage.storageMode(),/Production/);await assert.rejects(scan(Buffer.from('fixture')),/production/);await assert.rejects(sendEmail('test@example.invalid','test','test','key'),/production/); }
  finally {process.env.NODE_ENV=previous || 'test';}
});
test('email HTTP adapter propagates failure and supplies idempotency key without sending real mail', async t => {
  process.env.EMAIL_DRIVER='resend';process.env.RESEND_API_KEY='test-key';process.env.EMAIL_FROM='noreply@example.invalid';
  let request;t.mock.method(global,'fetch',async(url,options)=>{request={url,options};return new Response('{}',{status:503});});
  await assert.rejects(sendEmail('student@example.invalid','Subject','Private inbox link','event-123'),/503/);assert.equal(request.url,'https://api.resend.com/emails');assert.equal(request.options.headers['Idempotency-Key'],'event-123');
});
