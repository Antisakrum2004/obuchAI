import { PrismaClient } from '@prisma/client'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'

// ---- WebSocket setup for Neon (Node.js local dev only) ----
// On Vercel serverless, Neon uses fetch-based connections — no WebSocket needed
if (typeof WebSocket === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ws = require('ws')
    neonConfig.webSocketConstructor = ws
  } catch {
    // ws not available, Neon will use fetch-based connections
  }
}

// ---- Neon Pool (for raw SQL queries — used by 40+ API routes) ----
const globalForPool = globalThis as unknown as {
  pool: Pool | undefined
}

function createPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL environment variable is not set')

  return new Pool({
    connectionString: databaseUrl,
    // CRITICAL: Timeout so DB queries don't hang forever on Vercel serverless.
    // If Neon doesn't respond in 5s, the connection FAILS instead of blocking the lambda.
    connectionTimeoutMillis: 5000,
    // Close idle connections after 30s — prevents connection leaks in serverless
    idleTimeoutMillis: 30000,
    // Limit max connections per lambda to avoid exhausting Neon's pool
    max: 10,
    // SSL must be explicitly configured for Vercel → Neon connections
    ssl: {
      rejectUnauthorized: false,
    },
  })
}

export const pool = globalForPool.pool ?? createPool()
if (process.env.NODE_ENV !== 'production') globalForPool.pool = pool

// ---- Query helper ----
export async function query(text: string, params?: unknown[]) {
  return pool.query(text, params)
}

// ---- PrismaClient (for auth/PrismaAdapter and admin routes) ----
// Uses PrismaNeon adapter — kept for backward compatibility with auth
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL environment variable is not set')

  // Reuse the SAME global pool for Prisma adapter — no second pool leak!
  // The pool already has all the timeouts and SSL configured above.
  const adapter = new PrismaNeon(pool as unknown as import('@neondatabase/serverless').PoolConfig)

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
