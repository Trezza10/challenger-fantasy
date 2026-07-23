import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

/** Props for a compact label/value statistic row. */
interface StatProps {
  label: string;
  value: string;
}

/** Displays one stat with its label on the left and current value on the right. */
export function Stat({ label, value }: StatProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: '#91A09C', fontSize: 13, fontWeight: '700' },
  value: { color: colors.text, fontSize: 15, fontWeight: '800' },
});
