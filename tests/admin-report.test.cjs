const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

// Execute the actual TS module with stubbed API/auth boundaries. No HTTP, session or secrets.
function harness(request = async () => undefined) {
  const cache = new Map();
  class ApiError extends Error {
    constructor(status, message = '', code, errors) {
      super(message);
      this.status = status;
      this.code = code;
      this.errors = errors;
    }
  }
  function load(name) {
    if (name === '@/services/api-client') {
      return { ApiError, apiRequest: request, refreshAuthSession: async () => ({ accessToken: 'new' }) };
    }
    if (name === '@/auth/auth-storage') return { readAuthSession: () => ({ accessToken: 'token' }) };
    if (name === '@/config/api') return { getApiUrl: (p) => `http://api${p}` };
    if (cache.has(name)) return cache.get(name).exports;
    assert.equal(name, '@/services/admin-report-service');
    const filename = path.join(__dirname, '..', 'src', `${name.slice(2)}.ts`);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    cache.set(name, module);
    new Function('require', 'module', 'exports', code)(load, module, module.exports);
    return module.exports;
  }
  return { service: load('@/services/admin-report-service'), ApiError };
}

test('empty filters ask the backend for its default 30-day, all-locker report', () => {
  const { service } = harness();

  assert.deepEqual(service.emptyReportFilters(), { from: '', to: '', lockerId: '' });
  assert.equal(service.buildReportQuery(service.emptyReportFilters()).toString(), '');
  assert.equal(service.DEFAULT_REPORT_DAYS, 30);
});

test('query sends the whole local day range and the selected locker', () => {
  const { service } = harness();
  const query = service.buildReportQuery({ from: '2026-10-01', to: '2026-10-07', lockerId: 'locker-1' });

  assert.equal(query.get('from'), new Date(2026, 9, 1, 0, 0, 0, 0).toISOString());
  assert.equal(query.get('to'), new Date(2026, 9, 7, 23, 59, 59, 999).toISOString());
  assert.equal(query.get('lockerId'), 'locker-1');
  assert.equal(service.buildReportQuery({ from: '', to: '', lockerId: 'locker-2' }).toString(), 'lockerId=locker-2');
});

test('validation rejects a future start date and an inverted range', () => {
  const { service } = harness();
  const today = new Date(2026, 9, 21);
  const filters = (overrides) => ({ from: '', to: '', lockerId: '', ...overrides });

  assert.deepEqual(service.validateReportFilters(filters({ from: '2026-10-01', to: '2026-10-21' }), today), {});
  assert.deepEqual(service.validateReportFilters(filters({ from: '2026-10-21', to: '2026-10-21' }), today), {});
  assert.ok(service.validateReportFilters(filters({ from: '2026-10-22' }), today).from);
  assert.ok(service.validateReportFilters(filters({ from: '2026-10-10', to: '2026-10-05' }), today).to);
});

test('summary request carries the filters', async () => {
  const urls = [];
  const { service } = harness(async (url) => {
    urls.push(url);
    return { deliveries: 1 };
  });

  await service.getReportSummary({ from: '', to: '', lockerId: 'locker-9' });
  assert.equal(urls[0], '/api/reports/summary?lockerId=locker-9');
});

test('six metrics are labelled in Vietnamese', () => {
  const { service } = harness();

  assert.deepEqual(
    service.REPORT_METRICS.map((metric) => metric.key),
    ['deliveries', 'returns', 'retrievedParcels', 'openIncidents', 'maintenanceRequests', 'emergencyUnlocks'],
  );
  assert.ok(service.REPORT_METRICS.every((metric) => metric.label && metric.description));
});

test('errors are shown in Vietnamese', () => {
  const { service, ApiError } = harness();

  assert.match(service.getReportErrorMessage(new ApiError(0)), /Không thể kết nối/);
  assert.match(service.getReportErrorMessage(new ApiError(403)), /không có quyền/);
  assert.match(service.getReportErrorMessage(new ApiError(404)), /Không tìm thấy tủ/);
  assert.match(service.getReportErrorMessage(new ApiError(503)), /Máy chủ đang gặp sự cố/);
  assert.equal(service.getReportErrorMessage(undefined), 'Không thể tải báo cáo. Vui lòng thử lại.');
});

test('filters are compared field by field to tell whether numbers are current (review #74)', () => {
  const { service } = harness();
  const a = { from: '2026-10-01', to: '2026-10-07', lockerId: 'locker-A' };

  assert.equal(service.sameReportFilters(a, { ...a }), true);
  assert.equal(service.sameReportFilters(a, { ...a, lockerId: 'locker-B' }), false);
  assert.equal(service.sameReportFilters(a, { ...a, from: '' }), false);
  assert.equal(service.sameReportFilters(a, { ...a, to: '2026-10-08' }), false);
});

test('the page only shows and exports numbers that match the applied filters (review #74)', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'pages', 'admin', 'reports.tsx'), 'utf8');

  // Numbers are stored with the filters that produced them…
  assert.match(source, /filters: applied,\s*summary: await getReportSummary\(applied, signal\)/);
  // …are hidden when they belong to other filters (loading or failed reload)…
  assert.match(source, /const summary = isCurrent \? loaded\?\.summary : undefined;/);
  // …and the CSV uses the loaded filters and is enabled only for a successful, current load.
  assert.match(source, /await downloadReportCsv\(loadedFilters\);/);
  assert.match(source, /report\.state\.status === 'success'/);
  assert.match(source, /isDisabled=\{!canExport\}/);
});
