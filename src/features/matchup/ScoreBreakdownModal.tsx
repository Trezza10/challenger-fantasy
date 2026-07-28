import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { MatchupPlayerData } from '../../types/fantasy';
import { formatPoints } from '../../utils/formatters';

/** Explains a player's total using the exact stat quantities and league scoring values. */
export function ScoreBreakdownModal({ onClose, player }: { onClose: () => void; player: MatchupPlayerData | null }) {
  if (!player) return null;
  const rows = player.scoreBreakdown ?? [];

  return <Modal animationType="fade" onRequestClose={onClose} transparent visible>
    <View style={styles.backdrop}>
      <Pressable accessibilityLabel="Close score breakdown" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View style={styles.dialog}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{player.position} · {player.team}</Text>
            <Text style={styles.title}>{player.name}</Text>
          </View>
          <Pressable accessibilityLabel="Close score breakdown" onPress={onClose} style={styles.close}><Ionicons color={colors.text} name="close" size={22} /></Pressable>
        </View>
        <View style={styles.totalRow}><Text style={styles.totalLabel}>FANTASY POINTS</Text><Text style={styles.total}>{formatPoints(player.score)}</Text></View>
        <View style={styles.componentRow}><Text style={styles.component}>PLAYER STATS <Text style={styles.componentValue}>{formatPoints(player.baseScore ?? player.score - (player.cardAdjustment ?? 0))}</Text></Text><Text style={styles.component}>CARD EFFECTS <Text style={styles.cardComponentValue}>{(player.cardAdjustment ?? 0) > 0 ? '+' : ''}{formatPoints(player.cardAdjustment ?? 0)}</Text></Text></View>
        <ScrollView contentContainerStyle={styles.rows}>
          {rows.map((row, index) => <View key={`${row.label}-${index}`} style={styles.row}>
            <View style={styles.rowCopy}>
              <Text style={styles.statLabel}>{row.label}</Text>
              <Text style={styles.calculation}>{formatNumber(row.quantity)} × {formatRate(row.pointsPerUnit)} pts</Text>
            </View>
            <Text style={[styles.points, row.points < 0 && styles.negativePoints]}>{row.points > 0 ? '+' : ''}{formatPoints(row.points)}</Text>
          </View>)}
          {rows.length === 0 && <Text style={styles.empty}>No scoring stats have been recorded for this player yet.</Text>}
        </ScrollView>
        <Text style={styles.footer}>Calculated using this league’s Rules & Scoring settings.</Text>
      </View>
    </View>
  </Modal>;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function formatRate(value: number) {
  const sign = value < 0 ? '−' : '';
  return `${sign}${formatNumber(Math.abs(value))}`;
}

const styles = StyleSheet.create({
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.76)', flex: 1, justifyContent: 'center', padding: 22 },
  dialog: { backgroundColor: '#101716', borderColor: colors.border, borderRadius: 18, borderWidth: 1, maxHeight: '82%', maxWidth: 480, overflow: 'hidden', width: '100%' },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', padding: 20 },
  eyebrow: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: .9 },
  title: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 4 },
  close: { alignItems: 'center', backgroundColor: '#1A2321', borderRadius: 16, height: 32, justifyContent: 'center', width: 32 },
  totalRow: { alignItems: 'center', backgroundColor: '#17221E', borderBottomColor: colors.border, borderBottomWidth: 1, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  totalLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: '900', letterSpacing: .8 },
  total: { color: colors.accent, fontSize: 25, fontWeight: '900' },
  componentRow: { backgroundColor: '#111A18', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
  component: { color: colors.textSecondary, fontSize: 8, fontWeight: '900', letterSpacing: .4 },
  componentValue: { color: colors.text },
  cardComponentValue: { color: '#C88AFF' },
  rows: { paddingHorizontal: 20 },
  row: { alignItems: 'center', borderBottomColor: '#25302E', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 },
  rowCopy: { flex: 1, paddingRight: 14 },
  statLabel: { color: colors.text, fontSize: 13, fontWeight: '800' },
  calculation: { color: colors.textSecondary, fontSize: 11, marginTop: 4 },
  points: { color: colors.accent, fontSize: 14, fontWeight: '900' },
  negativePoints: { color: '#FF7777' },
  empty: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, paddingVertical: 24, textAlign: 'center' },
  footer: { color: colors.muted, fontSize: 9, lineHeight: 14, padding: 16, textAlign: 'center' },
});
