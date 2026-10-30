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
    assert.ok(['@/services/operator-coverage-service', '@/constants/error-codes'].includes(name));
    const filename = path.join(__dirname, '..', 'src', `${name.slice(2)}.ts`);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    cache.set(name, module);
    new Function('require', 'module', 'exports', code)(load, module, module.exports);
    return module.exports;
  }
  return { service: load('@/services/operator-coverage-service'), ApiError };
}

const proposal = (overrides = {}) => ({ id: 'p-1', lockerId: 'l-1', originalOperatorUserId: 'o-1', operatorUserId: 'o-2', status: 'PendingApproval', statusReason: 'Suggestion only. Explicit Admin approval is required.', anchorLockerId: 'l-2', distanceKm: 1.25, serviceArea: 'Q7', loadBefore: 1, loadAfter: 2, policyId: 'pol', approvedByUserId: null, approvedAt: null, activatedAt: null, ...overrides });

test('absence state, cancel rule and pending detection', () => {
  const { service } = harness();
  const now = Date.parse('2026-10-29T00:00:00Z');
  const absence = (overrides = {}) => ({ startsAt: '2026-10-30T00:00:00Z', endsAt: '2026-10-31T00:00:00Z', cancelledAt: null, proposals: [proposal()], ...overrides });

  assert.equal(service.absenceState(absence(), now), 'upcoming');
  assert.equal(service.absenceState(absence({ startsAt: '2026-10-28T00:00:00Z' }), now), 'active');
  assert.equal(service.absenceState(absence({ endsAt: '2026-10-28T12:00:00Z', startsAt: '2026-10-28T00:00:00Z' }), now), 'ended');
  assert.equal(service.absenceState(absence({ cancelledAt: '2026-10-28T00:00:00Z' }), now), 'cancelled');
  assert.ok(service.canOperatorCancel(absence()));
  assert.ok(!service.canOperatorCancel(absence({ proposals: [proposal({ approvedAt: '2026-10-28T00:00:00Z' })] })));
  assert.ok(service.needsAdminAction(proposal({ status: 'Unassigned' })));
  assert.ok(!service.needsAdminAction(proposal({ status: 'Active' })));
  assert.match(service.translateReason(proposal().statusReason), /Admin duyệt/);
  assert.equal(service.formatDistance(null), '—');
});

test('form validation mirrors OperatorCoverageService', () => {
  const { service } = harness();
  const now = Date.parse('2026-10-29T00:00:00Z');
  const valid = { operatorUserId: 'o-1', startsAt: '2026-10-30T08:00', endsAt: '2026-10-31T08:00', reason: 'Nghỉ phép' };

  assert.deepEqual(service.validateAbsenceForm(valid, now), {});
  assert.ok(service.validateAbsenceForm({ ...valid, endsAt: '2026-10-30T07:00' }, now).endsAt);
  assert.ok(service.validateAbsenceForm({ ...valid, operatorUserId: '' }, now).operatorUserId);
  assert.ok(service.validateAbsenceForm({ ...valid, reason: 'x'.repeat(1001) }, now).reason);
  assert.deepEqual(service.validateLocationForm({ latitude: '10.73', longitude: '106.72', serviceArea: 'Q7' }), {});
  const bad = service.validateLocationForm({ latitude: '91', longitude: 'abc', serviceArea: ' ' });
  assert.ok(bad.latitude && bad.longitude && bad.serviceArea);
  assert.match(service.locationWarning({ latitude: null, longitude: null, serviceArea: null, confirmedAt: null }), /chưa có tọa độ/);
  assert.equal(service.locationWarning({ latitude: 1, longitude: 2, serviceArea: 'Q7', confirmedAt: '2026-10-01T00:00:00Z' }), '');
});

test('endpoints and payloads', async () => {
  const calls = [];
  const { service, ApiError } = harness(async (url, init = {}) => { calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined }); return {}; });

  await service.createAbsence({ operatorUserId: 'o-1', startsAt: '2026-10-30T08:00', endsAt: '2026-10-31T08:00', reason: ' Nghỉ ' });
  await service.suggestReplacements('a-1');
  await service.approveReplacement('p-1', null, ' ok ');
  await service.cancelAbsence('a-1', ' hủy ');
  await service.confirmLockerLocation('l-1', { latitude: ' 10.5 ', longitude: '-106', serviceArea: ' Q7 ' });
  assert.deepEqual(calls.map((call) => `${call.method} ${call.url}`), [
    'POST /api/operator-absences',
    'POST /api/operator-absences/a-1/proposals',
    'POST /api/operator-absences/proposals/p-1/approve',
    'POST /api/operator-absences/a-1/cancel',
    'PUT /api/lockers/l-1/location',
  ]);
  assert.deepEqual(calls[0].body, { operatorUserId: 'o-1', startsAt: new Date('2026-10-30T08:00').toISOString(), endsAt: new Date('2026-10-31T08:00').toISOString(), reason: 'Nghỉ' });
  assert.deepEqual(calls[2].body, { operatorUserId: null, reason: 'ok' });
  assert.deepEqual(calls[4].body, { latitude: 10.5, longitude: -106, serviceArea: 'Q7' });
  assert.match(service.getCoverageErrorMessage(new ApiError(409, '', 'OPERATOR_ABSENCE_OVERLAP')), /trùng/);
  assert.match(service.getCoverageErrorMessage(new ApiError(409, '', 'OPERATOR_REPLACEMENT_INELIGIBLE')), /không còn đủ điều kiện/);
});

test('approval only counts as granted when the proposal is Approved or Active', () => {
  const { service } = harness();
  const absence = (status) => ({ proposals: [proposal({ id: 'p-0', status: 'Active' }), proposal({ status })] });

  assert.equal(service.approvalOutcome(absence('Approved'), 'p-1').granted, true);
  assert.equal(service.approvalOutcome(absence('Active'), 'p-1').granted, true);
  const refreshed = service.approvalOutcome(absence('NeedsApproval'), 'p-1');
  assert.equal(refreshed.granted, false);
  assert.equal(refreshed.proposal.status, 'NeedsApproval');
  assert.deepEqual(service.approvalOutcome(absence('Approved'), 'missing'), { granted: false, proposal: null });
});
