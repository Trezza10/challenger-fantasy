import DateTimePicker from '@react-native-community/datetimepicker';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

/** Native calendar and clock controls for scheduling a draft in local time. */
export function DraftDateTimePicker({ onChange, value }: { onChange: (value: Date) => void; value: Date }) {
  const updateDate = (selected?: Date) => {
    if (!selected) return;
    const next = new Date(value);
    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    onChange(next);
  };
  const updateTime = (selected?: Date) => {
    if (!selected) return;
    const next = new Date(value);
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    onChange(next);
  };

  return <View style={styles.container}>
    <View style={styles.field}><Text style={styles.label}>DATE</Text><DateTimePicker minimumDate={new Date()} mode="date" onChange={(_, selected) => updateDate(selected)} value={value} /></View>
    <View style={styles.field}><Text style={styles.label}>TIME</Text><DateTimePicker mode="time" onChange={(_, selected) => updateTime(selected)} value={value} /></View>
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 10, marginTop: 12 },
  field: { alignItems: 'center', backgroundColor: '#111A18', borderColor: colors.border, borderRadius: 10, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 12 },
  label: { color: colors.textSecondary, fontSize: 9, fontWeight: '900', letterSpacing: .8 },
});
