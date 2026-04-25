import { NextResponse } from "next/server";

import { getSessionHistory } from "@/lib/party-admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionCode: string }> }
) {
  const { sessionCode } = await params;
  const url = new URL(request.url);
  const hostToken = url.searchParams.get("hostToken")?.trim();

  if (!hostToken) {
    return NextResponse.json({ error: "Host token is required." }, { status: 400 });
  }

  try {
    const payload = await getSessionHistory(sessionCode.toUpperCase(), hostToken);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not fetch session history.";
    const status = message === "Session not found." ? 404 : message.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
