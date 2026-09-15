import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { blockActor, unblockActor } from '@/lib/security';

import crypto from 'crypto';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

const ADMIN_SECRET = process.env.ADMIN_SECRET;

function verifyAdmin(req: NextRequest): boolean {
  if (!ADMIN_SECRET) return false;

  // Rate limit admin attempts (15 attempts per minute per IP to prevent brute force)
  const clientIp = getClientIp(req.headers);
  const rateCheck = checkRateLimit(`admin_auth:${clientIp}`, 15, 60_000);
  if (!rateCheck.success) return false;

  const authHeader = req.headers.get('authorization');
  if (!authHeader) return false;
  const token = (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader).trim();
  const secret = ADMIN_SECRET.trim();

  const tokenBuf = Buffer.from(token);
  const secretBuf = Buffer.from(secret);
  if (tokenBuf.length !== secretBuf.length) return false;

  return crypto.timingSafeEqual(tokenBuf, secretBuf);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/security — full security dashboard snapshot
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getDb();

    // 1. All blocked actors (IPs + wallets)
    const blockedActors = await db
      .collection('blockedActors')
      .find({})
      .sort({ blockedAt: -1 })
      .toArray();

    // 2. Sybil flags — IPs with more than SYBIL_THRESHOLD wallets
    const sybilFlags = await db
      .collection('sybilFlags')
      .find({})
      .sort({ walletCount: -1, flaggedAt: -1 })
      .toArray();

    // 3. Country analytics — aggregate trafficLogs by country
    const countryPipeline = [
      { $group: { _id: '$country', hits: { $sum: 1 } } },
      { $sort: { hits: -1 } },
      { $limit: 50 },
    ];
    const countryAnalytics = await db
      .collection('trafficLogs')
      .aggregate(countryPipeline)
      .toArray();

    // 4. Endpoint analytics — traffic by path
    const pathPipeline = [
      { $group: { _id: '$path', hits: { $sum: 1 } } },
      { $sort: { hits: -1 } },
    ];
    const pathAnalytics = await db
      .collection('trafficLogs')
      .aggregate(pathPipeline)
      .toArray();

    // 5. Recent 50 traffic requests
    const recentTraffic = await db
      .collection('trafficLogs')
      .find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    // 6. Total user count + demo vs real breakdown
    const totalUsers = await db.collection('users').countDocuments();
    const demoUsers = await db.collection('users').countDocuments({ isDemo: true });
    const realUsers = totalUsers - demoUsers;

    // 7. Distinct IP counts in ipWallets
    const ipWalletStats = await db
      .collection('ipWallets')
      .aggregate([
        { $group: { _id: '$ip', walletCount: { $sum: 1 }, addresses: { $push: '$address' } } },
        { $sort: { walletCount: -1 } },
        { $limit: 50 },
      ])
      .toArray();

    return NextResponse.json({
      success: true,
      snapshot: {
        totalUsers,
        realUsers,
        demoUsers,
      },
      blockedActors,
      sybilFlags,
      countryAnalytics: countryAnalytics.map((r) => ({ country: r._id, hits: r.hits })),
      pathAnalytics: pathAnalytics.map((r) => ({ path: r._id, hits: r.hits })),
      recentTraffic,
      ipWalletStats,
    });
  } catch (err) {
    console.error('Admin security GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/security — ban or unban actors
// Body: { action: 'ban' | 'unban', target: string, type?: 'ip' | 'address', reason?: string }
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, target, type, reason } = body;

    if (!action || !target || typeof target !== 'string') {
      return NextResponse.json({ error: 'action and target are required' }, { status: 400 });
    }

    const db = await getDb();

    if (action === 'ban') {
      if (!type || !['ip', 'address'].includes(type)) {
        return NextResponse.json(
          { error: 'type must be "ip" or "address" when banning' },
          { status: 400 }
        );
      }
      await blockActor(target, type as 'ip' | 'address', reason || 'Banned by admin', db);
      return NextResponse.json({ success: true, message: `${type} "${target}" has been banned.` });
    }

    if (action === 'unban') {
      await unblockActor(target, db);
      return NextResponse.json({ success: true, message: `"${target}" has been unbanned.` });
    }

    if (action === 'review_sybil') {
      await db.collection('sybilFlags').updateOne({ ip: target }, { $set: { reviewed: true } });
      return NextResponse.json({ success: true, message: `Sybil flag for "${target}" marked as reviewed.` });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('Admin security POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
