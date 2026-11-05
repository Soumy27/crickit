import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { newCode } from "../match/store";
import { Invalid } from "./validate";

export class NoDatabase extends Error {}

let client: NeonQueryFunction<false, false> | null = null;

export function db(): NeonQueryFunction<false, false> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new NoDatabase("DATABASE_URL is not set.");
  client ??= neon(url);
  return client;
}

/** Long enough that a code cannot be guessed its way into; easy enough to read out. */
export const publicCode = () => newCode(6);

export function newSecret(): { secret: string; hash: string } {
  const secret = randomBytes(24).toString("base64url");
  return { secret, hash: hashSecret(secret) };
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function secretMatches(secret: string, hash: string): boolean {
  const a = Buffer.from(hashSecret(secret));
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function bearer(request: Request): string {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
}

/**
 * Who made this, for the hourly limit, and nothing else: a salted hash, so the
 * table holds no IP address. With no login this is the only brake on a flood.
 */
export function creatorHash(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  return createHash("sha256").update(`crickit:${ip}`).digest("hex").slice(0, 32);
}

const MAX_BODY = 1_000_000;

export async function readJson<T>(request: Request): Promise<T> {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new Invalid("That is too much to save.");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Invalid("Expected JSON.");
  }
}

/** One place that decides what a failure looks like to the client. */
export function failure(err: unknown): NextResponse {
  if (err instanceof Invalid) return NextResponse.json({ error: err.message }, { status: 400 });
  if (err instanceof NoDatabase) {
    return NextResponse.json({ error: "Public matches are not set up yet." }, { status: 503 });
  }
  console.error(err);
  return NextResponse.json({ error: "Could not reach the match list. Try again." }, { status: 502 });
}
