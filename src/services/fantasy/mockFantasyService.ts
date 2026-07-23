import { HomeData, LeagueActivityEntry, LeagueData, LeagueMatchupSummary, LeagueSummary, MatchupData, MatchupPlayerData, Position, PowerCard, ProfileData, TeamData } from '../../types/fantasy';
import { FantasyService } from './FantasyService';
import { createMockCard, createMockInventory } from './mockCardCatalog';

// Static, schema-shaped data used until a backend is connected.
const home: HomeData = {
  leagueRank: '#3',
  news: [
    { body: 'The Titans enter Week 5 with the league’s third-highest projection after a strong run from the top of the roster. Jalen Hurts and Jahmyr Gibbs headline a lineup that has gained momentum across the last two scoring periods.\n\nManagers are keeping a close eye on the final injury reports before Sunday kickoff. The projected margin remains narrow enough that a timely card play could change the matchup.', category: 'MATCHUP REPORT', id: 'titans-week-five', publishedAt: '18 min ago', summary: 'Trezza Titans carry the third-highest projection into a tight Week 5 matchup.', title: 'Titans look to hold their edge in Week 5' },
    { body: 'Card activity has increased across the league as managers begin to use their limited inventory more aggressively. BOOST and CURSE cards have appeared in several head-to-head matchups, creating new decisions before games begin.\n\nRemember that cards can only be removed before the selected player’s game starts. Once kickoff happens, the modifier is locked for the rest of the scoring window.', category: 'LEAGUE UPDATE', id: 'card-activity', publishedAt: '1 hr ago', summary: 'Managers are beginning to use their card inventories ahead of Sunday.', title: 'Card activity rises ahead of the weekend slate' },
    { body: 'The Grid Iron Kings made a late roster adjustment, shifting their projected total and tightening the gap against the Titans. Their manager has not revealed whether another card play is planned.\n\nWith several games still pending, both teams have multiple paths to a Week 5 win.', category: 'OPPONENT WATCH', id: 'kings-roster-move', publishedAt: '2 hrs ago', summary: 'A late Grid Iron Kings move narrows the projected gap in your matchup.', title: 'Kings make a late lineup adjustment' },
  ],
  projectedPoints: 128.4,
  welcomeMessage: 'Your league draft begins in 3 days. Set your lineup and scout the competition.',
};
const team: TeamData = { rosterSpots: '10 / 10', topPlayer: 'Jalen Hurts' };
const league: LeagueData = { currentWeek: 1, memberCount: 10, name: 'Challengers League' };
const leagues: LeagueSummary[] = [
  { id: 'challengers', memberCount: 10, name: 'Challengers League' },
  { id: 'sunday-rivals', memberCount: 12, name: 'Sunday Rivals' },
  { id: 'office-gridiron', memberCount: 8, name: 'Office Gridiron' },
];
const profile: ProfileData = { memberSince: '2026', name: 'Your Name' };

/** Static feed data, sorted newest first, used to exercise cursor pagination in the UI. */
const activityFeed: LeagueActivityEntry[] = [
  ['Chris Harper', 'played Breakaway Threat on J. Taylor.', 'card', 'Jul 24, 2026 · 8:31 PM'], ['You', 'moved T. Higgins to the bench.', 'lineup', 'Jul 24, 2026 · 8:17 PM'], ['Maya Reed', 'offered D. Smith for A. Cooper.', 'trade', 'Jul 24, 2026 · 7:54 PM'], ['Jordan Lee', 'claimed R. Dowdle from waivers.', 'waiver', 'Jul 24, 2026 · 6:42 PM'], ['You', 'played Ground Control on A. Kamara.', 'card', 'Jul 24, 2026 · 5:28 PM'], ['Andre Cole', 'moved J. Warren into the FLEX slot.', 'lineup', 'Jul 24, 2026 · 4:15 PM'], ['Priya Shah', 'offered a trade to Leo Grant.', 'trade', 'Jul 23, 2026 · 9:06 PM'], ['Maya Reed', 'added K. Herbert from free agency.', 'waiver', 'Jul 23, 2026 · 7:48 PM'], ['Chris Harper', 'played Pocket Protector on J. Allen.', 'card', 'Jul 23, 2026 · 6:30 PM'], ['Jordan Lee', 'set their Week 5 starting lineup.', 'lineup', 'Jul 23, 2026 · 5:11 PM'], ['Leo Grant', 'dropped D. Singletary.', 'waiver', 'Jul 22, 2026 · 8:36 PM'], ['You', 'offered T. Higgins for J. Reed.', 'trade', 'Jul 22, 2026 · 7:20 PM'], ['Andre Cole', 'played Momentum Shift on C. Lamb.', 'card', 'Jul 22, 2026 · 6:03 PM'], ['Priya Shah', 'claimed J. Palmer from waivers.', 'waiver', 'Jul 22, 2026 · 4:44 PM'], ['Maya Reed', 'moved T. Etienne into the RB slot.', 'lineup', 'Jul 21, 2026 · 9:19 PM'], ['Chris Harper', 'offered J. Taylor for C. McCaffrey.', 'trade', 'Jul 21, 2026 · 7:55 PM'], ['Jordan Lee', 'played Red Zone Raider on T. Hill.', 'card', 'Jul 21, 2026 · 6:21 PM'], ['Leo Grant', 'added Z. White from free agency.', 'waiver', 'Jul 20, 2026 · 8:02 PM'], ['You', 'moved J. Love to the bench.', 'lineup', 'Jul 20, 2026 · 6:40 PM'], ['Andre Cole', 'completed a trade with Priya Shah.', 'trade', 'Jul 20, 2026 · 5:09 PM'], ['Maya Reed', 'played Air Raid on L. Jackson.', 'card', 'Jul 19, 2026 · 8:27 PM'], ['Chris Harper', 'claimed T. Tracy from waivers.', 'waiver', 'Jul 19, 2026 · 7:10 PM'], ['Jordan Lee', 'moved C. Godwin into the FLEX slot.', 'lineup', 'Jul 19, 2026 · 5:32 PM'], ['Leo Grant', 'offered a trade to You.', 'trade', 'Jul 18, 2026 · 9:01 PM'],
].map(([actor, summary, type, occurredAt], index) => ({ actor, id: `activity-${index + 1}`, occurredAt, summary, type: type as LeagueActivityEntry['type'] }));

const starterPositions: Position[] = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'DEF', 'K', 'COACH'];
const benchPositions: Position[] = ['QB', 'WR', 'RB'];

/** Builds complete mock player records from concise static player-name lists. */
function createPlayer(name: string, position: Position, team: string): MatchupPlayerData {
  return { gameStarted: false, liveStats: [{ label: 'Status', value: 'Upcoming' }], name, position, recentStats: [{ label: 'Last game', value: '12.4 pts' }, { label: 'Status', value: 'Active' }], score: 0, team };
}

/** Creates a small, static inventory for a manager while real card data is unavailable. */
function createTeamInventory(teamName: string): PowerCard[] {
  const inventory = createMockInventory(teamName);
  // Every manager receives an opponent-targeting option alongside their self-target cards.
  return inventory.some((card) => card.allowedTeam === 'OPPONENT')
    ? inventory
    : [...inventory, createMockCard('Momentum Shift', `${teamName}-momentum-shift`, 2)];
}

/** Builds another league matchup with ten starters and three bench players on each side. */
function createLeagueMatchup(id: string, leftName: string, leftTeam: string, leftPlayers: string[], rightName: string, rightTeam: string, rightPlayers: string[], featuredPlayers: string, gameTime: string, leftProjection: number, rightProjection: number, winChance: number): LeagueMatchupSummary {
  return {
    benchMatchups: benchPositions.map((position, index) => ({ left: createPlayer(leftPlayers[index + 10], position, leftTeam), right: createPlayer(rightPlayers[index + 10], position, rightTeam) })),
    featuredPlayers,
    gameTime,
    id,
    isLive: false,
    leftTeam: { hand: createTeamInventory(leftName), name: leftName, projectedPoints: leftProjection, score: 0 },
    playerMatchups: starterPositions.map((position, index) => ({ left: createPlayer(leftPlayers[index], position, leftTeam), right: createPlayer(rightPlayers[index], position, rightTeam) })),
    rightTeam: { hand: createTeamInventory(rightName), name: rightName, projectedPoints: rightProjection, score: 0 },
    winChance,
  };
}

const otherLeagueMatchups: LeagueMatchupSummary[] = [
  createLeagueMatchup('vipers-hawks', 'Velocity Vipers', 'BAL', ['L. Jackson', 'C. McCaffrey', 'A. Kamara', 'D. Adams', 'D. Metcalf', 'G. Kittle', 'J. Cook', 'Ravens D/ST', 'J. Tucker', 'J. Harbaugh', 'B. Mayfield', 'C. Godwin', 'Z. Charbonnet'], 'Harbor Hawks', 'MIA', ['T. Tagovailoa', 'R. White', 'D. Achane', 'T. Hill', 'J. Waddle', 'S. LaPorta', 'C. Kupp', 'Dolphins D/ST', 'J. Sanders', 'M. McDaniel', 'K. Cousins', 'C. Olave', 'T. Etienne'], 'L. Jackson · C. McCaffrey', 'Sun 4:25 PM', 131.8, 126.4, 58),
  createLeagueMatchup('knights-wolves', 'Neon Knights', 'CIN', ['J. Burrow', 'J. Mixon', 'I. Pacheco', 'J. Chase', 'D. London', 'D. Kincaid', 'R. Rice', 'Bengals D/ST', 'E. McPherson', 'Z. Taylor', 'D. Prescott', 'C. Ridley', 'A. Jones'], 'Iron Wolves', 'DET', ['A. Richardson', 'J. Jacobs', 'D. Swift', 'A. St. Brown', 'M. Evans', 'T. McBride', 'D. Samuel', 'Lions D/ST', 'J. Bates', 'D. Campbell', 'G. Smith', 'K. Allen', 'J. Warren'], 'J. Chase · A. St. Brown', 'Sun 4:25 PM', 124.2, 129.7, 47),
  createLeagueMatchup('bears-foxes', 'Solar Bears', 'TEN', ['W. Levis', 'D. Henry', 'R. Stevenson', 'N. Collins', 'C. Kirk', 'E. Engram', 'D. Montgomery', 'Titans D/ST', 'N. Folk', 'B. Callahan', 'M. Stafford', 'J. Reed', 'T. Spears'], 'Thunder Foxes', 'NYJ', ['A. Rodgers', 'B. Hall', 'A. Ekeler', 'G. Wilson', 'M. Pittman', 'D. Goedert', 'C. Watson', 'Jets D/ST', 'G. Zuerlein', 'R. Saleh', 'T. Lawrence', 'Z. Flowers', 'N. Harris'], 'D. Henry · B. Hall', 'Mon 8:15 PM', 119.9, 122.6, 46),
  createLeagueMatchup('comets-owls', 'Crimson Comets', 'KC', ['P. Mahomes', 'A. Jones', 'J. Conner', 'C. Cooper', 'T. Dell', 'D. Njoku', 'C. Sutton', 'Chiefs D/ST', 'H. Butker', 'A. Reid', 'J. Goff', 'J. Smith-Njigba', 'R. Mostert'], 'Arctic Owls', 'MIN', ['K. Murray', 'T. Pollard', 'A. Gibson', 'J. Jefferson', 'B. Aiyuk', 'K. Pitts', 'C. Samuel', 'Vikings D/ST', 'G. Joseph', 'K. OConnell', 'C. Williams', 'J. Downs', 'J. Ford'], 'P. Mahomes · J. Jefferson', 'Mon 8:15 PM', 137.5, 133.8, 54),
];

// Each league matchup includes one card played on its owner's player and one on their opponent.
otherLeagueMatchups[0].initialModifiers = [
  { card: createMockCard('Air Raid', 'vipers-air-raid'), id: 'vipers-air-raid-jackson', playedBy: 'opponent', playedByName: 'Maya Reed', playerName: 'L. Jackson' },
  { card: createMockCard('Momentum Shift', 'vipers-momentum-shift'), id: 'vipers-momentum-shift-hill', playedBy: 'opponent', playedByName: 'Maya Reed', playerName: 'T. Hill' },
];
otherLeagueMatchups[1].initialModifiers = [
  { card: createMockCard('Pocket Protector', 'knights-pocket-protector'), id: 'knights-pocket-protector-burrow', playedBy: 'opponent', playedByName: 'Andre Cole', playerName: 'J. Burrow' },
  { card: createMockCard('Momentum Shift', 'knights-momentum-shift'), id: 'knights-momentum-shift-richardson', playedBy: 'opponent', playedByName: 'Andre Cole', playerName: 'A. Richardson' },
];
otherLeagueMatchups[2].initialModifiers = [
  { card: createMockCard('Ground Control', 'bears-ground-control'), id: 'bears-ground-control-henry', playedBy: 'opponent', playedByName: 'Priya Shah', playerName: 'D. Henry' },
  { card: createMockCard('Momentum Shift', 'bears-momentum-shift'), id: 'bears-momentum-shift-hall', playedBy: 'opponent', playedByName: 'Priya Shah', playerName: 'B. Hall' },
];
otherLeagueMatchups[3].initialModifiers = [
  { card: createMockCard('Clutch Factor', 'comets-clutch-factor'), id: 'comets-clutch-factor-mahomes', playedBy: 'opponent', playedByName: 'Leo Grant', playerName: 'P. Mahomes' },
  { card: createMockCard('Momentum Shift', 'comets-momentum-shift'), id: 'comets-momentum-shift-jefferson', playedBy: 'opponent', playedByName: 'Leo Grant', playerName: 'J. Jefferson' },
];
const matchup: MatchupData = {
  // Bench entries are position-agnostic: any supported position can appear here.
  benchMatchups: [
    { left: { gameStarted: false, liveStats: [{ label: 'Status', value: 'Sun 4:25 PM' }], name: 'J. Love', position: 'QB', recentStats: [{ label: 'Pass YDS', value: '248' }, { label: 'Pass TD', value: '2' }], score: 0, team: 'GB' }, right: { gameStarted: false, liveStats: [{ label: 'Status', value: 'Sun 1:05 PM' }], name: 'C. Stroud', position: 'QB', recentStats: [{ label: 'Pass YDS', value: '265' }, { label: 'Pass TD', value: '2' }], score: 0, team: 'HOU' } },
    { left: { gameStarted: false, liveStats: [{ label: 'Status', value: 'Sun 1:05 PM' }], name: 'T. Higgins', position: 'WR', recentStats: [{ label: 'REC', value: '5' }, { label: 'YDS', value: '71' }], score: 0, team: 'CIN' }, right: { gameStarted: false, liveStats: [{ label: 'Status', value: 'Sun 4:25 PM' }], name: 'D. Moore', position: 'WR', recentStats: [{ label: 'REC', value: '6' }, { label: 'YDS', value: '83' }], score: 0, team: 'CHI' } },
    { left: { gameStarted: false, liveStats: [{ label: 'Status', value: 'Mon 8:15 PM' }], name: '49ers D/ST', position: 'DEF', recentStats: [{ label: 'Sacks', value: '4' }, { label: 'INT', value: '1' }], score: 0, team: 'SF' }, right: { gameStarted: false, liveStats: [{ label: 'Status', value: 'Sun 1:05 PM' }], name: 'Steelers D/ST', position: 'DEF', recentStats: [{ label: 'Sacks', value: '3' }, { label: 'INT', value: '2' }], score: 0, team: 'PIT' } },
  ],
  gameTime: 'Sun 1:05 PM',
  hand: [
    createMockCard('Second-Half Sniper', 'second-half-sniper', 2),
    createMockCard('Ground Control', 'ground-control'),
    createMockCard('Pocket Protector', 'pocket-protector'),
    createMockCard('Volume Play', 'volume-play'),
    createMockCard('Red Zone Raider', 'red-zone-raider'),
    createMockCard('Drive Surge', 'drive-surge'),
    createMockCard('Momentum Shift', 'momentum-shift', 2),
  ],
  isLive: true,
  initialModifiers: [
    // The opponent has targeted one player on the manager's team and boosted one of their own.
    { card: createMockCard('Momentum Shift', 'opponent-momentum-shift'), id: 'opponent-momentum-shift-lamb', playedBy: 'opponent', playedByName: 'Chris Harper', playerName: 'C. Lamb' },
    { card: createMockCard('Breakaway Threat', 'opponent-breakaway-threat'), id: 'opponent-breakaway-threat-taylor', playedBy: 'opponent', playedByName: 'Chris Harper', playerName: 'J. Taylor' },
  ],
  leftTeam: { name: 'Trezza Titans', projectedPoints: 142.6, score: 128.4 },
  leagueMatchups: [
    { featuredPlayers: 'J. Hurts · J. Allen', gameTime: 'Sun 1:05 PM', id: 'titans-kings', isLive: true, leftTeam: { name: 'Trezza Titans', projectedPoints: 142.6, score: 128.4 }, rightTeam: { name: 'Grid Iron Kings', projectedPoints: 135.1, score: 119.7 }, winChance: 84 },
    ...otherLeagueMatchups,
  ],
  playerMatchups: [
    { left: { gameStarted: false, liveStats: [{ label: 'Status', value: 'Sun 1:05 PM' }], name: 'J. Hurts', position: 'QB', recentStats: [{ label: 'Pass YDS', value: '286' }, { label: 'Pass TD', value: '3' }], score: 32.5, team: 'PHI' }, right: { gameStarted: false, liveStats: [{ label: 'Status', value: 'Sun 1:05 PM' }], name: 'J. Allen', position: 'QB', recentStats: [{ label: 'Pass YDS', value: '274' }, { label: 'Pass TD', value: '2' }], score: 21.6, team: 'BUF' } },
    { left: { gameStarted: false, liveStats: [{ label: 'Status', value: 'Sun 4:25 PM' }], name: 'J. Gibbs', position: 'RB', recentStats: [{ label: 'Rush YDS', value: '88' }, { label: 'TD', value: '1' }], score: 24.4, team: 'DET' }, right: { gameStarted: true, liveStats: [{ label: 'Rush YDS', value: '67' }, { label: 'TD', value: '1' }], name: 'J. Taylor', position: 'RB', recentStats: [{ label: 'Rush YDS', value: '94' }, { label: 'REC', value: '3' }], score: 15.6, team: 'IND' } },
    { left: { gameStarted: false, liveStats: [{ label: 'Status', value: 'Sun 4:25 PM' }], name: 'S. Barkley', position: 'RB', recentStats: [{ label: 'Rush YDS', value: '102' }, { label: 'TD', value: '1' }], score: 19.8, team: 'PHI' }, right: { gameStarted: false, liveStats: [{ label: 'Status', value: 'Sun 1:05 PM' }], name: 'K. Williams', position: 'RB', recentStats: [{ label: 'Rush YDS', value: '76' }, { label: 'REC', value: '4' }], score: 17.2, team: 'LAR' } },
    { left: { gameStarted: true, liveStats: [{ label: 'REC', value: '7' }, { label: 'YDS', value: '94' }], name: 'C. Lamb', position: 'WR', recentStats: [{ label: 'REC', value: '8' }, { label: 'YDS', value: '112' }], score: 21.3, team: 'DAL' }, right: { gameStarted: true, liveStats: [{ label: 'REC', value: '5' }, { label: 'YDS', value: '73' }], name: 'A. Brown', position: 'WR', recentStats: [{ label: 'REC', value: '6' }, { label: 'YDS', value: '89' }], score: 17.9, team: 'PHI' } },
    { left: { gameStarted: false, liveStats: [{ label: 'Status', value: 'Mon 8:15 PM' }], name: 'J. Jefferson', position: 'WR', recentStats: [{ label: 'REC', value: '9' }, { label: 'YDS', value: '126' }], score: 18.7, team: 'MIN' }, right: { gameStarted: false, liveStats: [{ label: 'Status', value: 'Sun 4:25 PM' }], name: 'P. Nacua', position: 'WR', recentStats: [{ label: 'REC', value: '7' }, { label: 'YDS', value: '104' }], score: 16.4, team: 'LAR' } },
    { left: { gameStarted: false, liveStats: [{ label: 'Status', value: 'Mon 8:15 PM' }], name: 'T. Kelce', position: 'TE', recentStats: [{ label: 'REC', value: '6' }, { label: 'YDS', value: '68' }], score: 13.2, team: 'KC' }, right: { gameStarted: true, liveStats: [{ label: 'REC', value: '4' }, { label: 'YDS', value: '45' }], name: 'M. Andrews', position: 'TE', recentStats: [{ label: 'REC', value: '5' }, { label: 'YDS', value: '58' }], score: 11.8, team: 'BAL' } },
    { left: { gameStarted: false, liveStats: [{ label: 'Status', value: 'Sun 1:05 PM' }], name: 'B. Robinson', position: 'FLEX', recentStats: [{ label: 'Rush YDS', value: '81' }, { label: 'REC', value: '5' }], score: 15.4, team: 'ATL' }, right: { gameStarted: false, liveStats: [{ label: 'Status', value: 'Sun 4:25 PM' }], name: 'D. Smith', position: 'FLEX', recentStats: [{ label: 'REC', value: '6' }, { label: 'YDS', value: '77' }], score: 14.1, team: 'PHI' } },
    { left: { gameStarted: false, liveStats: [{ label: 'Status', value: 'Sun 1:05 PM' }], name: 'Eagles D/ST', position: 'DEF', recentStats: [{ label: 'Sacks', value: '3' }, { label: 'INT', value: '2' }], score: 10.0, team: 'PHI' }, right: { gameStarted: false, liveStats: [{ label: 'Status', value: 'Sun 1:05 PM' }], name: 'Bills D/ST', position: 'DEF', recentStats: [{ label: 'Sacks', value: '2' }, { label: 'INT', value: '1' }], score: 8.0, team: 'BUF' } },
    { left: { gameStarted: false, liveStats: [{ label: 'Status', value: 'Sun 1:05 PM' }], name: 'J. Elliott', position: 'K', recentStats: [{ label: 'FG', value: '3/3' }, { label: 'XP', value: '2/2' }], score: 9.0, team: 'PHI' }, right: { gameStarted: false, liveStats: [{ label: 'Status', value: 'Sun 1:05 PM' }], name: 'T. Bass', position: 'K', recentStats: [{ label: 'FG', value: '2/2' }, { label: 'XP', value: '3/3' }], score: 8.0, team: 'BUF' } },
    { left: { gameStarted: false, liveStats: [{ label: 'Status', value: 'Sun 1:05 PM' }], name: 'N. Sirianni', position: 'COACH', recentStats: [{ label: 'Team W', value: '1' }, { label: 'PF', value: '27' }], score: 7.0, team: 'PHI' }, right: { gameStarted: false, liveStats: [{ label: 'Status', value: 'Sun 1:05 PM' }], name: 'S. McDermott', position: 'COACH', recentStats: [{ label: 'Team W', value: '1' }, { label: 'PF', value: '24' }], score: 6.0, team: 'BUF' } },
  ],
  rightTeam: { hand: createTeamInventory('Grid Iron Kings'), name: 'Grid Iron Kings', projectedPoints: 135.1, score: 119.7 },
  week: 5,
  winChance: 84,
};

/** Creates a complete league response from a league-specific manager matchup. */
function createLeagueMatchupData(ownMatchup: LeagueMatchupSummary, leagueMatchups: LeagueMatchupSummary[], week: number): MatchupData {
  const playerMatchups = ownMatchup.playerMatchups ?? [];
  const benchMatchups = ownMatchup.benchMatchups ?? [];
  return {
    benchMatchups,
    gameTime: ownMatchup.gameTime,
    hand: ownMatchup.leftTeam.hand ?? createTeamInventory(ownMatchup.leftTeam.name),
    initialModifiers: ownMatchup.initialModifiers ?? [],
    isLive: ownMatchup.isLive,
    leagueMatchups,
    leftTeam: ownMatchup.leftTeam,
    playerMatchups,
    rightTeam: ownMatchup.rightTeam,
    week,
    winChance: ownMatchup.winChance,
  };
}

// Each additional league has its own manager roster, opponent, schedule, scores, and card inventory.
const sundayRivalsOwnMatchup = createLeagueMatchup('sunday-strikers-crush', 'Sunday Strikers', 'NO', ['D. Maye', 'A. Kamara', 'J. Williams', 'C. Olave', 'D. Smith', 'D. Goedert', 'J. Meyers', 'Saints D/ST', 'W. Lutz', 'D. Allen', 'C. Williams', 'T. Lockett', 'R. Dowdle'], 'Coastal Crush', 'TB', ['B. Mayfield', 'R. White', 'B. Robinson', 'M. Evans', 'C. Godwin', 'C. Otton', 'J. Reed', 'Buccaneers D/ST', 'C. McLaughlin', 'T. Bowles', 'B. Nix', 'J. Addison', 'I. Likely'], 'A. Kamara · M. Evans', 'Sun 4:05 PM', 126.8, 123.4, 57);
sundayRivalsOwnMatchup.initialModifiers = [
  { card: createMockCard('Ground Control', 'strikers-ground-control'), id: 'strikers-ground-control-kamara', playedBy: 'manager', playedByName: 'You', playerName: 'A. Kamara' },
  { card: createMockCard('Momentum Shift', 'crush-momentum-shift'), id: 'crush-momentum-shift-olave', playedBy: 'opponent', playedByName: 'Jordan Lee', playerName: 'C. Olave' },
];

const officeGridironOwnMatchup = createLeagueMatchup('office-pioneers-aces', 'Office Pioneers', 'SF', ['B. Purdy', 'I. Pacheco', 'R. Mostert', 'D. Samuel', 'B. Aiyuk', 'G. Kittle', 'J. Downs', '49ers D/ST', 'J. Moody', 'K. Shanahan', 'G. Minshew', 'C. Sutton', 'Z. Moss'], 'Breakroom Aces', 'DAL', ['D. Prescott', 'T. Pollard', 'A. Jones', 'C. Lamb', 'G. Pickens', 'D. Njoku', 'T. Dell', 'Cowboys D/ST', 'B. Aubrey', 'M. McCarthy', 'R. Wilson', 'J. Palmer', 'T. Allgeier'], 'B. Purdy · C. Lamb', 'Mon 8:15 PM', 118.6, 121.9, 48);
officeGridironOwnMatchup.initialModifiers = [
  { card: createMockCard('Pocket Protector', 'pioneers-pocket-protector'), id: 'pioneers-pocket-protector-purdy', playedBy: 'manager', playedByName: 'You', playerName: 'B. Purdy' },
  { card: createMockCard('Hot Hand', 'aces-hot-hand'), id: 'aces-hot-hand-lamb', playedBy: 'opponent', playedByName: 'Morgan Diaz', playerName: 'C. Lamb' },
];

const sundayRivalsMatchups: LeagueMatchupSummary[] = [
  sundayRivalsOwnMatchup,
  createLeagueMatchup('sunday-sabers-swarm', 'Midnight Sabers', 'SEA', ['G. Smith', 'K. Walker', 'J. Ford', 'D. Moore', 'C. Kirk', 'N. Fant', 'D. Johnson', 'Seahawks D/ST', 'J. Myers', 'M. Macdonald', 'D. Carr', 'J. Dotson', 'T. Bigsby'], 'Miami Swarm', 'MIA', ['T. Tagovailoa', 'D. Achane', 'R. White', 'T. Hill', 'J. Waddle', 'D. Kincaid', 'R. Shaheed', 'Dolphins D/ST', 'J. Sanders', 'M. McDaniel', 'B. Young', 'R. Doubs', 'K. Herbert'], 'K. Walker · T. Hill', 'Sun 1:00 PM', 120.4, 128.1, 44),
  createLeagueMatchup('sunday-blazers-pilots', 'River Blazers', 'ATL', ['K. Cousins', 'B. Robinson', 'T. Allgeier', 'D. London', 'D. Mooney', 'K. Pitts', 'C. Watson', 'Falcons D/ST', 'Y. Koo', 'R. Morris', 'J. Herbert', 'Q. Johnston', 'T. Tracy'], 'Skyline Pilots', 'LAC', ['J. Herbert', 'J. Jacobs', 'N. Harris', 'K. Allen', 'L. McConkey', 'T. Hockenson', 'M. Nabers', 'Chargers D/ST', 'C. Dicker', 'J. Harbaugh', 'A. Rodgers', 'J. Jeudy', 'A. Mattison'], 'B. Robinson · J. Herbert', 'Sun 4:25 PM', 124.6, 117.8, 61),
  createLeagueMatchup('sunday-royals-forge', 'Emerald Royals', 'GB', ['J. Love', 'J. Gibbs', 'A. Jones', 'C. Lamb', 'J. Reed', 'S. LaPorta', 'T. Higgins', 'Packers D/ST', 'B. McManus', 'M. LaFleur', 'C. Stroud', 'A. Cooper', 'D. Singletary'], 'Iron Forge', 'PIT', ['R. Wilson', 'J. Warren', 'N. Chubb', 'G. Pickens', 'C. Sutton', 'P. Freiermuth', 'J. Addison', 'Steelers D/ST', 'C. Boswell', 'M. Tomlin', 'B. Mayfield', 'M. Wilson', 'J. McLaughlin'], 'J. Gibbs · G. Pickens', 'Mon 8:15 PM', 130.2, 116.7, 66),
];

const officeGridironMatchups: LeagueMatchupSummary[] = [
  officeGridironOwnMatchup,
  createLeagueMatchup('office-analysts-builders', 'Data Analysts', 'CLE', ['D. Watson', 'N. Chubb', 'J. Cook', 'A. Cooper', 'A. Thielen', 'D. Schultz', 'C. Ridley', 'Browns D/ST', 'D. Hopkins', 'K. Stefanski', 'T. Lawrence', 'W. Robinson', 'R. Johnson'], 'Night Builders', 'CHI', ['C. Williams', 'D. Swift', 'R. Stevenson', 'D. Moore', 'K. Allen', 'C. Kmet', 'T. McLaurin', 'Bears D/ST', 'C. Santos', 'M. Eberflus', 'M. Stafford', 'C. Samuel', 'Z. White'], 'N. Chubb · D. Moore', 'Sun 1:00 PM', 115.3, 113.8, 52),
  createLeagueMatchup('office-orbit-summit', 'Orbit Runners', 'ARI', ['K. Murray', 'J. Conner', 'A. Ekeler', 'M. Harrison Jr.', 'Z. Flowers', 'T. McBride', 'J. Smith-Njigba', 'Cardinals D/ST', 'M. Prater', 'J. Gannon', 'L. Jackson', 'R. Bateman', 'J. Hill'], 'Summit Squad', 'BAL', ['L. Jackson', 'D. Henry', 'G. Edwards', 'Z. Flowers', 'R. Bateman', 'M. Andrews', 'C. Godwin', 'Ravens D/ST', 'J. Tucker', 'J. Harbaugh', 'T. Tagovailoa', 'T. Lockett', 'T. Spears'], 'K. Murray · L. Jackson', 'Sun 4:25 PM', 122.1, 125.6, 49),
  createLeagueMatchup('office-circuit-vault', 'Circuit Breakers', 'CIN', ['J. Burrow', 'Z. Moss', 'J. Mixon', 'J. Chase', 'T. Dell', 'T. McBride', 'D. Samuel', 'Bengals D/ST', 'E. McPherson', 'Z. Taylor', 'A. Richardson', 'M. Evans', 'J. Warren'], 'Vault Keepers', 'MIN', ['S. Darnold', 'A. Gibson', 'T. Pollard', 'J. Jefferson', 'B. Aiyuk', 'K. Pitts', 'C. Kupp', 'Vikings D/ST', 'G. Joseph', 'K. OConnell', 'B. Nix', 'J. Downs', 'R. Mostert'], 'J. Chase · J. Jefferson', 'Mon 8:15 PM', 127.4, 131.5, 46),
];

const leagueDataById: Record<string, LeagueData> = {
  challengers: { currentWeek: 5, memberCount: 10, name: 'Challengers League' },
  'sunday-rivals': { currentWeek: 8, memberCount: 12, name: 'Sunday Rivals' },
  'office-gridiron': { currentWeek: 3, memberCount: 8, name: 'Office Gridiron' },
};
const matchupDataByLeagueId: Record<string, MatchupData> = {
  challengers: matchup,
  'sunday-rivals': createLeagueMatchupData(sundayRivalsOwnMatchup, sundayRivalsMatchups, 8),
  'office-gridiron': createLeagueMatchupData(officeGridironOwnMatchup, officeGridironMatchups, 3),
};

/** Simulates a brief network round trip so loading UI can be tested with mock data. */
const mockNetworkDelay = () => new Promise<void>((resolve) => setTimeout(resolve, 650));

/** Mock provider returning static data that already conforms to the app's data types. */
export const mockFantasyService: FantasyService = {
  async getHome() { await mockNetworkDelay(); return home; },
  async getLeagueActivity(_leagueId = 'challengers', cursor = 0, limit = 10) { await mockNetworkDelay(); const entries = activityFeed.slice(cursor, cursor + limit); const nextCursor = cursor + entries.length < activityFeed.length ? cursor + entries.length : null; return { entries, nextCursor }; },
  async getLeague(leagueId = 'challengers') { await mockNetworkDelay(); return leagueDataById[leagueId] ?? league; },
  async getLeagues() { await mockNetworkDelay(); return leagues; },
  async getMatchup(leagueId = 'challengers') { await mockNetworkDelay(); return matchupDataByLeagueId[leagueId] ?? matchup; },
  async getProfile() { await mockNetworkDelay(); return profile; },
  async getTeam() { await mockNetworkDelay(); return team; },
};
