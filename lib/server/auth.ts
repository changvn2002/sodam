import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { prisma } from './prisma';
import { unauthorized } from './errors';

const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days, like a typical app session

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET is not set — refusing to sign tokens with a guessable secret.');
    }
    return new TextEncoder().encode('dev-only-insecure-secret-change-me');
  }
  return new TextEncoder().encode(secret);
}

/** Hash a password with scrypt (built into Node — no native dependency). Stored as `scrypt$<salt>$<hash>` hex. */
export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string) {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

export async function issueToken(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS)
    .sign(authSecret());
}

/**
 * Resolve the signed-in user from the `Authorization: Bearer <jwt>` header —
 * the standalone equivalent of the host's JwtAuthGuard + @CurrentUser.
 */
export async function requireUser(req: Request) {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!token) throw unauthorized();
  let userId: string | undefined;
  try {
    const { payload } = await jwtVerify(token, authSecret());
    userId = typeof payload.sub === 'string' ? payload.sub : undefined;
  } catch {
    throw unauthorized();
  }
  if (!userId) throw unauthorized();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthorized();
  return user;
}
