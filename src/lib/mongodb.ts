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
      indexesInitialized = true;
    } catch {
      // Indexes already exist or initialized concurrently
      indexesInitialized = true;
    }
  }

  return db;
}

export default clientPromise;
