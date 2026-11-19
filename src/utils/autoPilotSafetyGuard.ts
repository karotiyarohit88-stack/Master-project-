import type { RequestHandler } from 'express';

/**
 * Locks AutoPilot mutations while preserving ordinary authenticated chat.
 * Authentication and owner authorization must run before this middleware.
 */
export function createAutoPilotSafetyGuard(
  isSafetyEnabled: () => boolean
): RequestHandler {
  return (req, res, next) => {
    const isAutoPilotMutation =
      req.path.startsWith('/autopilot/') || req.path === '/automation/trigger';

    if (!isAutoPilotMutation || req.method === 'GET' || req.path === '/autopilot/safety') {
      next();
      return;
    }

    if (!isSafetyEnabled()) {
      res.status(423).json({
        error: 'AutoPilot is locked in Safe Chat-Only Mode. Enable Safety & Security after OTP login.'
      });
      return;
    }

    next();
  };
}
