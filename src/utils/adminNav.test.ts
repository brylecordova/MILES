import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_NAV_CLUSTERS, getAdminClusterForTab, type AdminTabId } from './adminNav';

test('admin navigation groups all tabs into 3 labeled functional clusters', () => {
  assert.equal(ADMIN_NAV_CLUSTERS.length, 3);
  assert.deepEqual(
    ADMIN_NAV_CLUSTERS.map((c) => c.label),
    ['Certificates & Reporting', 'Curriculum Management', 'System Settings']
  );
});

test('every admin tab appears exactly once across clusters', () => {
  const allTabs = ADMIN_NAV_CLUSTERS.flatMap((c) => c.items.map((item) => item.id));
  const expected: AdminTabId[] = [
    'analytics',
    'submissions',
    'courses',
    'branding',
    'distribution',
  ];
  assert.equal(allTabs.length, expected.length);
  for (const id of expected) {
    assert.ok(allTabs.includes(id), `Missing tab ${id}`);
  }
});

test('getAdminClusterForTab resolves the owning cluster for any tab', () => {
  assert.equal(getAdminClusterForTab('analytics').id, 'certificates-reporting');
  assert.equal(getAdminClusterForTab('submissions').id, 'certificates-reporting');
  assert.equal(getAdminClusterForTab('courses').id, 'curriculum-management');
  assert.equal(getAdminClusterForTab('branding').id, 'system-settings');
  assert.equal(getAdminClusterForTab('distribution').id, 'system-settings');
});
