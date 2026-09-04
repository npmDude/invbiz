import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export type AccessTokenPayload = JWTPayload & {
  sub: string;
  type: 'access';
};

export type RefreshTokenPayload = JWTPayload & {
  sub: string;
  type: 'refresh';
  jti: string;
};

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error('JWT_SECRET is not configured');
}

const secret = new TextEncoder().encode(jwtSecret);

export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function signAccessToken(userId: string) {
  return new SignJWT({
    sub: userId,
    type: 'access',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret);
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ['HS256'],
  });

  if (payload.type !== 'access') {
    throw new Error('Invalid access token');
  }

  if (typeof payload.sub !== 'string') {
    throw new Error('Invalid access token');
  }

  return payload as AccessTokenPayload;
}

export async function signRefreshToken(userId: string, jti: string) {
  return new SignJWT({
    sub: userId,
    type: 'refresh',
    jti,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(new Date(Date.now() + REFRESH_TOKEN_TTL_MS))
    .sign(secret);
}

export async function verifyRefreshToken(token: string) {
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ['HS256'],
  });

  if (payload.type !== 'refresh') {
    throw new Error('Invalid refresh token');
  }

  if (typeof payload.sub !== 'string') {
    throw new Error('Invalid refresh token');
  }

  if (typeof payload.jti !== 'string') {
    throw new Error('Invalid refresh token');
  }

  return payload as RefreshTokenPayload;
}
