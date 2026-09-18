import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { verifySessionToken, extractBearerToken } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';

const VALID_TASKS: Record<string, number> = {
  connect: 50,
  connectx: 50,
  follow: 30,
  like: 20,
  repost: 30,
  comment: 30,
  referral: 40,
};

const ALLOWED_SPIN_VALUES = new Set([10, 15, 20, 25, 30, 40, 50]);
const SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MAX_TARGET_POINTS = 2200;


export async function POST(req: NextRequest) {
  try {
    // 0. IP Rate Limiting
    const clientIp = getClientIp(req.headers);
    const rateCheck = checkRateLimit(`sync:${clientIp}`, 30, 60_000);
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429 }
      );
    }

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
    const { address, taskId, spinPoints, tweetUrl, twitterHandle } = body;

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
      logger.info('DB:sync', `Saved task to DB: "${taskId}" (+${VALID_TASKS[taskId]} pts)`, { address: normalizedAddress, taskId });

      // Record in userTasks collection
      const userTasksCollection = db.collection('userTasks');
      try {
        await userTasksCollection.insertOne({
          address: normalizedAddress,
          taskId,
          pts: VALID_TASKS[taskId],
          completedAt: Date.now(),
        });
      } catch {
        // Continue if already recorded
      }
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

    // 5. Secure Server-Enforced Tweet Verification & Global Deduplication
    if (tweetUrl && typeof tweetUrl === 'string') {
      const cleanUrl = tweetUrl.trim();
      let statusId = '';
      try {
        const parsed = new URL(cleanUrl);
        const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
        if (host !== 'twitter.com' && host !== 'x.com') {
          return NextResponse.json({ error: 'Link must be from x.com or twitter.com' }, { status: 400 });
        }
        const match = parsed.pathname.match(/\/(?:status|statuses)\/(\d+)/i);
        if (!match) {
          return NextResponse.json({ error: 'Link must be a direct tweet status URL' }, { status: 400 });
        }
        statusId = match[1];
      } catch {
        return NextResponse.json({ error: 'Invalid tweet URL format' }, { status: 400 });
      }

      if (user.tweetClaimed) {
        return NextResponse.json({ error: 'Tweet reward has already been claimed' }, { status: 400 });
      }

      // Global circle check: ensure no other user has claimed this exact tweet URL or status ID
      const existingSubmission = await usersCollection.findOne({
        $or: [
          { submittedTweetUrls: cleanUrl },
          ...(statusId ? [{ submittedTweetIds: statusId }] : []),
        ],
      });

      if (existingSubmission) {
        return NextResponse.json(
          {
            error:
              'Nyx is watching from the shadows... That prophecy has already been claimed in the dream circle. Submit your own genuine dream.',
          },
          { status: 400 }
        );
      }

      updateDoc['tweetClaimed'] = true;
      ptsToAdd += 50;

      await usersCollection.updateOne(
        { address: normalizedAddress },
        {
          $addToSet: {
            submittedTweetUrls: cleanUrl,
            ...(statusId ? { submittedTweetIds: statusId } : {}),
          },
        } as any
      );
    }

    // 6. Secure Server-Enforced Twitter Handle Connection
    if (twitterHandle && typeof twitterHandle === 'string') {
      const cleanHandle = twitterHandle.trim().replace(/^@/, '');
      if (/^[a-zA-Z0-9_]{1,15}$/.test(cleanHandle)) {
        // Enforce uniqueness: No two wallets can claim the same X handle
        const duplicateHandle = await usersCollection.findOne({
          twitterHandle: { $regex: new RegExp(`^${cleanHandle}$`, 'i') },
          address: { $ne: normalizedAddress },
        });

        if (duplicateHandle) {
          return NextResponse.json(
            { error: 'This X handle is already bound to another dream circle. Each wallet requires a unique account.' },
            { status: 400 }
          );
        }

        updateDoc['twitterHandle'] = cleanHandle;

        // If this user was a pending same-IP referral, unlock the referrer reward now!
        if (user.referralPending && user.referredByCode) {
          const referrer = await usersCollection.findOne({ referralCode: user.referredByCode });
          if (referrer && (referrer.referralsCount || 0) < 30) {
            const currentRefCount = referrer.referralsCount || 0;
            const nextRefCount = currentRefCount + 1;
            let milestoneBonus = 0;
            if (nextRefCount === 1) milestoneBonus = 20;
            else if (nextRefCount === 5) milestoneBonus = 50;
            else if (nextRefCount === 15) milestoneBonus = 100;
            else if (nextRefCount === 30) milestoneBonus = 500;

            const totalAward = 10 + milestoneBonus;
            const referrerNewPoints = Math.min(2200, (referrer.points || 0) + totalAward);

            const historyEntry = {
              id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              address: `${normalizedAddress.slice(0, 6)}...${normalizedAddress.slice(-4)}`,
              timestamp: Date.now(),
              pts: totalAward,
            };

            await usersCollection.updateOne(
              { referralCode: user.referredByCode },
              {
                $set: { points: referrerNewPoints },
                $inc: {
                  referralsCount: 1,
                  referralPoints: totalAward,
                },
                $push: {
                  referralHistory: {
                    $each: [historyEntry],
                    $slice: -20,
                  },
                },
              } as any
            );
            updateDoc['referralPending'] = false;
            logger.info('Anti-Sybil', `Pending referral unlocked via X connect (${cleanHandle})`, {
              referrerCode: user.referredByCode,
              twitterHandle: cleanHandle,
            });
          }
        }

        if (!user.tasksDone?.connectx) {
          updateDoc['tasksDone.connectx'] = true;
          ptsToAdd += VALID_TASKS['connectx'] || 50;

          const userTasksCollection = db.collection('userTasks');
          try {
            await userTasksCollection.insertOne({
              address: normalizedAddress,
              taskId: 'connectx',
              pts: VALID_TASKS['connectx'] || 50,
              completedAt: Date.now(),
            });
          } catch {
            // Already recorded
          }
        }
      }
    }

    // 7. Apply Atomic Updates
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
    logger.error('User:sync', 'User sync error', error);
    return NextResponse.json({ error: 'Failed to sync user state' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
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

    const db = await getDb();
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ address: session.address.toLowerCase() });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        address: user.address,
        referralCode: user.referralCode,
        twitterHandle: user.twitterHandle || null,
        points: user.points ?? 50,
        tasksDone: user.tasksDone || { connect: true },
        tweetClaimed: !!user.tweetClaimed,
        submittedTweetUrls: user.submittedTweetUrls || [],
        lastSpinAt: user.lastSpinAt || null,
        fcfsCelebrated: !!user.fcfsCelebrated,
        referralsCount: user.referralsCount || 0,
        referralPoints: user.referralPoints || 0,
        referredByCode: user.referredByCode || null,
        referralHistory: user.referralHistory || [],
      },
    });
  } catch (error) {
    logger.error('User:sync', 'GET /api/user/sync error', error);
    return NextResponse.json({ error: 'Failed to retrieve user' }, { status: 500 });
  }
}
