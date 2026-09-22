import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { verifyWalletSignature, generateReferralCode, createSessionToken } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import {
  isLegitWalletAddress,
  checkPersistentBlock,
  recordIpWalletConnection,
  recordTrafficHit,
  getRealIp,
} from '@/lib/security';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    // 1. IP Rate Limiting (20 attempts per minute)
    const clientIp = getClientIp(req.headers);
    const rateCheck = checkRateLimit(`auth:${clientIp}`, 20, 60_000);
    if (!rateCheck.success) {
      logger.warn('Auth:wallet', 'Rate limit exceeded for IP', { clientIp });
      return NextResponse.json(
        { error: 'Too many authentication attempts. Please wait a moment.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { address, signature, message, refCode, isDemo } = body;

    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'Valid wallet address is required' }, { status: 400 });
    }

    const normalizedAddress = address.toLowerCase();

    // 1. Dead / burn / low-entropy wallet filter
    if (!isLegitWalletAddress(normalizedAddress)) {
      return NextResponse.json(
        { error: 'Suspicious or invalid wallet address. Zero addresses and burn wallets are not permitted.' },
        { status: 400 }
      );
    }

    // 3. Security Check on Address format
    const isStandardEvm = /^0x[a-f0-9]{40}$/i.test(normalizedAddress);
    const isDemoAddress = /^0xdemo_[a-f0-9]{4,32}$/i.test(normalizedAddress);

    if (!isStandardEvm && !isDemoAddress) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    const db = await getDb();

    // 4. Persistent ban check - runs before any DB user lookup
    const realIp = getRealIp(req.headers);
    const blockCheck = await checkPersistentBlock(realIp, normalizedAddress, db);
    if (blockCheck.blocked) {
      return NextResponse.json(
        { error: `Access denied: ${blockCheck.reason || 'This entity has been blocked'}` },
        { status: 403 }
      );
    }

    const usersCollection = db.collection('users');
    const usedNoncesCollection = db.collection('usedNonces');

    // 3. Demo Mode Containment: Only permitted in local development
    if (isDemo) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Demo mode is only permitted in local development.' },
          { status: 403 }
        );
      }
      if (!isDemoAddress) {
        return NextResponse.json(
          { error: 'Standard wallet addresses require verified cryptographic signatures.' },
          { status: 403 }
        );
      }
    } else {
      // 4. Strict Cryptographic Signature Verification
      if (!signature || !message) {
        return NextResponse.json({ error: 'Signature and message are required' }, { status: 400 });
      }

      const verification = await verifyWalletSignature(normalizedAddress, message, signature);
      if (!verification.valid) {
        return NextResponse.json(
          { error: verification.reason || 'Cryptographic verification failed' },
          { status: 401 }
        );
      }

      // 5. Anti-Replay: Atomically consume nonce to prevent race condition replays
      if (verification.nonce) {
        try {
          await usedNoncesCollection.insertOne({
            nonce: verification.nonce,
            address: normalizedAddress,
            createdAt: new Date(),
          });
        } catch {
          logger.warn('Auth:wallet', 'Signature replay attempt detected', {
            nonce: verification.nonce,
            address: normalizedAddress,
          });
          return NextResponse.json(
            { error: 'Signature replay detected. Please sign a fresh request.' },
            { status: 403 }
          );
        }
      }
    }

    // 6. Issue tamper-proof HMAC-SHA256 session token
    const sessionToken = createSessionToken(normalizedAddress);

    // 7. Check if user already exists
    const existingUser = await usersCollection.findOne({ address: normalizedAddress });

    if (existingUser) {
      await usersCollection.updateOne(
        { address: normalizedAddress },
        { $set: { lastAuthAt: Date.now(), lastIp: realIp } }
      );

      // Record this IP-wallet connection for Sybil tracking and traffic analytics
      await Promise.allSettled([
        recordIpWalletConnection(realIp, normalizedAddress, db),
        recordTrafficHit(req.headers, '/api/auth/wallet', db),
      ]);

      logger.info('Auth:wallet', `Authenticated existing wallet`, { address: normalizedAddress, ip: realIp });

      return NextResponse.json({
        success: true,
        sessionToken,
        user: {
          address: existingUser.address,
          twitterHandle: existingUser.twitterHandle || null,
          referralCode: existingUser.referralCode,
          points: existingUser.points ?? 50,
          tasksDone: existingUser.tasksDone || { connect: true },
          tweetClaimed: !!existingUser.tweetClaimed,
          submittedTweetUrls: existingUser.submittedTweetUrls || [],
          lastSpinAt: existingUser.lastSpinAt || null,
          fcfsCelebrated: !!existingUser.fcfsCelebrated,
          referralsCount: existingUser.referralsCount || 0,
          referralPoints: existingUser.referralPoints || 0,
          referredByCode: existingUser.referredByCode || null,
          referralHistory: existingUser.referralHistory || [],
        },
      });
    }

    // 8. Generate unique referral code
    let refCodeCandidate = generateReferralCode();
    let collision = await usersCollection.findOne({ referralCode: refCodeCandidate });
    let attempts = 0;
    while (collision && attempts < 10) {
      refCodeCandidate = generateReferralCode();
      collision = await usersCollection.findOne({ referralCode: refCodeCandidate });
      attempts++;
    }

    let initialPoints = 50; // Wallet connect task reward
    let appliedRefCode: string | null = null;

    // 9. Handle invite code if provided during first connect
    let referralPending = false;
    if (refCode && typeof refCode === 'string') {
      const cleanRef = refCode.trim().toUpperCase();
      if (/^[A-Z0-9-]{4,16}$/.test(cleanRef) && cleanRef !== refCodeCandidate) {
        const referrer = await usersCollection.findOne({ referralCode: cleanRef });
        if (referrer && referrer.address !== normalizedAddress) {
          appliedRefCode = cleanRef;
          initialPoints += 10; // Welcome invite bonus (10 pts) for referee

          // Max referral limit: 30
          const currentRefCount = referrer.referralsCount || 0;

          if (currentRefCount >= 30) {
            logger.info('Referrals:cap', `Referrer ${cleanRef} already reached max 30 referrals`, {
              referee: normalizedAddress,
              referrer: referrer.address,
              currentRefCount,
            });
            // Referrer has already maxed out 30 referrals, do not queue pending or award referrer
            referralPending = false;
          } else {
            // Atomically reserve 1 of the 30 referral slots (guarantees referralsCount never exceeds 30)
            const updatedReferrer = await usersCollection.findOneAndUpdate(
              {
                referralCode: cleanRef,
                $or: [{ referralsCount: { $lt: 30 } }, { referralsCount: { $exists: false } }],
              },
              {
                $inc: { referralsCount: 1 },
              },
              { returnDocument: 'after' }
            );

            if (updatedReferrer) {
              const nextRefCount = updatedReferrer.referralsCount || 1;
              let milestoneBonus = 0;
              // Calibrated Milestones: 1 friend (+20), 5 friends (+50), 15 friends (+100), 30 friends (+500)
              if (nextRefCount === 1) milestoneBonus = 20;
              else if (nextRefCount === 5) milestoneBonus = 50;
              else if (nextRefCount === 15) milestoneBonus = 100;
              else if (nextRefCount === 30) milestoneBonus = 500;

              const totalAward = 10 + milestoneBonus;
              const historyEntry = {
                id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                address: `${normalizedAddress.slice(0, 6)}...${normalizedAddress.slice(-4)}`,
                timestamp: Date.now(),
                pts: totalAward,
              };

              // Atomically award points and push history (no lost updates)
              await usersCollection.updateOne(
                { referralCode: cleanRef },
                {
                  $inc: {
                    points: totalAward,
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

              // Atomically clamp referrer points to 2200
              await usersCollection.updateOne(
                { referralCode: cleanRef, points: { $gt: 2200 } },
                { $set: { points: 2200 } }
              );
            }
          }
        }
      }
    }

    const newUser = {
      address: normalizedAddress,
      referralCode: refCodeCandidate,
      points: initialPoints,
      tasksDone: {
        connect: true,
        connectx: false,
        follow: false,
        like: false,
        repost: false,
        comment: false,
        post_traits: false,
        referral: false,
      },
      twitterHandle: null,
      tweetClaimed: false,
      submittedTweetUrls: [],
      lastSpinAt: null,
      fcfsCelebrated: false,
      referralsCount: 0,
      referralPoints: 0,
      referredByCode: appliedRefCode,
      referralPending: referralPending,
      referralHistory: [],
      registrationIp: realIp,
      lastIp: realIp,
      createdAt: Date.now(),
      lastAuthAt: Date.now(),
      isDemo: !!isDemo,
    };

    await usersCollection.insertOne(newUser);

    logger.info('DB:users', `Registered new wallet in MongoDB`, {
      address: normalizedAddress,
      referralCode: refCodeCandidate,
      referredBy: appliedRefCode,
      ip: realIp,
    });

    // Record IP-wallet connection for Sybil tracking and traffic log
    await Promise.allSettled([
      recordIpWalletConnection(realIp, normalizedAddress, db),
      recordTrafficHit(req.headers, '/api/auth/wallet', db),
    ]);

    return NextResponse.json({
      success: true,
      sessionToken,
      user: {
        address: newUser.address,
        twitterHandle: null,
        referralCode: newUser.referralCode,
        points: newUser.points,
        tasksDone: newUser.tasksDone,
        tweetClaimed: newUser.tweetClaimed,
        submittedTweetUrls: newUser.submittedTweetUrls,
        lastSpinAt: newUser.lastSpinAt,
        fcfsCelebrated: newUser.fcfsCelebrated,
        referralsCount: newUser.referralsCount,
        referralPoints: newUser.referralPoints,
        referredByCode: newUser.referredByCode,
        referralHistory: newUser.referralHistory,
      },
    });
  } catch (error) {
    logger.error('Auth:wallet', 'Wallet auth error', error);
    return NextResponse.json({ error: 'Internal server error during authentication' }, { status: 500 });
  }
}
