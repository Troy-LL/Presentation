import { Metadata } from "next";
import { headers } from "next/headers";
import { HostConsole } from "@/components/host-console";

export async function generateMetadata({
  params
}: {
  params: Promise<{ sessionCode: string }>;
}): Promise<Metadata> {
  const { sessionCode } = await params;
  return {
    title: `Host Dashboard [${sessionCode.toUpperCase()}] — LocalHost`,
    description: "Real-time audience interaction control panel."
  };
}

export default async function HostPage({
  params,
  searchParams
}: {
  params: Promise<{ sessionCode: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ sessionCode }, { token }] = await Promise.all([params, searchParams]);
  const requestHeaders = await headers();
  const appOrigin =
    requestHeaders.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

  return (
    <HostConsole
      sessionCode={sessionCode.toUpperCase()}
      tokenFromUrl={token}
      appOrigin={appOrigin}
    />
  );
}
