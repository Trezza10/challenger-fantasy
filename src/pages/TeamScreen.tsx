import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ServiceState } from '../features/ui/ServiceState';
import { colors } from '../theme/colors';
import { AppliedModifier, MatchupData, MatchupPlayerData, MatchupTeam, PowerCard, RosterLineup, RosterSlotData } from '../types/fantasy';
import { formatPoints, getAvatarUrl } from '../utils/formatters';

interface TeamRoster { bench: MatchupPlayerData[]; id: string; players: MatchupPlayerData[]; team: MatchupTeam; }

/** A roster slot keeps its eligibility even when another player moves into it. */
type RosterSlot = RosterSlotData;

/** Single-team roster view with the same visual language as the matchup screen. */
export function TeamScreen({ appliedCards, canPlayCard, draggingCard, hoveredPlayerName, managerRoster, matchupData, onCardPress, onManagerRosterChange, onRegisterRosterEditActions, onRosterEditingChange, onRegisterDropTarget, onSelectPlayer, onTeamSelectionChange }: { appliedCards: Record<string, AppliedModifier[]>; canPlayCard: (card: PowerCard, player: MatchupPlayerData, isManagerTeam: boolean) => boolean; draggingCard: PowerCard | null; hoveredPlayerName: string | null; managerRoster: RosterLineup | null; matchupData: MatchupData | null; onCardPress: (card: PowerCard) => void; onManagerRosterChange: (roster: RosterLineup) => void; onRegisterRosterEditActions: (actions: { discard: () => void; save: () => void }) => void; onRosterEditingChange: (isEditing: boolean) => void; onRegisterDropTarget: (player: MatchupPlayerData, isManagerTeam: boolean, node: View | null) => void; onSelectPlayer: (player: MatchupPlayerData) => void; onTeamSelectionChange: (isYourTeam: boolean) => void }) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isEditingRoster, setIsEditingRoster] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [rosterSlots, setRosterSlots] = useState<{ bench: RosterSlot[]; starters: RosterSlot[]; teamId: string } | null>(null);
  const isYourTeam = selectedTeamId === null || selectedTeamId === 'titans';

  /** Keeps the fixed inventory visible only for the manager's own team. */
  useEffect(() => onTeamSelectionChange(isYourTeam), [isYourTeam, onTeamSelectionChange]);
  /** Keeps the navigator's save/discard actions pointed at the latest local draft. */
  useEffect(() => {
    if (isEditingRoster) onRegisterRosterEditActions({ discard: discardRosterEdits, save: saveRosterEdits });
  }, [isEditingRoster, onRegisterRosterEditActions, rosterSlots]);
  if (!matchupData) return <ServiceState error={null} isLoading />;

  const teams = getLeagueTeams(matchupData);
  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? teams[0];
  const activeRoster = isYourTeam
    ? isEditingRoster && rosterSlots?.teamId === selectedTeam.id ? rosterSlots : managerRoster ? { ...managerRoster, teamId: selectedTeam.id } : createRosterSlots(selectedTeam)
    : rosterSlots?.teamId === selectedTeam.id ? rosterSlots : createRosterSlots(selectedTeam);
  const selectedSlot = [...activeRoster.starters, ...activeRoster.bench].find((slot) => slot.id === selectedSlotId) ?? null;

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
    if (isYourTeam && rosterSlots) onManagerRosterChange({ bench: rosterSlots.bench, starters: rosterSlots.starters });
    setRosterSlots(null);
    setSelectedSlotId(null);
    setIsEditingRoster(false);
    onRosterEditingChange(false);
  }

  /** Drops the local draft and restores the last saved roster. */
  function discardRosterEdits() {
    setRosterSlots(null);
    setSelectedSlotId(null);
    setIsEditingRoster(false);
    onRosterEditingChange(false);
  }

  return <View style={styles.screen}>
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
    <RosterSection appliedCards={appliedCards} canPlayCard={canPlayCard} draggingCard={draggingCard} hoveredPlayerName={hoveredPlayerName} isEditing={isEditingRoster} isManagerTeam={isYourTeam} onRegisterDropTarget={onRegisterDropTarget} onSelectPlayer={onSelectPlayer} onSlotPress={handleSlotPress} selectedSlot={selectedSlot} selectedSlotId={selectedSlotId} slots={activeRoster.starters} title="STARTING LINEUP" />
    <RosterSection appliedCards={appliedCards} canPlayCard={canPlayCard} draggingCard={draggingCard} hoveredPlayerName={hoveredPlayerName} isEditing={isEditingRoster} isManagerTeam={isYourTeam} onRegisterDropTarget={onRegisterDropTarget} onSelectPlayer={onSelectPlayer} onSlotPress={handleSlotPress} selectedSlot={selectedSlot} selectedSlotId={selectedSlotId} slots={activeRoster.bench} title="BENCH" />
    {!isYourTeam && <ReadOnlyInventory cards={selectedTeam.team.hand ?? []} onCardPress={onCardPress} teamName={selectedTeam.team.name} />}
  </View>;
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
function RosterSection({ appliedCards, canPlayCard, draggingCard, hoveredPlayerName, isEditing, isManagerTeam, onRegisterDropTarget, onSelectPlayer, onSlotPress, selectedSlot, selectedSlotId, slots, title }: { appliedCards: Record<string, AppliedModifier[]>; canPlayCard: (card: PowerCard, player: MatchupPlayerData, isManagerTeam: boolean) => boolean; draggingCard: PowerCard | null; hoveredPlayerName: string | null; isEditing: boolean; isManagerTeam: boolean; onRegisterDropTarget: (player: MatchupPlayerData, isManagerTeam: boolean, node: View | null) => void; onSelectPlayer: (player: MatchupPlayerData) => void; onSlotPress: (slotId: string) => void; selectedSlot: RosterSlot | null; selectedSlotId: string | null; slots: RosterSlot[]; title: string }) {
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

const styles = StyleSheet.create({
  screen: { gap: 16 }, selectorContainer: { backgroundColor: '#0E1514', borderColor: colors.border, borderRadius: 12, borderWidth: 1, overflow: 'hidden', zIndex: 10 }, selector: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }, selectorLabel: { color: '#91A09C', fontSize: 9, fontWeight: '800', letterSpacing: 1 }, selectorName: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 3 }, teamMenu: { borderTopColor: colors.border, borderTopWidth: 1 }, teamOption: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 }, selectedOption: { backgroundColor: '#15221E' }, teamOptionName: { color: colors.text, fontSize: 13, fontWeight: '700' },
  scoreCard: { backgroundColor: '#0E1514', borderColor: colors.border, borderRadius: 16, borderWidth: 1, padding: 18 }, teamName: { color: colors.accent, fontSize: 13, fontWeight: '800' }, score: { color: colors.text, fontSize: 38, fontWeight: '900', letterSpacing: -1, marginTop: 4 }, projected: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' }, editButton: { alignItems: 'center', alignSelf: 'flex-start', borderColor: colors.accent, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 6, marginTop: 13, paddingHorizontal: 10, paddingVertical: 7 }, editButtonActive: { backgroundColor: colors.accent }, editButtonText: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: .6 }, editButtonTextActive: { color: colors.background }, editHint: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: -7, textAlign: 'center' },
  rosterCard: { backgroundColor: '#0E1514', borderColor: colors.border, borderRadius: 16, borderWidth: 1, overflow: 'hidden' }, rosterTitle: { color: colors.text, fontSize: 11, fontWeight: '800', letterSpacing: 1, paddingHorizontal: 16, paddingTop: 15 }, playerRow: { alignItems: 'center', borderBottomColor: '#202A28', borderBottomWidth: 1, flexDirection: 'row', minHeight: 58, paddingHorizontal: 12 }, selectedPlayerRow: { backgroundColor: 'rgba(182, 255, 0, 0.13)', borderColor: colors.accent, borderWidth: 1 }, validSwapRow: { backgroundColor: 'rgba(182, 255, 0, 0.055)' }, avatar: { backgroundColor: '#29565B', borderRadius: 15, height: 30, width: 30 }, playerDetails: { flex: 1, marginLeft: 9, minWidth: 0 }, playerName: { color: colors.text, flexShrink: 1, fontSize: 13, fontWeight: '800' }, validName: { color: colors.accent }, validSwapName: { color: colors.accent }, hoveredName: { fontSize: 15, textShadowColor: 'rgba(182, 255, 0, 0.65)', textShadowRadius: 8 }, playerMeta: { color: '#8DA09B', fontSize: 10, fontWeight: '700', marginTop: 2 }, effectIcons: { flexDirection: 'row', gap: 3, marginTop: 3 }, slotBadge: { color: colors.accent, fontSize: 9, fontWeight: '900', marginRight: 7 }, playerScore: { color: colors.text, fontSize: 14, fontWeight: '800', marginLeft: 12, textAlign: 'right', width: 42 },
  inventoryCard: { backgroundColor: '#0E1514', borderColor: colors.border, borderRadius: 16, borderWidth: 1, padding: 14 }, inventoryHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, inventoryCards: { flexDirection: 'row', gap: 10, marginTop: 12 }, inventoryItem: { alignItems: 'center', backgroundColor: '#101516', borderRadius: 9, borderWidth: 1, height: 75, justifyContent: 'center', overflow: 'hidden', width: 62 }, quantityBadge: { alignItems: 'center', backgroundColor: '#101516', borderRadius: 9, borderWidth: 1, left: 4, minWidth: 22, paddingHorizontal: 3, position: 'absolute', top: 4 }, quantityText: { color: colors.text, fontSize: 9, fontWeight: '900' }, inventoryLabel: { fontSize: 8, fontWeight: '900', marginTop: 4 },
});
