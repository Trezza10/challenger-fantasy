import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

/** Props accepted by the reusable content card. */
interface CardProps {
  children: ReactNode;
  title: string;
}

/** Provides a consistently styled title-and-content card for simple pages. */
export function Card({ children, title }: CardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // Mirrors the matchup panels so every tab uses the same dark card language.
  card: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 16, borderWidth: 1, gap: 14, padding: 18 },
  title: { color: colors.text, fontSize: 14, fontWeight: '800', letterSpacing: 0.6 },
});
