import { NextResponse } from "next/server";

import { getSessionSnapshot } from "@/lib/party-admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionCode: string }> }
) {
  const { sessionCode } = await params;

  try {
    const snapshot = await getSessionSnapshot(sessionCode.toUpperCase());
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Session lookup failed.";
    const status = message === "Session not found." ? 404 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

