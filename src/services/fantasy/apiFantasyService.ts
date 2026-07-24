import { HomeData, LeagueActivityPage, LeagueData, LeagueSummary, MatchupData, ProfileData, ProfileUpdate, TeamData } from '../../types/fantasy';
import { apiFetch, apiRequest } from '../api/client';
import { FantasyService } from './FantasyService';

/** Real provider. Update these endpoint paths when the backend API is finalized. */
export const apiFantasyService: FantasyService = {
  getHome: () => apiFetch<HomeData>('/home'),
  getLeagueActivity: (leagueId = 'challengers', cursor = 0, limit = 10) => apiFetch<LeagueActivityPage>(`/leagues/${leagueId}/activity?cursor=${cursor}&limit=${limit}`),
  getLeague: (leagueId = 'challengers') => apiFetch<LeagueData>(`/leagues/${leagueId}`),
  getLeagues: () => apiFetch<LeagueSummary[]>('/leagues'),
  getMatchup: (leagueId = 'challengers') => apiFetch<MatchupData>(`/leagues/${leagueId}/matchup`),
  getProfile: () => apiFetch<ProfileData>('/profile'),
  getTeam: () => apiFetch<TeamData>('/team'),
  updateProfile: (update: ProfileUpdate) => apiRequest<ProfileData>('/profile', { body: JSON.stringify(update), headers: { 'Content-Type': 'application/json' }, method: 'PATCH' }),
  updatePassword: (currentPassword: string, newPassword: string) => apiRequest<void>('/profile/password', { body: JSON.stringify({ currentPassword, newPassword }), headers: { 'Content-Type': 'application/json' }, method: 'PATCH' }),
};
