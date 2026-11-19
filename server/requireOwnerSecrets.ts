import type { RequestHandler } from 'express';

type AuthenticatedRoleContext = { role?: string } | undefined;

/**
 * Secrets are a platform Owner-only surface.
 * Require both the authenticated account role and the active tenant membership
 * role to be Owner; neither Tenant Admin nor any delegated sub-role is sufficient.
 */
export const requireOwnerForSecrets: RequestHandler = (_req, res, next) => {
  const accountRole = (res.locals.authSession as AuthenticatedRoleContext)?.role;
  const tenantRole = (res.locals.tenantContext as AuthenticatedRoleContext)?.role;

  if (accountRole !== 'owner' || tenantRole !== 'owner') {
    return res.status(403).json({ error: 'Owner access is required to manage secrets.' });
  }

  return next();
};
