import { HostConsole } from "@/components/host-console";

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
