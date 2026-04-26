import { Metadata } from "next";
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

  return (
    <HostConsole
      sessionCode={sessionCode.toUpperCase()}
      tokenFromUrl={token}
    />
  );
}
