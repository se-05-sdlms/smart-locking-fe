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
    assert.ok(['@/services/account-change-service', '@/constants/error-codes'].includes(name));
    const filename = path.join(__dirname, '..', 'src', `${name.slice(2)}.ts`);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    cache.set(name, module);
    new Function('require', 'module', 'exports', code)(load, module, module.exports);
    return module.exports;
  }
  return { service: load('@/services/account-change-service'), ApiError };
}

test('blockers are translated and grouped by unmet condition', () => {
  const { service } = harness();
  const groups = service.groupBlockers([
    { kind: 'Parcel', id: 'p1', message: 'Parcel P-1 must be collected or physically confirmed at the recovery address.' },
    { kind: 'Parcel', id: 'p2', message: 'An overdue charge is outstanding.' },
    { kind: 'Parcel', id: 'p3', message: 'An overdue charge is outstanding.' },
    { kind: 'Reconciliation', id: 'r1', message: 'Reconciliation REC-1 is unresolved.' },
    { kind: 'Unknown', id: 'u', message: 'Raw message' },
  ]);

  assert.deepEqual(groups.map((group) => group.label), ['Bưu kiện / phí quá hạn', 'Tra soát thanh toán', 'Unknown']);
  assert.equal(groups[0].messages.length, 2);
  assert.match(groups[0].messages[0], /Bưu kiện P-1/);
  assert.match(groups[1].messages[0], /REC-1/);
  assert.equal(groups[2].messages[0], 'Raw message');
});

test('review rules', () => {
  const { service } = harness();

  assert.ok(service.canReview({ status: 'Submitted' }));
  assert.ok(!service.canReview({ status: 'Applied' }));
  assert.ok(service.wasApprovalBlocked({ status: 'Submitted', blockers: [{}] }));
  assert.ok(!service.wasApprovalBlocked({ status: 'Applied', blockers: [] }));
  assert.ok(service.validateReviewReason(' '));
  assert.ok(service.validateReviewReason('x'.repeat(2001)));
  assert.equal(service.validateReviewReason('ok'), '');
  assert.match(service.approvalImpact({ kind: 'Locker' }).join(' '), /không bị chuyển/);
  assert.match(service.approvalImpact({ kind: 'Phone' }).join(' '), /OTP/);
});

test('endpoints and errors', async () => {
  const calls = [];
  const { service, ApiError } = harness(async (url, init = {}) => { calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined }); return {}; });

  await service.listAccountChanges(2);
  await service.getAccountChange('c-1');
  await service.reviewAccountChange('c-1', true, ' ok ');
  assert.deepEqual(calls.map((call) => `${call.method} ${call.url}`), [
    'GET /api/resident-account-changes?pageNumber=2&pageSize=20',
    'GET /api/resident-account-changes/c-1',
    'POST /api/resident-account-changes/c-1:review',
  ]);
  assert.deepEqual(calls[2].body, { approve: true, reason: 'ok' });
  assert.match(service.getAccountChangeErrorMessage(new ApiError(409, '', 'account-change/phone-unavailable')), /tài khoản khác/);
});
