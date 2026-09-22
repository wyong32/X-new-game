import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

const activeSessions = new Set<string>();

// Basic login rate limiting: max 5 failed attempts per IP within 15 minutes
interface FailedAttemptRecord {
  count: number;
  lockedUntil?: number;
}
const failedAttempts = new Map<string, FailedAttemptRecord>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function checkRateLimit(ip: string): { allowed: boolean; remainingLockMs?: number } {
  const record = failedAttempts.get(ip);
  if (!record) return { allowed: true };

  const now = Date.now();
  if (record.lockedUntil && record.lockedUntil > now) {
    return { allowed: false, remainingLockMs: record.lockedUntil - now };
  }

  // If lockout expired, reset
  if (record.lockedUntil && record.lockedUntil <= now) {
    failedAttempts.delete(ip);
    return { allowed: true };
  }

  return { allowed: true };
}

export function recordFailedLogin(ip: string): void {
  const record = failedAttempts.get(ip) || { count: 0 };
  record.count++;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_MS;
  }
  failedAttempts.set(ip, record);
}

export function resetFailedLogin(ip: string): void {
  failedAttempts.delete(ip);
}

/**
 * P0-5 Auth Hardening:
 * APP_PASSWORD must have NO fallback.
 * Strictly empty string if undefined.
 */
export function getAppPassword(): string {
  return process.env.APP_PASSWORD || '';
}

export function createSession(): string {
  const token = crypto.randomBytes(32).toString('hex');
  activeSessions.add(token);
  return token;
}

export function invalidateSession(token: string): void {
  activeSessions.delete(token);
}

export function isValidSession(token?: string | null): boolean {
  if (!token) return false;
  return activeSessions.has(token);
}

export function parseCookie(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [key, val] = part.trim().split('=');
    if (key && val) {
      cookies[key] = decodeURIComponent(val);
    }
  }
  return cookies;
}

/**
 * Authenticates request using ONLY:
 * 1. HttpOnly Cookie: lab_session
 * 2. Authorization header: Bearer <token> (for programmatic/automated testing)
 *
 * NOTE: auth_token query parameter support is STRICTLY REMOVED.
 */
export function authGuard(req: Request, res: Response, next: NextFunction): void {
  // Allow unauthenticated endpoints
  if (
    req.path === '/api/auth/login' ||
    req.path === '/api/auth/status' ||
    req.path === '/api/health'
  ) {
    return next();
  }

  // 1. Check Cookie (Primary mechanism in production)
  const cookies = parseCookie(req.headers.cookie);
  if (cookies.lab_session && isValidSession(cookies.lab_session)) {
    return next();
  }

  // 2. Check Authorization header (Permitted for test harnesses / server-to-server)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (isValidSession(token)) {
      return next();
    }
  }

  // Unauthorized: fail closed
  res.status(401).json({
    error: 'Unauthorized: Private Lab authentication required',
    code: 'AUTH_REQUIRED'
  });
}
