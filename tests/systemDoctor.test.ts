import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSystemDoctor } from '../server/systemDoctor.ts';

const base = {
  databaseConnected: true,
  appliedMigrations: ['001.sql', '002.sql'],
  requiredMigrations: ['001.sql', '002.sql'],
  encryptionKeyConfigured: true,
  cspMode: 'enforce' as const,
  globalProviderKeyFallbackDisabled: true,
  ownerScopedSecretResolverAvailable: true
};

test('System Doctor reports healthy only when all required controls pass', () => {
  const result = evaluateSystemDoctor(base);
  assert.equal(result.status, 'healthy');
  assert.equal(result.summary.failed, 0);
  assert.equal(result.summary.warnings, 0);
});

test('System Doctor reports missing database, migrations, or encryption as critical', () => {
  const result = evaluateSystemDoctor({
    ...base,
    databaseConnected: false,
    appliedMigrations: ['001.sql'],
    encryptionKeyConfigured: false
  });
  assert.equal(result.status, 'critical');
  assert.equal(result.summary.failed, 3);
  assert.ok(result.checks.some(check => check.id === 'database_migrations' && check.status === 'fail'));
});

test('System Doctor marks report-only CSP as degraded, not healthy', () => {
  const result = evaluateSystemDoctor({ ...base, cspMode: 'report-only' });
  assert.equal(result.status, 'degraded');
  assert.equal(result.summary.warnings, 1);
});

test('System Doctor can include durable emergency halt readiness', () => {
  const result = evaluateSystemDoctor({ ...base, emergencyHaltAvailable: false });
  assert.equal(result.status, 'critical');
  assert.ok(result.checks.some(check => check.id === 'emergency_halt' && check.status === 'fail'));
});
