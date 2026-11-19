import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestHandler } from 'express';

export type RuntimeSecretContext = { ownerId: string | null; secrets: Record<string, string> };
const runtimeSecretStorage = new AsyncLocalStorage<RuntimeSecretContext>();

export function getRuntimeSecret(name: string): string {
  const value = runtimeSecretStorage.getStore()?.secrets?.[name];
  return typeof value === 'string' ? value : '';
}

export function createRuntimeSecretsMiddleware(
  resolveSecrets: (ownerId: string) => Promise<Record<string, string>>
): RequestHandler {
  return (req, res, next) => {
    const ownerId = (res.locals.authSession as { id?: string } | undefined)?.id || null;
    const context: RuntimeSecretContext = { ownerId, secrets: {} };
    return runtimeSecretStorage.run(context, () => {
      const resolution = ownerId ? resolveSecrets(ownerId) : Promise.resolve({});
      void resolution.then((secrets) => {
        context.secrets = secrets && typeof secrets === 'object' && !Array.isArray(secrets)
          ? secrets as Record<string, string>
          : {};
        res.locals.runtimeSecrets = context.secrets;
        next();
      }).catch((error) => next(error));
    });
  };
}
