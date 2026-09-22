import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

const activeSessions = new Set<string>();

export function getAppPassword(): string {
  return process.env.APP_PASSWORD || 'discovery2026';
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

export function authGuard(req: Request, res: Response, next: NextFunction): void {
  // Allow login and status check endpoints
  if (
    req.path === '/api/auth/login' ||
    req.path === '/api/auth/status' ||
    req.path === '/api/health'
  ) {
    return next();
  }

  // 1. Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (isValidSession(token)) {
      return next();
    }
  }

  // 2. Check Cookie
  const cookies = parseCookie(req.headers.cookie);
  if (cookies.lab_session && isValidSession(cookies.lab_session)) {
    return next();
  }

  // 3. Check query param (specifically for browser download links like /api/export/*)
  const queryToken = typeof req.query.auth_token === 'string' ? req.query.auth_token : undefined;
  if (queryToken && isValidSession(queryToken)) {
    return next();
  }

  // Unauthorized
  res.status(401).json({
    error: 'Unauthorized: Private Lab authentication required',
    code: 'AUTH_REQUIRED'
  });
}
