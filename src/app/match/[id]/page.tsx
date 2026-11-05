import { Scorer } from "@/components/scoring/Scorer";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Scorer matchId={id} />;
}
