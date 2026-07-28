import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

const adminAreas = [
  { icon: 'american-football-outline' as const, label: 'GAME OPERATIONS', value: 'Live data console', copy: 'Manage the staff workflow used to publish official game events.' },
  { icon: 'people-outline' as const, label: 'ACCESS CONTROL', value: 'Clerk-protected', copy: 'Platform roles remain separate from commissioner and league membership.' },
  { icon: 'shield-checkmark-outline' as const, label: 'AUDIT & SAFETY', value: 'Backend next', copy: 'Every correction will retain its author, timestamp, and original event.' },
];

/** Platform administration preview. Visibility is role-gated by AppNavigator. */
export function AdminScreen() {
  return <View style={styles.screen}>
    <View style={styles.hero}>
      <View style={styles.heroIcon}><Ionicons color={colors.background} name="shield-checkmark" size={24} /></View>
      <View style={styles.heroCopy}><Text style={styles.eyebrow}>PLATFORM OPERATIONS</Text><Text style={styles.title}>Admin control room</Text><Text style={styles.subtitle}>Restricted tools for operating Challenger Fantasy across every league.</Text></View>
      <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>ADMIN</Text></View>
    </View>

    <View style={styles.notice}><Ionicons color={colors.accent} name="lock-closed" size={18} /><View style={styles.noticeCopy}><Text style={styles.noticeTitle}>ROLE-PROTECTED PREVIEW</Text><Text style={styles.noticeBody}>Only Clerk accounts carrying the platform admin role can see this destination. Backend policies will enforce the same role before any administrative action is enabled.</Text></View></View>

    <View style={styles.grid}>
      {adminAreas.map((area) => <View key={area.label} style={styles.card}>
        <View style={styles.cardTop}><View style={styles.cardIcon}><Ionicons color={colors.accent} name={area.icon} size={21} /></View><Text style={styles.cardLabel}>{area.label}</Text></View>
        <Text style={styles.cardValue}>{area.value}</Text>
        <Text style={styles.cardCopy}>{area.copy}</Text>
      </View>)}
    </View>

    <View style={styles.section}>
      <Text style={styles.sectionLabel}>IMPLEMENTATION ROADMAP</Text>
      {[
        ['01', 'Live game data', 'Structured play entry, field state, scoring events'],
        ['02', 'Staff management', 'Assign and review platform-level access'],
        ['03', 'Audit history', 'Corrections, reversals, and operator attribution'],
      ].map(([number, title, copy]) => <View key={number} style={styles.row}><Text style={styles.rowNumber}>{number}</Text><View style={styles.rowCopy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowBody}>{copy}</Text></View><Ionicons color={colors.muted} name="chevron-forward" size={17} /></View>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { gap: 14 },
  hero: { alignItems: 'center', backgroundColor: '#111A17', borderColor: '#31523A', borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 13, padding: 17 },
  heroIcon: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 13, height: 48, justifyContent: 'center', width: 48 },
  heroCopy: { flex: 1 },
  eyebrow: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 3 },
  subtitle: { color: colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 5 },
  liveBadge: { alignItems: 'center', backgroundColor: '#17221E', borderRadius: 20, flexDirection: 'row', gap: 5, paddingHorizontal: 9, paddingVertical: 6 },
  liveDot: { backgroundColor: colors.accent, borderRadius: 4, height: 7, width: 7 },
  liveText: { color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: .7 },
  notice: { alignItems: 'flex-start', backgroundColor: '#101716', borderColor: colors.border, borderRadius: 13, borderWidth: 1, flexDirection: 'row', gap: 11, padding: 14 },
  noticeCopy: { flex: 1 },
  noticeTitle: { color: colors.text, fontSize: 10, fontWeight: '900', letterSpacing: .7 },
  noticeBody: { color: colors.textSecondary, fontSize: 10, lineHeight: 15, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 14, borderWidth: 1, flexBasis: 210, flexGrow: 1, minHeight: 150, padding: 14 },
  cardTop: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  cardIcon: { alignItems: 'center', backgroundColor: '#17221E', borderRadius: 9, height: 34, justifyContent: 'center', width: 34 },
  cardLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: .7 },
  cardValue: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 16 },
  cardCopy: { color: colors.textSecondary, fontSize: 10, lineHeight: 15, marginTop: 5 },
  section: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 14, borderWidth: 1, padding: 14 },
  sectionLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: .8, marginBottom: 4 },
  row: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: 11, paddingVertical: 13 },
  rowNumber: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  rowCopy: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 12, fontWeight: '900' },
  rowBody: { color: colors.textSecondary, fontSize: 9, marginTop: 3 },
});
