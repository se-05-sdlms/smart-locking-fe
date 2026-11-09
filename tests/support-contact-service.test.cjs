const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

function harness(request = async () => undefined) {
  class ApiError extends Error {
    constructor(status, message = '', code, errors) {
      super(message);
      this.status = status;
      this.code = code;
      this.errors = errors;
    }
  }
  const cache = new Map();
  function load(name) {
    if (name === '@/services/api-client') return { ApiError, apiRequest: request };
    if (cache.has(name)) return cache.get(name).exports;
    assert.ok(['@/services/support-contact-service', '@/constants/error-codes'].includes(name));
    const filename = path.join(__dirname, '..', 'src', `${name.slice(2)}.ts`);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    cache.set(name, module);
    new Function('require', 'module', 'exports', code)(load, module, module.exports);
    return module.exports;
  }
  return { service: load('@/services/support-contact-service'), ApiError };
}

const contact = (overrides = {}) => ({ operatorUserId: 'op-1', displayName: 'Lan', workPhoneNumber: '0901234567', isPublic: true, utcOffsetMinutes: 420, weekdaysMask: 62, startsAtMinute: 480, endsAtMinute: 1020, instructions: 'Gọi trong giờ', updatedAt: '2026-10-28T00:00:00Z', ...overrides });

test('weekday mask and time conversions match the backend bit order', () => {
  const { service } = harness();

  assert.equal(service.toMask([1, 2, 3, 4, 5]), 62);
  assert.deepEqual(service.fromMask(65), [0, 6]);
  assert.equal(service.timeToMinute('08:30'), 510);
  assert.equal(service.timeToMinute('24:00'), 1440);
  assert.ok(Number.isNaN(service.timeToMinute('25:00')));
  assert.equal(service.minuteToTime(1440), '24:00');
  assert.deepEqual(service.toContactForm(contact()), { displayName: 'Lan', workPhoneNumber: '0901234567', isPublic: true, weekdays: [1, 2, 3, 4, 5], startsAt: '08:00', endsAt: '17:00', instructions: 'Gọi trong giờ' });
});

test('validation mirrors OperatorSupportService', () => {
  const { service } = harness();
  const valid = { ...service.emptyContactForm('Lan'), workPhoneNumber: '+84901234567', instructions: 'Gọi' };

  assert.deepEqual(service.validateContactForm(valid), {});
  assert.ok(service.validateContactForm({ ...valid, workPhoneNumber: '090-123' }).workPhoneNumber);
  assert.ok(service.validateContactForm({ ...valid, weekdays: [] }).weekdays);
  assert.ok(service.validateContactForm({ ...valid, endsAt: '08:00' }).endsAt);
  assert.deepEqual(service.validateContactForm({ ...valid, startsAt: '22:00', endsAt: '06:00' }), {});
  assert.ok(service.validateContactForm({ ...valid, instructions: ' ' }).instructions);

  const settings = { fallbackName: '', fallbackPhoneNumber: '', fallbackInstructions: 'Liên hệ BQL', fallbackHours: '' };
  assert.deepEqual(service.validateSettingsForm(settings), {});
  assert.ok(service.validateSettingsForm({ ...settings, fallbackPhoneNumber: 'abc' }).fallbackPhoneNumber);
  assert.ok(service.validateSettingsForm({ ...settings, fallbackInstructions: '' }).fallbackInstructions);
});

test('warnings flag missing contacts and saving sends the backend contract', async () => {
  const { service } = harness();

  assert.equal(service.supportWarnings({ hasOperator: true, contact: contact(), settings: { fallbackPhoneNumber: '028123456', fallbackInstructions: 'x' } }).length, 0);
  assert.equal(service.supportWarnings({ hasOperator: false, contact: null, settings: null }).length, 2);
  assert.match(service.supportWarnings({ hasOperator: true, contact: contact({ isPublic: false }), settings: { fallbackPhoneNumber: null } }).join(' '), /đang ẩn.*chưa có số/);

  const calls = [];
  const { service: live } = harness(async (url, init = {}) => { calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined }); return undefined; });
  assert.equal(await live.getOperatorContact('op-1'), null);
  await live.saveOperatorContact('op-1', { ...live.emptyContactForm(' Lan '), workPhoneNumber: ' 0901234567 ', instructions: ' Gọi ' });
  await live.saveLockerSupportSettings('l-1', { fallbackName: ' ', fallbackPhoneNumber: '', fallbackInstructions: ' BQL ', fallbackHours: '24/7' });
  assert.deepEqual(calls.map((call) => `${call.method} ${call.url}`), [
    'GET /api/operators/op-1/support-contact',
    'PUT /api/operators/op-1/support-contact',
    'PUT /api/lockers/l-1/support-settings',
  ]);
  assert.deepEqual(calls[1].body, { displayName: 'Lan', workPhoneNumber: '0901234567', isPublic: true, utcOffsetMinutes: 420, weekdaysMask: 62, startsAtMinute: 480, endsAtMinute: 1020, instructions: 'Gọi' });
  assert.deepEqual(calls[2].body, { fallbackName: null, fallbackPhoneNumber: null, fallbackInstructions: 'BQL', fallbackHours: '24/7' });
});

test('active coverage mirrors effective assignments: only Active substitutes inside a live absence', async () => {
  const { service } = harness();
  const now = Date.parse('2026-10-29T12:00:00Z');
  const proposal = (overrides = {}) => ({ lockerId: 'l-1', originalOperatorUserId: 'a', operatorUserId: 'b', status: 'Active', activatedAt: '2026-10-29T00:00:00Z', ...overrides });
  const absence = (overrides = {}) => ({ operatorUserId: 'a', startsAt: '2026-10-29T00:00:00Z', endsAt: '2026-10-30T00:00:00Z', cancelledAt: null, proposals: [proposal()], ...overrides });

  const map = service.activeCoverage([absence()], now);
  assert.deepEqual(map.get('l-1'), { lockerId: 'l-1', originalOperatorUserId: 'a', substituteUserId: 'b', startsAt: '2026-10-29T00:00:00Z', endsAt: '2026-10-30T00:00:00Z' });
  assert.equal(service.activeCoverage([absence({ cancelledAt: '2026-10-29T01:00:00Z' })], now).size, 0);
  assert.equal(service.activeCoverage([absence({ endsAt: '2026-10-29T06:00:00Z' })], now).size, 0);
  assert.equal(service.activeCoverage([absence({ startsAt: '2026-10-29T13:00:00Z' })], now).size, 0);
  for (const status of ['Approved', 'PendingApproval', 'NeedsApproval', 'Unassigned']) {
    assert.equal(service.activeCoverage([absence({ proposals: [proposal({ status })] })], now).size, 0, status);
  }
  assert.equal(service.activeCoverage([absence({ proposals: [proposal({ activatedAt: null })] })], now).size, 0);

  const calls = [];
  const { service: live } = harness(async (url) => { calls.push(url); return [absence()]; });
  assert.equal((await live.listActiveCoverage()).size >= 0, true);
  assert.deepEqual(calls, ['/api/operator-absences']);
});
