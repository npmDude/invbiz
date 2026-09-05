import type { Request, Response } from 'express';

import { REFRESH_TOKEN_TTL_MS } from './auth.jwt';

const REFRESH_TOKEN_COOKIE = 'refreshToken';

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: '/',
  };
}

export function setRefreshTokenCookie(res: Response, token: string) {
  res.cookie(REFRESH_TOKEN_COOKIE, token, cookieOptions());
}

export function clearRefreshTokenCookie(res: Response) {
  res.clearCookie(REFRESH_TOKEN_COOKIE, cookieOptions());
}

/**
 * Resolve the refresh token from the HttpOnly cookie (browser clients)
 * or the request body (mobile and other API clients).
 */
export function resolveRefreshToken(req: Request): string | undefined {
  const fromCookie =
    typeof req.cookies?.[REFRESH_TOKEN_COOKIE] === 'string'
      ? (req.cookies[REFRESH_TOKEN_COOKIE] as string)
      : undefined;

  const fromBody =
    typeof req.body?.refreshToken === 'string'
      ? (req.body.refreshToken as string)
      : undefined;

  return fromCookie ?? fromBody;
}
