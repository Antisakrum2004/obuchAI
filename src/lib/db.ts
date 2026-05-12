import { PrismaClient } from '@prisma/client'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

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

  const pool = new Pool({ connectionString: databaseUrl })
  const adapter = new PrismaNeon(pool)

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
