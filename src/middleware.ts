import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// [ETAP-2] Middleware temporarily gutted — only logs and passes through.
// If navigation works after this, the OLD middleware was the culprit.
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  console.log("[ETAP-2] middleware invoked for:", pathname);
  return NextResponse.next();
}

// [ETAP-2] Narrow matcher — only the routes we're debugging
export const config = {
  matcher: [
    "/knowledge/:path*",
    "/challenges/:path*",
  ],
};
