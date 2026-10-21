const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

// Execute the actual TS module with a stubbed API boundary. No HTTP, session or secrets.
function harness(request = async () => []) {
  function load(name) {
    if (name === '@/services/api-client') return { apiRequest: request };
    assert.equal(name, '@/services/operations-service');
    const filename = path.join(__dirname, '..', 'src', `${name.slice(2)}.ts`);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', code)(load, module, module.exports);
    return module.exports;
  }
  return load('@/services/operations-service');
}

const locker = (id, overrides = {}) => ({
  id,
  code: `LK-${id}`,
  address: `Địa chỉ ${id}`,
  operationalStatus: 0,
  connectionStatus: 0,
  lastSeenAt: null,
  totalCompartments: 6,
  activeCompartments: 4,
  ...overrides,
});

test('operator dashboard rows are built only from existing endpoints (#62)', async () => {
  const urls = [];
  const service = harness(async (url) => {
    urls.push(url);
    if (url === '/api/Lockers') return { items: [locker('a'), locker('b', { operationalStatus: 1, connectionStatus: 1 })] };
    if (url === '/api/parcels?view=Active') return [{ lockerId: 'a' }, { lockerId: 'a' }, { lockerId: 'b' }];
    return [
      { lockerId: 'a', status: 0 },
      { lockerId: 'a', status: 'Resolved' },
      { lockerId: 'b', status: 'Escalated' },
      { lockerId: null, status: 1 },
    ];
  });

  const rows = await service.operationsService.lockers();

  assert.deepEqual(urls.sort(), ['/api/Lockers', '/api/operator/incidents', '/api/parcels?view=Active']);
  assert.ok(!urls.some((url) => url.includes('operational-summary')));
  assert.deepEqual(rows[0], {
    id: 'a', code: 'LK-a', address: 'Địa chỉ a', status: 'Operational', connection: 'Online',
    lastSeenAt: null, activeCompartments: 4, totalCompartments: 6, storedParcels: 2, openIncidents: 1,
  });
  assert.equal(rows[1].status, 'OutOfService');
  assert.equal(rows[1].connection, 'Offline');
  assert.equal(rows[1].storedParcels, 1);
  assert.equal(rows[1].openIncidents, 1);
});

test('unknown enum values fall back safely and lockers without activity count zero', () => {
  const service = harness();
  const [row] = service.buildOperationalLockers([locker('x', { operationalStatus: 9, connectionStatus: 9 })], [], []);

  assert.equal(row.status, 'Inactive');
  assert.equal(row.connection, 'Unknown');
  assert.equal(row.storedParcels, 0);
  assert.equal(row.openIncidents, 0);
});
