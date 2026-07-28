import { AppliedModifier, CardClaimState, CreateLeaguePost, DraftState, HomeData, LeagueAccess, LeagueActivityPage, LeagueData, LeagueInvitation, LeagueMember, LeaguePost, LeagueSummary, MatchupData, ProfileData, ProfileUpdate, RosterLineup, TeamData, TradeOffer, TradePartner } from '../../types/fantasy';
import { apiFetch, apiRequest } from '../api/client';
import { FantasyService } from './FantasyService';

/** Real provider. Update these endpoint paths when the backend API is finalized. */
export const apiFantasyService: FantasyService = {
  getHome: () => apiFetch<HomeData>('/home'),
  getLeagueActivity: (leagueId = 'challengers', cursor = 0, limit = 10) => apiFetch<LeagueActivityPage>(`/leagues/${leagueId}/activity?cursor=${cursor}&limit=${limit}`),
  getLeague: (leagueId = 'challengers') => apiFetch<LeagueData>(`/leagues/${leagueId}`),
  getLeagues: () => apiFetch<LeagueSummary[]>('/leagues'),
  createLeague: (name, teamName, maxMembers, managerName, email) => apiRequest<LeagueAccess>('/leagues', { body: JSON.stringify({ email: email || null, managerName: managerName || null, maxMembers, name, teamName }), method: 'POST' }),
  createLeagueInvitation: (leagueId, email) => apiRequest<LeagueInvitation>(`/leagues/${leagueId}/invitations`, { body: JSON.stringify({ email: email || null }), method: 'POST' }),
  completeDraft: (leagueId) => apiRequest<void>(`/leagues/${leagueId}/draft/complete`, { method: 'POST' }),
  getCardClaim: (leagueId) => apiFetch<CardClaimState>(`/leagues/${leagueId}/cards/claims/current`),
  claimCard: (leagueId, offerId, cardId) => apiRequest<CardClaimState>(`/leagues/${leagueId}/cards/claims`, { body: JSON.stringify({ cardId, offerId }), method: 'POST' }),
  getDraft: (leagueId) => apiFetch<DraftState>(`/leagues/${leagueId}/draft`),
  makeDraftPick: (leagueId, playerId) => apiRequest<DraftState>(`/leagues/${leagueId}/draft/picks`, { body: JSON.stringify({ playerId }), method: 'POST' }),
  scheduleDraft: (leagueId, startsAt) => apiRequest<DraftState>(`/leagues/${leagueId}/draft/schedule`, { body: JSON.stringify({ startsAt }), method: 'PUT' }),
  getLeagueAccess: (leagueId) => apiFetch<LeagueAccess>(`/leagues/${leagueId}/access`),
  getLeagueMembers: (leagueId) => apiFetch<LeagueMember[]>(`/leagues/${leagueId}/members`),
  getLeaguePosts: (leagueId) => apiFetch<LeaguePost[]>(`/leagues/${leagueId}/posts`),
  createLeaguePost: (leagueId, post: CreateLeaguePost) => apiRequest<LeaguePost>(`/leagues/${leagueId}/posts`, { body: JSON.stringify(post), method: 'POST' }),
  joinLeague: (codeOrToken, teamName, managerName, email) => apiRequest<LeagueAccess>('/leagues/join', { body: JSON.stringify({ codeOrToken, email: email || null, managerName: managerName || null, teamName: teamName || null }), method: 'POST' }),
  updateLeagueSize: (leagueId, maxMembers) => apiRequest<LeagueData>(`/leagues/${leagueId}/settings`, { body: JSON.stringify({ maxMembers }), method: 'PATCH' }),
  updateLeagueSettings: (leagueId, settings) => apiRequest<LeagueData>(`/leagues/${leagueId}/settings`, { body: JSON.stringify(settings), method: 'PATCH' }),
  getTrades: (leagueId) => apiFetch<TradeOffer[]>(`/leagues/${leagueId}/trades`),
  getTradePartners: (leagueId) => apiFetch<TradePartner[]>(`/leagues/${leagueId}/trades/partners`),
  createTrade: (leagueId, trade) => apiRequest<TradeOffer>(`/leagues/${leagueId}/trades`, { body: JSON.stringify(trade), method: 'POST' }),
  resolveTrade: (leagueId, tradeId, decision) => apiRequest<TradeOffer>(`/leagues/${leagueId}/trades/${tradeId}`, { body: JSON.stringify({ decision }), method: 'PATCH' }),
  voteTrade: (leagueId, tradeId, decision) => apiRequest<TradeOffer>(`/leagues/${leagueId}/trades/${tradeId}/votes`, { body: JSON.stringify({ decision }), method: 'POST' }),
  getMatchup: (leagueId = 'challengers') => apiFetch<MatchupData>(`/leagues/${leagueId}/matchup`),
  getRoster: (leagueId = 'challengers') => apiFetch<RosterLineup>(`/leagues/${leagueId}/roster`),
  getProfile: () => apiFetch<ProfileData>('/profile'),
  getTeam: () => apiFetch<TeamData>('/team'),
  playCard: (leagueId, cardId, playerId) => apiRequest<AppliedModifier>(`/leagues/${leagueId}/cards/plays`, { body: JSON.stringify({ cardId, playerId }), method: 'POST' }),
  removeCard: (leagueId, playId) => apiRequest<void>(`/leagues/${leagueId}/cards/plays/${playId}`, { method: 'DELETE' }),
  saveLineup: (leagueId, roster) => apiRequest<RosterLineup>(`/leagues/${leagueId}/lineup`, {
    body: JSON.stringify({
      bench: roster.bench.map((slot) => ({ playerId: slot.player.id, slotId: slot.id })),
      starters: roster.starters.map((slot) => ({ playerId: slot.player.id, slotId: slot.id })),
    }),
    method: 'PUT',
  }),
  updateProfile: (update: ProfileUpdate) => apiRequest<ProfileData>('/profile', { body: JSON.stringify(update), headers: { 'Content-Type': 'application/json' }, method: 'PATCH' }),
  updatePassword: (currentPassword: string, newPassword: string) => apiRequest<void>('/profile/password', { body: JSON.stringify({ currentPassword, newPassword }), headers: { 'Content-Type': 'application/json' }, method: 'PATCH' }),
};
