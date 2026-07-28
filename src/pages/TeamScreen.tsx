import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ServiceState } from '../features/ui/ServiceState';
import { colors } from '../theme/colors';
import { getPositionColor, getPositionFill } from '../theme/positions';
import { AppliedModifier, MatchupData, MatchupPlayerData, MatchupTeam, Position, PowerCard, RosterLineup, RosterSlotData } from '../types/fantasy';
import { formatPoints, getAvatarUrl } from '../utils/formatters';
import { getGameInfo } from '../utils/gameInfo';

interface TeamRoster { bench: MatchupPlayerData[]; id: string; players: MatchupPlayerData[]; team: MatchupTeam; }

/** A roster slot keeps its eligibility even when another player moves into it. */
type RosterSlot = RosterSlotData;
type TeamView = 'freeAgents' | 'roster' | 'waivers';

/** Single-team roster view with the same visual language as the matchup screen. */
export function TeamScreen({ appliedCards, canPlayCard, draggingCard, error, hoveredPlayerName, managerRoster, matchupData, onCardPress, onManagerRosterChange, onRegisterReachEnd, onRegisterRosterEditActions, onRosterEditingChange, onRegisterDropTarget, onSelectPlayer, onSelectScore, onTeamSelectionChange }: { appliedCards: Record<string, AppliedModifier[]>; canPlayCard: (card: PowerCard, player: MatchupPlayerData, isManagerTeam: boolean) => boolean; draggingCard: PowerCard | null; error: Error | null; hoveredPlayerName: string | null; managerRoster: RosterLineup | null; matchupData: MatchupData | null; onCardPress: (card: PowerCard) => void; onManagerRosterChange: (roster: RosterLineup) => Promise<void>; onRegisterReachEnd: (handler: () => void) => () => void; onRegisterRosterEditActions: (actions: { discard: () => void; save: () => void }) => void; onRosterEditingChange: (isEditing: boolean) => void; onRegisterDropTarget: (player: MatchupPlayerData, isManagerTeam: boolean, node: View | null) => void; onSelectPlayer: (player: MatchupPlayerData) => void; onSelectScore: (player: MatchupPlayerData) => void; onTeamSelectionChange: (isYourTeam: boolean) => void }) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isEditingRoster, setIsEditingRoster] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [rosterSlots, setRosterSlots] = useState<{ bench: RosterSlot[]; starters: RosterSlot[]; teamId: string } | null>(null);
  const [teamView, setTeamView] = useState<TeamView>('roster');
  const isYourTeam = selectedTeamId === null || selectedTeamId === 'titans';

  /** Keeps the fixed inventory visible only for the manager's own team. */
  useEffect(() => onTeamSelectionChange(isYourTeam && teamView === 'roster'), [isYourTeam, onTeamSelectionChange, teamView]);
  /** Keeps the navigator's save/discard actions pointed at the latest local draft. */
  useEffect(() => {
    if (isEditingRoster) onRegisterRosterEditActions({ discard: discardRosterEdits, save: saveRosterEdits });
  }, [isEditingRoster, onRegisterRosterEditActions, rosterSlots]);
  if (!matchupData) return <ServiceState error={error} isLoading={!error} />;

  const teams = getLeagueTeams(matchupData);
  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? teams[0];
  const activeRoster = isYourTeam
    ? isEditingRoster && rosterSlots?.teamId === selectedTeam.id ? rosterSlots : managerRoster ? { ...managerRoster, teamId: selectedTeam.id } : createRosterSlots(selectedTeam)
    : rosterSlots?.teamId === selectedTeam.id ? rosterSlots : createRosterSlots(selectedTeam);
  const displayedRoster = withEmptyRosterSkeleton(activeRoster);
  const selectedSlot = [...displayedRoster.starters, ...displayedRoster.bench].find((slot) => slot.id === selectedSlotId) ?? null;

  /** Changing teams discards only unsaved UI roster edits for the previous team. */
  function selectTeam(teamId: string) {
    setSelectedTeamId(teamId);
    setRosterSlots(null);
    setSelectedSlotId(null);
    setIsEditingRoster(false);
    onRosterEditingChange(false);
    setIsSelectorOpen(false);
  }

  /** Selects one slot, then swaps it with a valid destination. */
  function handleSlotPress(slotId: string) {
    if (!isEditingRoster) return;
    if (!selectedSlotId) { setSelectedSlotId(slotId); return; }
    if (selectedSlotId === slotId) { setSelectedSlotId(null); return; }
    const allSlots = [...activeRoster.starters, ...activeRoster.bench];
    const source = allSlots.find((slot) => slot.id === selectedSlotId);
    const destination = allSlots.find((slot) => slot.id === slotId);
    if (!source || !destination || !canSwapSlots(source, destination)) return;
    const updateRoster = (current: { bench: RosterSlot[]; starters: RosterSlot[]; teamId: string } | null) => {
      const roster = current?.teamId === selectedTeam.id ? current : activeRoster;
      return swapRosterSlotPlayers(roster, source.id, destination.id);
    };
    setRosterSlots(updateRoster);
    setSelectedSlotId(null);
  }

  /** Starts an isolated lineup draft which does not update the shared matchup yet. */
  function beginRosterEdits() {
    setRosterSlots(activeRoster);
    setIsEditingRoster(true);
    onRosterEditingChange(true);
    onRegisterRosterEditActions({ discard: discardRosterEdits, save: saveRosterEdits });
  }

  /** Applies the draft to the shared roster used by both Team and Matchup screens. */
  function saveRosterEdits() {
    if (!isYourTeam || !rosterSlots) return;
    void onManagerRosterChange({ bench: rosterSlots.bench, starters: rosterSlots.starters })
      .then(() => {
        setRosterSlots(null);
        setSelectedSlotId(null);
        setIsEditingRoster(false);
        onRosterEditingChange(false);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Please try again.';
        // Native alerts are intentionally localized to the mutation that failed.
        Alert.alert('Unable to save lineup', message);
      });
  }

  /** Drops the local draft and restores the last saved roster. */
  function discardRosterEdits() {
    setRosterSlots(null);
    setSelectedSlotId(null);
    setIsEditingRoster(false);
    onRosterEditingChange(false);
  }

  return <View style={styles.screen}>
    <TeamViewTabs activeView={teamView} onSelect={setTeamView} />
    {teamView === 'freeAgents' ? <FreeAgentsView onRegisterReachEnd={onRegisterReachEnd} /> : teamView === 'waivers' ? <WaiversView /> : <>
    <View style={styles.selectorContainer}>
      <Pressable onPress={() => setIsSelectorOpen((open) => !open)} style={styles.selector}>
        <View><Text style={styles.selectorLabel}>VIEW TEAM</Text><Text style={styles.selectorName}>{selectedTeam.team.name}</Text></View>
        <Ionicons color={colors.accent} name={isSelectorOpen ? 'chevron-up' : 'chevron-down'} size={20} />
      </Pressable>
      {isSelectorOpen && <View style={styles.teamMenu}>{teams.map((team) => <Pressable key={team.id} onPress={() => selectTeam(team.id)} style={[styles.teamOption, team.id === selectedTeam.id && styles.selectedOption]}><Text style={styles.teamOptionName}>{team.team.name}</Text>{team.id === selectedTeam.id && <Ionicons color={colors.accent} name="checkmark" size={18} />}</Pressable>)}</View>}
    </View>

    <View style={styles.scoreCard}>
      <Text style={styles.teamName}>{selectedTeam.team.name}</Text>
      <Text style={styles.score}>{formatPoints(selectedTeam.team.score)}</Text>
      <Text style={styles.projected}>Projected {formatPoints(selectedTeam.team.projectedPoints)}</Text>
      {isYourTeam && <Pressable onPress={() => isEditingRoster ? saveRosterEdits() : beginRosterEdits()} style={[styles.editButton, isEditingRoster && styles.editButtonActive]}><Ionicons color={isEditingRoster ? colors.background : colors.accent} name={isEditingRoster ? 'checkmark' : 'swap-horizontal'} size={16} /><Text style={[styles.editButtonText, isEditingRoster && styles.editButtonTextActive]}>{isEditingRoster ? 'DONE' : 'EDIT ROSTER'}</Text></Pressable>}
    </View>

    {isEditingRoster && <Text style={styles.editHint}>{selectedSlotId ? 'Choose a highlighted valid slot to swap players.' : 'Choose a player, then choose a valid roster slot.'}</Text>}
    <RosterSection appliedCards={appliedCards} canPlayCard={canPlayCard} draggingCard={draggingCard} hoveredPlayerName={hoveredPlayerName} isEditing={isEditingRoster} isManagerTeam={isYourTeam} onRegisterDropTarget={onRegisterDropTarget} onSelectPlayer={onSelectPlayer} onSelectScore={onSelectScore} onSlotPress={handleSlotPress} selectedSlot={selectedSlot} selectedSlotId={selectedSlotId} slots={displayedRoster.starters} title="STARTING LINEUP" />
    <RosterSection appliedCards={appliedCards} canPlayCard={canPlayCard} draggingCard={draggingCard} hoveredPlayerName={hoveredPlayerName} isEditing={isEditingRoster} isManagerTeam={isYourTeam} onRegisterDropTarget={onRegisterDropTarget} onSelectPlayer={onSelectPlayer} onSelectScore={onSelectScore} onSlotPress={handleSlotPress} selectedSlot={selectedSlot} selectedSlotId={selectedSlotId} slots={displayedRoster.bench} title="BENCH" />
    {!isYourTeam && <ReadOnlyInventory cards={selectedTeam.team.hand ?? []} onCardPress={onCardPress} teamName={selectedTeam.team.name} />}
    </>}
  </View>;
}

/** Top-level roster-management switcher keeps roster, free agency, and waiver work in one destination. */
function TeamViewTabs({ activeView, onSelect }: { activeView: TeamView; onSelect: (view: TeamView) => void }) {
  return <View style={styles.teamViewTabs}>{([{ id: 'roster', label: 'ROSTER' }, { id: 'freeAgents', label: 'FREE AGENTS' }, { id: 'waivers', label: 'WAIVERS' }] as { id: TeamView; label: string }[]).map((tab) => <Pressable key={tab.id} onPress={() => onSelect(tab.id)} style={[styles.teamViewTab, activeView === tab.id && styles.activeTeamViewTab]}><Text style={[styles.teamViewTabText, activeView === tab.id && styles.activeTeamViewTabText]}>{tab.label}</Text></Pressable>)}</View>;
}

/** Mock free-agent list; replace this data with the free-agent service when transactions are available. */
function FreeAgentsView({ onRegisterReachEnd }: { onRegisterReachEnd: (handler: () => void) => () => void }) {
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [visibleCount, setVisibleCount] = useState(10);
  const players = Array.from({ length: 40 }, (_, index) => ({ id: `free-agent-${index}`, name: `${['A.', 'C.', 'D.', 'E.', 'G.', 'K.', 'M.', 'R.'][index % 8]} ${['Mitchell', 'Watson', 'Douglas', 'Miller', 'Edwards', 'Osborn', 'Wilson', 'Johnson'][Math.floor(index / 4) % 8]}`, position: ['QB', 'RB', 'WR', 'TE', 'FLEX', 'DEF', 'K', 'COACH'][index % 8], projected: Number((17.8 - index * .25).toFixed(1)), team: ['ARI', 'ATL', 'CHI', 'DEN', 'HOU', 'IND', 'MIA', 'NYJ'][index % 8] }));
  const matches = players
    .filter((player) => (positionFilter === 'ALL' || player.position === positionFilter) && player.name.toLowerCase().includes(search.toLowerCase()))
    .sort((first, second) => second.projected - first.projected);
  useEffect(() => setVisibleCount(10), [positionFilter, search]);
  useEffect(() => onRegisterReachEnd(() => setVisibleCount((current) => Math.min(current + 10, matches.length))), [matches.length, onRegisterReachEnd]);
  return <View style={styles.managementCard}><Text style={styles.managementTitle}>FREE AGENTS</Text><View style={styles.freeAgentControls}><View style={styles.freeAgentSearch}><Ionicons color={colors.muted} name="search" size={17} /><TextInput onChangeText={setSearch} placeholder="Search players" placeholderTextColor={colors.muted} style={styles.freeAgentSearchInput} value={search} /></View><View style={styles.positionFilters}>{['ALL', 'QB', 'RB', 'WR', 'TE', 'FLEX', 'DEF', 'K', 'COACH'].map((position) => <Pressable key={position} onPress={() => setPositionFilter(position)} style={[styles.positionFilter, positionFilter === position && styles.activePositionFilter]}><Text style={[styles.positionFilterText, positionFilter === position && styles.activePositionFilterText]}>{position}</Text></Pressable>)}</View></View>{matches.slice(0, visibleCount).map((player) => <FreeAgentRow key={player.id} player={player} />)}</View>;
}

function LegacyFreeAgentRow({ player }: { player: { name: string; position: string; projected: number; team: string } }) {
  const game = getGameInfo(player.team);
  return <View style={styles.transactionRow}><Image source={{ uri: getAvatarUrl(player.name) }} style={styles.freeAgentAvatar} /><View style={[styles.positionPill, { backgroundColor: getPositionFill(player.position), borderColor: getPositionColor(player.position) }]}><Text style={[styles.positionPillText, { color: getPositionColor(player.position) }]}>{player.position}</Text></View><View style={styles.transactionCopy}><Text style={styles.transactionName}>{player.name}</Text><Text numberOfLines={1} style={styles.transactionMeta}><Text style={{ color: getPositionColor(player.position) }}>{player.position}</Text><Text style={styles.lightTeamMeta}> · {player.team} vs {game.opponent} · {game.time}</Text></Text></View><Text style={styles.projectionValue}>{player.projected.toFixed(1)}</Text><Pressable style={styles.transactionButton}><Text style={styles.transactionButtonText}>ADD</Text></Pressable></View>;
}

/** Compact player row: profile image and colored metadata replace a redundant position tile. */
function FreeAgentRow({ player }: { player: { name: string; position: string; projected: number; team: string } }) {
  const game = getGameInfo(player.team);
  return <View style={styles.transactionRow}>
    <Image source={{ uri: getAvatarUrl(player.name) }} style={styles.freeAgentAvatar} />
    <View style={styles.transactionCopy}>
      <Text style={styles.transactionName}>{player.name}</Text>
      <Text ellipsizeMode="tail" numberOfLines={1} style={styles.transactionMeta}>
        <Text style={{ color: getPositionColor(player.position) }}>{player.position}</Text>
        <Text style={styles.lightTeamMeta}>{' · '}{player.team} vs {game.opponent}{' · '}{game.time}</Text>
      </Text>
    </View>
    <Text style={styles.projectionValue}>{player.projected.toFixed(1)}</Text>
    <Pressable style={styles.transactionButton}><Text style={styles.transactionButtonText}>ADD</Text></Pressable>
  </View>;
}

function LegacyFreeAgentsTable({ onRegisterReachEnd }: { onRegisterReachEnd: (handler: () => void) => () => void }) {
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [visibleCount, setVisibleCount] = useState(10);
  const players = Array.from({ length: 40 }, (_, index) => ({ name: `${['A.', 'C.', 'D.', 'E.', 'G.', 'K.', 'M.', 'R.'][index % 8]} ${['Mitchell', 'Watson', 'Douglas', 'Miller', 'Edwards', 'Osborn', 'Wilson', 'Johnson'][Math.floor(index / 4) % 8]}`, position: ['QB', 'RB', 'WR', 'TE', 'DEF'][index % 5], projected: Number((17.8 - index * .25).toFixed(1)), team: ['ARI', 'ATL', 'CHI', 'DEN', 'HOU', 'IND', 'MIA', 'NYJ'][index % 8] }));
  const matchingPlayers = players.filter((player) => (positionFilter === 'ALL' || player.position === positionFilter) && player.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.projected - a.projected);
  const visiblePlayers = matchingPlayers.slice(0, visibleCount);
  useEffect(() => setVisibleCount(10), [positionFilter, search]);
  useEffect(() => onRegisterReachEnd(() => setVisibleCount((current) => Math.min(current + 10, matchingPlayers.length))), [matchingPlayers.length, onRegisterReachEnd]);
  return <View style={styles.managementCard}><Text style={styles.managementTitle}>FREE AGENTS</Text><View style={styles.freeAgentControls}><View style={styles.freeAgentSearch}><Ionicons color={colors.muted} name="search" size={17} /><TextInput onChangeText={setSearch} placeholder="Search players" placeholderTextColor={colors.muted} style={styles.freeAgentSearchInput} value={search} /></View><View style={styles.positionFilters}>{['ALL', 'QB', 'RB', 'WR', 'TE', 'DEF'].map((position) => <Pressable key={position} onPress={() => setPositionFilter(position)} style={[styles.positionFilter, positionFilter === position && styles.activePositionFilter]}><Text style={[styles.positionFilterText, positionFilter === position && styles.activePositionFilterText]}>{position}</Text></Pressable>)}</View></View><View style={styles.freeAgentHeader}><Text style={[styles.freeAgentHeaderText, styles.freeAgentPlayerColumn]}>PLAYER</Text><Text style={styles.freeAgentHeaderText}>PROJ</Text></View>{visiblePlayers.map((player) => <View key={player.name} style={styles.transactionRow}><View style={[styles.positionPill, { backgroundColor: getPositionFill(player.position), borderColor: getPositionColor(player.position) }]}><Text style={[styles.positionPillText, { color: getPositionColor(player.position) }]}>{player.position}</Text></View><View style={styles.transactionCopy}><Text style={styles.transactionName}>{player.name}</Text><Text style={[styles.transactionMeta, { color: getPositionColor(player.position) }]}>{player.position} · {player.team}</Text></View><Text style={styles.projectionValue}>{player.projected.toFixed(1)}</Text><Pressable style={styles.transactionButton}><Text style={styles.transactionButtonText}>ADD</Text></Pressable></View>)}</View>;
}

function LegacyFreeAgentsView({ onRegisterReachEnd }: { onRegisterReachEnd: (handler: () => void) => () => void }) {
  const [addedPlayers, setAddedPlayers] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [isDescending, setIsDescending] = useState(true);
  const [visibleCount, setVisibleCount] = useState(10);
  const players = [{ name: 'T. Spears', position: 'RB', projected: 13.8, team: 'TEN', trend: '+8.4' }, { name: 'J. Palmer', position: 'WR', projected: 11.7, team: 'LAC', trend: '+5.7' }, { name: 'D. Waller', position: 'TE', projected: 9.1, team: 'NYG', trend: '+3.1' }, { name: 'B. Mayfield', position: 'QB', projected: 17.2, team: 'TB', trend: '+4.2' }, { name: 'Browns D/ST', position: 'DEF', projected: 8.8, team: 'CLE', trend: '+2.8' }, { name: 'J. Meyers', position: 'WR', projected: 10.9, team: 'LV', trend: '+2.0' }, { name: 'T. Higbee', position: 'TE', projected: 7.6, team: 'LAR', trend: '+1.4' }, { name: 'J. Ford', position: 'RB', projected: 10.4, team: 'CLE', trend: '+3.7' }];
  const generatedPlayers = Array.from({ length: 32 }, (_, index) => ({ name: `${['A.', 'C.', 'D.', 'E.', 'G.', 'K.', 'M.', 'R.'][index % 8]} ${['Mitchell', 'Watson', 'Douglas', 'Miller', 'Edwards', 'Osborn', 'Wilson', 'Johnson'][Math.floor(index / 4) % 8]}`, position: ['QB', 'RB', 'WR', 'TE', 'DEF'][index % 5], projected: Number((15.8 - index * .28).toFixed(1)), team: ['ARI', 'ATL', 'CHI', 'DEN', 'HOU', 'IND', 'MIA', 'NYJ'][index % 8], trend: `+${(1 + index * .3).toFixed(1)}` }));
  const matchingPlayers = [...players, ...generatedPlayers].filter((player) => (positionFilter === 'ALL' || player.position === positionFilter) && player.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => isDescending ? b.projected - a.projected : a.projected - b.projected);
  const visiblePlayers = matchingPlayers.slice(0, visibleCount);
  /** Resets paging when the manager applies a new search, position, or sort rule. */
  useEffect(() => setVisibleCount(10), [isDescending, positionFilter, search]);
  /** Appends one mock cursor page whenever the shared screen scroll reaches its end. */
  useEffect(() => onRegisterReachEnd(() => setVisibleCount((current) => Math.min(current + 10, matchingPlayers.length))), [matchingPlayers.length, onRegisterReachEnd]);
  return <View style={styles.managementCard}><View><Text style={styles.managementTitle}>FREE AGENTS</Text><Text style={styles.managementSubtitle}>Available players can be added directly to an open bench slot.</Text></View><View style={styles.freeAgentControls}><View style={styles.freeAgentSearch}><Ionicons color={colors.muted} name="search" size={17} /><TextInput onChangeText={setSearch} placeholder="Search players" placeholderTextColor={colors.muted} style={styles.freeAgentSearchInput} value={search} /></View><View style={styles.positionFilters}>{['ALL', 'QB', 'RB', 'WR', 'TE', 'DEF'].map((position) => <Pressable key={position} onPress={() => setPositionFilter(position)} style={[styles.positionFilter, positionFilter === position && styles.activePositionFilter]}><Text style={[styles.positionFilterText, positionFilter === position && styles.activePositionFilterText]}>{position}</Text></Pressable>)}</View></View><View style={styles.freeAgentHeader}><Text style={[styles.freeAgentHeaderText, styles.freeAgentPlayerColumn]}>PLAYER</Text><Pressable onPress={() => setIsDescending((current) => !current)} style={styles.sortButton}><Text style={styles.freeAgentHeaderText}>PROJ</Text><Ionicons color={colors.accent} name={isDescending ? 'arrow-down' : 'arrow-up'} size={13} /></Pressable></View>{visiblePlayers.map((player) => { const isAdded = addedPlayers.includes(player.name); return <View key={player.name} style={styles.transactionRow}><View style={styles.positionPill}><Text style={styles.positionPillText}>{player.position}</Text></View><View style={styles.transactionCopy}><Text style={styles.transactionName}>{player.name}</Text><Text style={styles.transactionMeta}>{player.team} · Trending {player.trend}</Text></View><Text style={styles.projectionValue}>{player.projected.toFixed(1)}</Text><Pressable disabled={isAdded} onPress={() => setAddedPlayers((current) => [...current, player.name])} style={[styles.transactionButton, isAdded && styles.transactionButtonAdded]}><Text style={[styles.transactionButtonText, isAdded && styles.transactionButtonAddedText]}>{isAdded ? 'ADDED' : 'ADD'}</Text></Pressable></View>; })}{visiblePlayers.length === 0 && <Text style={styles.noFreeAgents}>No available players match those filters.</Text>}</View>;
}

/** Displays pending waiver claims separately from immediately available free agents. */
function WaiversView() {
  return <View style={styles.managementCard}><View><Text style={styles.managementTitle}>WAIVERS</Text><Text style={styles.managementSubtitle}>Claims process Wednesday at 3:00 AM ET. Your priority: #3.</Text></View><View style={styles.waiverEmpty}><Ionicons color={colors.accent} name="time-outline" size={25} /><Text style={styles.waiverTitle}>No pending claims</Text><Text style={styles.waiverCopy}>Add a player from Free Agents to create a waiver claim when they are not immediately available.</Text></View></View>;
}

/** Converts all league matchups into a list of individually selectable team rosters. */
function getLeagueTeams(data: MatchupData): TeamRoster[] {
  const ownMatchup: TeamRoster[] = [
    { bench: data.benchMatchups.map((matchup) => matchup.left), id: 'titans', players: data.playerMatchups.map((matchup) => matchup.left), team: data.leftTeam },
    { bench: data.benchMatchups.map((matchup) => matchup.right), id: 'kings', players: data.playerMatchups.map((matchup) => matchup.right), team: data.rightTeam },
  ];
  const leagueTeams = data.leagueMatchups.slice(1).flatMap((matchup) => !matchup.playerMatchups || !matchup.benchMatchups ? [] : [
    { bench: matchup.benchMatchups.map((pair) => pair.left), id: `${matchup.id}-left`, players: matchup.playerMatchups.map((pair) => pair.left), team: matchup.leftTeam },
    { bench: matchup.benchMatchups.map((pair) => pair.right), id: `${matchup.id}-right`, players: matchup.playerMatchups.map((pair) => pair.right), team: matchup.rightTeam },
  ]);
  return [...ownMatchup, ...leagueTeams];
}

/** Creates stable slot ids and records the original starter position. */
function createRosterSlots(team: TeamRoster): RosterLineup & { teamId: string } {
  return { bench: team.bench.map((player, index) => ({ id: `bench-${index}`, kind: 'bench' as const, player, position: player.position })), starters: team.players.map((player, index) => ({ id: `starter-${index}`, kind: 'starter' as const, player, position: player.position })), teamId: team.id };
}

const starterSkeleton: Position[] = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'DEF', 'K', 'COACH'];
const benchSkeleton: Position[] = ['FLEX', 'FLEX', 'FLEX'];

function withEmptyRosterSkeleton<T extends RosterLineup & { teamId: string }>(roster: T): T {
  if (roster.starters.length > 0 || roster.bench.length > 0) return roster;
  const createEmptySlot = (position: Position, index: number, kind: 'bench' | 'starter'): RosterSlot => ({
    id: `empty-${kind}-${index}`,
    kind,
    position,
    player: { gameStarted: false, id: `empty-${kind}-${index}`, liveStats: [], name: 'Empty', position, recentStats: [], score: 0, team: '—' },
  });
  return {
    ...roster,
    starters: starterSkeleton.map((position, index) => createEmptySlot(position, index, 'starter')),
    bench: benchSkeleton.map((position, index) => createEmptySlot(position, index, 'bench')),
  };
}

/** FLEX accepts RB/WR/TE; bench slots deliberately accept any position. */
function canPlayerFillSlot(player: MatchupPlayerData, slot: RosterSlot) {
  if (slot.kind === 'bench') return true;
  const eligiblePositions = player.position === 'FLEX' ? ['RB', 'WR', 'TE'] : [player.position];
  return slot.position === 'FLEX' ? eligiblePositions.some((position) => ['RB', 'WR', 'TE'].includes(position)) : eligiblePositions.includes(slot.position);
}

/** A swap is valid only when both players fit the other player's current slot. */
function canSwapSlots(source: RosterSlot, destination: RosterSlot) { return canPlayerFillSlot(source.player, destination) && canPlayerFillSlot(destination.player, source); }

/** Swaps player values while preserving each slot's eligibility and label. */
function swapRosterSlotPlayers<T extends RosterLineup>(roster: T, firstId: string, secondId: string): T {
  const slots = [...roster.starters, ...roster.bench];
  const first = slots.find((slot) => slot.id === firstId);
  const second = slots.find((slot) => slot.id === secondId);
  if (!first || !second) return roster;
  const replacePlayer = (slot: RosterSlot) => slot.id === firstId ? { ...slot, player: second.player } : slot.id === secondId ? { ...slot, player: first.player } : slot;
  return { ...roster, bench: roster.bench.map(replacePlayer), starters: roster.starters.map(replacePlayer) };
}

/** Team-only version of the matchup table, including roster-edit affordances. */
/** Renders roster rows with the global position palette used by matchup, free agency, and draft. */
function RosterSection({ appliedCards, canPlayCard, draggingCard, hoveredPlayerName, isEditing, isManagerTeam, onRegisterDropTarget, onSelectPlayer, onSelectScore, onSlotPress, selectedSlot, selectedSlotId, slots, title }: { appliedCards: Record<string, AppliedModifier[]>; canPlayCard: (card: PowerCard, player: MatchupPlayerData, isManagerTeam: boolean) => boolean; draggingCard: PowerCard | null; hoveredPlayerName: string | null; isEditing: boolean; isManagerTeam: boolean; onRegisterDropTarget: (player: MatchupPlayerData, isManagerTeam: boolean, node: View | null) => void; onSelectPlayer: (player: MatchupPlayerData) => void; onSelectScore: (player: MatchupPlayerData) => void; onSlotPress: (slotId: string) => void; selectedSlot: RosterSlot | null; selectedSlotId: string | null; slots: RosterSlot[]; title: string }) {
  const visibleSlots = isEditing && selectedSlot ? slots.filter((slot) => slot.id === selectedSlot.id || canSwapSlots(selectedSlot, slot)) : slots;

  return <View style={styles.rosterCard}>
    <Text style={styles.rosterTitle}>{title}</Text>
    {visibleSlots.length === 0 && <Text style={styles.emptyRoster}>No players have been added yet.</Text>}
    {visibleSlots.map((slot) => {
      const player = slot.player;
      const isEmpty = player.id?.startsWith('empty-') ?? false;
      const isSelected = slot.id === selectedSlotId;
      const position = isEditing && slot.kind === 'starter' ? slot.position : player.position;
      const game = getGameInfo(player.team);
      const label = isEditing && slot.kind === 'starter' ? `SLOT ${slot.position}` : player.position;
      const isValidCardTarget = Boolean(!isEmpty && draggingCard && canPlayCard(draggingCard, player, isManagerTeam));
      const isInvalidCardTarget = Boolean(draggingCard && !isValidCardTarget);

      return <Pressable disabled={isEmpty} key={slot.id} onPress={() => isEditing ? onSlotPress(slot.id) : onSelectPlayer(player)} ref={(node) => { if (!isEmpty) onRegisterDropTarget(player, isManagerTeam, node); }} style={[styles.playerRow, isEmpty && styles.emptyPlayerRow, isInvalidCardTarget && styles.invalidCardTargetRow]}>
        {isEmpty ? <View style={styles.emptyAvatar}><Ionicons color={colors.muted} name="person-outline" size={18} /></View> : <Image source={{ uri: getAvatarUrl(player.name) }} style={[styles.avatar, isValidCardTarget && styles.validCardTargetAvatar]} />}
        <View style={styles.playerDetails}>
          <Text ellipsizeMode="tail" numberOfLines={1} style={[styles.playerName, isSelected && styles.validName, (hoveredPlayerName === player.name || isSelected) && styles.hoveredName]}>{player.name}</Text>
          <Text ellipsizeMode="tail" numberOfLines={1} style={styles.playerMeta}>
            <Text style={{ color: getPositionColor(position) }}>{label}</Text>
            {!isEmpty && <Text style={styles.lightTeamMeta}>{' · '}{player.team} vs {game.opponent}{' · '}{game.time}</Text>}
          </Text>
          {(appliedCards[player.name]?.length ?? 0) > 0 && <View style={styles.effectIcons}>{appliedCards[player.name].map((modifier) => <Ionicons color={modifier.card.accent} key={modifier.id} name={modifier.card.icon} size={14} />)}</View>}
        </View>
        {isEditing && slot.kind === 'starter' && <Text style={[styles.slotBadge, { color: getPositionColor(slot.position) }]}>{slot.position}</Text>}
        {!isEmpty && <Pressable accessibilityLabel={`View ${player.name} score breakdown`} disabled={isEditing} onPress={(event) => { event.stopPropagation(); onSelectScore(player); }} style={styles.playerScoreButton}><Text style={styles.playerScore}>{formatPoints(player.score)}</Text></Pressable>}
      </Pressable>;
    })}
  </View>;
}

function LegacyRosterSectionWithGameInformation({ appliedCards, canPlayCard, draggingCard, hoveredPlayerName, isEditing, isManagerTeam, onRegisterDropTarget, onSelectPlayer, onSlotPress, selectedSlot, selectedSlotId, slots, title }: { appliedCards: Record<string, AppliedModifier[]>; canPlayCard: (card: PowerCard, player: MatchupPlayerData, isManagerTeam: boolean) => boolean; draggingCard: PowerCard | null; hoveredPlayerName: string | null; isEditing: boolean; isManagerTeam: boolean; onRegisterDropTarget: (player: MatchupPlayerData, isManagerTeam: boolean, node: View | null) => void; onSelectPlayer: (player: MatchupPlayerData) => void; onSlotPress: (slotId: string) => void; selectedSlot: RosterSlot | null; selectedSlotId: string | null; slots: RosterSlot[]; title: string }) {
  const visibleSlots = isEditing && selectedSlot ? slots.filter((slot) => slot.id === selectedSlot.id || canSwapSlots(selectedSlot, slot)) : slots;
  return <View style={styles.rosterCard}><Text style={styles.rosterTitle}>{title}</Text>{visibleSlots.map((slot) => {
    const player = slot.player;
    const isSelected = slot.id === selectedSlotId;
    const positionLabel = isEditing && slot.kind === 'starter' ? slot.position : player.position;
    return <Pressable key={slot.id} onPress={() => isEditing ? onSlotPress(slot.id) : onSelectPlayer(player)} ref={(node) => onRegisterDropTarget(player, isManagerTeam, node)} style={styles.playerRow}><Image source={{ uri: getAvatarUrl(player.name) }} style={styles.avatar} /><View style={styles.playerDetails}><Text ellipsizeMode="tail" numberOfLines={1} style={[styles.playerName, (draggingCard && canPlayCard(draggingCard, player, isManagerTeam) || isSelected) && styles.validName, (hoveredPlayerName === player.name || isSelected) && styles.hoveredName]}>{player.name}</Text><Text style={[styles.playerMeta, { color: getPositionColor(positionLabel) }]}>{isEditing && slot.kind === 'starter' ? `SLOT ${slot.position} · ${player.team}` : `${player.position} · ${player.team}`}</Text>{(appliedCards[player.name]?.length ?? 0) > 0 && <View style={styles.effectIcons}>{appliedCards[player.name].map((modifier) => <Ionicons color={modifier.card.accent} key={modifier.id} name={modifier.card.icon} size={14} />)}</View>}</View>{isEditing && slot.kind === 'starter' && <Text style={[styles.slotBadge, { color: getPositionColor(slot.position) }]}>{slot.position}</Text>}<Text style={styles.playerScore}>{formatPoints(player.score)}</Text></Pressable>;
  })}</View>;
}

function LegacyRosterSection({ appliedCards, canPlayCard, draggingCard, hoveredPlayerName, isEditing, isManagerTeam, onRegisterDropTarget, onSelectPlayer, onSlotPress, selectedSlot, selectedSlotId, slots, title }: { appliedCards: Record<string, AppliedModifier[]>; canPlayCard: (card: PowerCard, player: MatchupPlayerData, isManagerTeam: boolean) => boolean; draggingCard: PowerCard | null; hoveredPlayerName: string | null; isEditing: boolean; isManagerTeam: boolean; onRegisterDropTarget: (player: MatchupPlayerData, isManagerTeam: boolean, node: View | null) => void; onSelectPlayer: (player: MatchupPlayerData) => void; onSlotPress: (slotId: string) => void; selectedSlot: RosterSlot | null; selectedSlotId: string | null; slots: RosterSlot[]; title: string }) {
  const visibleSlots = isEditing && selectedSlot ? slots.filter((slot) => slot.id === selectedSlot.id || canSwapSlots(selectedSlot, slot)) : slots;
  return <View style={styles.rosterCard}><Text style={styles.rosterTitle}>{title}</Text>{visibleSlots.map((slot) => {
    const player = slot.player;
    const isSelected = slot.id === selectedSlotId;
    return <Pressable key={slot.id} onPress={() => isEditing ? onSlotPress(slot.id) : onSelectPlayer(player)} ref={(node) => onRegisterDropTarget(player, isManagerTeam, node)} style={styles.playerRow}><Image source={{ uri: getAvatarUrl(player.name) }} style={styles.avatar} /><View style={styles.playerDetails}><Text ellipsizeMode="tail" numberOfLines={1} style={[styles.playerName, (draggingCard && canPlayCard(draggingCard, player, isManagerTeam) || isSelected) && styles.validName, (hoveredPlayerName === player.name || isSelected) && styles.hoveredName]}>{player.name}</Text><Text style={styles.playerMeta}>{isEditing && slot.kind === 'starter' ? `SLOT ${slot.position} · ${player.team}` : `${player.position} · ${player.team}`}</Text>{(appliedCards[player.name]?.length ?? 0) > 0 && <View style={styles.effectIcons}>{appliedCards[player.name].map((modifier) => <Ionicons color={modifier.card.accent} key={modifier.id} name={modifier.card.icon} size={14} />)}</View>}</View>{isEditing && slot.kind === 'starter' && <Text style={styles.slotBadge}>{slot.position}</Text>}<Text style={styles.playerScore}>{formatPoints(player.score)}</Text></Pressable>;
  })}</View>;
}

/** Shows another manager's cards without attaching any play or drag interactions. */
function ReadOnlyInventory({ cards, onCardPress, teamName }: { cards: PowerCard[]; onCardPress: (card: PowerCard) => void; teamName: string }) {
  return <View style={styles.inventoryCard}><View style={styles.inventoryHeading}><Text style={styles.rosterTitle}>{teamName.toUpperCase()} INVENTORY</Text></View><View style={styles.inventoryCards}>{cards.map((card) => <Pressable key={card.id} onPress={() => onCardPress(card)} style={[styles.inventoryItem, { borderColor: card.accent }]}><View style={[styles.quantityBadge, { borderColor: card.accent }]}><Text style={styles.quantityText}>×{card.quantity}</Text></View><Ionicons color={card.accent} name={card.icon} size={29} /><Text style={[styles.inventoryLabel, { color: card.accent }]}>{card.label}</Text></Pressable>)}</View></View>;
}

const styles: any = StyleSheet.create({
  screen: { gap: 16 }, selectorContainer: { backgroundColor: '#0E1514', borderColor: colors.border, borderRadius: 12, borderWidth: 1, overflow: 'hidden', zIndex: 10 }, selector: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }, selectorLabel: { color: '#91A09C', fontSize: 9, fontWeight: '800', letterSpacing: 1 }, selectorName: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 3 }, teamMenu: { borderTopColor: colors.border, borderTopWidth: 1 }, teamOption: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 }, selectedOption: { backgroundColor: '#15221E' }, teamOptionName: { color: colors.text, fontSize: 13, fontWeight: '700' },
  scoreCard: { backgroundColor: '#0E1514', borderColor: colors.border, borderRadius: 16, borderWidth: 1, padding: 18 }, teamName: { color: colors.accent, fontSize: 13, fontWeight: '800' }, score: { color: colors.text, fontSize: 38, fontWeight: '900', letterSpacing: -1, marginTop: 4 }, projected: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' }, editButton: { alignItems: 'center', alignSelf: 'flex-start', borderColor: colors.accent, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 6, marginTop: 13, paddingHorizontal: 10, paddingVertical: 7 }, editButtonActive: { backgroundColor: colors.accent }, editButtonText: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: .6 }, editButtonTextActive: { color: colors.background }, editHint: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: -7, textAlign: 'center' },
  rosterCard: { backgroundColor: '#0E1514', borderColor: colors.border, borderRadius: 16, borderWidth: 1, overflow: 'hidden' }, rosterTitle: { color: colors.text, fontSize: 11, fontWeight: '800', letterSpacing: 1, paddingHorizontal: 16, paddingTop: 15 }, emptyRoster: { color: colors.textSecondary, fontSize: 11, padding: 18, textAlign: 'center' }, playerRow: { alignItems: 'center', borderBottomColor: '#202A28', borderBottomWidth: 1, flexDirection: 'row', minHeight: 58, paddingHorizontal: 12 }, emptyPlayerRow: { opacity: .72 }, emptyAvatar: { alignItems: 'center', backgroundColor: '#17201F', borderColor: colors.border, borderRadius: 15, borderStyle: 'dashed', borderWidth: 1, height: 30, justifyContent: 'center', width: 30 }, validCardTargetAvatar: { borderColor: colors.accent, borderWidth: 2 }, invalidCardTargetRow: { opacity: 0.28 }, selectedPlayerRow: { backgroundColor: 'rgba(182, 255, 0, 0.13)', borderColor: colors.accent, borderWidth: 1 }, validSwapRow: { backgroundColor: 'rgba(182, 255, 0, 0.055)' }, avatar: { backgroundColor: '#29565B', borderRadius: 15, height: 30, width: 30 }, playerDetails: { flex: 1, marginLeft: 9, minWidth: 0 }, playerName: { color: colors.text, flexShrink: 1, fontSize: 13, fontWeight: '800' }, validName: { color: colors.accent }, validSwapName: { color: colors.accent }, hoveredName: { fontSize: 15, textShadowColor: 'rgba(182, 255, 0, 0.65)', textShadowRadius: 8 }, playerMeta: { color: '#8DA09B', fontSize: 10, fontWeight: '700', marginTop: 2 }, effectIcons: { flexDirection: 'row', gap: 3, marginTop: 3 }, slotBadge: { color: colors.accent, fontSize: 9, fontWeight: '900', marginRight: 7 }, playerScoreButton: { alignItems: 'flex-end', justifyContent: 'center', marginLeft: 8, minHeight: 40, width: 46 }, playerScore: { color: colors.text, fontSize: 14, fontWeight: '800', textAlign: 'right' },
  inventoryCard: { backgroundColor: '#0E1514', borderColor: colors.border, borderRadius: 16, borderWidth: 1, padding: 14 }, inventoryHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, inventoryCards: { flexDirection: 'row', gap: 10, marginTop: 12 }, inventoryItem: { alignItems: 'center', backgroundColor: '#101516', borderRadius: 9, borderWidth: 1, height: 75, justifyContent: 'center', overflow: 'hidden', width: 62 }, quantityBadge: { alignItems: 'center', backgroundColor: '#101516', borderRadius: 9, borderWidth: 1, left: 4, minWidth: 22, paddingHorizontal: 3, position: 'absolute', top: 4 }, quantityText: { color: colors.text, fontSize: 9, fontWeight: '900' }, inventoryLabel: { fontSize: 8, fontWeight: '900', marginTop: 4 },
});

Object.assign(styles, StyleSheet.create({
  teamViewTabs: { backgroundColor: '#101516', borderColor: colors.border, borderRadius: 10, borderWidth: 1, flexDirection: 'row', padding: 3 }, teamViewTab: { alignItems: 'center', borderRadius: 7, flex: 1, paddingVertical: 9 }, activeTeamViewTab: { backgroundColor: '#243614' }, teamViewTabText: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: .35 }, activeTeamViewTabText: { color: colors.accent }, managementCard: { backgroundColor: '#0E1514', borderColor: colors.border, borderRadius: 16, borderWidth: 1, overflow: 'hidden', paddingTop: 15 }, managementTitle: { color: colors.text, fontSize: 12, fontWeight: '900', letterSpacing: .8, paddingHorizontal: 15 }, managementSubtitle: { color: colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 5, paddingHorizontal: 15, paddingRight: 25 }, transactionRow: { alignItems: 'center', borderTopColor: '#202A28', borderTopWidth: 1, flexDirection: 'row', minHeight: 62, marginTop: 13, paddingHorizontal: 12 }, positionPill: { alignItems: 'center', backgroundColor: '#263710', borderColor: colors.accent, borderRadius: 7, borderWidth: 1, height: 30, justifyContent: 'center', width: 36 }, positionPillText: { color: colors.accent, fontSize: 9, fontWeight: '900' }, transactionCopy: { flex: 1, marginHorizontal: 9 }, transactionName: { color: colors.text, fontSize: 13, fontWeight: '900' }, transactionMeta: { color: colors.textSecondary, fontSize: 10, fontWeight: '700', marginTop: 2 }, transactionButton: { borderColor: colors.accent, borderRadius: 7, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6 }, transactionButtonAdded: { backgroundColor: '#243614' }, transactionButtonText: { color: colors.accent, fontSize: 9, fontWeight: '900' }, transactionButtonAddedText: { color: '#87B94A' }, waiverEmpty: { alignItems: 'center', borderTopColor: '#202A28', borderTopWidth: 1, marginTop: 13, padding: 24 }, waiverTitle: { color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 8 }, waiverCopy: { color: colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 5, textAlign: 'center' },
}));

Object.assign(styles, StyleSheet.create({
  freeAgentControls: { marginTop: 13, paddingHorizontal: 12 }, freeAgentSearch: { alignItems: 'center', backgroundColor: '#101516', borderColor: colors.border, borderRadius: 9, borderWidth: 1, flexDirection: 'row', paddingHorizontal: 9 }, freeAgentSearchInput: { color: colors.text, flex: 1, fontSize: 12, height: 38, paddingLeft: 7 }, positionFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 }, positionFilter: { borderColor: '#31403C', borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5 }, activePositionFilter: { backgroundColor: '#243614', borderColor: colors.accent }, positionFilterText: { color: colors.textSecondary, fontSize: 9, fontWeight: '900' }, activePositionFilterText: { color: colors.accent }, freeAgentHeader: { alignItems: 'center', borderBottomColor: '#202A28', borderBottomWidth: 1, flexDirection: 'row', marginTop: 12, paddingHorizontal: 12, paddingVertical: 8 }, freeAgentHeaderText: { color: colors.textSecondary, fontSize: 8, fontWeight: '900', letterSpacing: .5 }, freeAgentPlayerColumn: { flex: 1 }, sortButton: { alignItems: 'center', flexDirection: 'row', gap: 3, marginRight: 15 }, projectionValue: { color: colors.accent, fontSize: 12, fontWeight: '900', marginRight: 10, textAlign: 'right', width: 34 }, noFreeAgents: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', padding: 22, textAlign: 'center' },
}));

Object.assign(styles, StyleSheet.create({
  freeAgentAvatar: { backgroundColor: '#29565B', borderRadius: 15, height: 30, marginRight: 7, width: 30 },
  lightTeamMeta: { color: '#BBC5C3' },
}));
