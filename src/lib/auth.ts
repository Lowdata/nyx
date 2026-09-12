import { verifyMessage, isAddress } from 'viem';
import crypto from 'crypto';

const AUTH_SECRET = process.env.AUTH_SECRET || process.env.JWT_SECRET || 'nyx-cosmic-secret-key-salt-9872134098234';

export function createSummonMessage(address: string, nonce: string, timestamp: number): string {
  return `Nyx — Wake the God of Sleep\n\nSign this message to authenticate your wallet and summon your dream circle.\n\nWallet: ${address.toLowerCase()}\nNonce: ${nonce}\nTimestamp: ${timestamp}`;
}

export function generateReferralCode(): string {
  // Generate random 6 character uppercase alphanumeric string
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude ambiguous 0, O, 1, I
  let result = 'NYX-';
  const randomBytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}

export async function verifyWalletSignature(
  address: string,
  message: string,
  signature: string
): Promise<{ valid: boolean; reason?: string; nonce?: string }> {
  if (!isAddress(address)) {
    return { valid: false, reason: 'Invalid Ethereum address format' };
  }

  if (!signature || typeof signature !== 'string') {
    return { valid: false, reason: 'Missing or malformed signature' };
  }

  // Prevent replay attacks: check timestamp window (10 minutes)
  const timestampMatch = message.match(/Timestamp:\s*(\d+)/);
  if (!timestampMatch) {
    return { valid: false, reason: 'Message missing timestamp' };
  }

  const msgTimestamp = parseInt(timestampMatch[1], 10);
  const now = Date.now();
  if (isNaN(msgTimestamp) || Math.abs(now - msgTimestamp) > 10 * 60 * 1000) {
    return { valid: false, reason: 'Signature expired (exceeded 10 minute window)' };
  }

  // Verify wallet address in message matches submitted address
  const walletMatch = message.match(/Wallet:\s*(0x[a-fA-F0-9]{40})/i);
  if (!walletMatch || walletMatch[1].toLowerCase() !== address.toLowerCase()) {
    return { valid: false, reason: 'Message wallet address mismatch' };
  }

  // Extract nonce
  const nonceMatch = message.match(/Nonce:\s*([a-zA-Z0-9_-]+)/);
  const nonce = nonceMatch ? nonceMatch[1] : undefined;

  try {
    const isValid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    return {
      valid: isValid,
      reason: isValid ? undefined : 'Cryptographic signature verification failed',
      nonce,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Verification error';
    return { valid: false, reason: msg };
  }
}

export interface SessionPayload {
  address: string;
  iat: number;
  exp: number;
}

/**
 * Creates a tamper-proof HMAC-SHA256 signed session token for verified wallets
 */
export function createSessionToken(address: string): string {
  const payload: SessionPayload = {
    address: address.toLowerCase(),
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', AUTH_SECRET);
  hmac.update(payloadB64);
  const sig = hmac.digest('base64url');

  return `${payloadB64}.${sig}`;
}

/**
 * Verifies HMAC-SHA256 session token and returns the authenticated address
 */
export function verifySessionToken(token: string): { valid: boolean; address?: string; reason?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'Token missing' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, reason: 'Invalid token format' };
  }

  const [payloadB64, providedSig] = parts;

  // Recompute HMAC signature
  const hmac = crypto.createHmac('sha256', AUTH_SECRET);
  hmac.update(payloadB64);
  const expectedSig = hmac.digest('base64url');

  // Constant-time comparison to prevent timing attacks
  const providedBuf = Buffer.from(providedSig);
  const expectedBuf = Buffer.from(expectedSig);

  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return { valid: false, reason: 'Invalid token signature' };
  }

  try {
    const payload: SessionPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (!payload.address || !payload.exp) {
      return { valid: false, reason: 'Malformed token payload' };
    }

    if (Date.now() > payload.exp) {
      return { valid: false, reason: 'Session token has expired' };
    }

    return { valid: true, address: payload.address.toLowerCase() };
  } catch {
    return { valid: false, reason: 'Corrupt token payload' };
  }
}

/**
 * Extracts Bearer token from HTTP Authorization header
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
