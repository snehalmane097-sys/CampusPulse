const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const cache = path.resolve('.private-data/test-mongo-binaries');
process.env.MONGOMS_DOWNLOAD_DIR = cache;
process.env.MONGOMS_MAX_RETRIES = '1';
const { MongoMemoryReplSet } = require('mongodb-memory-server');
async function main() {
  let replica;
  try {
    const binary = fs.existsSync(cache) ? fs.readdirSync(cache).find(name => /^mongod.*\.exe$/.test(name)) : undefined;
    replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' }, ...(binary ? { binary: { systemBinary: path.join(cache, binary) } } : {}) });
    const name = 'campuspulse_test_' + randomBytes(8).toString('hex');
    const child = spawn(process.execPath, ['--require', './scripts/register.cjs', '--test', 'tests/integration/*.test.cjs'], { stdio: 'inherit', env: { ...process.env, TEST_MONGODB_URI: replica.getUri(name) } });
    process.exitCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', code => resolve(code ?? 1)); });
  } finally { if (replica) await replica.stop(); }
}
main().catch(error => { console.error('Disposable integration test setup failed:', error.message); process.exitCode = 1; });
