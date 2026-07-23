import Ionicons from '@expo/vector-icons/Ionicons';
import { ComponentProps, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ServiceState } from '../features/ui/ServiceState';
import { useServiceData } from '../hooks/useServiceData';
import { fantasyService } from '../services/fantasy';
import { colors } from '../theme/colors';
import { LeagueActivityEntry, LeagueData, LeagueSummary } from '../types/fantasy';

type IconName = ComponentProps<typeof Ionicons>['name'];
type LeagueDestination = 'activity' | 'chat' | 'draft' | 'members' | 'playoffs' | 'rules' | 'settings' | 'standings' | 'trades';

interface LeagueHubItem { description: string; icon: IconName; id: LeagueDestination; title: string; }

/** The tools available from the league home page. Each opens an in-tab detail page. */
const leagueHubItems: LeagueHubItem[] = [
  { description: 'Rankings, records, and points for', icon: 'podium-outline', id: 'standings', title: 'Standings' },
  { description: 'Card plays, lineup moves, and results', icon: 'pulse-outline', id: 'activity', title: 'Activity' },
  { description: 'Review offers and completed moves', icon: 'swap-horizontal-outline', id: 'trades', title: 'Trades' },
  { description: 'Bracket, seeding, and clinching paths', icon: 'trophy-outline', id: 'playoffs', title: 'Playoffs' },
  { description: 'Draft board, picks, and recap', icon: 'layers-outline', id: 'draft', title: 'Draft' },
  { description: 'League messages and commissioner notes', icon: 'chatbubbles-outline', id: 'chat', title: 'Chat' },
  { description: 'Managers, teams, and invitations', icon: 'people-outline', id: 'members', title: 'Members' },
  { description: 'Scoring, roster, and card rules', icon: 'book-outline', id: 'rules', title: 'Rules' },
  { description: 'Commissioner controls and preferences', icon: 'settings-outline', id: 'settings', title: 'Settings' },
];

/** Change this array to configure the mock draft's total roster rounds. */
const draftPositions = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'DEF', 'K', 'COACH', 'BENCH', 'BENCH', 'BENCH'];
const draftTeams = ['Trezza Titans', 'Grid Iron Kings', 'Velocity Vipers', 'Harbor Hawks', 'Neon Knights', 'Iron Wolves', 'Solar Bears', 'Thunder Foxes', 'Crimson Comets', 'Arctic Owls', 'Midnight Sabers', 'Miami Swarm'];
const mockFirstNames = ['Jalen', 'Caleb', 'Jayden', 'Lamar', 'Justin', 'Bijan', 'Jahmyr', 'Saquon', 'Amon-Ra', 'CeeDee', 'Puka', 'Brock', 'Trey', 'Nico', 'Garrett', 'Travis', 'Sam', 'Tyler', 'Brandon', 'Chris'];
const mockLastNames = ['Hurts', 'Williams', 'Daniels', 'Jackson', 'Herbert', 'Robinson', 'Gibbs', 'Barkley', 'St. Brown', 'Lamb', 'Nacua', 'Bowers', 'McBride', 'Collins', 'Wilson', 'Kelce', 'LaPorta', 'Lockett', 'Aiyuk', 'Olave'];
const nflTeams = ['PHI', 'BUF', 'BAL', 'DET', 'SF', 'DAL', 'KC', 'MIN', 'CIN', 'GB'];

/** League hub with compact, mock-backed detail pages while the fuller API is pending. */
export function LeagueScreen({ onRegisterReachEnd, onRegisterRefresh, selectedLeague }: { onRegisterReachEnd: (handler: () => void) => () => void; onRegisterRefresh: (refresh: () => Promise<void>) => () => void; selectedLeague?: LeagueSummary | null }) {
  const [destination, setDestination] = useState<LeagueDestination | null>(null);
  const loadSelectedLeague = useCallback(() => fantasyService.getLeague(selectedLeague?.id), [selectedLeague?.id]);
  const { data, error, isLoading, refetch } = useServiceData(loadSelectedLeague);

  useEffect(() => onRegisterRefresh(refetch), [onRegisterRefresh, refetch]);
  useEffect(() => setDestination(null), [selectedLeague?.id]);
  if (!data) return <ServiceState error={error} isLoading={isLoading} />;

  if (destination) return <LeagueDetail data={data} destination={destination} isCommissioner={selectedLeague?.id === 'challengers'} leagueId={selectedLeague?.id ?? 'challengers'} onBack={() => setDestination(null)} onRegisterReachEnd={onRegisterReachEnd} />;
  return <LeagueHub data={data} memberCount={selectedLeague?.memberCount ?? data.memberCount} onSelect={setDestination} />;
}

/** Main league page: a league snapshot followed by each available league tool. */
function LeagueHub({ data, memberCount, onSelect }: { data: LeagueData; memberCount: number; onSelect: (destination: LeagueDestination) => void }) {
  return <View style={styles.screen}>
    <View style={styles.heroCard}><Text style={styles.eyebrow}>LEAGUE HQ</Text><Text style={styles.leagueName}>{data.name}</Text><View style={styles.stats}><LeagueStat label="MEMBERS" value={String(memberCount)} /><LeagueStat label="CURRENT WEEK" value={String(data.currentWeek)} /><LeagueStat label="YOUR RANK" value="#3" /></View></View>
    <Text style={styles.sectionTitle}>LEAGUE TOOLS</Text>
    <View style={styles.toolGrid}>{leagueHubItems.map((item) => <Pressable key={item.id} onPress={() => onSelect(item.id)} style={({ pressed }) => [styles.toolCard, pressed && styles.pressed]}><View style={styles.toolIcon}><Ionicons color={colors.accent} name={item.icon} size={21} /></View><View style={styles.toolText}><Text style={styles.toolTitle}>{item.title}</Text><Text numberOfLines={2} style={styles.toolDescription}>{item.description}</Text></View><Ionicons color={colors.muted} name="chevron-forward" size={17} /></Pressable>)}</View>
  </View>;
}

/** Simple reusable back page used until each league feature has a dedicated service and workflow. */
function LeagueDetail({ data, destination, isCommissioner, leagueId, onBack, onRegisterReachEnd }: { data: LeagueData; destination: LeagueDestination; isCommissioner: boolean; leagueId: string; onBack: () => void; onRegisterReachEnd: (handler: () => void) => () => void }) {
  const item = leagueHubItems.find((entry) => entry.id === destination)!;
  if (destination === 'activity') return <LeagueActivity leagueId={leagueId} onBack={onBack} onRegisterReachEnd={onRegisterReachEnd} />;
  if (destination === 'draft') return <DraftBoard data={data} onBack={onBack} />;
  if (destination === 'rules') return <LeagueRules data={data} onBack={onBack} />;
  const detail = getDetailContent(destination, data, isCommissioner);
  return <View style={styles.screen}><Pressable onPress={onBack} style={styles.backButton}><Ionicons color={colors.text} name="chevron-back" size={20} /><Text style={styles.backText}>LEAGUE HQ</Text></Pressable><View style={styles.detailHeader}><View style={styles.detailIcon}><Ionicons color={colors.accent} name={item.icon} size={27} /></View><View><Text style={styles.eyebrow}> {data.name.toUpperCase()}</Text><Text style={styles.detailTitle}>{item.title}</Text></View></View><View style={styles.detailCard}>{detail.map((row) => <View key={row.label} style={styles.detailRow}><View style={styles.detailCopy}><Text style={styles.detailLabel}>{row.label}</Text><Text style={styles.detailValue}>{row.value}</Text></View>{row.badge && <Text style={[styles.badge, row.badge === 'COMMISSIONER' && styles.commissionerBadge]}>{row.badge}</Text>}</View>)}</View></View>;
}

/** A horizontally scrollable draft grid based on the league's configured round positions. */
function DraftBoard({ data, onBack }: { data: LeagueData; onBack: () => void }) {
  const teams = draftTeams.slice(0, data.memberCount);
  return <View style={styles.screen}><Pressable onPress={onBack} style={styles.backButton}><Ionicons color={colors.text} name="chevron-back" size={20} /><Text style={styles.backText}>LEAGUE HQ</Text></Pressable><View style={styles.detailHeader}><View style={styles.detailIcon}><Ionicons color={colors.accent} name="layers-outline" size={27} /></View><View><Text style={styles.eyebrow}>{data.name.toUpperCase()}</Text><Text style={styles.detailTitle}>Draft Board</Text></View></View><View style={draftStyles.summary}><Text style={styles.rulesIntroTitle}>{teams.length} TEAMS · {draftPositions.length} ROUNDS</Text><Text style={styles.rulesIntroCopy}>Swipe horizontally to browse every manager’s picks.</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} style={draftStyles.scroller}><View>{<View style={draftStyles.headerRow}><View style={draftStyles.roundHeader}><Text style={draftStyles.roundHeaderText}>ROUND</Text></View>{teams.map((team) => <View key={team} style={draftStyles.teamHeader}><Text numberOfLines={2} style={draftStyles.teamHeaderText}>{team}</Text></View>)}</View>}{draftPositions.map((_, roundIndex) => <View key={roundIndex} style={draftStyles.boardRow}><View style={draftStyles.roundCell}><Text style={draftStyles.roundNumber}>ROUND {roundIndex + 1}</Text></View>{teams.map((team, teamIndex) => <DraftPick key={team} overallPick={roundIndex * teams.length + teamIndex + 1} round={roundIndex + 1} teamIndex={teamIndex} />)}</View>)}</View></ScrollView></View>;
}

/** One compact draft-board cell. The generated players make the mock board easy to scan and replace later. */
function DraftPick({ overallPick, round, teamIndex }: { overallPick: number; round: number; teamIndex: number }) {
  const playerIndex = (overallPick * 3 + teamIndex) % mockFirstNames.length;
  const displayPosition = ['QB', 'RB', 'WR', 'TE', 'RB', 'WR', 'DEF', 'K', 'RB', 'WR', 'COACH'][((overallPick * 5) + round + teamIndex) % 11];
  const playerName = `${mockFirstNames[playerIndex].charAt(0)}. ${mockLastNames[(playerIndex + round) % mockLastNames.length]}`;
  return <View style={[draftStyles.pickCell, { backgroundColor: positionFill(displayPosition), borderColor: positionColor(displayPosition) }]}><Text numberOfLines={1} style={draftStyles.pickName}>{playerName}</Text><Text style={[draftStyles.pickPosition, { color: positionColor(displayPosition) }]}>{displayPosition} · {nflTeams[(overallPick + round) % nflTeams.length]}</Text><Text style={draftStyles.pickNumber}>R{round} · #{overallPick}</Text></View>;
}

/** Position colors match the visual scanning pattern used throughout the roster views. */
function positionColor(position: string) { return position === 'QB' ? '#61D3F2' : position === 'RB' ? '#B6FF00' : position === 'WR' ? '#C66AFF' : position === 'TE' ? '#F6C544' : position === 'DEF' ? '#F18A6B' : position === 'K' ? '#EFA6EC' : position === 'COACH' ? '#91A09C' : '#B6FF00'; }
/** Dark position-specific fills keep each entire pick tile colorful while preserving text contrast. */
function positionFill(position: string) { return position === 'QB' ? '#12313A' : position === 'RB' ? '#263710' : position === 'WR' ? '#301948' : position === 'TE' ? '#493709' : position === 'DEF' ? '#482419' : position === 'K' ? '#41223F' : '#26312F'; }

/** Cursor-paginated activity feed. The shared app scroll requests more data near its bottom edge. */
function LeagueActivity({ leagueId, onBack, onRegisterReachEnd }: { leagueId: string; onBack: () => void; onRegisterReachEnd: (handler: () => void) => () => void }) {
  const [entries, setEntries] = useState<LeagueActivityEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(0);
  const [isLoading, setIsLoading] = useState(true);
  const isRequesting = useRef(false);

  /** Fetches a single page and appends it without duplicating existing activity rows. */
  const loadNextPage = useCallback(async () => {
    if (isLoading || nextCursor === null || isRequesting.current) return;
    isRequesting.current = true;
    setIsLoading(true);
    try {
      const page = await fantasyService.getLeagueActivity(leagueId, nextCursor, 10);
      setEntries((current) => [...current, ...page.entries.filter((entry) => !current.some((existing) => existing.id === entry.id))]);
      setNextCursor(page.nextCursor);
    } finally {
      isRequesting.current = false;
      setIsLoading(false);
    }
  }, [isLoading, leagueId, nextCursor]);

  /** Initial page always starts at cursor zero when a manager opens Activity. */
  useEffect(() => {
    let isCurrent = true;
    setEntries([]);
    setNextCursor(0);
    setIsLoading(true);
    fantasyService.getLeagueActivity(leagueId, 0, 10).then((page) => {
      if (!isCurrent) return;
      setEntries(page.entries);
      setNextCursor(page.nextCursor);
      setIsLoading(false);
    });
    return () => { isCurrent = false; };
  }, [leagueId]);

  useEffect(() => onRegisterReachEnd(() => { void loadNextPage(); }), [loadNextPage, onRegisterReachEnd]);
  return <View style={styles.screen}><Pressable onPress={onBack} style={styles.backButton}><Ionicons color={colors.text} name="chevron-back" size={20} /><Text style={styles.backText}>LEAGUE HQ</Text></Pressable><View style={styles.detailHeader}><View style={styles.detailIcon}><Ionicons color={colors.accent} name="pulse-outline" size={27} /></View><View><Text style={styles.eyebrow}>LIVE LEAGUE LOG</Text><Text style={styles.detailTitle}>Activity</Text></View></View><View style={styles.activityCard}>{entries.map((entry) => <View key={entry.id} style={styles.activityRow}><View style={styles.activityIcon}><Ionicons color={activityColor(entry.type)} name={activityIcon(entry.type)} size={17} /></View><View style={styles.activityCopy}><Text style={styles.activityDate}>{entry.occurredAt}</Text><Text style={styles.activitySummary}><Text style={styles.activityActor}>{entry.actor} </Text>{entry.summary}</Text></View></View>)}{isLoading && <Text style={styles.feedStatus}>Loading activity…</Text>}{!isLoading && nextCursor === null && <Text style={styles.feedStatus}>You’re all caught up.</Text>}</View></View>;
}

function activityIcon(type: LeagueActivityEntry['type']): IconName { return type === 'card' ? 'flash-outline' : type === 'trade' ? 'swap-horizontal-outline' : type === 'waiver' ? 'add-circle-outline' : 'people-outline'; }
function activityColor(type: LeagueActivityEntry['type']) { return type === 'card' ? '#C66AFF' : type === 'trade' ? '#F6C544' : type === 'waiver' ? '#61D3F2' : colors.accent; }

/** Detailed, categorized settings page inspired by the grouped scoring layouts in major fantasy apps. */
function LeagueRules({ data, onBack }: { data: LeagueData; onBack: () => void }) {
  const [openSection, setOpenSection] = useState('offense');
  const sections = [
    { id: 'offense', title: 'OFFENSIVE SCORING', rows: [['Reception', '+1.0 pt'], ['Receiving yards', '+0.10 / yard'], ['Receiving TD', '+6 pts'], ['Rushing yards', '+0.10 / yard'], ['Rushing TD', '+6 pts'], ['Passing yards', '+0.04 / yard'], ['Passing TD', '+4 pts'], ['2-point conversion', '+2 pts'], ['Interception thrown', '−2 pts'], ['Fumble lost', '−2 pts']] },
    { id: 'kicking', title: 'KICKING', rows: [['FG made: 0–39 yards', '+3 pts'], ['FG made: 40–49 yards', '+4 pts'], ['FG made: 50–59 yards', '+5 pts'], ['FG made: 60+ yards', '+6 pts'], ['Extra point made', '+1 pt'], ['Field goal missed', '−1 pt']] },
    { id: 'defense', title: 'DEFENSE / SPECIAL TEAMS', rows: [['Sack', '+1 pt'], ['Interception', '+2 pts'], ['Fumble recovery', '+2 pts'], ['Safety', '+2 pts'], ['Defensive or return TD', '+6 pts'], ['0 points allowed', '+5 pts'], ['1–6 points allowed', '+4 pts'], ['7–13 points allowed', '+3 pts'], ['28–34 points allowed', '−1 pt'], ['35+ points allowed', '−4 pts']] },
    { id: 'coach', title: 'COACH & ROSTER', rows: [['Team win (Coach)', '+3 pts'], ['Team loss (Coach)', '−1 pt'], ['Starters', 'QB, 2 RB, 2 WR, TE, FLEX, D/ST, K, Coach'], ['FLEX eligibility', 'RB / WR / TE'], ['Bench', 'Any position'], ['Lineup lock', 'Individual game kickoff']] },
    { id: 'league', title: 'LEAGUE & CARD RULES', rows: [['Format', 'Head-to-head, weekly'], ['Regular season', `Weeks 1–${Math.max(14, data.currentWeek + 9)}`], ['Playoffs', '6 teams · Weeks 15–17'], ['Card inventory', 'League-defined quantities'], ['Play card', 'Must target an eligible player'], ['Remove a card', 'Only before that player’s game begins'], ['Stat corrections', 'Official NFL corrections apply automatically']] },
  ];
  return <View style={styles.screen}><Pressable onPress={onBack} style={styles.backButton}><Ionicons color={colors.text} name="chevron-back" size={20} /><Text style={styles.backText}>LEAGUE HQ</Text></Pressable><View style={styles.detailHeader}><View style={styles.detailIcon}><Ionicons color={colors.accent} name="book-outline" size={27} /></View><View><Text style={styles.eyebrow}>{data.name.toUpperCase()}</Text><Text style={styles.detailTitle}>Rules & Scoring</Text></View></View><View style={styles.rulesIntro}><Text style={styles.rulesIntroTitle}>FULL PPR · HEAD-TO-HEAD</Text><Text style={styles.rulesIntroCopy}>Tap a section to view every scoring value and league rule.</Text></View>{sections.map((section) => { const isOpen = openSection === section.id; return <View key={section.id} style={styles.rulesCard}><Pressable onPress={() => setOpenSection(isOpen ? '' : section.id)} style={styles.rulesHeader}><Text style={styles.rulesTitle}>{section.title}</Text><Ionicons color={colors.accent} name={isOpen ? 'chevron-up' : 'chevron-down'} size={19} /></Pressable>{isOpen && section.rows.map(([label, value]) => <View key={label} style={styles.ruleRow}><Text style={styles.ruleLabel}>{label}</Text><Text style={styles.ruleValue}>{value}</Text></View>)}</View>;})}</View>;
}

/** Provides representative static detail rows for the mock league experience. */
function getDetailContent(destination: LeagueDestination, data: LeagueData, isCommissioner: boolean) {
  const rows: Record<LeagueDestination, Array<{ badge?: string; label: string; value: string }>> = {
    standings: [{ label: '1  Velocity Vipers', value: '4–1 · 654.2 pts' }, { label: '2  Grid Iron Kings', value: '4–1 · 632.8 pts' }, { label: '3  Your team', value: '3–2 · 618.4 pts', badge: 'YOU' }, { label: '4  Harbor Hawks', value: '3–2 · 601.7 pts' }],
    activity: [{ label: '8:31 PM', value: 'Chris Harper played Breakaway Threat on J. Taylor.' }, { label: '8:17 PM', value: 'You moved T. Higgins to your bench.' }, { label: '7:54 PM', value: 'Maya Reed offered a trade to Jordan Lee.' }],
    trades: [{ label: 'Trade block', value: '4 managers have players available.' }, { label: 'Pending offer', value: 'No offers waiting for you.' }, { label: 'Most recent', value: 'Harbor Hawks acquired D. Smith for A. Cooper.' }],
    playoffs: [{ label: 'Format', value: '6 teams · Weeks 15–17' }, { label: 'Current seed', value: '#3 · 78% chance to qualify' }, { label: 'Next cutoff', value: `Week ${Math.max(data.currentWeek + 1, 2)} standings lock` }],
    draft: [{ label: 'Draft format', value: 'Snake · 16 rounds' }, { label: 'Your first pick', value: 'Jalen Hurts · Round 1, Pick 8' }, { label: 'Draft recap', value: 'Viewable to all league members.' }],
    chat: [{ label: 'Commissioner', value: 'Welcome to Week ' + data.currentWeek + '. Set your lineups before Sunday!' }, { label: 'Maya Reed', value: 'Anyone interested in a WR trade?' }, { label: 'Jordan Lee', value: 'That last card play was brutal.' }],
    members: [{ label: 'Your team', value: 'Trezza Titans', badge: 'YOU' }, { label: 'League size', value: `${data.memberCount} active managers` }, { label: 'Invitations', value: 'Commissioner approval required.' }],
    rules: [{ label: 'Lineup lock', value: 'Each player locks at their scheduled kickoff.' }, { label: 'Card effects', value: 'Effects are removable only before a game starts.' }, { label: 'Roster', value: '10 starters and flexible bench slots.' }],
    settings: [{ label: 'League visibility', value: 'Private' }, { label: 'Commissioner access', value: isCommissioner ? 'You can manage league settings.' : 'Read-only access. Ask the commissioner to make changes.', badge: isCommissioner ? 'COMMISSIONER' : 'READ ONLY' }, { label: 'Scoring changes', value: 'Locked after the season begins.' }],
  };
  return rows[destination];
}

function LeagueStat({ label, value }: { label: string; value: string }) { return <View><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  screen: { gap: 14 }, heroCard: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 16, borderWidth: 1, padding: 18 }, eyebrow: { color: '#91A09C', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, leagueName: { color: colors.text, fontSize: 25, fontWeight: '900', marginTop: 5 }, stats: { borderTopColor: '#263330', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 17, paddingTop: 13 }, statValue: { color: colors.accent, fontSize: 17, fontWeight: '900' }, statLabel: { color: colors.textSecondary, fontSize: 8, fontWeight: '800', letterSpacing: .6, marginTop: 3 }, sectionTitle: { color: colors.text, fontSize: 11, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 2 }, toolGrid: { gap: 9 }, toolCard: { alignItems: 'center', backgroundColor: colors.card, borderColor: colors.border, borderRadius: 13, borderWidth: 1, flexDirection: 'row', minHeight: 70, padding: 11 }, pressed: { opacity: .72, transform: [{ scale: .985 }] }, toolIcon: { alignItems: 'center', backgroundColor: '#17221E', borderRadius: 10, height: 42, justifyContent: 'center', width: 42 }, toolText: { flex: 1, marginHorizontal: 11 }, toolTitle: { color: colors.text, fontSize: 14, fontWeight: '900' }, toolDescription: { color: colors.textSecondary, fontSize: 10, lineHeight: 14, marginTop: 3 }, backButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', marginLeft: -4, paddingVertical: 4 }, backText: { color: colors.text, fontSize: 11, fontWeight: '800', letterSpacing: .7 }, detailHeader: { alignItems: 'center', flexDirection: 'row', gap: 12, marginBottom: 2 }, detailIcon: { alignItems: 'center', backgroundColor: '#17221E', borderRadius: 13, height: 52, justifyContent: 'center', width: 52 }, detailTitle: { color: colors.text, fontSize: 23, fontWeight: '900', marginTop: 3 }, detailCard: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 16, borderWidth: 1, overflow: 'hidden' }, detailRow: { alignItems: 'center', borderBottomColor: '#202A28', borderBottomWidth: 1, flexDirection: 'row', minHeight: 64, paddingHorizontal: 15 }, detailCopy: { flex: 1, paddingVertical: 10 }, detailLabel: { color: colors.text, fontSize: 12, fontWeight: '800' }, detailValue: { color: colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 3 }, badge: { borderColor: colors.accent, borderRadius: 5, borderWidth: 1, color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: .5, paddingHorizontal: 6, paddingVertical: 4 }, commissionerBadge: { backgroundColor: '#1D2D17' }, rulesIntro: { backgroundColor: '#17221E', borderColor: '#31523A', borderRadius: 12, borderWidth: 1, padding: 13 }, rulesIntroTitle: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: .8 }, rulesIntroCopy: { color: colors.textSecondary, fontSize: 11, marginTop: 4 }, rulesCard: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 13, borderWidth: 1, overflow: 'hidden' }, rulesHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: 15 }, rulesTitle: { color: colors.text, fontSize: 11, fontWeight: '900', letterSpacing: .7 }, ruleRow: { alignItems: 'center', borderTopColor: '#202A28', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 43, paddingHorizontal: 15 }, ruleLabel: { color: colors.textSecondary, flex: 1, fontSize: 12, fontWeight: '700', paddingRight: 12 }, ruleValue: { color: colors.accent, fontSize: 12, fontWeight: '900', textAlign: 'right' }, activityCard: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 16, borderWidth: 1, overflow: 'hidden' }, activityRow: { alignItems: 'flex-start', borderBottomColor: '#202A28', borderBottomWidth: 1, flexDirection: 'row', minHeight: 73, padding: 13 }, activityIcon: { alignItems: 'center', backgroundColor: '#17221E', borderRadius: 16, height: 32, justifyContent: 'center', marginRight: 10, width: 32 }, activityCopy: { flex: 1 }, activityDate: { color: '#879793', fontSize: 9, fontWeight: '800', letterSpacing: .35 }, activitySummary: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 4 }, activityActor: { color: colors.text, fontWeight: '900' }, feedStatus: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', padding: 15, textAlign: 'center' },
});

const draftStyles = StyleSheet.create({
  summary: { backgroundColor: '#17221E', borderColor: '#31523A', borderRadius: 12, borderWidth: 1, padding: 13 },
  scroller: { marginHorizontal: -2 }, headerRow: { flexDirection: 'row' }, roundHeader: { alignItems: 'center', backgroundColor: '#111A18', borderColor: colors.border, borderWidth: 1, height: 54, justifyContent: 'center', width: 62 }, roundHeaderText: { color: colors.textSecondary, fontSize: 8, fontWeight: '900', letterSpacing: .5 }, teamHeader: { alignItems: 'center', backgroundColor: '#111A18', borderColor: colors.border, borderWidth: 1, height: 54, justifyContent: 'center', paddingHorizontal: 6, width: 112 }, teamHeaderText: { color: colors.text, fontSize: 9, fontWeight: '900', textAlign: 'center' },
  boardRow: { flexDirection: 'row' }, roundCell: { alignItems: 'center', backgroundColor: '#101516', borderColor: colors.border, borderWidth: 1, justifyContent: 'center', minHeight: 74, width: 62 }, roundNumber: { color: colors.accent, fontSize: 12, fontWeight: '900' }, roundPosition: { color: colors.textSecondary, fontSize: 8, fontWeight: '800', marginTop: 3 }, pickCell: { backgroundColor: colors.card, borderColor: colors.border, borderLeftWidth: 3, borderWidth: 1, justifyContent: 'center', minHeight: 74, paddingHorizontal: 8, width: 112 }, pickName: { color: colors.text, fontSize: 11, fontWeight: '900' }, pickPosition: { fontSize: 9, fontWeight: '900', marginTop: 3 }, pickNumber: { color: colors.textSecondary, fontSize: 8, fontWeight: '800', marginTop: 3 },
});
