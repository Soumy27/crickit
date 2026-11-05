import { NextResponse } from "next/server";
import { bearer, db, failure, readJson, secretMatches } from "@/lib/public/db";
import { getPublicMatch } from "@/lib/public/queries";
import type { PublicPayload } from "@/lib/public/summary";
import { cleanPayload } from "@/lib/public/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ code: string }> };

const NOT_FOUND = () => NextResponse.json({ error: "This match is not public." }, { status: 404 });

/** The same answer for a wrong code and a wrong token: neither says which codes exist. */
async function owned(code: string, request: Request): Promise<boolean> {
  const [row] = await db()`SELECT token_hash FROM public_matches WHERE code = ${code}`;
  return Boolean(row) && secretMatches(bearer(request), row.token_hash as string);
}

export async function GET(_request: Request, { params }: Context) {
  try {
    const view = await getPublicMatch((await params).code);
    return view ? NextResponse.json(view, { headers: { "Cache-Control": "no-store" } }) : NOT_FOUND();
  } catch (err) {
    return failure(err);
  }
}

export async function PUT(request: Request, { params }: Context) {
  try {
    const code = (await params).code.toUpperCase();
    if (!(await owned(code, request))) return NOT_FOUND();
    const { payload, summary } = cleanPayload(await readJson<Partial<PublicPayload>>(request));
    await db()`
      UPDATE public_matches
      SET phase = ${summary.phase}, summary = ${JSON.stringify(summary)}::jsonb,
          payload = ${JSON.stringify(payload)}::jsonb, updated_at = now()
      WHERE code = ${code}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return failure(err);
  }
}

/** Stop sharing: the row is removed rather than hidden. */
export async function DELETE(request: Request, { params }: Context) {
  try {
    const code = (await params).code.toUpperCase();
    if (!(await owned(code, request))) return NOT_FOUND();
    await db()`DELETE FROM public_matches WHERE code = ${code}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return failure(err);
  }
}
