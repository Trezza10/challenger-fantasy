import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { AppliedModifier, MatchupPlayerData, PlayerStat } from '../../types/fantasy';

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

          <Text style={styles.sectionTitle}>{player.gameStarted ? 'LIVE GAME STATS' : 'UPCOMING GAME'}</Text>
          <StatsRow stats={player.liveStats} />
          <Text style={styles.sectionTitle}>MOST RECENT GAME</Text>
          <StatsRow stats={player.recentStats} />

          <Text style={styles.sectionTitle}>ACTIVE EFFECTS</Text>
          {modifiers.length > 0 ? <ScrollView contentContainerStyle={styles.effectsList} nestedScrollEnabled style={styles.effectsScroll}>{modifiers.map((modifier) => <ModifierCard key={modifier.id} modifier={modifier} onRemove={() => onRemoveModifier(modifier)} player={player} />)}</ScrollView> : <Text style={styles.emptyModifier}>No card modifier is active.</Text>}
        </View>
      </View>
    </Modal>
  );
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
  dialog: { backgroundColor: '#101716', borderColor: '#2B3835', borderRadius: 18, borderWidth: 1, padding: 20, width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  name: { color: colors.text, fontSize: 24, fontWeight: '800' },
  meta: { color: '#A2B0AD', fontSize: 13, fontWeight: '700', marginTop: 3 },
  sectionTitle: { color: '#9AA7A4', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 22 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 9 },
  stat: { backgroundColor: '#18211F', borderRadius: 8, flex: 1, padding: 10 },
  statValue: { color: colors.text, fontSize: 17, fontWeight: '800' },
  statLabel: { color: '#91A09C', fontSize: 9, fontWeight: '700', marginTop: 3 },
  modifier: { backgroundColor: '#14201D', borderRadius: 10, borderWidth: 1, padding: 14 },
  modifierHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  modifierTitle: { fontSize: 15, fontWeight: '900' },
  modifierText: { color: '#B1BFBC', fontSize: 12, lineHeight: 18, marginTop: 6 },
  removeButton: { alignItems: 'center', borderRadius: 7, borderWidth: 1, marginTop: 13, paddingVertical: 10 },
  removeText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.7 },
  emptyModifier: { color: '#92A09C', fontSize: 13, marginTop: 22, textAlign: 'center' },
  effectsScroll: { marginTop: 7, maxHeight: 180 },
  effectsList: { gap: 10, paddingBottom: 2 },
});
