import { AudienceScreen } from "@/components/audience-screen";

export default async function LobbyPage({
  params
}: {
  params: Promise<{ sessionCode: string }>;
}) {
  const { sessionCode } = await params;

  return <AudienceScreen sessionCode={sessionCode.toUpperCase()} />;
}
