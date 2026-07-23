import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MatchupPlayer } from '../features/matchup/MatchupPlayer';
import { ServiceState } from '../features/ui/ServiceState';
import { colors } from '../theme/colors';
import { AppliedModifier, LeagueMatchupSummary, MatchupData, MatchupPlayerData, PowerCard, RosterLineup } from '../types/fantasy';
import { formatPoints } from '../utils/formatters';

/** Shows the live head-to-head score and the two starting lineups. */
export function MatchupScreen({ appliedCards, canPlayCard, data, draggingCard, hoveredPlayerName, managerRoster, onMatchupSelectionChange, onRegisterDropTarget, onSelectPlayer }: { appliedCards: Record<string, AppliedModifier[]>; canPlayCard: (card: PowerCard, player: MatchupPlayerData, isManagerTeam: boolean) => boolean; data: MatchupData | null; draggingCard: PowerCard | null; hoveredPlayerName: string | null; managerRoster: RosterLineup | null; onMatchupSelectionChange: (isYourMatchup: boolean) => void; onRegisterDropTarget: (player: MatchupPlayerData, isManagerTeam: boolean, node: View | null) => void; onSelectPlayer: (player: MatchupPlayerData) => void }) {
  // Null means the first (your) matchup is selected by default once data loads.
  const [selectedMatchupId, setSelectedMatchupId] = useState<string | null>(null);
  const isYourMatchup = selectedMatchupId === null || selectedMatchupId === data?.leagueMatchups[0]?.id;

  /** Lets the fixed inventory tray know whether the manager's own matchup is selected. */
  useEffect(() => onMatchupSelectionChange(isYourMatchup), [isYourMatchup, onMatchupSelectionChange]);

  if (!data) return <ServiceState error={null} isLoading />;
  const selectedMatchup = data.leagueMatchups.find((matchup) => matchup.id === selectedMatchupId) ?? data.leagueMatchups[0];
  const startingLineup = selectedMatchup.playerMatchups ?? data.playerMatchups;
  const bench = selectedMatchup.benchMatchups ?? data.benchMatchups;
  /** The first matchup's left roster belongs to the manager and may have local lineup changes. */
  const displayedStartingLineup = isYourMatchup && managerRoster ? startingLineup.map((matchup, index) => ({ ...matchup, left: managerRoster.starters[index]?.player ?? matchup.left, slotPosition: managerRoster.starters[index]?.position ?? matchup.left.position })) : startingLineup.map((matchup) => ({ ...matchup, slotPosition: matchup.left.position }));
  const displayedBench = isYourMatchup && managerRoster ? bench.map((matchup, index) => ({ ...matchup, left: managerRoster.bench[index]?.player ?? matchup.left, slotPosition: managerRoster.bench[index]?.position ?? matchup.left.position })) : bench.map((matchup) => ({ ...matchup, slotPosition: matchup.left.position }));

  return (
    <View style={styles.screen}>
      <MatchupCarousel matchups={data.leagueMatchups} onSelect={setSelectedMatchupId} selectedId={selectedMatchup.id} />
      <View style={styles.matchupCard}>
        <View style={styles.header}><View style={styles.livePill}><Text style={styles.liveText}>{selectedMatchup.isLive ? 'LIVE' : 'UPCOMING'}</Text></View><Text style={styles.weekLabel}>WEEK {data.week}</Text><Text style={styles.gameTime}>{selectedMatchup.gameTime}</Text></View>
        <View style={styles.scoreRow}>
          <ScoreTeam name={selectedMatchup.leftTeam.name} score={formatPoints(selectedMatchup.leftTeam.score)} projected={formatPoints(selectedMatchup.leftTeam.projectedPoints)} leading />
          <View style={styles.vsCircle}><Text style={styles.vs}>VS</Text></View>
          <ScoreTeam name={selectedMatchup.rightTeam.name} score={formatPoints(selectedMatchup.rightTeam.score)} projected={formatPoints(selectedMatchup.rightTeam.projectedPoints)} opponent />
        </View>
        <View style={styles.winChance}><Text style={styles.winValue}>{selectedMatchup.winChance}%</Text><View style={styles.winBar}><View style={[styles.winFill, { width: `${selectedMatchup.winChance}%` }]} /></View><Text style={styles.loseValue}>{100 - selectedMatchup.winChance}%</Text></View>
        <Text style={styles.winLabel}>WIN CHANCE</Text>
      </View>
      <View style={styles.rosterCard}>
        {/* <Text style={styles.rosterTitle}>STARTING LINEUP</Text> */}
        {displayedStartingLineup.map((playerMatchup) => <MatchupPlayer canPlayCard={canPlayCard} draggingCard={draggingCard} hoveredPlayerName={hoveredPlayerName} key={`${playerMatchup.left.name}-${playerMatchup.right.name}`} leftAppliedCards={appliedCards[playerMatchup.left.name]} leftName={playerMatchup.left.name} leftPlayer={playerMatchup.left} leftScore={formatPoints(playerMatchup.left.score)} onRegisterDropTarget={onRegisterDropTarget} onSelectPlayer={onSelectPlayer} position={playerMatchup.slotPosition} rightAppliedCards={appliedCards[playerMatchup.right.name]} rightName={playerMatchup.right.name} rightPlayer={playerMatchup.right} rightScore={formatPoints(playerMatchup.right.score)} />)}
      </View>
      <View style={styles.rosterCard}>
        <Text style={styles.rosterTitle}>BENCH</Text>
        {displayedBench.map((playerMatchup) => <MatchupPlayer canPlayCard={canPlayCard} draggingCard={draggingCard} hoveredPlayerName={hoveredPlayerName} key={`${playerMatchup.left.name}-${playerMatchup.right.name}`} leftAppliedCards={appliedCards[playerMatchup.left.name]} leftName={playerMatchup.left.name} leftPlayer={playerMatchup.left} leftScore={formatPoints(playerMatchup.left.score)} onRegisterDropTarget={onRegisterDropTarget} onSelectPlayer={onSelectPlayer} position={playerMatchup.slotPosition} rightAppliedCards={appliedCards[playerMatchup.right.name]} rightName={playerMatchup.right.name} rightPlayer={playerMatchup.right} rightScore={formatPoints(playerMatchup.right.score)} />)}
      </View>
    </View>
  );
}

/** Horizontal scorecard rail for browsing the five league matchups. */
function MatchupCarousel({ matchups, onSelect, selectedId }: { matchups: LeagueMatchupSummary[]; onSelect: (id: string) => void; selectedId: string }) {
  return <ScrollView contentContainerStyle={styles.carousel} horizontal showsHorizontalScrollIndicator={false}>{matchups.map((matchup) => <Pressable key={matchup.id} onPress={() => onSelect(matchup.id)} style={[styles.matchupChip, matchup.id === selectedId && styles.selectedChip]}><Text numberOfLines={1} style={styles.chipTeam}>{matchup.leftTeam.name}</Text><Text style={styles.chipScore}>{formatPoints(matchup.leftTeam.score)} <Text style={styles.chipVs}>VS</Text> {formatPoints(matchup.rightTeam.score)}</Text><Text numberOfLines={1} style={styles.chipTeam}>{matchup.rightTeam.name}</Text></Pressable>)}</ScrollView>;
}

/** Presents either side's name, current score, and projected total. */
function ScoreTeam({ leading = false, name, opponent = false, projected, score }: { leading?: boolean; name: string; opponent?: boolean; projected: string; score: string }) {
  return <View style={[styles.scoreTeam, opponent && styles.rightTeam]}><Text style={[styles.teamName, opponent && styles.opponentName]}>{name}</Text><Text style={[styles.score, leading && styles.leadingScore]}>{score}</Text><Text style={styles.projected}>Proj {projected}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { gap: 16 }, matchupCard: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 16, borderWidth: 1, padding: 18 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, livePill: { backgroundColor: '#063B20', borderColor: '#159447', borderRadius: 4, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 3 }, liveText: { color: '#63F58A', fontSize: 9, fontWeight: '800' }, weekLabel: { color: colors.text, fontSize: 15, fontWeight: '800' }, gameTime: { color: '#AAB4B2', fontSize: 10 },
  scoreRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 21 }, scoreTeam: { flex: 1 }, rightTeam: { alignItems: 'flex-end' }, teamName: { color: '#A7F24A', fontSize: 12, fontWeight: '700' }, opponentName: { color: '#E1A0F8' }, score: { color: '#E8ECEB', fontSize: 32, fontWeight: '800', letterSpacing: -1, marginTop: 3 }, leadingScore: { color: '#A7F24A' }, projected: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' }, vsCircle: { alignItems: 'center', borderColor: '#36413F', borderRadius: 22, borderWidth: 1, height: 40, justifyContent: 'center', marginHorizontal: 8, width: 40 }, vs: { color: '#B8C2C0', fontSize: 12, fontWeight: '900' },
  winChance: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 22 }, winValue: { color: '#A7F24A', fontSize: 16, fontWeight: '800' }, loseValue: { color: '#E297F5', fontSize: 16, fontWeight: '800' }, winBar: { backgroundColor: '#A94BE8', borderRadius: 8, flex: 1, height: 5, overflow: 'hidden' }, winFill: { backgroundColor: '#A7F24A', borderRadius: 8, height: '100%' }, winLabel: { color: '#9EAAA7', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginTop: 7, textAlign: 'center' },
  rosterCard: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 16, borderWidth: 1, overflow: 'hidden' }, rosterTitle: { color: colors.text, fontSize: 12, fontWeight: '800', letterSpacing: 1, paddingHorizontal: 16, paddingTop: 16 },
  carousel: { gap: 10, paddingRight: 2 }, matchupChip: { backgroundColor: '#0D1413', borderColor: '#263330', borderRadius: 10, borderWidth: 1, padding: 10, width: 144 }, selectedChip: { borderColor: '#B6FF00' }, chipTeam: { color: '#D9E2DF', fontSize: 10, fontWeight: '700' }, chipScore: { color: colors.text, fontSize: 13, fontWeight: '800', marginVertical: 4 }, chipVs: { color: '#80918D', fontSize: 9 },
});
