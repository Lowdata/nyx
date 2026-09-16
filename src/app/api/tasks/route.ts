import { NextRequest, NextResponse } from 'next/server';
import { getDb, DEFAULT_TASKS, ensureTasksSeeded } from '@/lib/mongodb';
import { extractBearerToken, verifySessionToken } from '@/lib/auth';
import { recordTrafficHit } from '@/lib/security';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryAddress = searchParams.get('address')?.toLowerCase();

    // Check optional bearer token
    const authHeader = req.headers.get('authorization');
    const token = extractBearerToken(authHeader);
    let sessionAddress: string | null = null;
    if (token) {
      const session = verifySessionToken(token);
      if (session.valid && session.address) {
        sessionAddress = session.address;
      }
    }

    const targetAddress = sessionAddress || queryAddress;

    let db;
    try {
      db = await getDb();
    } catch (dbErr) {
      console.warn('DB connection error in GET /api/tasks, returning fallback default tasks:', dbErr);
      return NextResponse.json({
        success: true,
        tasks: DEFAULT_TASKS.map((t) => ({
          id: t.taskId,
          icon: t.icon,
          title: t.title,
          description: t.description,
          pts: t.pts,
          intentUrl: (t as any).intentUrl,
          externalLink: (t as any).externalLink,
          type: t.type,
          order: t.order,
          isDone: false,
        })),
      });
    }

    await ensureTasksSeeded(db);
    await recordTrafficHit(req.headers, '/api/tasks', db);

    const tasksCol = db.collection('tasks');
    const tasksFromDb = await tasksCol
      .find({ active: true })
      .sort({ order: 1 })
      .toArray();

    // If address is known, fetch completed tasks for this user from userTasks
    let completedSet = new Set<string>();
    if (targetAddress) {
      const userTasksCol = db.collection('userTasks');
      const completions = await userTasksCol
        .find({ address: targetAddress })
        .toArray();
      completedSet = new Set(completions.map((c) => c.taskId as string));

      // Also check user's tasksDone map for backwards compatibility
      const usersCol = db.collection('users');
      const user = await usersCol.findOne({ address: targetAddress });
      if (user?.tasksDone) {
        for (const [taskId, isDone] of Object.entries(user.tasksDone)) {
          if (isDone) completedSet.add(taskId);
        }
      }
    }

    const formattedTasks = tasksFromDb.map((t) => ({
      id: t.taskId,
      icon: t.icon,
      title: t.title,
      description: t.description,
      pts: t.pts,
      intentUrl: t.intentUrl,
      externalLink: t.externalLink,
      type: t.type,
      order: t.order,
      isDone: completedSet.has(t.taskId),
    }));

    return NextResponse.json({
      success: true,
      tasks: formattedTasks,
    });
  } catch (error) {
    console.error('Error in GET /api/tasks:', error);
    return NextResponse.json(
      {
        success: true,
        tasks: DEFAULT_TASKS.map((t) => ({
          id: t.taskId,
          icon: t.icon,
          title: t.title,
          description: t.description,
          pts: t.pts,
          intentUrl: (t as any).intentUrl,
          externalLink: (t as any).externalLink,
          type: t.type,
          order: t.order,
          isDone: false,
        })),
      },
      { status: 200 }
    );
  }
}
