import type { Db } from 'mongodb';

// ─────────────────────────────────────────────────────────────────────────────
// Dead / Burn / Low-Entropy Wallet Filter
// ─────────────────────────────────────────────────────────────────────────────

const DEAD_ADDRESSES = new Set([
  '0x0000000000000000000000000000000000000000', // zero address
  '0x000000000000000000000000000000000000dead', // burn address
  '0xdeaddeaddeaddeaddeaddeaddeaddeaddead0000', // common dead variant
  '0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead', // full dead
  '0x000000000000000000000000000000000000beef', // beef address
  '0xffffffffffffffffffffffffffffffffffffffff', // max address
]);

/** Returns true if the address is safe to allow. False = reject it. */
export function isLegitWalletAddress(address: string): boolean {
  const lower = address.toLowerCase();

  // Must match standard EVM format (0x + 40 hex) or our demo prefix
  const isStandardEvm = /^0x[a-f0-9]{40}$/.test(lower);
  const isDemo = /^0xdemo_/.test(lower);

  if (!isStandardEvm && !isDemo) return false;
  if (isDemo) return true; // Demo addresses pass (they are already isolated)

  // Known dead addresses
  if (DEAD_ADDRESSES.has(lower)) return false;

  // Low-entropy check: all hex chars after 0x are the same character
  const hexPart = lower.slice(2); // strip 0x
  if (hexPart.split('').every((c) => c === hexPart[0])) return false;

  // Reject if more than 36 of 40 chars are the same (near-low-entropy)
  const charFrequency: Record<string, number> = {};
  for (const c of hexPart) {
    charFrequency[c] = (charFrequency[c] || 0) + 1;
  }
  const maxFreq = Math.max(...Object.values(charFrequency));
  if (maxFreq >= 36) return false; // e.g. 0x000...001 still mostly zero

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistent Block Check
// ─────────────────────────────────────────────────────────────────────────────

export async function checkPersistentBlock(
  ip: string,
  address: string | undefined,
  db: Db
): Promise<{ blocked: boolean; reason?: string }> {
  try {
    const col = db.collection('blockedActors');

    const targets = [ip];
    if (address) targets.push(address.toLowerCase());

    const hit = await col.findOne({ target: { $in: targets } });
    if (hit) {
      return { blocked: true, reason: hit.reason || 'Blocked by admin' };
    }
    return { blocked: false };
  } catch {
    // Never block legitimate users due to DB errors
    return { blocked: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ban / Unban Actor
// ─────────────────────────────────────────────────────────────────────────────

export async function blockActor(
  target: string,
  type: 'ip' | 'address',
  reason: string,
  db: Db
): Promise<void> {
  const col = db.collection('blockedActors');
  await col.updateOne(
    { target: target.toLowerCase() },
    {
      $set: {
        target: target.toLowerCase(),
        type,
        reason,
        blockedAt: Date.now(),
      },
    },
    { upsert: true }
  );
}

export async function unblockActor(target: string, db: Db): Promise<void> {
  const col = db.collection('blockedActors');
  await col.deleteOne({ target: target.toLowerCase() });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sybil / IP-Wallet Connection Tracking
// ─────────────────────────────────────────────────────────────────────────────

const SYBIL_THRESHOLD = 3; // > 3 distinct wallets from same IP = Sybil flag

export async function recordIpWalletConnection(
  ip: string,
  address: string,
  db: Db
): Promise<{ sybilFlagged: boolean }> {
  try {
    const col = db.collection('ipWallets');

    // Upsert the (ip, address) pair — compound unique index prevents duplicates
    await col.updateOne(
      { ip, address: address.toLowerCase() },
      {
        $setOnInsert: {
          ip,
          address: address.toLowerCase(),
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    // Count how many distinct wallets this IP has used
    const distinctCount = await col.countDocuments({ ip });

    if (distinctCount > SYBIL_THRESHOLD) {
      // Log the Sybil flag (auto-flag, but do NOT auto-ban — admin reviews first)
      const flagsCol = db.collection('sybilFlags');
      await flagsCol.updateOne(
        { ip },
        {
          $set: {
            ip,
            walletCount: distinctCount,
            flaggedAt: Date.now(),
            reviewed: false,
          },
        },
        { upsert: true }
      );
      return { sybilFlagged: true };
    }

    return { sybilFlagged: false };
  } catch {
    return { sybilFlagged: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Traffic Logging (Country, Path, UA)
// ─────────────────────────────────────────────────────────────────────────────

export async function recordTrafficHit(
  headers: Headers,
  path: string,
  db: Db
): Promise<void> {
  try {
    // Cloudflare injects these headers automatically when proxy is enabled
    const country = headers.get('cf-ipcountry') || headers.get('x-vercel-ip-country') || 'XX';
    const ip =
      headers.get('cf-connecting-ip') ||
      headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      headers.get('x-real-ip') ||
      '0.0.0.0';
    const ua = headers.get('user-agent') || '';

    const col = db.collection('trafficLogs');
    await col.insertOne({
      ip,
      country,
      path,
      ua: ua.slice(0, 200), // truncate to avoid bloat
      createdAt: new Date(), // TTL index deletes docs after 30 days
    });
  } catch {
    // Traffic logging must never break the main request
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Same-IP Self-Referral Check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the referrer's wallet was also connected from the same IP —
 * i.e. this is likely a self-referral from the same person / device.
 */
export async function isSameIpReferral(
  redeemerIp: string,
  referrerAddress: string,
  db: Db
): Promise<boolean> {
  try {
    const col = db.collection('ipWallets');
    const hit = await col.findOne({
      ip: redeemerIp,
      address: referrerAddress.toLowerCase(),
    });
    return !!hit;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cloudflare-aware IP extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts the real client IP preferring Cloudflare header first.
 * Replaces the rateLimit.ts version for security-sensitive routes.
 */
export function getRealIp(headers: Headers): string {
  return (
    headers.get('cf-connecting-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}
