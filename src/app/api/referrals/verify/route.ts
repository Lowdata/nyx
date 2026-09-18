import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req.headers);
    const rateCheck = checkRateLimit(`ref-verify:${clientIp}`, 20, 60_000);
    if (!rateCheck.success) {
      return NextResponse.json(
        { valid: false, error: 'Too many verification attempts. Please wait a moment.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ valid: false, error: 'Invite code is required' }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,16}$/.test(cleanCode)) {
      return NextResponse.json(
        { valid: false, error: 'Invalid invite code format. Check the code and try again.' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const referrer = await db.collection('users').findOne({ referralCode: cleanCode });

    if (!referrer) {
      return NextResponse.json(
        { valid: false, error: 'Invalid invite code: That summons does not exist in the dream circle.' },
        { status: 404 }
      );
    }

    if ((referrer.referralsCount || 0) >= 30) {
      return NextResponse.json(
        { valid: false, error: 'This invite code has reached its maximum limit of 30 referrals.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      code: cleanCode,
      message: `Valid code from dreamer ${referrer.address.slice(0, 6)}...${referrer.address.slice(-4)}`,
    });
  } catch (err) {
    logger.error('Referrals:verify', 'Verify referral error', err);
    return NextResponse.json({ valid: false, error: 'Failed to verify invite code' }, { status: 500 });
  }
}
