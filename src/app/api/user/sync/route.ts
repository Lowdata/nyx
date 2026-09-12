import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { verifySessionToken, extractBearerToken } from '@/lib/auth';

const VALID_TASKS: Record<string, number> = {
  connect: 150,
  connectx: 200,
  follow: 100,
  like: 50,
  repost: 100,
  comment: 50,
  discord: 150,
  referral: 100,
};

const ALLOWED_SPIN_VALUES = new Set([25, 50, 75, 100, 150, 200]);
const SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MAX_TARGET_POINTS = 2200;

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate with Session Token
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
    const { address, taskId, spinPoints, tweetUrl } = body;

    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'Valid wallet address required' }, { status: 400 });
    }

    const normalizedAddress = address.toLowerCase();

    // 2. Strict Session-to-Address Binding Check
    if (session.address !== normalizedAddress) {
      return NextResponse.json(
        { error: 'Forbidden: Session does not match requested wallet address' },
        { status: 403 }
      );
    }

    const db = await getDb();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ address: normalizedAddress });
    if (!user) {
      return NextResponse.json({ error: 'User not found. Connect wallet first.' }, { status: 404 });
    }

    const updateDoc: Record<string, unknown> = {};
    let ptsToAdd = 0;

    // 3. Secure Server-Enforced Task Processing
    if (taskId && typeof taskId === 'string') {
      if (!(taskId in VALID_TASKS)) {
        return NextResponse.json({ error: 'Invalid quest task ID' }, { status: 400 });
      }

      // Verify idempotency: do not award if already done
      if (user.tasksDone && user.tasksDone[taskId]) {
        return NextResponse.json({
          success: true,
          message: 'Task already completed',
          user,
        });
      }

      updateDoc[`tasksDone.${taskId}`] = true;
      ptsToAdd += VALID_TASKS[taskId];
    }

    // 4. Secure Server-Enforced Spin Processing
    if (typeof spinPoints === 'number' && spinPoints > 0) {
      if (!ALLOWED_SPIN_VALUES.has(spinPoints)) {
        return NextResponse.json({ error: 'Invalid spin prize value' }, { status: 400 });
      }

      // Check 24-hour spin cooldown
      if (user.lastSpinAt && Date.now() - user.lastSpinAt < SPIN_COOLDOWN_MS) {
        return NextResponse.json(
          { error: 'Wheel cooldown active. You can spin once every 24 hours.' },
          { status: 400 }
        );
      }

      updateDoc['lastSpinAt'] = Date.now();
      ptsToAdd += spinPoints;
    }

    // 5. Secure Server-Enforced Tweet Verification
    if (tweetUrl && typeof tweetUrl === 'string') {
      const cleanUrl = tweetUrl.trim();
      try {
        const parsed = new URL(cleanUrl);
        const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
        if (host !== 'twitter.com' && host !== 'x.com') {
          return NextResponse.json({ error: 'Link must be from x.com or twitter.com' }, { status: 400 });
        }
        if (!/\/[^/]+\/status(es)?\/\d+/i.test(parsed.pathname)) {
          return NextResponse.json({ error: 'Link must be a direct tweet status URL' }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: 'Invalid tweet URL format' }, { status: 400 });
      }

      if (user.tweetClaimed) {
        return NextResponse.json({ error: 'Tweet reward has already been claimed' }, { status: 400 });
      }

      updateDoc['tweetClaimed'] = true;
      ptsToAdd += 50;

      await usersCollection.updateOne(
        { address: normalizedAddress },
        {
          $addToSet: { submittedTweetUrls: cleanUrl },
        } as any
      );
    }

    // 6. Apply Atomic Updates
    const currentPoints = user.points || 0;
    const newPoints = Math.min(MAX_TARGET_POINTS, currentPoints + ptsToAdd);
    if (ptsToAdd > 0) {
      updateDoc['points'] = newPoints;
    }

    if (Object.keys(updateDoc).length > 0) {
      await usersCollection.updateOne(
        { address: normalizedAddress },
        { $set: updateDoc }
      );
    }

    const updatedUser = await usersCollection.findOne({ address: normalizedAddress });
    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('User sync error:', error);
    return NextResponse.json({ error: 'Failed to sync user state' }, { status: 500 });
  }
}
