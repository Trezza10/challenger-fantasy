/** Supported fantasy roster positions in this prototype. */
export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'FLEX' | 'DEF' | 'K' | 'COACH';

/** Shape used when matchup player data is loaded from a service. */
export interface MatchupPlayerData {
  gameStarted: boolean;
  liveStats: PlayerStat[];
  name: string;
  position: Position;
  recentStats: PlayerStat[];
  score: number;
  team: string;
}

/** A player paired with the roster position they currently occupy. */
export interface RosterSlotData {
  id: string;
  kind: 'bench' | 'starter';
  player: MatchupPlayerData;
  position: Position;
}

/** The editable portion of the manager's lineup, shared between Team and Matchup. */
export interface RosterLineup {
  bench: RosterSlotData[];
  starters: RosterSlotData[];
}

/** One label/value stat displayed in the player detail dialog. */
export interface PlayerStat {
  label: string;
  value: string;
}

/** Pair of opposing players occupying the same roster position. */
export interface PlayerMatchup {
  left: MatchupPlayerData;
  right: MatchupPlayerData;
  highlighted?: boolean;
}

/** Team score information shown at the top of the matchup screen. */
export interface MatchupTeam {
  /** Cards this manager currently owns; opponents' inventories are display-only. */
  hand?: PowerCard[];
  name: string;
  projectedPoints: number;
  score: number;
}

/** Compact scorecard data used for browsing every matchup in the league. */
export interface LeagueMatchupSummary {
  benchMatchups?: PlayerMatchup[];
  featuredPlayers: string;
  gameTime: string;
  id: string;
  isLive: boolean;
  initialModifiers?: AppliedModifier[];
  leftTeam: MatchupTeam;
  playerMatchups?: PlayerMatchup[];
  rightTeam: MatchupTeam;
  winChance: number;
}

/** A playable card shown in the manager's hand tray. */
export interface PowerCard {
  accent: string;
  allowedPositions: Array<Position | 'ALL'>;
  allowedTeam: 'SELF' | 'OPPONENT';
  description: string;
  duration: string;
  effectText: string;
  icon: 'flash' | 'shield' | 'skull' | 'football' | 'lock-closed' | 'layers' | 'flame' | 'rocket' | 'radio' | 'trending-up' | 'swap-horizontal' | 'speedometer' | 'stats-chart' | 'bar-chart' | 'analytics' | 'timer' | 'checkmark-circle';
  id: string;
  label: string;
  quantity: number;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  type: 'Strategy' | 'Tactic' | 'Review';
}

/** A card currently attached to a player, including who played it. */
export interface AppliedModifier {
  card: PowerCard;
  id: string;
  playedBy: 'manager' | 'opponent';
  playedByName: string;
  playerName: string;
}

/** Data models for the five current app pages. */
/** A short league-news article displayed on the Home screen. */
export interface NewsStory {
  body: string;
  category: string;
  id: string;
  publishedAt: string;
  summary: string;
  title: string;
}

export interface HomeData { leagueRank: string; news: NewsStory[]; projectedPoints: number; welcomeMessage: string; }
export interface TeamData { rosterSpots: string; topPlayer: string; }
export interface LeagueData { currentWeek: number; memberCount: number; name: string; }
/** One time-stamped update in the league-wide activity feed. */
export interface LeagueActivityEntry { actor: string; id: string; occurredAt: string; summary: string; type: 'card' | 'lineup' | 'trade' | 'waiver'; }
/** Cursor page returned by activity services to support incremental feed loading. */
export interface LeagueActivityPage { entries: LeagueActivityEntry[]; nextCursor: number | null; }
/** Compact league record used by the global league switcher. */
export interface LeagueSummary { id: string; memberCount: number; name: string; }
/** Account information displayed and edited from the Profile tab. */
export interface ProfileData { avatarUrl: string; email: string; memberSince: string; name: string; username: string; }
/** Mutable subset of profile fields accepted by the account settings endpoint. */
export interface ProfileUpdate { avatarUrl: string; email: string; username: string; }
export interface MatchupData {
  benchMatchups: PlayerMatchup[];
  gameTime: string;
  hand: PowerCard[];
  isLive: boolean;
  initialModifiers: AppliedModifier[];
  leftTeam: MatchupTeam;
  leagueMatchups: LeagueMatchupSummary[];
  playerMatchups: PlayerMatchup[];
  rightTeam: MatchupTeam;
  week: number;
  winChance: number;
}
