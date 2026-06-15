import { Redis } from 'ioredis'

// BullMQ requires maxRetriesPerRequest: null on the connection it uses for
// blocking commands. Cache the client on globalThis so Next.js hot-reloads
// don't open a new Redis connection on every module re-evaluation.
const globalForRedis = globalThis as unknown as { __bullRedis?: Redis }

export const connection =
  globalForRedis.__bullRedis ??
  new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.__bullRedis = connection
}
