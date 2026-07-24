/** Lightweight mock schedule lookup used until live game data is supplied by the API. */
export function getGameInfo(team: string) {
  const opponents: Record<string, string> = { ARI: 'SEA', ATL: 'CAR', BUF: 'MIA', CHI: 'GB', CIN: 'CLE', CLE: 'PIT', DAL: 'NYG', DEN: 'LV', DET: 'MIN', GB: 'CHI', HOU: 'IND', IND: 'HOU', KC: 'LAC', LAC: 'KC', LAR: 'SF', LV: 'DEN', MIA: 'BUF', MIN: 'DET', NYG: 'DAL', NYJ: 'NE', PHI: 'WAS', PIT: 'CLE', SF: 'LAR', TB: 'NO', TEN: 'JAX' };
  return { opponent: opponents[team] ?? 'TBD', time: ['Sun 1:00 PM', 'Sun 4:25 PM', 'Mon 8:15 PM'][team.length % 3] };
}
