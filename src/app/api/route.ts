import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "obuch-ai",
    version: "1.5.0",
    timestamp: new Date().toISOString(),
  });
}
