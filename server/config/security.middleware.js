/**
 * Security middleware for the existing Master Project Express server.
 *
 * Provides conservative HTTP security headers and an optional in-memory
 * fixed-window API rate limiter. This module is intentionally dependency-light.
 *
 * IMPORTANT:
 * - Exporting this module does not activate it. The Express app must mount it.
 * - The rate limiter is opt-in until the deployment proxy / client IP trust
 *   configuration has been reviewed.
 * - The limiter is process-local; it is not a distributed production limiter.
 * - Do not log request bodies, authorization headers, cookies, or API keys.
 */

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 180;
const DEFAULT_MAX_ENTRIES = 10_000;

function isPositiveInteger(value, fallback) {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

/**
 * Apply baseline response headers without imposing a Content-Security-Policy.
 * CSP must be configured after auditing the app's Vite, media, and OAuth origins.
 */
export function securityHeaders(req, res, next) {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');

  // Render / production ingress terminates HTTPS before forwarding to Node.
  // HSTS is only emitted in production; browsers ignore it over plain HTTP.
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  }

  return next();
}

/**
 * Create an in-memory fixed-window limiter.
 *
 * keyGenerator should use a trusted client IP. Do not read X-Forwarded-For
 * directly. If Express trust proxy is configured, req.ip can be used safely
 * for the explicitly trusted proxy topology.
 */
export function createRateLimitMiddleware(options = {}) {
  const windowMs = isPositiveInteger(options.windowMs, DEFAULT_WINDOW_MS);
  const maxRequests = isPositiveInteger(options.maxRequests, DEFAULT_MAX_REQUESTS);
  const maxEntries = isPositiveInteger(options.maxEntries, DEFAULT_MAX_ENTRIES);
  const keyGenerator = typeof options.keyGenerator === 'function'
    ? options.keyGenerator
    : (req) => req.ip || req.socket?.remoteAddress || 'unknown';
  const skip = typeof options.skip === 'function' ? options.skip : () => false;
  const buckets = new Map();

  return function rateLimitMiddleware(req, res, next) {
    if (skip(req)) return next();

    let key;
    try {
      key = String(keyGenerator(req) || 'unknown').slice(0, 200);
    } catch {
      return res.status(503).json({ error: 'Request protection is temporarily unavailable.' });
    }

    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
    }

    bucket.count += 1;
    buckets.delete(key);
    buckets.set(key, bucket);

    // Bound memory use if many distinct client addresses are observed.
    if (buckets.size > maxEntries) {
      for (const [entryKey, entry] of buckets) {
        if (entry.resetAt <= now || buckets.size > maxEntries) {
          buckets.delete(entryKey);
        }
        if (buckets.size <= maxEntries) break;
      }
    }

    const remaining = Math.max(0, maxRequests - bucket.count);
    const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader('RateLimit-Limit', String(maxRequests));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(resetSeconds));

    if (bucket.count > maxRequests) {
      res.setHeader('Retry-After', String(resetSeconds));
      return res.status(429).json({
        error: 'Too many requests. Please wait before trying again.',
        retryAfterSeconds: resetSeconds
      });
    }

    return next();
  };
}

/**
 * Compose security headers with an optional API rate limiter.
 *
 * Example:
 * app.use(createSecurityMiddleware({
 *   rateLimit: {
 *     maxRequests: 180,
 *     windowMs: 60_000,
 *     skip: (req) => req.path === '/api/health' || req.method === 'OPTIONS'
 *   }
 * }));
 */
export function createSecurityMiddleware(options = {}) {
  const limiter = options.rateLimit
    ? createRateLimitMiddleware(options.rateLimit)
    : null;

  return function securityMiddleware(req, res, next) {
    securityHeaders(req, res, (headerError) => {
      if (headerError) return next(headerError);
      if (!limiter) return next();
      return limiter(req, res, next);
    });
  };
}

export default createSecurityMiddleware;
