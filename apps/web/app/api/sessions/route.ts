import { NextResponse } from "next/server";

import type { SessionResponse } from "@interactive-presentation/types";

import { initializeSessionRoom } from "@/lib/party-admin";
import { generateHostToken } from "@/lib/security";
import { generateSessionCode } from "@/lib/session-code";

// Force reload
export async function POST(request: Request) {
  const origin =
    request.headers.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const sessionCode = generateSessionCode();
      const hostToken = generateHostToken();

      try {
        await initializeSessionRoom(sessionCode, hostToken);

        const joinUrl = `${origin.replace(/\/$/, "")}/join?code=${sessionCode}`;
        const payload: SessionResponse = {
          sessionCode,
          hostToken,
          joinUrl,
          qrValue: joinUrl
        };

        return NextResponse.json(payload, { status: 201 });
      } catch (error) {
        console.error(`Attempt ${attempt} failed with error:`, error);
        if (!(error instanceof Error) || !error.message.includes("already exists")) {
          throw error;
        }
      }
    }

    throw new Error("Could not reserve a unique session code.");
  } catch (error) {
    console.error("Outer catch block caught an error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not create session."
      },
      { status: 500 }
    );
  }

}
