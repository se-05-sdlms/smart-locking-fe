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
    assert.ok(['@/services/payment-reconciliation-service', '@/constants/error-codes'].includes(name));
    const filename = path.join(__dirname, '..', 'src', `${name.slice(2)}.ts`);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    cache.set(name, module);
    new Function('require', 'module', 'exports', code)(load, module, module.exports);
    return module.exports;
  }
  return { service: load('@/services/payment-reconciliation-service'), ApiError };
}

test('lookup query maps filters to whole local days and the backend page size', () => {
  const { service } = harness();
  const filters = { ...service.emptyLookupFilters(), kind: 'Overdue', status: 'Pending', orderCode: ' 123 ', residentUserId: 'r-1', from: '2026-10-01', to: '2026-10-02', page: 2 };
  const params = new URLSearchParams(service.buildLookupQuery(filters));

  assert.equal(params.get('Kind'), 'Overdue');
  assert.equal(params.get('Status'), 'Pending');
  assert.equal(params.get('OrderCode'), '123');
  assert.equal(params.get('ResidentUserId'), 'r-1');
  assert.equal(params.get('From'), new Date('2026-10-01T00:00:00').toISOString());
  assert.equal(params.get('To'), new Date('2026-10-02T23:59:59.999').toISOString());
  assert.equal(params.get('PageNumber'), '2');
  assert.equal(new URLSearchParams(service.buildLookupQuery(service.emptyLookupFilters())).has('Kind'), false);
  assert.ok(service.validateLookupFilters({ ...filters, from: '2026-10-03' }));
  assert.equal(service.validateLookupFilters(filters), '');
});

test('only backend-allowed actions are offered; final cases have none', () => {
  const { service } = harness();

  assert.deepEqual(service.caseActions({ status: 'Submitted', assignedAdminUserId: null }, 'a-1'), { canAssign: true, canRespond: true, canSynchronize: true });
  assert.equal(service.caseActions({ status: 'InReview', assignedAdminUserId: 'a-1' }, 'a-1').canAssign, false);
  assert.equal(service.caseActions({ status: 'InReview', assignedAdminUserId: 'a-2' }, 'a-1').canAssign, true);
  for (const status of ['Resolved', 'Closed']) {
    assert.deepEqual(service.caseActions({ status, assignedAdminUserId: 'a-1' }, 'a-1'), { canAssign: false, canRespond: false, canSynchronize: false });
  }
  assert.deepEqual(Object.keys(service.respondStatusLabels), ['InReview', 'WaitingProvider', 'Closed']);
  assert.ok(service.isCaseUncertain('WaitingProvider') && service.isCaseUncertain('Conflict'));
  assert.ok(!service.isCaseUncertain('Resolved'));
});

test('case endpoints and responses', async () => {
  const calls = [];
  const { service, ApiError } = harness(async (url, init = {}) => { calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined }); return {}; });

  await service.listCases(1);
  await service.assignCase('c-1');
  await service.respondCase('c-1', 'Closed', '  Đã kiểm tra  ');
  await service.synchronizeCase('c-1');
  await service.getPayment('Subscription', 's-1');
  assert.deepEqual(calls.map((call) => `${call.method} ${call.url}`), [
    'GET /api/payment-reconciliations?pageNumber=1&pageSize=20',
    'POST /api/payment-reconciliations/c-1:assign',
    'POST /api/payment-reconciliations/c-1:respond',
    'POST /api/payment-reconciliations/c-1:synchronize',
    'GET /api/payment-reconciliations/payments/Subscription/s-1',
  ]);
  assert.deepEqual(calls[2].body, { status: 'Closed', response: 'Đã kiểm tra' });

  assert.ok(service.validateResponse('', 'x'));
  assert.ok(service.validateResponse('Closed', ' '));
  assert.ok(service.validateResponse('Closed', 'x'.repeat(2001)));
  assert.equal(service.validateResponse('Closed', 'ok'), '');
  assert.match(service.translateCaseMessage('An administrator has accepted this reconciliation.'), /Quản trị viên/);
  assert.equal(service.translateCaseMessage('free text'), 'free text');
  assert.match(service.getReconciliationErrorMessage(new ApiError(404, '', 'payment/not_found')), /Không tìm thấy/);
  assert.match(service.getReconciliationErrorMessage(new ApiError(429, '')), /quá nhanh/);
});
