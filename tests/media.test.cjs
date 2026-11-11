const {test}=require('node:test');const assert=require('node:assert/strict');
const {validateMedia}=require('../src/lib/mediaValidation.ts');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
test('container checks accept a small PNG and reject oversized dimensions',()=>{assert.doesNotThrow(()=>validateMedia(png,'image/png'));const oversized=Buffer.from(png);oversized.writeUInt32BE(100000,16);assert.throws(()=>validateMedia(oversized,'image/png'),/megapixel/);});
test('container checks reject truncated and encrypted documents',()=>{assert.throws(()=>validateMedia(Buffer.from('%PDF-1.7'),'application/pdf'),/Incomplete/);assert.throws(()=>validateMedia(Buffer.from('%PDF-1.7\n/Encrypt 1 0 R\n%%EOF'),'application/pdf'),/Encrypted/);});
test('container checks reject videos without verifiable duration',()=>{const ftyp=Buffer.alloc(20);ftyp.writeUInt32BE(20);ftyp.write('ftyp',4);ftyp.write('isom',8);assert.throws(()=>validateMedia(ftyp,'video/mp4'),/duration metadata/);});
