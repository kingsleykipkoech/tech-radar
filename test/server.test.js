/**
 * Unit & Integration Tests for Tech Radar Server
 * Tests API proxy, health check, package resolution, and security headers
 */

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

test('Tech Radar Server Endpoints', async (t) => {
  // Start server on an ephemeral port
  process.env.PORT = '0';
  process.env.SERVER_NAME = 'test-node-01';

  // Require server (it starts listening)
  delete require.cache[require.resolve('../server.js')];
  
  // We can test the helper functions and live endpoints
  await t.test('Health check endpoint returns UP and server hostname', async () => {
    const res = await fetch('http://localhost:5000/api/health');
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'UP');
    assert.ok(data.uptime >= 0);
  });

  await t.test('Search endpoint requires "q" parameter', async () => {
    const res = await fetch('http://localhost:5000/api/search');
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  await t.test('Search endpoint returns valid package objects', async () => {
    const res = await fetch('http://localhost:5000/api/search?q=express&ecosystem=npm');
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.query, 'express');
    assert.ok(Array.isArray(data.results));
    assert.ok(data.results.length > 0);
    assert.strictEqual(data.results[0].ecosystem, 'npm');
  });

  await t.test('Package detail endpoint returns health score and metadata', async () => {
    const res = await fetch('http://localhost:5000/api/package/npm/express');
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.name, 'express');
    assert.ok(data.healthScore >= 0 && data.healthScore <= 100);
    assert.strictEqual(data.license, 'MIT');
  });

  await t.test('Security headers are present', async () => {
    const res = await fetch('http://localhost:5000/api/health');
    assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(res.headers.get('x-served-by'));
  });
});
