import { PrismaClient } from '@prisma/client'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'

// ---- Neon Pool (for raw SQL queries, works reliably on Vercel serverless) ----
const globalForPool = globalThis as unknown as {
  pool: Pool | undefined
}

function createPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL environment variable is not set')

  // Only set ws for Node.js environments (local dev)
  // On Vercel serverless, Neon uses fetch-based connections without WebSocket
  if (typeof WebSocket === 'undefined') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ws = require('ws')
      neonConfig.webSocketConstructor = ws
    } catch {
      // ws not available, Neon will use fetch-based connections
    }
  }

  return new Pool({ connectionString: databaseUrl })
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

  if (typeof WebSocket === 'undefined') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ws = require('ws')
      neonConfig.webSocketConstructor = ws
    } catch {
      // ws not available, Neon will use fetch-based connections
    }
  }

  // Use a separate Pool for Prisma adapter (not the same as the raw query pool)
  const adapterPool = new Pool({ connectionString: databaseUrl })
  const adapter = new PrismaNeon(adapterPool)

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
