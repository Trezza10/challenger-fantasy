import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { AppliedModifier, MatchupPlayerData, PlayerStat, PlayerWeekHistory } from '../../types/fantasy';

interface PlayerDetailsModalProps {
  modifiers: AppliedModifier[];
  onClose: () => void;
  onRemoveModifier: (modifier: AppliedModifier) => void;
  player: MatchupPlayerData | null;
}

/**
 * Displays a player's game context and any current card effect.
 * Pre-game modifiers may be removed and returned to the manager's inventory.
 */
export function PlayerDetailsModal({ modifiers, onClose, onRemoveModifier, player }: PlayerDetailsModalProps) {
  if (!player) return null;

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <View style={styles.backdrop}>
        {/* This sits behind the dialog and closes it when the dimmed area is tapped. */}
        <Pressable accessibilityLabel="Close player details" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={styles.dialog}>
          <View style={styles.header}>
            <View><Text style={styles.name}>{player.name}</Text><Text style={styles.meta}>{player.position} · {player.team}</Text></View>
            <Pressable accessibilityLabel="Close player details" onPress={onClose}><Ionicons color={colors.text} name="close" size={24} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content} nestedScrollEnabled>
            <Text style={styles.sectionTitle}>{player.gameStarted ? 'CURRENT GAME' : 'UPCOMING GAME'}</Text>
            <StatsRow stats={player.liveStats} />
            <View style={styles.pointsSummary}><PointSummary label="PLAYER STATS" value={player.baseScore ?? player.score - (player.cardAdjustment ?? 0)} /><PointSummary card label="CARD EFFECTS" value={player.cardAdjustment ?? 0} /><PointSummary total label="TOTAL" value={player.score} /></View>

            <View style={styles.historyHeading}><Text style={styles.sectionTitle}>WEEKLY GAME LOG</Text><Text style={styles.historyNote}>Card points are tracked separately from player production.</Text></View>
            <WeeklyHistoryTable history={player.weeklyHistory ?? []} />

            <Text style={styles.sectionTitle}>ACTIVE MATCHUP EFFECTS</Text>
            {modifiers.length > 0 ? <View style={styles.effectsList}>{modifiers.map((modifier) => <ModifierCard key={modifier.id} modifier={modifier} onRemove={() => onRemoveModifier(modifier)} player={player} />)}</View> : <Text style={styles.emptyModifier}>No card modifier is active for this matchup.</Text>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PointSummary({ card = false, label, total = false, value }: { card?: boolean; label: string; total?: boolean; value: number }) {
  return <View style={[styles.pointSummary, total && styles.totalSummary]}><Text style={styles.pointLabel}>{label}</Text><Text style={[styles.pointValue, card && value !== 0 && styles.cardValue, total && styles.totalValue]}>{value > 0 && card ? '+' : ''}{value.toFixed(1)}</Text></View>;
}

function WeeklyHistoryTable({ history }: { history: PlayerWeekHistory[] }) {
  if (history.length === 0) return <Text style={styles.emptyHistory}>No completed-game history is available yet.</Text>;
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroll}><View style={styles.table}>
    <View style={[styles.tableRow, styles.tableHeader]}><TableCell header text="WK" width={34} /><TableCell header text="OPP" width={45} /><TableCell flex header text="STAT LINE" /><TableCell header numeric text="BASE" width={48} /><TableCell header numeric text="CARD" width={48} /><TableCell header numeric text="TOTAL" width={50} /></View>
    {[...history].sort((a, b) => b.week - a.week).map((game) => <View key={game.week} style={styles.tableRow}><TableCell text={String(game.week)} width={34} /><TableCell text={game.opponent} width={45} /><TableCell flex text={game.statLine} /><TableCell numeric text={game.basePoints.toFixed(1)} width={48} /><TableCell accent={game.cardAdjustment !== 0} numeric text={game.cardAdjustment ? `${game.cardAdjustment > 0 ? '+' : ''}${game.cardAdjustment.toFixed(1)}` : '—'} width={48} /><TableCell bold numeric text={game.totalPoints.toFixed(1)} width={50} /></View>)}
  </View></ScrollView>;
}

function TableCell({ accent = false, bold = false, flex = false, header = false, numeric = false, text, width }: { accent?: boolean; bold?: boolean; flex?: boolean; header?: boolean; numeric?: boolean; text: string; width?: number }) {
  return <Text numberOfLines={1} style={[styles.tableCell, flex && styles.flexCell, header && styles.headerCell, numeric && styles.numericCell, accent && styles.accentCell, bold && styles.boldCell, width ? { width } : undefined]}>{text}</Text>;
}

/** Shows one modifier and only exposes removal for a pre-game card played by this manager. */
function ModifierCard({ modifier, onRemove, player }: { modifier: AppliedModifier; onRemove: () => void; player: MatchupPlayerData }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const canRemove = modifier.playedBy === 'manager' && !player.gameStarted;
  return <View style={[styles.modifier, { borderColor: modifier.card.accent }]}>
    <Pressable onPress={() => setIsExpanded((expanded) => !expanded)} style={styles.modifierHeader}>
      <Text style={[styles.modifierTitle, { color: modifier.card.accent }]}>{modifier.card.label} {modifier.card.effectText}</Text>
      <Ionicons color={modifier.card.accent} name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} />
    </Pressable>
    {isExpanded && <><Text style={styles.modifierText}>{modifier.playedBy === 'opponent' ? `Played by ${modifier.playedByName}. Opponent effects cannot be removed.` : player.gameStarted ? `Played by ${modifier.playedByName}. This modifier is locked because the game has started.` : `Played by ${modifier.playedByName}. This modifier can still be removed before kickoff.`}</Text>
    {canRemove && <Pressable onPress={onRemove} style={[styles.removeButton, { borderColor: modifier.card.accent }]}><Text style={[styles.removeText, { color: modifier.card.accent }]}>REMOVE MODIFIER</Text></Pressable>}</>}
  </View>;
}

/** Renders a compact row of supplied live or recent statistics. */
function StatsRow({ stats }: { stats: PlayerStat[] }) {
  return <View style={styles.statsRow}>{stats.map((stat) => <View key={stat.label} style={styles.stat}><Text style={styles.statValue}>{stat.value}</Text><Text style={styles.statLabel}>{stat.label}</Text></View>)}</View>;
}

const styles = StyleSheet.create({
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.72)', flex: 1, justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#101716', borderColor: '#2B3835', borderRadius: 18, borderWidth: 1, maxHeight: '88%', maxWidth: 620, overflow: 'hidden', padding: 20, width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  content: { paddingBottom: 2 },
  name: { color: colors.text, fontSize: 24, fontWeight: '800' },
  meta: { color: '#A2B0AD', fontSize: 13, fontWeight: '700', marginTop: 3 },
  sectionTitle: { color: '#9AA7A4', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 22 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 9 },
  stat: { backgroundColor: '#18211F', borderRadius: 8, flex: 1, padding: 10 },
  statValue: { color: colors.text, fontSize: 17, fontWeight: '800' },
  statLabel: { color: '#91A09C', fontSize: 9, fontWeight: '700', marginTop: 3 },
  pointsSummary: { flexDirection: 'row', gap: 7, marginTop: 10 },
  pointSummary: { backgroundColor: '#18211F', borderRadius: 8, flex: 1, paddingHorizontal: 9, paddingVertical: 9 },
  totalSummary: { backgroundColor: '#203018', borderColor: '#456428', borderWidth: 1 },
  pointLabel: { color: '#91A09C', fontSize: 7, fontWeight: '900', letterSpacing: .5 },
  pointValue: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 3 },
  cardValue: { color: '#C88AFF' },
  totalValue: { color: colors.accent },
  historyHeading: { marginTop: 2 },
  historyNote: { color: colors.textSecondary, fontSize: 9, marginTop: 4 },
  emptyHistory: { backgroundColor: '#151D1B', borderRadius: 8, color: colors.textSecondary, fontSize: 11, marginTop: 9, padding: 14, textAlign: 'center' },
  tableScroll: { marginTop: 9 },
  table: { borderColor: colors.border, borderRadius: 9, borderWidth: 1, minWidth: 420, overflow: 'hidden' },
  tableRow: { alignItems: 'center', borderTopColor: '#263330', borderTopWidth: 1, flexDirection: 'row', minHeight: 39, paddingHorizontal: 7 },
  tableHeader: { backgroundColor: '#18211F', borderTopWidth: 0, minHeight: 32 },
  tableCell: { color: colors.textSecondary, fontSize: 9, paddingHorizontal: 3 },
  flexCell: { flex: 1, minWidth: 145 },
  headerCell: { color: '#91A09C', fontSize: 7, fontWeight: '900', letterSpacing: .45 },
  numericCell: { textAlign: 'right' },
  accentCell: { color: '#C88AFF', fontWeight: '900' },
  boldCell: { color: colors.text, fontWeight: '900' },
  modifier: { backgroundColor: '#14201D', borderRadius: 10, borderWidth: 1, padding: 14 },
  modifierHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  modifierTitle: { fontSize: 15, fontWeight: '900' },
  modifierText: { color: '#B1BFBC', fontSize: 12, lineHeight: 18, marginTop: 6 },
  removeButton: { alignItems: 'center', borderRadius: 7, borderWidth: 1, marginTop: 13, paddingVertical: 10 },
  removeText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.7 },
  emptyModifier: { color: '#92A09C', fontSize: 12, marginTop: 10, textAlign: 'center' },
  effectsList: { gap: 10, paddingBottom: 2, paddingTop: 8 },
});
