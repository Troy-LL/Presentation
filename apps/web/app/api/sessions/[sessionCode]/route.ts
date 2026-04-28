import { NextResponse } from "next/server";

import { closeSessionRoom, getSessionSnapshot } from "@/lib/party-admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionCode: string }> }
) {
  const { sessionCode } = await params;

  if (!/^[A-Z0-9]{5}$/i.test(sessionCode)) {
    return NextResponse.json({ error: "Invalid session code." }, { status: 400 });
  }

  try {
    const snapshot = await getSessionSnapshot(sessionCode.toUpperCase());
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Session lookup failed.";
    const status = message === "Session not found." ? 404 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionCode: string }> }
) {
  const { sessionCode } = await params;
  if (!/^[A-Z0-9]{5}$/i.test(sessionCode)) {
    return NextResponse.json({ error: "Invalid session code." }, { status: 400 });
  }

  const payload = (await request.json().catch(() => null)) as { action?: string; hostToken?: string } | null;

  if (payload?.action !== "close_session" && payload?.action !== "client.close_session") {
    return NextResponse.json({ error: "Invalid session action." }, { status: 400 });
  }

  if (!payload.hostToken) {
    return NextResponse.json({ error: "Host token is required." }, { status: 400 });
  }

  try {
    await closeSessionRoom(sessionCode.toUpperCase(), payload.hostToken);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not close the session.";
    const status = message === "Session not found." ? 404 : message.includes("rejected") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
