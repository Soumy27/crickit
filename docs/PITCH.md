# Crickit: call the match, keep the book

**Live:** <https://crickit-pink.vercel.app> · **Code:** <https://github.com/Soumy27/crickit>

## The problem

A twenty-over match is 240 deliveries. At a local ground, someone writes every one of
them down, head bent, for three hours, while their friends play. So most club and gully
cricketers end up with no record of what they have done. Scoring apps exist, but they
still ask one person to stop watching and tap a phone for every ball.

## The solution

Crickit lets the scorer watch the match and say what happened, in any of ten Indian
languages, or several mixed in one breath. "चौका", "wide ball" and "एक धाव" all become
entries in the scorebook, and the scorecard, target and player records follow. No install,
no account. The keypad works offline, so a scorer is never stuck.

## Who it is for

Club and gully cricket scorers, tournament organisers, and players who want a record of
their cricket. Anyone can follow a shared match from a WhatsApp link with no login.

## How it uses Gnani's models

- **Prisma v3.0 (speech to text):** language auto-detection on every ball, with squad names
  and cricket terms passed as `keyterms` so local names are recognised.
- **Timbre v3.0 (text to speech):** ball-by-ball commentary in the scorer's language, using
  audio tags for the moments that deserve a shout.

A deterministic parser, not a model, turns the words into a delivery, so no model guesses a
score. Every call stays visible and can be undone.

## What it does

Limited-overs and four-innings Test scoring, DLS rain targets from the ICC's published
Standard Edition table, live public links (the scorer opts in), search and nearby matches,
tournaments with fixtures and net run rate, and player career records with insights.

## Evidence

- Six deliveries through a studio mic, an 8 kHz phone line, and that line under crowd noise.
  At 5 dB of signal over the crowd, listing the squad in both scripts took player recognition
  from 50% to 100%, and correctly read deliveries from 83% to 100%. This was a synthetic voice
  and synthetic noise: enough to choose a design, not a claim about every ground.
- 328 automated tests, including the ICC's published DLS worked examples.

## Limits

Hands-free listening is not built: the scorer holds a button for each ball. DLS uses the
Standard Edition, not the licensed Stern software internationals run. Careers currently live
on the scorer's device. All names and figures in the demo are synthetic.
