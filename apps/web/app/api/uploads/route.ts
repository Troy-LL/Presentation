import { NextResponse } from "next/server";
import { saveUpload } from "@/lib/upload-store";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
    }

    // Limit size to 50MB for local/self-hosted environments.
    // NOTE: Cloud platforms like Vercel have a hard 4.5MB limit for serverless functions.
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const id = crypto.randomUUID();
    
    saveUpload(id, buffer, file.type, file.name);

    // Return the URL that can be used to fetch this file
    const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const fileUrl = `${origin.replace(/\/$/, "")}/api/uploads/${id}`;

    return NextResponse.json({ id, url: fileUrl });
  } catch (error) {
    console.error("Upload failed:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
