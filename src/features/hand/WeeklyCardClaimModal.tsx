import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { CardClaimState, PowerCard } from '../../types/fantasy';
import { LoadingIndicator } from '../ui/LoadingIndicator';

export function WeeklyCardClaimModal({ busy, claim, onChoose, onClose, visible }: { busy: boolean; claim: CardClaimState | null; onChoose: (card: PowerCard) => void; onClose: () => void; visible: boolean }) {
  return <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
    <View style={styles.screen}>
      <View style={styles.header}><View><Text style={styles.eyebrow}>WEEK {claim?.week ?? '—'} CARD DROP</Text><Text style={styles.title}>Choose one card</Text></View><Pressable onPress={onClose} style={styles.close}><Ionicons color={colors.text} name="close" size={21} /></Pressable></View>
      <Text style={styles.copy}>This offer is locked in, so refreshing won’t reroll it. Choose carefully.</Text>
      <View style={styles.progress}><Text style={styles.progressLabel}>CLAIMS REMAINING</Text><Text style={styles.progressValue}>{claim?.remainingClaims ?? 0} / {claim?.allowance ?? 0}</Text></View>
      <ScrollView contentContainerStyle={styles.cards}>
        {claim?.choices.map((card) => <Pressable disabled={busy} key={card.id} onPress={() => onChoose(card)} style={[styles.card, { borderColor: card.accent }, busy && styles.disabled]}>
          <View style={[styles.icon, { backgroundColor: `${card.accent}18` }]}><Ionicons color={card.accent} name={card.icon} size={31} /></View>
          <View style={styles.cardCopy}><Text style={[styles.rarity, { color: card.accent }]}>{card.rarity.toUpperCase()} · {card.type.toUpperCase()}</Text><Text style={styles.cardTitle}>{card.label}</Text><Text style={styles.description}>{card.description}</Text><Text style={styles.effect}>{card.effectText}</Text><Text style={styles.target}>{card.allowedTeam === 'SELF' ? 'YOUR TEAM' : 'OPPONENT'} · {card.allowedPositions.join(', ')}</Text></View>
          <View style={[styles.choose, { backgroundColor: card.accent }]}>{busy ? <LoadingIndicator size="small" /> : <Text style={styles.chooseText}>CLAIM</Text>}</View>
        </Pressable>)}
      </ScrollView>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1, padding: 20, paddingTop: 28 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', marginTop: 4 },
  close: { alignItems: 'center', backgroundColor: colors.card, borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  copy: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 10 },
  progress: { alignItems: 'center', backgroundColor: '#17221E', borderColor: '#31523A', borderRadius: 11, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, padding: 12 },
  progressLabel: { color: colors.textSecondary, fontSize: 9, fontWeight: '900', letterSpacing: .7 },
  progressValue: { color: colors.accent, fontSize: 16, fontWeight: '900' },
  cards: { gap: 13, paddingBottom: 30, paddingTop: 16 },
  card: { alignItems: 'center', backgroundColor: colors.card, borderRadius: 15, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 13 },
  disabled: { opacity: .55 },
  icon: { alignItems: 'center', borderRadius: 12, height: 58, justifyContent: 'center', width: 58 },
  cardCopy: { flex: 1 },
  rarity: { fontSize: 8, fontWeight: '900', letterSpacing: .6 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 3 },
  description: { color: colors.textSecondary, fontSize: 10, lineHeight: 14, marginTop: 3 },
  effect: { color: colors.text, fontSize: 10, fontWeight: '800', marginTop: 5 },
  target: { color: colors.muted, fontSize: 8, fontWeight: '800', marginTop: 5 },
  choose: { alignItems: 'center', borderRadius: 8, justifyContent: 'center', minHeight: 34, width: 54 },
  chooseText: { color: colors.background, fontSize: 8, fontWeight: '900' },
});
