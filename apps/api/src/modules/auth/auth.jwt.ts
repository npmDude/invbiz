import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export type AccessTokenPayload = JWTPayload & {
  sub: string;
  type: 'access';
};

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error('JWT_SECRET is not configured');
}

const secret = new TextEncoder().encode(jwtSecret);

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

  return payload;
}
