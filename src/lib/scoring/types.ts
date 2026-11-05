/**
 * Cricket scoring domain types.
 *
 * The match is an immutable log of events. State is always derived by folding
 * the log, which is what makes undo exact: drop the last event and refold.
 */

export type DismissalKind =
  | "bowled"
  | "caught"
  | "lbw"
  | "run_out"
  | "stumped"
  | "hit_wicket";

/** Dismissals the bowler is credited with. A run out is not one of them. */
export const BOWLER_CREDITED: readonly DismissalKind[] = [
  "bowled",
  "caught",
  "lbw",
  "stumped",
  "hit_wicket",
];

export type ExtraKind = "wide" | "noball" | "bye" | "legbye";

export interface Wicket {
  kind: DismissalKind;
  /** Which batter is out. Only a run out can take the non-striker. */
  who: "striker" | "non_striker";
  fielder?: string;
  /** Who was bowling when it fell. The bowler at the crease may have changed since. */
  bowlerId?: string;
}

/**
 * One delivery.
 *
 * `batRuns` is runs off the bat, so it stays 0 for a wide, bye or leg bye.
 * `extraRuns` is runs run in addition to any penalty: the runs taken on a
 * wide beyond the one-run penalty, or the byes/leg byes taken.
 */
export interface BallEvent {
  type: "ball";
  batRuns: number;
  extra?: ExtraKind;
  extraRuns: number;
  wicket?: Wicket;
  /** The raw utterance this was parsed from, kept for audit and replay. */
  said?: string;
}

export interface NewBatterEvent {
  type: "new_batter";
  playerId: string;
}

export interface NewBowlerEvent {
  type: "new_bowler";
  playerId: string;
}

export interface EndInningsEvent {
  type: "end_innings";
  /** A captain closing the innings. Test matches. */
  declared?: boolean;
  /** Rain ended it, so the overs left are lost to the DLS calculation. */
  rain?: boolean;
}

/** Opens the next innings. The side is decided by the rules, not by this event. */
export interface StartInningsEvent {
  type: "start_innings";
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  /** The side that just batted is sent straight back in. Test matches. */
  followOn?: boolean;
  /** Overs for this innings, when rain has cut it. Limited overs. */
  maxOvers?: number;
}

/** Rain took overs from the innings in play. Limited overs. */
export interface ReduceOversEvent {
  type: "reduce_overs";
  /** The innings's new total length, overs already bowled included. */
  maxOvers: number;
}

/** The match stops with no winner: time ran out, or rain did. */
export interface EndMatchEvent {
  type: "end_match";
  /** "rain" settles a chase on the DLS par score, if enough overs were bowled. */
  outcome: "draw" | "abandoned" | "rain";
}

export type MatchEvent =
  | BallEvent
  | NewBatterEvent
  | NewBowlerEvent
  | EndInningsEvent
  | StartInningsEvent
  | ReduceOversEvent
  | EndMatchEvent;

export interface Player {
  id: string;
  name: string;
  /**
   * Other spellings the same player answers to — above all the Devanagari
   * form, because Prisma returns "धनंजय" or "Dhananjay" depending on the ball,
   * and a squad list in one script only will miss half of them.
   */
  aliases?: string[];
}

export interface InningsSetup {
  battingTeam: string;
  bowlingTeam: string;
  batting: Player[];
  bowling: Player[];
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  /** Overs in the innings. Null for a timed match with no limit. */
  maxOvers: number | null;
}

export interface BatterFigures {
  id: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  dismissal?: Wicket;
  /** Set when the batter has been to the crease. */
  batted: boolean;
}

export interface BowlerFigures {
  id: string;
  name: string;
  /** Legal deliveries bowled. Overs are derived from this. */
  balls: number;
  runs: number;
  wickets: number;
  maidens: number;
}

export interface Extras {
  wides: number;
  noballs: number;
  byes: number;
  legbyes: number;
}

/** A delivery as it should read in the scorebook grid. */
export interface ScorebookMark {
  /** "4", ".", "W", "wd", "2nb", "1lb" and so on. */
  notation: string;
  runs: number;
  wicket: boolean;
  legal: boolean;
}

export interface OverRecord {
  number: number;
  bowlerId: string;
  marks: ScorebookMark[];
  /** Runs the batting side scored in this over, byes included. */
  runs: number;
  /** Runs debited to the bowler in this over. A maiden is zero of these. */
  bowlerRuns: number;
  wickets: number;
  complete: boolean;
}

export interface InningsState {
  battingTeam: string;
  bowlingTeam: string;
  runs: number;
  wickets: number;
  legalBalls: number;
  extras: Extras;
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  batters: Record<string, BatterFigures>;
  bowlers: Record<string, BowlerFigures>;
  overs: OverRecord[];
  complete: boolean;
  /** Runs needed to win, on the innings that can win the match outright. */
  target: number | null;
  declared: boolean;
  /**
   * What the innings is waiting to be told before the next ball. Both can be
   * pending at once, when a wicket falls on the last ball of an over.
   */
  awaiting: ("new_batter" | "new_bowler")[];
  maxOvers: number | null;
  maxWickets: number;
}
