import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME || process.env.MONGODB_DB_NAME;

if (!uri) {
  throw new Error('MONGO_URI environment variable is not set.');
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const mongoOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 15000, // 15 seconds to allow cold starts and replica set election
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
};

if (!global._mongoClientPromise) {
  const client = new MongoClient(uri, mongoOptions);
  global._mongoClientPromise = client.connect().catch((err) => {
    // Reset cache so subsequent serverless invocations can re-attempt cleanly
    global._mongoClientPromise = undefined;
    throw err;
  });
}
const clientPromise: Promise<MongoClient> = global._mongoClientPromise!;

export const DEFAULT_TASKS = [
  {
    taskId: 'connect',
    title: 'Connect & sign wallet',
    description: 'Verify your wallet signature to awaken your dream circle',
    icon: '🔗',
    pts: 50,
    type: 'wallet' as const,
    order: 1,
    active: true,
  },
  {
    taskId: 'connectx',
    title: 'Connect X account',
    description: 'Link your X handle to awaken your social dream bond',
    icon: '𝕏',
    pts: 50,
    type: 'social' as const,
    order: 2,
    active: true,
  },
  {
    taskId: 'follow',
    title: 'Follow @enternyx on X',
    description: 'Follow the official Nyx page on X',
    icon: '✕',
    pts: 30,
    type: 'twitter_intent' as const,
    intentUrl: 'https://twitter.com/intent/follow?screen_name=enternyx',
    order: 3,
    active: true,
  },
  {
    taskId: 'like',
    title: 'Like Tweet',
    description: 'Like the latest post from @enternyx on X',
    icon: '♥',
    pts: 20,
    type: 'twitter_intent' as const,
    intentUrl: 'https://twitter.com/intent/like?tweet_id=2102045565823401990',
    order: 4,
    active: true,
  },
  {
    taskId: 'repost',
    title: 'Retweet the Tweet',
    description: 'Repost the latest summons from @enternyx on X',
    icon: '↻',
    pts: 30,
    type: 'twitter_intent' as const,
    intentUrl: 'https://twitter.com/intent/retweet?tweet_id=2102045565823401990',
    order: 5,
    active: true,
  },
  {
    taskId: 'comment',
    title: 'Tweet about Nyx',
    description: 'Share your awakening and post about Nyx on X',
    icon: '💬',
    pts: 30,
    type: 'twitter_intent' as const,
    intentUrl: 'https://twitter.com/intent/tweet?text=Awakening%20with%20%40enternyx%20%F0%9F%8C%99%20Enter%20the%20dream%20circle%20and%20claim%20your%20wake%20points%3A%20https%3A%2F%2Fnyx.town&in_reply_to=2102045565823401990',
    order: 6,
    active: true,
  },
  {
    taskId: 'referral',
    title: 'Grab your referral link',
    description: 'Invite companions to unlock bonus wake points',
    icon: '🎁',
    pts: 40,
    type: 'referral' as const,
    order: 7,
    active: true,
  },
];

export async function ensureTasksSeeded(db: Db): Promise<void> {
  try {
    const tasksCol = db.collection('tasks');
    // Upsert each default task so existing DB instances reflect updated titles & tasks
    for (const t of DEFAULT_TASKS) {
      await tasksCol.updateOne(
        { taskId: t.taskId },
        {
          $set: {
            title: t.title,
            description: t.description,
            icon: t.icon,
            pts: t.pts,
            type: t.type,
            intentUrl: (t as { intentUrl?: string }).intentUrl,
            order: t.order,
            active: true,
            updatedAt: Date.now(),
          },
          $setOnInsert: {
            createdAt: Date.now(),
          },
        },
        { upsert: true }
      );
    }
    // Deactivate discord task if present in database
    await tasksCol.updateOne({ taskId: 'discord' }, { $set: { active: false } });
  } catch {
    // Graceful fallback if concurrent or network issue
  }
}

let indexesInitialized = false;

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  const db = client.db(dbName || undefined);

  if (!indexesInitialized) {
    try {
      await db.collection('users').createIndex({ address: 1 }, { unique: true });
      await db.collection('users').createIndex({ referralCode: 1 }, { unique: true });
      await db.collection('users').createIndex({ twitterHandle: 1 }, { unique: true, sparse: true });
      await db.collection('users').createIndex({ referredByCode: 1 });
      await db.collection('users').createIndex({ submittedTweetUrls: 1 });
      await db.collection('users').createIndex({ submittedTweetIds: 1 });
      await db.collection('usedNonces').createIndex({ nonce: 1 }, { unique: true });
      await db.collection('usedNonces').createIndex({ createdAt: 1 }, { expireAfterSeconds: 900 });
      await db.collection('tasks').createIndex({ taskId: 1 }, { unique: true });
      await db.collection('tasks').createIndex({ active: 1, order: 1 });
      await db.collection('userTasks').createIndex({ address: 1, taskId: 1 }, { unique: true });
      await db.collection('userTasks').createIndex({ address: 1 });
      await db.collection('userTasks').createIndex({ taskId: 1 });

      // ── Security collections ──────────────────────────────────────────────
      // blockedActors: persistent bans for IPs and wallet addresses
      await db.collection('blockedActors').createIndex({ target: 1 }, { unique: true });
      await db.collection('blockedActors').createIndex({ type: 1, blockedAt: -1 });

      // ipWallets: Sybil tracking - maps each (IP, address) pair
      await db.collection('ipWallets').createIndex({ ip: 1 });
      await db.collection('ipWallets').createIndex({ ip: 1, address: 1 }, { unique: true });
      // TTL: auto-delete after 7 days to keep data fresh and compliant
      await db.collection('ipWallets').createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: 7 * 24 * 60 * 60 }
      );

      // sybilFlags: flagged IPs for admin review
      await db.collection('sybilFlags').createIndex({ ip: 1 }, { unique: true });
      await db.collection('sybilFlags').createIndex({ reviewed: 1, flaggedAt: -1 });

      // trafficLogs: geo-analytics - auto-expire after 30 days
      await db.collection('trafficLogs').createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: 30 * 24 * 60 * 60 }
      );
      await db.collection('trafficLogs').createIndex({ country: 1, path: 1 });
      // ─────────────────────────────────────────────────────────────────────

      await ensureTasksSeeded(db);
      indexesInitialized = true;
    } catch {
      // Indexes already exist or initialized concurrently
      indexesInitialized = true;
    }
  }

  return db;
}

export default clientPromise;
