import { HomeData, LeagueActivityPage, LeagueData, LeagueSummary, MatchupData, ProfileData, TeamData } from '../../types/fantasy';
import { apiFetch } from '../api/client';
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
};
