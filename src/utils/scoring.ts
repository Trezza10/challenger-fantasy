import { MatchupPlayerData, Position, ScoreBreakdownItem } from '../types/fantasy';

/** Values shown in League Rules and used by the local mock scoring breakdown. */
export const SCORING_RULE_SECTIONS = [
  { id: 'offense', title: 'OFFENSIVE SCORING', rows: [['Reception', '+1.0 pt'], ['Receiving yards', '+0.10 / yard'], ['Receiving TD', '+6 pts'], ['Rushing yards', '+0.10 / yard'], ['Rushing TD', '+6 pts'], ['Passing yards', '+0.04 / yard'], ['Passing TD', '+4 pts'], ['2-point conversion', '+2 pts'], ['Interception thrown', '−2 pts'], ['Fumble lost', '−2 pts']] },
  { id: 'kicking', title: 'KICKING', rows: [['FG made: 0-39 yards', '+3 pts'], ['FG made: 40-49 yards', '+4 pts'], ['FG made: 50-59 yards', '+5 pts'], ['FG made: 60+ yards', '+6 pts'], ['Extra point made', '+1 pt'], ['Field goal missed', '−1 pt']] },
  { id: 'defense', title: 'DEFENSE / SPECIAL TEAMS', rows: [['Sack', '+1 pt'], ['Interception', '+2 pts'], ['Fumble recovery', '+2 pts'], ['Safety', '+2 pts'], ['Defensive or return TD', '+6 pts'], ['0 points allowed', '+5 pts'], ['1-6 points allowed', '+4 pts'], ['7-13 points allowed', '+3 pts'], ['28-34 points allowed', '−1 pt'], ['35+ points allowed', '−4 pts']] },
  { id: 'coach', title: 'COACH & ROSTER', rows: [['Team win (Coach)', '+3 pts'], ['Team loss (Coach)', '−1 pt'], ['Starters', 'QB, 2 RB, 2 WR, TE, FLEX, D/ST, K, Coach'], ['FLEX eligibility', 'RB / WR / TE'], ['Bench', 'Any position'], ['Lineup lock', 'Individual game kickoff']] },
] as const;

/** Gives mock-mode players the same calculation shape returned by the backend API. */
export function withMockScoreBreakdown(player: MatchupPlayerData): MatchupPlayerData {
  const weeklyHistory = player.weeklyHistory ?? buildMockHistory(player);
  if (!player.gameStarted) return { ...player, baseScore: 0, cardAdjustment: 0, score: 0, scoreBreakdown: [], weeklyHistory };
  if (player.scoreBreakdown || player.score === 0) return { ...player, baseScore: player.baseScore ?? player.score, cardAdjustment: player.cardAdjustment ?? 0, weeklyHistory };
  return { ...player, baseScore: player.score, cardAdjustment: 0, scoreBreakdown: buildBreakdown(player.position, player.score), weeklyHistory };
}

function buildMockHistory(player: MatchupPlayerData) {
  if (player.score <= 0) return [];
  return [1, 2, 3, 4].map((week) => {
    const basePoints = Number(Math.max(1, player.score + (week - 2) * 0.7).toFixed(1));
    const cardAdjustment = week === 3 && player.name.charCodeAt(0) % 3 === 0 ? 3 : 0;
    return { basePoints, cardAdjustment, opponent: ['DAL', 'NYG', 'WAS', 'GB'][week - 1], statLine: mockStatLine(player.position, basePoints), totalPoints: basePoints + cardAdjustment, week };
  });
}

function mockStatLine(position: Position, points: number) {
  if (position === 'QB') return `${Math.round(points / .04)} pass yds · ${Math.max(1, Math.floor(points / 10))} pass TD`;
  if (position === 'RB' || position === 'FLEX') return `${Math.round(points * 5)} rush yds · ${Math.max(1, Math.floor(points / 8))} TD`;
  if (position === 'WR' || position === 'TE') return `${Math.max(2, Math.round(points / 3))} rec · ${Math.round(points * 4)} rec yds`;
  if (position === 'DEF') return `${Math.max(1, Math.round(points / 3))} sacks`;
  if (position === 'K') return `${Math.max(1, Math.round(points / 4))} FG`;
  return points >= 3 ? 'Team win' : 'Team loss';
}

function buildBreakdown(position: Position, score: number): ScoreBreakdownItem[] {
  const rows: ScoreBreakdownItem[] = [];
  const remaining = () => Number((score - rows.reduce((total, row) => total + row.points, 0)).toFixed(2));
  const add = (label: string, quantity: number, pointsPerUnit: number) => {
    if (Math.abs(quantity) < .001) return;
    rows.push({ label, points: Number((quantity * pointsPerUnit).toFixed(2)), pointsPerUnit, quantity });
  };

  if (position === 'QB') {
    add('Passing touchdown(s)', Math.min(4, Math.floor(score / 4)), 4);
    add('Rushing yard(s)', Number((remaining() / .1).toFixed(2)), .1);
  } else if (position === 'RB' || position === 'FLEX' || position === 'WR' || position === 'TE') {
    add(position === 'RB' || position === 'FLEX' ? 'Rushing touchdown(s)' : 'Receiving touchdown(s)', Math.min(2, Math.floor(score / 6)), 6);
    add('Reception(s)', Math.min(5, Math.floor(remaining())), 1);
    add('Receiving yard(s)', Number((remaining() / .1).toFixed(2)), .1);
  } else if (position === 'DEF') {
    add('Defensive or return touchdown(s)', Math.min(1, Math.floor(score / 6)), 6);
    add('Sack(s)', remaining(), 1);
  } else if (position === 'K') {
    add('FG made: 50-59 yards', Math.min(1, Math.floor(score / 5)), 5);
    add('FG made: 40-49 yards', Math.floor(remaining() / 4), 4);
    add('Extra point(s) made', remaining(), 1);
  } else if (position === 'COACH') {
    const wins = Math.ceil(score / 3);
    add('Team win(s)', wins, 3);
    add('Team loss(es)', wins * 3 - score, -1);
  }
  return rows;
}
