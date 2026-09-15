import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { verifySessionToken, extractBearerToken } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { checkPersistentBlock, isSameIpReferral, recordTrafficHit, getRealIp } from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    // 1. IP Rate Limiting (max 10 redeem attempts per minute to prevent brute forcing)
    const clientIp = getClientIp(req.headers);
    const rateCheck = checkRateLimit(`redeem:${clientIp}`, 10, 60_000);
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: 'Too many invite redemption attempts. Please wait a minute.' },
        { status: 429 }
      );
    }

    // 2. Authenticate Session Token
    const authHeader = req.headers.get('authorization');
    const token = extractBearerToken(authHeader);

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: Session token required' },
        { status: 401 }
      );
    }

    const session = verifySessionToken(token);
    if (!session.valid || !session.address) {
      return NextResponse.json(
        { error: `Unauthorized: ${session.reason || 'Invalid session'}` },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { address, code } = body;

    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'Valid wallet address required' }, { status: 400 });
    }

    const normalizedAddress = address.toLowerCase();

    // 3. Ensure Session matches Address
    if (session.address !== normalizedAddress) {
      return NextResponse.json(
        { error: 'Forbidden: Session does not match requested wallet' },
        { status: 403 }
      );
    }

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,16}$/.test(cleanCode)) {
      return NextResponse.json({ error: 'Invalid invite code format' }, { status: 400 });
    }

    const db = await getDb();
    const usersCollection = db.collection('users');

    // Ban check
    const realIp = getRealIp(req.headers);
    const blockCheck = await checkPersistentBlock(realIp, normalizedAddress, db);
    if (blockCheck.blocked) {
      return NextResponse.json(
        { error: `Access denied: ${blockCheck.reason || 'This entity has been blocked'}` },
        { status: 403 }
      );
    }

    void recordTrafficHit(req.headers, '/api/referrals/redeem', db);

    const user = await usersCollection.findOne({ address: normalizedAddress });
    if (!user) {
      return NextResponse.json({ error: 'Wallet not registered. Connect wallet first.' }, { status: 404 });
    }

    if (user.referredByCode) {
      return NextResponse.json(
        { error: `You have already redeemed an invite code (${user.referredByCode}).` },
        { status: 400 }
      );
    }

    if (user.referralCode === cleanCode) {
      return NextResponse.json({ error: 'You cannot redeem your own invite code.' }, { status: 400 });
    }

    const referrer = await usersCollection.findOne({ referralCode: cleanCode });
    if (!referrer) {
      return NextResponse.json({ error: 'Invite code not found.' }, { status: 404 });
    }

    if (referrer.address === normalizedAddress) {
      return NextResponse.json({ error: 'Cannot refer yourself.' }, { status: 400 });
    }

    // Same-IP self-referral check — prevents one person creating multiple wallets to farm points
    const sameIp = await isSameIpReferral(realIp, referrer.address, db);
    if (sameIp) {
      return NextResponse.json(
        { error: 'Self-referral from the same network is not permitted.' },
        { status: 400 }
      );
    }

    // Enforce max referral cap (10 referrals per user)
    if ((referrer.referralsCount || 0) >= 10) {
      return NextResponse.json(
        { error: 'This referral link has reached its maximum use limit.' },
        { status: 400 }
      );
    }

    // 4. Atomic conditional update to prevent double redemption race conditions
    const updateResult = await usersCollection.updateOne(
      { address: normalizedAddress, referredByCode: { $in: [null, undefined] } },
      {
        $set: { referredByCode: cleanCode },
        $inc: { points: 10 },
      }
    );

    if (updateResult.modifiedCount === 0) {
      return NextResponse.json(
        { error: 'Invite code has already been redeemed.' },
        { status: 400 }
      );
    }

    // 5. Reward referrer atomically with cap
    const historyEntry = {
      id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      address: `${normalizedAddress.slice(0, 6)}...${normalizedAddress.slice(-4)}`,
      timestamp: Date.now(),
      pts: 10,
    };

    const referrerNewPoints = Math.min(2200, (referrer.points || 0) + 10);
    await usersCollection.updateOne(
      { referralCode: cleanCode },
      {
        $set: { points: referrerNewPoints },
        $inc: {
          referralsCount: 1,
          referralPoints: 10,
        },
        $push: {
          referralHistory: {
            $each: [historyEntry],
            $slice: -20,
          },
        },
      } as any
    );

    return NextResponse.json({
      success: true,
      message: `Welcome bonus unlocked! +10 wake points added from ${cleanCode}.`,
    });
  } catch (error) {
    console.error('Redeem error:', error);
    return NextResponse.json({ error: 'Failed to process invite code' }, { status: 500 });
  }
}
