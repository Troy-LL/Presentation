import { Metadata } from "next";
import { AudienceScreen } from "@/components/audience-screen";

export async function generateMetadata({
  params
}: {
  params: Promise<{ sessionCode: string }>;
}): Promise<Metadata> {
  const { sessionCode } = await params;
  return {
    title: `Participating in ${sessionCode.toUpperCase()} — LocalHost`,
    description: "Join the live audience interaction."
  };
}

export default async function LobbyPage({
  params
}: {
  params: Promise<{ sessionCode: string }>;
}) {
  const { sessionCode } = await params;

  return <AudienceScreen sessionCode={sessionCode.toUpperCase()} />;
}
