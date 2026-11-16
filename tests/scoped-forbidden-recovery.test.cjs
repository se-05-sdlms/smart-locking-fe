const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

// Execute both real modules. Only HTTP, browser timers and stored session are boundaries.
function harness(responses) {
  const events = [];
  const calls = [];
  let session = {
    accessToken: 'access-a', refreshToken: 'refresh-a',
    accessTokenExpiresAt: '2099-01-01T00:00:00Z',
    refreshTokenExpiresAt: '2099-01-01T00:00:00Z',
    user: { id: 'operator-a' },
  };
  const cache = new Map();
  const browser = { setTimeout, clearTimeout };
  async function fetchResponse(url, init) {
    calls.push({ url, init });
    assert.ok(responses.length, `Unexpected request ${url}`);
    const { status = 200, body = {} } = responses.shift();
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }
  function load(name) {
    if (name === '@/config/api') return { getApiUrl: (url) => `https://api.test${url}` };
    if (name === '@/auth/auth-storage') return {
      readAuthSession: () => session,
      saveAuthSession: (next) => { session = next; },
      clearAuthSession: () => { session = null; },
      isExpired: () => false,
      emitForbidden: () => events.push('forbidden'),
      emitPasswordChangeRequired: () => events.push('password-change'),
    };
    if (cache.has(name)) return cache.get(name).exports;
    assert.ok(['@/services/api-client', '@/services/operator-task-service', '@/constants/error-codes'].includes(name));
    const file = path.join(__dirname, '..', 'src', `${name.slice(2)}.ts`);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    cache.set(name, module);
    new Function('require', 'module', 'exports', 'window', 'fetch', code)(load, module, module.exports, browser, fetchResponse);
    return module.exports;
  }
  return { api: load('@/services/api-client'), service: load('@/services/operator-task-service'), events, calls };
}
const task = { kind: 'incident', id: 'task-a' };
const actions = {
  history: (service) => service.getHandovers(task),
  create: (service) => service.createHandover(task, { workDone: 'Done', blockers: '', nextSteps: 'Inspect' }),
  acknowledge: (service) => service.acknowledgeHandover('handover-a', ''),
};
for (const [name, action] of Object.entries(actions)) {
  for (const retry of [false, true]) {
    test(`${name}: resource 403 reaches recovery without global navigation${retry ? ' after token refresh' : ''}`, async () => {
      const responses = [];
      if (retry) responses.push({ status: 401 }, { body: { accessToken: 'access-b', refreshToken: 'refresh-b', user: { id: 'operator-a' } } });
      responses.push({ status: 403, body: { code: 'locker/access_denied' } });
      // The next list contains the other locker the Operator still owns.
      responses.push({ body: { items: [{ id: 'task-b', lockerId: 'locker-b' }], hasMore: false } });
      const h = harness(responses);
      await assert.rejects(action(h.service), (error) => h.service.isAccessLost(error));
      const result = await h.service.listTasks(0);
      assert.equal(result.items[0].lockerId, 'locker-b');
      assert.deepEqual(h.events, []);
      assert.ok(h.calls.every(({ init }) => !('handledForbiddenCodes' in init)));
      if (retry) assert.equal(h.calls[2].init.headers.get('Authorization'), 'Bearer access-b');
    });
  }
}
for (const retry of [false, true]) {
  for (const code of ['common/access_denied', undefined, 'auth/password_change_required']) {
    test(`resource caller preserves global guard for ${code ?? 'unknown 403'}${retry ? ' after refresh' : ''}`, async () => {
      const responses = retry ? [{ status: 401 }, { body: { accessToken: 'access-b', refreshToken: 'refresh-b', user: { id: 'operator-a' } } }] : [];
      responses.push({ status: 403, body: { code } });
      const h = harness(responses);
      await assert.rejects(h.service.createHandover(task, { workDone: 'Done', blockers: '', nextSteps: 'Inspect' }), (error) => {
        assert.equal(h.service.isAccessLost(error), false);
        return error.status === 403;
      });
      assert.deepEqual(h.events, [code === 'auth/password_change_required' ? 'password-change' : 'forbidden']);
    });
  }
}
test('default caller still uses global forbidden for a locker error', async () => {
  const h = harness([{ status: 403, body: { code: 'locker/access_denied' } }]);
  await assert.rejects(h.api.apiRequest('/api/role-page'), { status: 403 });
  assert.deepEqual(h.events, ['forbidden']);
});
test('password change cannot be suppressed even if included in handled codes', async () => {
  const h = harness([{ status: 403, body: { code: 'auth/password_change_required' } }]);
  await assert.rejects(h.api.apiRequest('/api/role-page', { handledForbiddenCodes: ['auth/password_change_required'] }), { status: 403 });
  assert.deepEqual(h.events, ['password-change']);
});
