import { NextResponse } from "next/server";
import { getUpload } from "@/lib/upload-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const file = getUpload(id);

  if (!file) {
    return new Response("File not found", { status: 404 });
  }

  return new Response(file.content, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `inline; filename="${file.filename}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
