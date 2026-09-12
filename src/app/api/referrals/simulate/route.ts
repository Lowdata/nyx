import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { verifySessionToken, extractBearerToken } from '@/lib/auth';

const MAX_TARGET_POINTS = 2200;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = extractBearerToken(authHeader);

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: Session token required' }, { status: 401 });
    }

    const session = verifySessionToken(token);
    if (!session.valid || !session.address) {
      return NextResponse.json({ error: 'Unauthorized: Invalid session' }, { status: 401 });
    }

    const body = await req.json();
    const { address } = body;

    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'Valid wallet address required' }, { status: 400 });
    }

    const normalizedAddress = address.toLowerCase();

    if (session.address !== normalizedAddress) {
      return NextResponse.json(
        { error: 'Forbidden: Session does not match requested wallet' },
        { status: 403 }
      );
    }

    const db = await getDb();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ address: normalizedAddress });
    if (!user) {
      return NextResponse.json({ error: 'User not found. Connect wallet first.' }, { status: 404 });
    }

    const randomHex = Math.random().toString(16).substring(2, 6);
    const mockAddress = `0x${randomHex}...${Math.random().toString(16).substring(2, 6)}`;
    const pts = 100;

    const historyItem = {
      id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      address: mockAddress,
      timestamp: Date.now(),
      pts,
    };

    const currentPoints = user.points || 0;
    const newPoints = Math.min(MAX_TARGET_POINTS, currentPoints + pts);

    await usersCollection.updateOne(
      { address: normalizedAddress },
      {
        $set: { points: newPoints },
        $inc: {
          referralsCount: 1,
          referralPoints: pts,
        },
        $push: {
          referralHistory: {
            $each: [historyItem],
            $slice: -20,
          },
        },
      } as any
    );

    return NextResponse.json({
      success: true,
      pts,
      address: mockAddress,
    });
  } catch (error) {
    console.error('Simulate referral error:', error);
    return NextResponse.json({ error: 'Failed to simulate referral' }, { status: 500 });
  }
}
