import { NextRequest, NextResponse } from 'next/server';
import { getDb, DEFAULT_TASKS, ensureTasksSeeded } from '@/lib/mongodb';
import { extractBearerToken, verifySessionToken } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { checkPersistentBlock, recordTrafficHit, getRealIp } from '@/lib/security';

const MAX_TARGET_POINTS = 2200;

export async function POST(req: NextRequest) {
  try {
    // 1. IP Rate Limiting
    const clientIp = getClientIp(req.headers);
    const rateCheck = checkRateLimit(`task_complete:${clientIp}`, 30, 60_000);
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: 'Too many completion attempts. Please wait a moment.' },
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
    const { address, taskId } = body;

    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'Valid wallet address required' }, { status: 400 });
    }

    if (!taskId || typeof taskId !== 'string') {
      return NextResponse.json({ error: 'Valid taskId required' }, { status: 400 });
    }

    const normalizedAddress = address.toLowerCase();

    // 3. Ensure Session Matches Address
    if (session.address !== normalizedAddress) {
      return NextResponse.json(
        { error: 'Forbidden: Session does not match requested wallet' },
        { status: 403 }
      );
    }

    const db = await getDb();

    // 4. Ban check — prevent banned actors from completing tasks
    const realIp = getRealIp(req.headers);
    const blockCheck = await checkPersistentBlock(realIp, normalizedAddress, db);
    if (blockCheck.blocked) {
      return NextResponse.json(
        { error: `Access denied: ${blockCheck.reason || 'This entity has been blocked'}` },
        { status: 403 }
      );
    }

    await recordTrafficHit(req.headers, '/api/tasks/complete', db);

    await ensureTasksSeeded(db);

    const tasksCol = db.collection('tasks');
    const userTasksCol = db.collection('userTasks');
    const usersCol = db.collection('users');

    // 4. Verify Task Definition
    const taskDef = await tasksCol.findOne({ taskId, active: true });
    let pointsToAward: number | null = typeof taskDef?.pts === 'number' ? taskDef.pts : null;

    if (pointsToAward === null) {
      const fallbackDef = DEFAULT_TASKS.find((t) => t.taskId === taskId);
      if (!fallbackDef) {
        return NextResponse.json({ error: 'Invalid or unknown taskId' }, { status: 400 });
      }
      pointsToAward = fallbackDef.pts;
    }

    // 5. Verify Idempotency in userTasks collection
    const existingCompletion = await userTasksCol.findOne({
      address: normalizedAddress,
      taskId,
    });

    const user = await usersCol.findOne({ address: normalizedAddress });
    if (!user) {
      return NextResponse.json({ error: 'User not found. Connect wallet first.' }, { status: 404 });
    }

    if (taskId === 'referral' && (!user.referralsCount || user.referralsCount < 1)) {
      return NextResponse.json(
        { error: 'Referral quest unlocks only when a friend joins using your summon code.' },
        { status: 400 }
      );
    }

    if (existingCompletion || (user.tasksDone && user.tasksDone[taskId])) {
      return NextResponse.json({
        success: true,
        message: 'Task already completed',
        taskId,
        alreadyCompleted: true,
        user,
      });
    }

    // 6. Record Completion in userTasks Collection
    const completionRecord = {
      address: normalizedAddress,
      taskId,
      pts: pointsToAward,
      completedAt: Date.now(),
    };

    try {
      await userTasksCol.insertOne(completionRecord);
    } catch {
      // Compound index collision indicates concurrent claim
      return NextResponse.json({
        success: true,
        message: 'Task already completed',
        taskId,
        alreadyCompleted: true,
        user,
      });
    }

    // 7. Atomically Update User Points & tasksDone Map
    const currentPoints = user.points || 0;
    const newPoints = Math.min(MAX_TARGET_POINTS, currentPoints + pointsToAward);

    await usersCol.updateOne(
      { address: normalizedAddress },
      {
        $set: {
          [`tasksDone.${taskId}`]: true,
          points: newPoints,
          lastActiveAt: Date.now(),
        },
      }
    );

    const updatedUser = await usersCol.findOne({ address: normalizedAddress });

    return NextResponse.json({
      success: true,
      taskId,
      ptsAwarded: pointsToAward,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Task complete error:', error);
    return NextResponse.json({ error: 'Failed to record task completion' }, { status: 500 });
  }
}
