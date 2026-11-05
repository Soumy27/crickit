import { NextResponse } from "next/server";
import { failure } from "@/lib/public/db";
import { getTournament } from "@/lib/public/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const view = await getTournament((await params).code);
    return view
      ? NextResponse.json(view, { headers: { "Cache-Control": "no-store" } })
      : NextResponse.json({ error: "No tournament with that code." }, { status: 404 });
  } catch (err) {
    return failure(err);
  }
}
