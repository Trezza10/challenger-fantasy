import { createElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

/** Browser-native date/time input; its value is interpreted in the device's local timezone. */
export function DraftDateTimePicker({ onChange, value }: { onChange: (value: Date) => void; value: Date }) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  return <View style={styles.field}>
    <Text style={styles.label}>DRAFT START</Text>
    {createElement('input', {
      min: new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16),
      onChange: (event: { target: { value: string } }) => {
        const next = new Date(event.target.value);
        if (!Number.isNaN(next.getTime())) onChange(next);
      },
      style: { backgroundColor: '#111A18', border: 0, color: '#F3F6F5', colorScheme: 'dark', flex: 1, fontFamily: 'inherit', fontSize: 14, outline: 'none' },
      type: 'datetime-local',
      value: local,
    })}
  </View>;
}

const styles = StyleSheet.create({
  field: { alignItems: 'center', backgroundColor: '#111A18', borderColor: colors.border, borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 14, marginTop: 12, minHeight: 52, paddingHorizontal: 12 },
  label: { color: colors.textSecondary, fontSize: 9, fontWeight: '900', letterSpacing: .8 },
});
