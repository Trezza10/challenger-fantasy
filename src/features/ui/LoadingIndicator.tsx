import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '../../theme/colors';

/** Shared branded spinner for page loads, refreshes, and future async UI. */
export function LoadingIndicator({ size = 'large' }: { size?: 'small' | 'large' }) {
  return <View accessibilityLabel="Loading" accessibilityRole="progressbar" style={styles.container}><ActivityIndicator color={colors.accent} size={size} /></View>;
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
});
