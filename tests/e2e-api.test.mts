import test from 'node:test';
import assert from 'node:assert';

async function isServerReachable(baseUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch(`${baseUrl}/api/auth/providers`, { signal: controller.signal });
    return res.status > 0;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

test('E2E Backend API Integration Tests', async (t) => {
  const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
  const reachable = await isServerReachable(BASE_URL);

  if (!reachable && process.env.REQUIRE_LIVE_SERVER !== '1') {
    t.skip(`Server at ${BASE_URL} is offline (local servers off per owner rule; set TEST_BASE_URL or REQUIRE_LIVE_SERVER=1 to run)`);
    return;
  }

  await t.test('Root endpoint / returns HTML and 200', async () => {
    const res = await fetch(`${BASE_URL}/`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(/<!doctype html>/i.test(text));
  });

  await t.test('/api/auth/providers returns available auth options', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/providers`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(json && typeof json === 'object');
  });
});
