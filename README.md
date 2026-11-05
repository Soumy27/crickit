# Crickit

Voice scoring for local cricket.

You call the ball the way you already would — in any of ten languages, or half
of each in one breath — and Crickit writes the scorecard, calls the
commentary back out loud, and keeps a career record for every player who walks
out to bat.

Built for **The Great Indian AI Internship Challenge** on Gnani's speech
platform: **Prisma v3.0** for recognition and **Timbre v3.0** for synthesis.

**Try it:** <https://crickit-pink.vercel.app> · **One-page pitch:** [docs/PITCH.md](docs/PITCH.md)

## Running it

Create `.env.local` with your Gnani key, and a Postgres connection string if you
want public matches, search and tournaments:

```
GNANI_API_KEY=your-key
DATABASE_URL=your-connection-string
```

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

The microphone needs a secure context, so a phone on your local network needs
HTTPS rather than a plain `http://192.168.x.x` address:

```bash
npx localtunnel --port 3000
```

## Checks

```bash
npm test            # the scoring engine, the parser, the careers
npx tsc --noEmit    # types
npm run lint
```

## How it is put together

| Area | Where | What it does |
| --- | --- | --- |
| Scoring | `src/lib/scoring/` | A pure reducer over an immutable ball log, with a match layer for limited-overs and four-innings Test rules: targets, declarations, the Law 14 follow-on and every result. Undo is a refold of one fewer event. |
| Parsing | `src/lib/parse/` | A deterministic cricket lexicon for all ten languages, in native script and Latin. No model guesses a number. |
| Speech | `src/lib/gnani/` | Server-only REST client for Prisma and Timbre. The key never reaches the browser. |
| Commentary | `src/lib/commentary/` | Templated broadcast lines in all ten languages with Timbre audio tags, picked deterministically so a replay reads the same. |
| Careers | `src/lib/match/careers.ts` | Recomputed from scratch across every stored match, never kept as a running total. |
| Landing page | `src/app/page.tsx`, `src/components/landing/` | A WebGL ball (three.js, lazy-loaded) and a 3D scorebook, scrubbed by GSAP ScrollTrigger on Lenis, with React Bits text effects in `src/components/reactbits/`. |

## Scripts

| Script | Purpose |
| --- | --- |
| `scripts/keyterms-ab.ts` | The A/B that measured what context hints are worth across four audio channels. Its finding — list squad names in both scripts — is why `Player` has `aliases`. See `docs/FINDINGS-KEYTERMS.md`. |
| `scripts/language-matrix.ts` | Runs a ball in all ten languages through Timbre, Prisma and the parser. See `docs/FINDINGS-LANGUAGES.md` for what the result does and does not show. |
| `scripts/compare-formats.ts` | Prisma's four output formats on the same clip. |
| `scripts/make-samples.ts` | Renders the landing page's commentary clips. Needs `ffmpeg` afterwards to convert to mp3. |
| `scripts/roundtrip.mjs` | A smoke test of both APIs with your key. |

## What it deliberately does not do

- Rain targets use the ICC-published Duckworth-Lewis Standard Edition, not the licensed Stern software internationals run. The table assumes eleven-a-side.
- One ball at a time, on a held button. Continuous hands-free listening is not
  built.
- Ten languages, and none of them from the North-East: that is what the speech
  models cover today.
- Amateur and local matches only. No broadcast audio, no feeds, nothing
  scraped.
- No account. Matches live in the browser's own storage. Each ball's audio and
  the squad names go to Gnani's speech API; Crickit does not store the audio.
- No moderation of public listings yet. The hourly limit per connection and the
  scorer's own Stop sharing button are the only controls.

## Public matches, search and tournaments

Scoring works with no database. Sharing a match, `/discover`, `/m/<code>` and
`/t/<code>` need `DATABASE_URL` set to a Postgres connection string in
`.env.local`, and in the host's environment once deployed. "Near me" needs HTTPS
or localhost, because browsers only allow location on a secure page.

Voice calls are limited so a public link cannot drain the speech credits: 300 an
hour per connection and 2,000 a day across the site, separately for recognition
and speech. Set `VOICE_HOURLY_LIMIT` and `VOICE_DAILY_LIMIT` to change them. If the
limit check itself fails, voice stays on. The keypad is never limited.

A match goes public only when the scorer opts in. Its score is worked out on the
server from the event log, the raw voice call and alternative name spellings are
left out, and a ground's position is stored to about a kilometre.
