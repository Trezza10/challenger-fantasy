import { HomeData, LeagueActivityPage, LeagueData, LeagueSummary, MatchupData, ProfileData, ProfileUpdate, TeamData } from '../../types/fantasy';

/**
 * Contract shared by the temporary mock implementation and future backend implementation.
 * UI code only depends on this interface, never on a specific data source.
 */
export interface FantasyService {
  getHome(): Promise<HomeData>;
  getLeagueActivity(leagueId?: string, cursor?: number, limit?: number): Promise<LeagueActivityPage>;
  getLeague(leagueId?: string): Promise<LeagueData>;
  getLeagues(): Promise<LeagueSummary[]>;
  getMatchup(leagueId?: string): Promise<MatchupData>;
  getProfile(): Promise<ProfileData>;
  getTeam(): Promise<TeamData>;
  updateProfile(update: ProfileUpdate): Promise<ProfileData>;
  updatePassword(currentPassword: string, newPassword: string): Promise<void>;
}
