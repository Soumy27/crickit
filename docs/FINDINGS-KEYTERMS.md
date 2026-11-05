# Does `keyterms` rescue Indian names on telephone-grade audio?

Run 4 Nov 2026 against the live Gnani API. Reproduce with:
`cd crickit && npx tsx --env-file=.env.local scripts/keyterms-ab.ts`

This is the Noise Canceller evidence and the interview answer, so it is run as an experiment: same audio, same model, one variable at a time.

---

## Method

Six utterances a scorer would actually say, each naming a player whose name no general recogniser has seen — Rutvik, Omkar, Dhananjay, Prathamesh, Sarfaraz, Kaustubh.

Each utterance is put through a channel chain:

1. **Timbre v3.0** speaks it in Hindi at 16 kHz
2. Downsampled to **8 kHz mono** and band-limited to **300–3400 Hz** — the actual telephone band
3. **G.726 ADPCM at 16 kbit/s** and back — a real narrowband telephony codec
4. Optionally mixed with band-limited brown noise at a **measured** SNR

Then transcribed by **Prisma v3.0** twice: with `keyterms` (squad + grounds + cricket vocabulary) and without.

Three things are measured, because they fail independently:

| Metric | Question |
| --- | --- |
| **Latin squad** | Does the parser attribute the ball, with a squad list in Latin only? |
| **Both scripts** | Does it, with the Devanagari spellings carried too? |
| **Delivery** | Is the ball itself right — 4 runs, wide, bowled? |

---

## Results

| Condition | Latin squad | Both scripts | Delivery |
| --- | --- | --- | --- |
| Studio, 16 kHz | 17% → **67%** | 100% → 100% | 100% → 100% |
| Telephone, 8 kHz + G.726 | 17% → **33%** | 100% → 100% | 100% → 100% |
| Telephone + crowd, 15 dB SNR | 17% → **33%** | 100% → 100% | 100% → 100% |
| Telephone + crowd, **5 dB SNR** | 0% → **33%** | 50% → **100%** | 83% → **100%** |

Each cell is *keyterms off → keyterms on*.

---

## What it actually found

### 1. The biggest accuracy problem was not the channel. It was our own squad list.

A Latin-only squad list matched **17% of players on clean studio audio**. Not because Prisma misheard anything — it heard perfectly — but because it returned `कौस्तुभ` while the squad said `Kaustubh`. The names were right and the match failed anyway.

Carrying both spellings takes it to **100%**, on every condition down to 15 dB SNR.

This was a bug in our code found by measuring the model, and it is now fixed: `Player` carries `aliases`, and the parser matches any spelling. Four regression tests cover it.

### 2. Prisma is genuinely hard to break on telephony audio.

Delivery extraction held at **100% through 8 kHz, G.726 and 15 dB of crowd noise**. It only moved at 5 dB SNR — where the speech is barely above the noise — and even then only to 83%.

On the evidence here, Gnani's claim about training on telephonic audio holds up. The channel is not the problem it would be with a general model.

### 3. `keyterms` earns its place exactly where it gets hard.

At 5 dB SNR, with keyterms off, the recogniser produced **`गौस्तुब`** for Kaustubh and **`Sarfraj`** for Sarfaraz. Both are wrong, and both would have attributed the ball to nobody.

With keyterms on, both came back correctly, and across that row:

- player matching **50% → 100%**
- delivery **83% → 100%**

In the easy conditions keyterms changes little, because little needed fixing. It is insurance against the worst ball of the day, which is the one that matters.

### 4. It also pulls the spelling toward the form you supplied.

On clean audio, keyterms raised Latin-form output from 17% to 67% — it nudges the model toward writing the name the way the squad list writes it. Useful, but **not a substitute for matching both scripts**, since it only got to 67%.

---

## What this honestly does not show

Worth stating plainly, both because it is true and because overstating it in a submission would be the kind of misleading demo the rules prohibit:

- **The speech is synthetic.** Timbre reading a line is cleaner and more regular than a real person shouting across a maidan. This measures the **channel**, not a real ground.
- **The noise is synthetic** — band-limited brown noise at a measured SNR, not a recorded crowd.
- **n = 6 utterances per cell.** Enough to see a 50-point effect, nowhere near enough for a small one. Treat the 33% versus 17% columns as suggestive, and the 5 dB row as the real result.
- One voice, one language, one speaking rate.

**Before submission**, this wants re-running with real recorded speech at a real ground — which is the same afternoon as the demo video, so it costs nothing extra.

---

## What changed in the product because of it

1. `Player` gained `aliases`; the parser matches a name in **any** supplied script.
2. Squad entry must capture both spellings. Prisma itself can generate the Devanagari form at squad-entry time, so the scorer still types each name once.
3. `keyterms` stays on for every request — it costs nothing and it is what holds the worst balls together.
