import { Position, PowerCard } from '../../types/fantasy';

type CardTemplate = Omit<PowerCard, 'id' | 'quantity'>;

/** Mock translation of the supplied stacked_fantasy card, effect, and condition SQL. */
const cardCatalog: Record<string, CardTemplate> = {
  'Second-Half Sniper': { accent: '#54C9FF', allowedPositions: ['WR'], allowedTeam: 'SELF', description: 'If the player scores a receiving touchdown in the second half, gain 5 points after the game.', duration: 'Post-game · Second half', effectText: '+5 PTS', icon: 'football', label: 'SECOND-HALF SNIPER', rarity: 'Rare', type: 'Strategy' },
  'Ground Control': { accent: '#86E04F', allowedPositions: ['RB'], allowedTeam: 'SELF', description: 'If the player rushes for 60 or more yards, gain 3 points after the game.', duration: 'Post-game · Full game', effectText: '+3 PTS', icon: 'layers', label: 'GROUND CONTROL', rarity: 'Common', type: 'Strategy' },
  'Pocket Protector': { accent: '#B74CFF', allowedPositions: ['QB'], allowedTeam: 'SELF', description: 'If your quarterback avoids an interception, gain 4 points after the game.', duration: 'Post-game · Full game', effectText: '+4 PTS', icon: 'lock-closed', label: 'POCKET PROTECTOR', rarity: 'Epic', type: 'Strategy' },
  'Volume Play': { accent: '#5CC8FF', allowedPositions: ['WR', 'TE'], allowedTeam: 'SELF', description: 'If the player receives 8 or more targets, gain 2 points after the game.', duration: 'Post-game · Full game', effectText: '+2 PTS', icon: 'radio', label: 'VOLUME PLAY', rarity: 'Common', type: 'Strategy' },
  'Red Zone Raider': { accent: '#FF9C3D', allowedPositions: ['RB', 'WR', 'TE'], allowedTeam: 'SELF', description: 'If the player scores a touchdown in the red zone, gain 6 points after the game.', duration: 'Post-game · Red zone', effectText: '+6 PTS', icon: 'flame', label: 'RED ZONE RAIDER', rarity: 'Legendary', type: 'Strategy' },
  'Drive Surge': { accent: '#F3B61F', allowedPositions: ['RB'], allowedTeam: 'SELF', description: 'For the next drive, double every rushing yard earned by the player.', duration: 'Next drive', effectText: '2× RUSH YDS', icon: 'rocket', label: 'DRIVE SURGE', rarity: 'Rare', type: 'Tactic' },
  'Air Raid': { accent: '#B74CFF', allowedPositions: ['QB'], allowedTeam: 'SELF', description: 'For the next two drives, passing yards score at 1.5 times their normal value.', duration: 'Next 2 drives', effectText: '1.5× PASS YDS', icon: 'trending-up', label: 'AIR RAID', rarity: 'Epic', type: 'Tactic' },
  'Breakaway Threat': { accent: '#FF784F', allowedPositions: ['RB', 'WR'], allowedTeam: 'SELF', description: 'If the player scores a touchdown on their next drive, double the touchdown value.', duration: 'Next drive', effectText: '2× TD VALUE', icon: 'speedometer', label: 'BREAKAWAY THREAT', rarity: 'Legendary', type: 'Tactic' },
  'Momentum Shift': { accent: '#F35454', allowedPositions: ['ALL'], allowedTeam: 'OPPONENT', description: 'Halve the opposing player’s next scoring play.', duration: 'Next scoring play', effectText: '½× NEXT PLAY', icon: 'swap-horizontal', label: 'MOMENTUM SHIFT', rarity: 'Rare', type: 'Tactic' },
  'Hot Hand': { accent: '#FF6E9B', allowedPositions: ['WR', 'RB'], allowedTeam: 'SELF', description: 'If the player gains 20 or more yards on one play, add 3 points after the game.', duration: 'Post-game · Full game', effectText: '+3 PTS', icon: 'flame', label: 'HOT HAND', rarity: 'Common', type: 'Tactic' },
  'Stat Padder': { accent: '#E7E9E8', allowedPositions: ['ALL'], allowedTeam: 'SELF', description: 'Add 1 point for every touchdown the player scores.', duration: 'Post-game · Full game', effectText: '+1 / TD', icon: 'stats-chart', label: 'STAT PADDER', rarity: 'Common', type: 'Review' },
  'Yardage Bonus': { accent: '#6EE7D4', allowedPositions: ['WR'], allowedTeam: 'SELF', description: 'If the player gains 50 or more receiving yards, add 2 points after the game.', duration: 'Post-game · Full game', effectText: '+2 PTS', icon: 'bar-chart', label: 'YARDAGE BONUS', rarity: 'Common', type: 'Review' },
  'Efficiency Boost': { accent: '#64D999', allowedPositions: ['RB'], allowedTeam: 'SELF', description: 'If the player averages 5 or more yards per carry, add 3 points after the game.', duration: 'Post-game · Full game', effectText: '+3 PTS', icon: 'analytics', label: 'EFFICIENCY BOOST', rarity: 'Rare', type: 'Review' },
  'Clutch Factor': { accent: '#D08CFF', allowedPositions: ['ALL'], allowedTeam: 'SELF', description: 'If the player scores in the fourth quarter, add 4 points after the game.', duration: 'Post-game · Fourth quarter', effectText: '+4 PTS', icon: 'timer', label: 'CLUTCH FACTOR', rarity: 'Epic', type: 'Review' },
  'Clean Sheet': { accent: '#7FCBFF', allowedPositions: ['ALL'], allowedTeam: 'SELF', description: 'If the player commits no turnovers, add 2 points after the game.', duration: 'Post-game · Full game', effectText: '+2 PTS', icon: 'checkmark-circle', label: 'CLEAN SHEET', rarity: 'Rare', type: 'Review' },
};

/** Creates an independently consumable inventory copy from a catalog card. */
export function createMockCard(name: keyof typeof cardCatalog, id: string, quantity = 1): PowerCard {
  return { ...cardCatalog[name], id, quantity };
}

/** Gives each mock manager a different rotating slice of the supplied card catalog. */
export function createMockInventory(teamName: string): PowerCard[] {
  const names = Object.keys(cardCatalog) as (keyof typeof cardCatalog)[];
  const offset = teamName.split('').reduce((total, character) => total + character.charCodeAt(0), 0) % names.length;
  return Array.from({ length: 6 }, (_, index) => {
    const name = names[(offset + index) % names.length];
    return createMockCard(name, `${teamName}-${name.toLowerCase().replaceAll(' ', '-')}`, index === 0 ? 2 : 1);
  });
}
