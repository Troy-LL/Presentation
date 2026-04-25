import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Simple in-memory-ish rate limit for Vercel Edge
// Note: Edge Middleware is ephemeral, but it still catches high-frequency bursts
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

export function middleware(request: NextRequest) {
  const ip = request.ip ?? "127.0.0.1";
  const path = request.nextUrl.pathname;

  // Only protect sensitive POST routes
  if (path.startsWith("/api/") && request.method === "POST") {
    const now = Date.now();
    const limit = 10; // 10 requests per window
    const windowMs = 60 * 1000; // 1 minute

    const record = rateLimitMap.get(ip) ?? { count: 0, lastReset: now };

    if (now - record.lastReset > windowMs) {
      record.count = 1;
      record.lastReset = now;
    } else {
      record.count += 1;
    }

    rateLimitMap.set(ip, record);

    if (record.count > limit) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
