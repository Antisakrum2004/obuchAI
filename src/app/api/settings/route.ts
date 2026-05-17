import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

// Revalidate every 30 seconds
export const revalidate = 30

// GET /api/settings — public settings (no auth required)
export async function GET() {
  try {
    const result = await pool.query('SELECT key, value FROM app_settings')
    const settings: Record<string, string> = {}
    for (const row of result.rows) {
      settings[row.key] = row.value
    }
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Failed to fetch public settings:', error)
    // Return defaults if DB is not ready
    return NextResponse.json({
      particles: 'true',
      confetti: 'true',
      liquid_xp: 'true',
      heart_animations: 'true',
      streak_fire: 'true',
      avatar_frames: 'true',
      micro_animations: 'true',
      adaptive_difficulty: 'true',
    })
  }
}
