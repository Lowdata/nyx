import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGO_URI;

if (!uri) {
  throw new Error('Please define the MONGO_URI environment variable inside .env');
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 5000,
  });
  clientPromise = client.connect();
}

export const DEFAULT_TASKS = [
  {
    taskId: 'connect',
    title: 'Connect & sign wallet',
    description: 'Verify your wallet signature to awaken your dream circle',
    icon: '🔗',
    pts: 150,
    type: 'wallet' as const,
    order: 1,
    active: true,
  },
  {
    taskId: 'follow',
    title: 'Follow @enternyx on X',
    description: 'Follow the official Nyx page on X',
    icon: '✕',
    pts: 100,
    type: 'twitter_intent' as const,
    intentUrl: 'https://twitter.com/intent/follow?screen_name=enternyx',
    order: 2,
    active: true,
  },
  {
    taskId: 'like',
    title: 'Like the summons',
    description: 'Like the latest summons from @enternyx on X',
    icon: '♥',
    pts: 100,
    type: 'twitter_intent' as const,
    intentUrl: 'https://x.com/enternyx',
    order: 3,
    active: true,
  },
  {
    taskId: 'repost',
    title: 'Repost the summons',
    description: 'Spread the Nyx prophecy across X',
    icon: '↻',
    pts: 100,
    type: 'twitter_intent' as const,
    intentUrl: 'https://twitter.com/intent/tweet?text=Nyx%20is%20dreaming...%20Wake%20the%20God%20of%20Sleep%20%F0%9F%8C%99%20%40enternyx%20https%3A%2F%2Fnyx.gg',
    order: 4,
    active: true,
  },
  {
    taskId: 'comment',
    title: 'Comment your dream',
    description: 'Tell Nyx what you see in the dreaming realm',
    icon: '💬',
    pts: 100,
    type: 'twitter_intent' as const,
    intentUrl: 'https://twitter.com/intent/tweet?text=%40enternyx%20My%20dream%20is%20',
    order: 5,
    active: true,
  },
  {
    taskId: 'discord',
    title: 'Join the dream circle',
    description: 'Enter the sanctuary of sleepers on Discord',
    icon: '◈',
    pts: 150,
    type: 'social' as const,
    externalLink: 'https://discord.gg/enternyx',
    order: 6,
    active: true,
  },
  {
    taskId: 'referral',
    title: 'Grab your referral link',
    description: 'Invite companions to unlock bonus wake points',
    icon: '🎁',
    pts: 100,
    type: 'referral' as const,
    order: 7,
    active: true,
  },
];

export async function ensureTasksSeeded(db: Db): Promise<void> {
  try {
    const tasksCol = db.collection('tasks');
    const count = await tasksCol.countDocuments();
    if (count === 0) {
      const docsWithTimestamp = DEFAULT_TASKS.map((t) => ({
        ...t,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
      await tasksCol.insertMany(docsWithTimestamp);
    }
  } catch {
    // Graceful fallback if concurrent or network issue
  }
}

let indexesInitialized = false;

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  const db = client.db('nyx');

  if (!indexesInitialized) {
    try {
      await db.collection('users').createIndex({ address: 1 }, { unique: true });
      await db.collection('users').createIndex({ referralCode: 1 }, { unique: true });
      await db.collection('users').createIndex({ referredByCode: 1 });
      await db.collection('usedNonces').createIndex({ nonce: 1 }, { unique: true });
      await db.collection('usedNonces').createIndex({ createdAt: 1 }, { expireAfterSeconds: 900 });
      await db.collection('tasks').createIndex({ taskId: 1 }, { unique: true });
      await db.collection('tasks').createIndex({ active: 1, order: 1 });
      await db.collection('userTasks').createIndex({ address: 1, taskId: 1 }, { unique: true });
      await db.collection('userTasks').createIndex({ address: 1 });
      await db.collection('userTasks').createIndex({ taskId: 1 });
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
