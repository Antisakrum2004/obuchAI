import { NextResponse } from 'next/server'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const logs: string[] = []
  try {
    logs.push(`DATABASE_URL exists: ${!!process.env.DATABASE_URL}`)
    logs.push(`DATABASE_URL prefix: ${process.env.DATABASE_URL?.substring(0, 30)}...`)
    logs.push(`WebSocket type: ${typeof WebSocket}`)
    
    // Try Neon direct connection
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const result = await pool.query('SELECT count(*) FROM users')
    logs.push(`Direct query result: ${JSON.stringify(result.rows)}`)
    await pool.end()
    
    // Try Prisma with adapter
    const pool2 = new Pool({ connectionString: process.env.DATABASE_URL! })
    const adapter = new PrismaNeon(pool2)
    const prisma = new PrismaClient({ adapter })
    const users = await prisma.user.findMany({ take: 1 })
    logs.push(`Prisma query result: ${JSON.stringify(users)}`)
    await prisma.$disconnect()
    await pool2.end()
    
    return NextResponse.json({ success: true, logs })
  } catch (error) {
    return NextResponse.json({ 
      error: String(error), 
      errorStack: (error as Error).stack,
      logs 
    }, { status: 500 })
  }
}
