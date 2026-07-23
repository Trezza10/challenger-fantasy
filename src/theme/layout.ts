import { StyleSheet } from 'react-native';
import { colors } from './colors';

/** Layout styles shared by every tab screen. */
export const layout = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.background },
  // Shared near-edge-to-edge page spacing, with room reserved for the bottom navigation.
  content: { paddingBottom: 110, paddingHorizontal: 2, paddingTop: 8 },
  eyebrow: { color: '#9CA3AF', fontSize: 12, fontWeight: '700', letterSpacing: 1.4, marginTop: 16 },
  title: { color: colors.text, fontSize: 36, fontWeight: '800', marginTop: 6 },
  screen: { gap: 16, marginTop: 8 },
});
