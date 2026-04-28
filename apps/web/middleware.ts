import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

const SESSION_CODE_PATTERN = /^[A-Z0-9]{5}$/;

function getRateLimitBucket(path: string, method: string) {
  if (path.startsWith("/api/sessions")) {
    return method === "POST" ? "sessions-post" : "sessions-get";
  }

  if (path.startsWith("/api/uploads")) {
    return "uploads";
  }

  return "api";
}

export function middleware(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
  const path = request.nextUrl.pathname;
  const method = request.method;

  if (path.startsWith("/api/sessions/") && path !== "/api/sessions") {
    const sessionCode = path.split("/").filter(Boolean)[2] ?? "";
    if (!SESSION_CODE_PATTERN.test(sessionCode.toUpperCase())) {
      return NextResponse.json({ error: "Invalid session code." }, { status: 400 });
    }
  }

  if (path.startsWith("/api/")) {
    const now = Date.now();
    const bucket = getRateLimitBucket(path, method);
    const limit = bucket === "sessions-post" ? 12 : bucket === "sessions-get" ? 60 : bucket === "uploads" ? 15 : 30;
    const windowMs = 60 * 1000; // 1 minute
    const key = `${ip}:${bucket}`;

    const record = rateLimitMap.get(key) ?? { count: 0, lastReset: now };

    if (now - record.lastReset > windowMs) {
      record.count = 1;
      record.lastReset = now;
    } else {
      record.count += 1;
    }

    rateLimitMap.set(key, record);

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
