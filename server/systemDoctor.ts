export type DoctorCheck = {
  id: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
};

export type SystemDoctorInput = {
  databaseConnected: boolean;
  appliedMigrations: string[];
  requiredMigrations: string[];
  encryptionKeyConfigured: boolean;
  cspMode: 'report-only' | 'enforce';
  globalProviderKeyFallbackDisabled: boolean;
  ownerScopedSecretResolverAvailable: boolean;
  emergencyHaltAvailable?: boolean;
};

export function evaluateSystemDoctor(input: SystemDoctorInput) {
  const missingMigrations = input.requiredMigrations.filter(name => !input.appliedMigrations.includes(name));
  const checks: DoctorCheck[] = [
    {
      id: 'postgres_connection',
      status: input.databaseConnected ? 'pass' : 'fail',
      message: input.databaseConnected ? 'PostgreSQL connection is available.' : 'PostgreSQL connection is unavailable.'
    },
    {
      id: 'database_migrations',
      status: missingMigrations.length === 0 ? 'pass' : 'fail',
      message: missingMigrations.length === 0 ? 'All required security migrations are applied.' : 'Required migrations are missing: ' + missingMigrations.join(', ')
    },
    {
      id: 'secrets_encryption',
      status: input.encryptionKeyConfigured ? 'pass' : 'fail',
      message: input.encryptionKeyConfigured ? 'AES-256-GCM encryption key is configured.' : 'Secret encryption key is missing or invalid.'
    },
    {
      id: 'csp',
      status: input.cspMode === 'enforce' ? 'pass' : 'warning',
      message: input.cspMode === 'enforce' ? 'Content Security Policy enforcement is active.' : 'Content Security Policy is report-only; enforcement awaits origin validation.'
    },
    {
      id: 'provider_key_isolation',
      status: input.globalProviderKeyFallbackDisabled ? 'pass' : 'fail',
      message: input.globalProviderKeyFallbackDisabled ? 'Provider keys are resolved only from the authenticated Owner secret context.' : 'Global provider-key fallback is enabled.'
    },
    {
      id: 'owner_secret_resolver',
      status: input.ownerScopedSecretResolverAvailable ? 'pass' : 'fail',
      message: input.ownerScopedSecretResolverAvailable ? 'Owner-scoped encrypted secret resolver is available.' : 'Owner-scoped secret resolver is unavailable.'
    }
  ];
  if (input.emergencyHaltAvailable !== undefined) {
    checks.push({
      id: 'emergency_halt',
      status: input.emergencyHaltAvailable ? 'pass' : 'fail',
      message: input.emergencyHaltAvailable ? 'Durable emergency halt storage is available.' : 'Durable emergency halt storage is unavailable.'
    });
  }
  const status = checks.some(check => check.status === 'fail')
    ? 'critical'
    : checks.some(check => check.status === 'warning')
      ? 'degraded'
      : 'healthy';
  return {
    status,
    checkedAt: new Date().toISOString(),
    checks,
    summary: {
      passed: checks.filter(check => check.status === 'pass').length,
      warnings: checks.filter(check => check.status === 'warning').length,
      failed: checks.filter(check => check.status === 'fail').length
    }
  };
}
