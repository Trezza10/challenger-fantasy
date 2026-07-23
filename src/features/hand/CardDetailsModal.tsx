import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { PowerCard } from '../../types/fantasy';

/** Displays the rule text for an inventory card without playing or consuming it. */
export function CardDetailsModal({ card, onClose }: { card: PowerCard | null; onClose: () => void }) {
  if (!card) return null;

  return <Modal animationType="fade" onRequestClose={onClose} transparent visible>
    <View style={styles.backdrop}>
      <Pressable accessibilityLabel="Close card details" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View style={[styles.dialog, { borderColor: card.accent }]}>
        <View style={styles.header}><View style={[styles.iconBox, { borderColor: card.accent }]}><Ionicons color={card.accent} name={card.icon} size={36} /></View><Pressable accessibilityLabel="Close card details" onPress={onClose}><Ionicons color={colors.text} name="close" size={24} /></Pressable></View>
        <Text style={[styles.title, { color: card.accent }]}>{card.label}</Text>
        <Text style={styles.effect}>{card.effectText}</Text>
        <Text style={styles.description}>{card.description}</Text>
        <View style={styles.metadata}><Text style={styles.metadataItem}>{card.type.toUpperCase()} · {card.rarity.toUpperCase()}</Text><Text style={styles.metadataItem}>{card.allowedTeam === 'SELF' ? 'YOUR PLAYER' : 'OPPONENT PLAYER'}</Text><Text style={styles.metadataItem}>{card.allowedPositions.join(' / ')}</Text></View>
        <View style={styles.duration}><Text style={styles.quantityLabel}>DURATION</Text><Text style={styles.durationValue}>{card.duration}</Text></View>
        <View style={styles.quantity}><Text style={styles.quantityLabel}>AVAILABLE</Text><Text style={styles.quantityValue}>×{card.quantity}</Text></View>
      </View>
    </View>
  </Modal>;
}

/** Gives each known power-card type a short explanation for the prototype. */
function getEffectDescription(card: PowerCard) {
  if (card.icon === 'flash') return 'Increase one player’s projected scoring output for this matchup.';
  if (card.icon === 'shield') return 'Protect a player from the next negative effect applied before kickoff.';
  return 'Reduce one opposing player’s projected scoring output for this matchup.';
}

const styles = StyleSheet.create({
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.72)', flex: 1, justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#101716', borderRadius: 18, borderWidth: 1, padding: 20, width: '100%' },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  iconBox: { alignItems: 'center', backgroundColor: '#151D1B', borderRadius: 12, borderWidth: 1, height: 62, justifyContent: 'center', width: 62 },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: 0.5, marginTop: 18 },
  effect: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 4 },
  description: { color: '#B1BFBC', fontSize: 13, lineHeight: 20, marginTop: 14 },
  metadata: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  metadataItem: { backgroundColor: '#1A2522', borderRadius: 5, color: '#AAB7B4', fontSize: 9, fontWeight: '800', letterSpacing: 0.4, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 5 },
  duration: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  durationValue: { color: colors.text, fontSize: 12, fontWeight: '700' },
  quantity: { alignItems: 'center', backgroundColor: '#18211F', borderRadius: 9, flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingHorizontal: 13, paddingVertical: 11 },
  quantityLabel: { color: '#91A09C', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  quantityValue: { color: colors.text, fontSize: 16, fontWeight: '900' },
});
