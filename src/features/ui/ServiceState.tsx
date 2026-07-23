import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { LoadingIndicator } from './LoadingIndicator';

/** A standard in-page loading or error state for asynchronous service calls. */
export function ServiceState({ error, isLoading }: { error: Error | null; isLoading: boolean }) {
  if (isLoading) return <View style={styles.container}><LoadingIndicator /></View>;
  return <View style={styles.container}><Text style={styles.text}>{isLoading ? 'Loading…' : error?.message}</Text></View>;
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', minHeight: 180 },
  text: { color: colors.textSecondary, fontSize: 15 },
});
