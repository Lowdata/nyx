import { NextRequest, NextResponse } from 'next/server';
import { getDb, DEFAULT_TASKS, ensureTasksSeeded } from '@/lib/mongodb';
import { extractBearerToken, verifySessionToken } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { checkPersistentBlock, recordTrafficHit, getRealIp } from '@/lib/security';
import { logger } from '@/lib/logger';

const MAX_TARGET_POINTS = 2200;
const FCFS_THRESHOLD = 1500; // Users at/above this earn reduced points (GTD grind mode)

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
    logger.info('Tasks:complete', `Received task "${taskId}" for wallet`, { address: normalizedAddress, taskId });

    // 3. Ensure Session Matches Address
    if (session.address !== normalizedAddress) {
      return NextResponse.json(
        { error: 'Forbidden: Session does not match requested wallet' },
        { status: 403 }
      );
    }

    const db = await getDb();

    // 4. Ban check - prevent banned actors from completing tasks
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

    // Apply GTD-grind diminishing returns: users at/above FCFS_THRESHOLD earn ~33% of normal pts
    const userForPoints = await usersCol.findOne({ address: normalizedAddress }, { projection: { points: 1 } });
    if ((userForPoints?.points ?? 0) >= FCFS_THRESHOLD) {
      pointsToAward = Math.max(1, Math.floor(pointsToAward * 0.33));
      logger.info('Tasks:complete', `GTD-grind mode: reduced task pts to ${pointsToAward}`, { address: normalizedAddress, taskId });
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
      logger.info('Tasks:complete', `Task "${taskId}" was already completed`, { address: normalizedAddress, taskId });
      return NextResponse.json({
        success: true,
        message: 'Task already completed',
        taskId,
        alreadyCompleted: true,
        user,
      });
    }

    // 6. Atomically Update User Points & tasksDone Map (primary source of truth)
    const updateResult = await usersCol.updateOne(
      {
        address: normalizedAddress,
        [`tasksDone.${taskId}`]: { $ne: true },
      },
      {
        $set: {
          [`tasksDone.${taskId}`]: true,
          lastActiveAt: Date.now(),
        },
        $inc: {
          points: pointsToAward,
        },
      }
    );

    if (updateResult.modifiedCount === 0) {
      // Task was already marked completed concurrently
      logger.info('Tasks:complete', `Task "${taskId}" was already completed concurrently`, { address: normalizedAddress, taskId });
      const currentUser = await usersCol.findOne({ address: normalizedAddress });
      return NextResponse.json({
        success: true,
        message: 'Task already completed',
        taskId,
        alreadyCompleted: true,
        user: currentUser,
      });
    }

    // 7. Record Completion in userTasks Collection (Audit log, non-blocking)
    try {
      await userTasksCol.insertOne({
        address: normalizedAddress,
        taskId,
        pts: pointsToAward,
        completedAt: Date.now(),
      });
    } catch (auditErr) {
      logger.warn('Tasks:complete', `Audit log insert skipped for "${taskId}" (non-critical)`, { address: normalizedAddress, error: auditErr });
    }

    // Atomically clamp points if they exceed MAX_TARGET_POINTS
    await usersCol.updateOne(
      { address: normalizedAddress, points: { $gt: MAX_TARGET_POINTS } },
      { $set: { points: MAX_TARGET_POINTS } }
    );

    const updatedUser = await usersCol.findOne({ address: normalizedAddress });

    logger.info('DB:tasks', `Task "${taskId}" recorded in MongoDB (${db.databaseName})`, {
      address: normalizedAddress,
      taskId,
      ptsAwarded: pointsToAward,
      newPoints: updatedUser?.points,
    });

    return NextResponse.json({
      success: true,
      taskId,
      ptsAwarded: pointsToAward,
      user: updatedUser,
    });
  } catch (error) {
    logger.error('Tasks:complete', 'Error recording task completion', error);
    return NextResponse.json({ error: 'Failed to record task completion' }, { status: 500 });
  }
}
