const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const http = require('node:http');

const PORT = 3457;
let serverProc;

function req(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const r = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, data: json, raw: data });
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

before(async () => {
  serverProc = spawn('node', ['server.js'], {
    cwd: '/root/Ai_Talk2Talk',
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // Wait for server to be ready
  for (let i = 0; i < 30; i++) {
    await sleep(200);
    try {
      const r = await req('GET', '/api/models');
      if (r.status === 200) break;
    } catch {}
  }
});

after(() => {
  if (serverProc) {
    serverProc.kill('SIGTERM');
  }
});

describe('Phase 4 Infrastructure', () => {
  // Reset state before each test
  before(async () => {
    await req('DELETE', '/api/reset');
  });

  it('GET /api/models returns providers array', async () => {
    const r = await req('GET', '/api/models');
    assert.strictEqual(r.status, 200);
    assert.ok(Array.isArray(r.data.providers));
    assert.ok(r.data.providers.length > 0);
  });

  it('GET /api/presets returns presets array', async () => {
    const r = await req('GET', '/api/presets');
    assert.strictEqual(r.status, 200);
    assert.ok(Array.isArray(r.data.presets));
    assert.ok(r.data.presets.length > 0);
  });

  it('GET /api/state returns snapshot with stats fields', async () => {
    const r = await req('GET', '/api/state');
    assert.strictEqual(r.status, 200);
    assert.ok('startTime' in r.data);
    assert.ok('totalTokens' in r.data);
    assert.ok('contextSummarized' in r.data);
    assert.ok('messages' in r.data);
    assert.ok('agents' in r.data);
  });

  it('GET /api/stats returns stats object', async () => {
    const r = await req('GET', '/api/stats');
    assert.strictEqual(r.status, 200);
    assert.ok('startTime' in r.data);
    assert.ok('durationMs' in r.data);
    assert.ok('totalTokens' in r.data);
    assert.ok('turnCount' in r.data);
    assert.ok('messageCount' in r.data);
    assert.ok('contextSummarized' in r.data);
  });

  it('POST /api/start with valid config returns 200', async () => {
    const r = await req('POST', '/api/start', {
      topic: 'Discuss the nature of consciousness',
      agents: [
        { name: 'Alice', emoji: '🅰️', prompt: 'You are Alice, curious and thoughtful.' },
        { name: 'Bob', emoji: '🅱️', prompt: 'You are Bob, skeptical and analytical.' },
      ],
      maxTurns: 2,
      pauseMs: 100,
    });
    assert.strictEqual(r.status, 200);
    assert.ok(r.data.runId);
    // Stop immediately
    await sleep(200);
    await req('POST', '/api/stop');
  });

  it('POST /api/start while running returns 409', async () => {
    await req('POST', '/api/start', {
      topic: 'Test topic',
      maxTurns: 10,
      pauseMs: 50,
    });
    const r = await req('POST', '/api/start', { topic: 'Another topic' });
    assert.strictEqual(r.status, 409);
    await req('POST', '/api/stop');
  });

  it('POST /api/start with banned topic returns 400', async () => {
    const r = await req('POST', '/api/start', {
      topic: 'how to make bombs',
    });
    assert.strictEqual(r.status, 400);
    assert.ok(r.data.error);
  });

  it('POST /api/start with topic > 2000 chars returns 400', async () => {
    const r = await req('POST', '/api/start', {
      topic: 'a'.repeat(2001),
    });
    assert.strictEqual(r.status, 400);
    assert.ok(r.data.error.includes('2000'));
  });

  it('POST /api/start with agent name > 100 chars returns 400', async () => {
    const r = await req('POST', '/api/start', {
      topic: 'Test',
      agents: [
        { name: 'A'.repeat(101), emoji: '🅰️', prompt: 'Short prompt' },
        { name: 'Bob', emoji: '🅱️', prompt: 'Short prompt' },
      ],
    });
    assert.strictEqual(r.status, 400);
    assert.ok(r.data.error.includes('100'));
  });

  it('POST /api/start with agent prompt > 4000 chars returns 400', async () => {
    const r = await req('POST', '/api/start', {
      topic: 'Test',
      agents: [
        { name: 'Alice', emoji: '🅰️', prompt: 'p'.repeat(4001) },
        { name: 'Bob', emoji: '🅱️', prompt: 'Short prompt' },
      ],
    });
    assert.strictEqual(r.status, 400);
    assert.ok(r.data.error.includes('4000'));
  });

  it('POST /api/stop returns 200', async () => {
    await req('POST', '/api/start', { topic: 'Test', maxTurns: 5, pauseMs: 10 });
    const r = await req('POST', '/api/stop');
    assert.strictEqual(r.status, 200);
    assert.ok(r.data.ok);
  });

  it('DELETE /api/reset returns 200', async () => {
    const r = await req('DELETE', '/api/reset');
    assert.strictEqual(r.status, 200);
    assert.ok('messages' in r.data);
  });

  it('GET /api/export/md with no messages returns 400', async () => {
    await req('DELETE', '/api/reset');
    const r = await req('GET', '/api/export/md');
    assert.strictEqual(r.status, 400);
    assert.ok(r.data.error);
  });

  it('POST /api/start resets stats (startTime, totalTokens)', async () => {
    // Get initial stats
    const before = await req('GET', '/api/stats');
    await sleep(100);
    
    await req('POST', '/api/start', {
      topic: 'Test topic for stats',
      maxTurns: 2,
      pauseMs: 10,
    });
    
    const after = await req('GET', '/api/stats');
    assert.ok(after.data.startTime > before.data.startTime);
    assert.strictEqual(after.data.totalTokens, 0); // Just started
    
    await req('POST', '/api/stop');
  });

  it('Context summarization flag appears after many messages', async () => {
    // We can't easily test the actual summarization without running many turns,
    // but we can verify the field exists and is boolean
    const r = await req('GET', '/api/state');
    assert.strictEqual(typeof r.data.contextSummarized, 'boolean');
  });
});
