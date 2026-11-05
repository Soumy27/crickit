import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TournamentBoard } from "@/components/public/TournamentBoard";
import stats from "@/components/stats/stats.module.css";
import { NoDatabase } from "@/lib/public/db";
import { getTournament, type TournamentView } from "@/lib/public/queries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

async function load(code: string): Promise<TournamentView | null | "unavailable"> {
  try {
    return await getTournament(code);
  } catch (err) {
    if (!(err instanceof NoDatabase)) console.error(err);
    return "unavailable";
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const view = await load((await params).code);
  if (!view || view === "unavailable") return { title: "Tournament" };
  const description = `${view.teams.length} teams in ${view.city}. Points table, fixtures and live scores.`;
  return { title: view.name, description, openGraph: { title: view.name, description, type: "website" } };
}

export default async function TournamentPage({ params }: Props) {
  const view = await load((await params).code);
  if (view === null) notFound();
  if (view === "unavailable") {
    return (
      <main className={stats.page}>
        <Link href="/" className={stats.back}>← Crickit</Link>
        <h1 className={stats.title}>Tournaments are unavailable</h1>
        <p className={stats.subtitle}>The match list could not be reached. Try again in a minute.</p>
      </main>
    );
  }
  return <TournamentBoard initial={view} />;
}
