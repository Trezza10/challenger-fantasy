import { AppliedModifier, CardClaimState, CreateLeaguePost, CreateTrade, DraftState, HomeData, LeagueAccess, LeagueActivityPage, LeagueData, LeagueInvitation, LeagueMember, LeaguePost, LeagueSummary, MatchupData, ProfileData, ProfileUpdate, RosterLineup, TeamData, TradeOffer, TradePartner } from '../../types/fantasy';

/**
 * Contract shared by the temporary mock implementation and future backend implementation.
 * UI code only depends on this interface, never on a specific data source.
 */
export interface FantasyService {
  getHome(): Promise<HomeData>;
  getLeagueActivity(leagueId?: string, cursor?: number, limit?: number): Promise<LeagueActivityPage>;
  getLeague(leagueId?: string): Promise<LeagueData>;
  getLeagues(): Promise<LeagueSummary[]>;
  createLeague(name: string, teamName: string, maxMembers: number, managerName?: string, email?: string): Promise<LeagueAccess>;
  createLeagueInvitation(leagueId: string, email?: string): Promise<LeagueInvitation>;
  completeDraft(leagueId: string): Promise<void>;
  getCardClaim(leagueId: string): Promise<CardClaimState>;
  claimCard(leagueId: string, offerId: string, cardId: string): Promise<CardClaimState>;
  getDraft(leagueId: string): Promise<DraftState>;
  makeDraftPick(leagueId: string, playerId: string): Promise<DraftState>;
  scheduleDraft(leagueId: string, startsAt: string): Promise<DraftState>;
  getLeagueAccess(leagueId: string): Promise<LeagueAccess>;
  getLeagueMembers(leagueId: string): Promise<LeagueMember[]>;
  getLeaguePosts(leagueId: string): Promise<LeaguePost[]>;
  createLeaguePost(leagueId: string, post: CreateLeaguePost): Promise<LeaguePost>;
  joinLeague(codeOrToken: string, teamName?: string, managerName?: string, email?: string): Promise<LeagueAccess>;
  updateLeagueSize(leagueId: string, maxMembers: number): Promise<LeagueData>;
  updateLeagueSettings(leagueId: string, settings: { tradeRejectVotesRequired?: number; tradeReviewHours?: number }): Promise<LeagueData>;
  getTrades(leagueId: string): Promise<TradeOffer[]>;
  getTradePartners(leagueId: string): Promise<TradePartner[]>;
  createTrade(leagueId: string, trade: CreateTrade): Promise<TradeOffer>;
  resolveTrade(leagueId: string, tradeId: string, decision: 'accept' | 'reject' | 'cancel'): Promise<TradeOffer>;
  voteTrade(leagueId: string, tradeId: string, decision: 'approve' | 'reject'): Promise<TradeOffer>;
  getMatchup(leagueId?: string): Promise<MatchupData>;
  getRoster(leagueId?: string): Promise<RosterLineup>;
  getProfile(): Promise<ProfileData>;
  getTeam(): Promise<TeamData>;
  playCard(leagueId: string, cardId: string, playerId: string): Promise<AppliedModifier>;
  removeCard(leagueId: string, playId: string): Promise<void>;
  saveLineup(leagueId: string, roster: RosterLineup): Promise<RosterLineup>;
  updateProfile(update: ProfileUpdate): Promise<ProfileData>;
  updatePassword(currentPassword: string, newPassword: string): Promise<void>;
}
