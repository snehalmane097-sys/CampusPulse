import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
  // Thrown at request-time, not import-time, so the app can still build
  // without a live database configured.
  console.warn("MONGODB_URI is not set. Add it to .env.local before running.");
}

type CachedConnection = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

// Cache the connection across hot reloads in dev so we don't open a new
// connection to Atlas on every file save.
const globalWithMongoose = global as typeof globalThis & {
  _campuspulseMongoose?: CachedConnection;
};

const cached: CachedConnection =
  globalWithMongoose._campuspulseMongoose || { conn: null, promise: null };

export async function dbConnect() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
  }

  cached.conn = await cached.promise;
  globalWithMongoose._campuspulseMongoose = cached;
  return cached.conn;
}
