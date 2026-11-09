const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

function harness(request = async () => undefined) {
  class ApiError extends Error {
    constructor(status, message = '', code) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  const rendered = [];
  function load(name) {
    if (name === '@/services/api-client') return { ApiError, apiRequest: request };
    if (name === 'qrcode') return { toDataURL: async (text, options) => { rendered.push({ text, options }); return 'data:image/png;base64,AAA'; } };
    assert.equal(name, '@/services/locker-qr-service');
    const filename = path.join(__dirname, '..', 'src', `${name.slice(2)}.ts`);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', code)(load, module, module.exports);
    return module.exports;
  }
  return { service: load('@/services/locker-qr-service'), ApiError, rendered };
}

const context = (overrides = {}) => ({
  lockerId: 'l-1', lockerCode: 'SEED-LKR-001', shipperUrl: 'https://ship.example.vn/?locker=SEED-LKR-001', operationalStatus: 0, ...overrides,
});

test('QR context is read from the backend for the chosen locker', async () => {
  const urls = [];
  const { service } = harness(async (url) => { urls.push(url); return context(); });

  await service.getLockerQrContext('l 1');
  assert.deepEqual(urls, ['/api/lockers/l%201/qr-context']);
});

test('only a public https Shipper URL for this exact locker is encoded', async () => {
  const { service, rendered } = harness();

  assert.equal(await service.renderLockerQr(context()), 'data:image/png;base64,AAA');
  assert.equal(rendered[0].text, 'https://ship.example.vn/?locker=SEED-LKR-001');
  assert.equal(rendered[0].options.width, 1024);
  assert.equal(service.validateQrContext(context({ shipperUrl: 'http://localhost:5174/?locker=SEED-LKR-001' })), 'http://localhost:5174/?locker=SEED-LKR-001');

  for (const shipperUrl of [
    'http://ship.example.vn/?locker=SEED-LKR-001',
    'https://user:pw@ship.example.vn/?locker=SEED-LKR-001',
    'https://ship.example.vn/?locker=SEED-LKR-001#x',
    'https://ship.example.vn/?locker=OTHER',
    'https://ship.example.vn/?locker=SEED-LKR-001&token=abc',
    'not a url',
  ]) {
    assert.throws(() => service.validateQrContext(context({ shipperUrl })), service.LockerQrError, shipperUrl);
  }
  assert.throws(() => service.validateQrContext(context({ lockerCode: ' ' })), /chưa có mã/);
});

test('file name identifies the locker and is safe', () => {
  const { service } = harness();

  assert.equal(service.qrFileName('SEED-LKR-001'), 'qr-tu-SEED-LKR-001.png');
  assert.equal(service.qrFileName('Tủ Á/01'), 'qr-tu-Tu-A-01.png');
  assert.equal(service.qrFileName('///'), 'qr-tu-khong-ma.png');
});

test('missing Shipper web configuration and scope errors are explained', () => {
  const { service, ApiError } = harness();

  assert.match(service.getLockerQrErrorMessage(new ApiError(409, 'x', 'LOCKER_QR_NOT_CONFIGURED')), /chưa cấu hình địa chỉ web Shipper/);
  assert.match(service.getLockerQrErrorMessage(new ApiError(403)), /phạm vi/);
  assert.match(service.getLockerQrErrorMessage(new service.LockerQrError('Địa chỉ QR không khớp mã tủ.')), /không khớp/);
});
