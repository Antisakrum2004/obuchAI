import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/admin/settings — returns all settings as key-value pairs
export async function GET() {
  try {
    const result = await pool.query('SELECT key, value FROM app_settings')
    const settings: Record<string, string> = {}
    for (const row of result.rows) {
      settings[row.key] = row.value
    }
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Failed to fetch settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

// PUT /api/admin/settings — updates a single setting
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { key, value } = body

    if (!key || typeof key !== 'string') {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 })
    }
    if (value !== 'true' && value !== 'false') {
      return NextResponse.json({ error: 'Value must be "true" or "false"' }, { status: 400 })
    }

    const result = await pool.query(
      `INSERT INTO app_settings (key, value, "updatedAt")
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET value = $2, "updatedAt" = CURRENT_TIMESTAMP
       RETURNING key, value`,
      [key, value]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 })
    }

    return NextResponse.json({ key: result.rows[0].key, value: result.rows[0].value })
  } catch (error) {
    console.error('Failed to update setting:', error)
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 })
  }
}
