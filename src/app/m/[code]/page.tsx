import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveMatch } from "@/components/public/LiveMatch";
import { resultLine, scoreLine } from "@/components/public/StatusPill";
import stats from "@/components/stats/stats.module.css";
import { NoDatabase } from "@/lib/public/db";
import { getPublicMatch, type PublicMatchView } from "@/lib/public/queries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

async function load(code: string): Promise<PublicMatchView | null | "unavailable"> {
  try {
    return await getPublicMatch(code);
  } catch (err) {
    if (!(err instanceof NoDatabase)) console.error(err);
    return "unavailable";
  }
}

/** What WhatsApp shows under the link, which is the score itself. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const view = await load((await params).code);
  if (!view || view === "unavailable") return { title: "Match", robots: { index: false } };
  const title = `${view.battingTeam} v ${view.bowlingTeam}`;
  const description = resultLine(view.summary) ?? scoreLine(view.summary);
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description: `${description}. ${view.venue}.`, type: "website" },
  };
}

export default async function PublicMatchPage({ params }: Props) {
  const view = await load((await params).code);
  if (view === null) notFound();
  if (view === "unavailable") {
    return (
      <main className={stats.page}>
        <Link href="/" className={stats.back}>← Crickit</Link>
        <h1 className={stats.title}>Scores are unavailable</h1>
        <p className={stats.subtitle}>The match list could not be reached. Try again in a minute.</p>
      </main>
    );
  }
  return <LiveMatch initial={view} />;
}
