import { Position } from '../types/fantasy';

/** Shared visual mapping for every roster position across draft, team, matchup, and acquisition views. */
export const positionColors: Record<Position, string> = {
  QB: '#61D3F2',
  RB: '#B6FF00',
  WR: '#C66AFF',
  TE: '#F6C544',
  FLEX: '#B6FF00',
  DEF: '#F18A6B',
  K: '#EFA6EC',
  COACH: '#91A09C',
};

/** Resolves a position label to its shared foreground color. */
export function getPositionColor(position: Position | string) { return positionColors[position as Position] ?? positionColors.FLEX; }

/** Dark companion fills preserve readable text when a whole tile is position-colored. */
export function getPositionFill(position: Position | string) {
  const fills: Record<string, string> = { QB: '#12313A', RB: '#263710', WR: '#301948', TE: '#493709', DEF: '#482419', K: '#41223F', COACH: '#26312F', FLEX: '#263710' };
  return fills[position] ?? fills.FLEX;
}
