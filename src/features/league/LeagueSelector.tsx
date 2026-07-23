import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { LeagueSummary } from '../../types/fantasy';
import { LoadingIndicator } from '../ui/LoadingIndicator';

interface LeagueSelectorProps {
  leagues: LeagueSummary[];
  onSelect: (league: LeagueSummary) => void;
  selectedLeague: LeagueSummary | null;
}

/** Global dropdown for switching among the manager's available leagues. */
export function LeagueSelector({ leagues, onSelect, selectedLeague }: LeagueSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectLeague = (league: LeagueSummary) => {
    onSelect(league);
    setIsOpen(false);
  };

  return <View style={styles.container}>
    <Pressable onPress={() => setIsOpen((open) => !open)} style={styles.trigger}>
      <View><Text style={styles.label}>LEAGUE</Text>{selectedLeague ? <Text style={styles.name}>{selectedLeague.name}</Text> : <View style={styles.loadingName}><LoadingIndicator size="small" /></View>}</View>
      <Ionicons color={colors.accent} name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} />
    </Pressable>
    {isOpen && <View style={styles.menu}>{leagues.map((league) => <Pressable key={league.id} onPress={() => selectLeague(league)} style={[styles.option, selectedLeague?.id === league.id && styles.selectedOption]}><View><Text style={styles.optionName}>{league.name}</Text><Text style={styles.optionMeta}>{league.memberCount} managers</Text></View>{selectedLeague?.id === league.id && <Ionicons color={colors.accent} name="checkmark" size={18} />}</Pressable>)}</View>}
  </View>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#090E0E', borderBottomColor: '#202A28', borderBottomWidth: 1, elevation: 20, position: 'relative', zIndex: 20 },
  trigger: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  label: { color: '#81918D', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 2 },
  loadingName: { alignItems: 'flex-start', height: 22, justifyContent: 'center', marginTop: 2 },
  menu: { backgroundColor: '#101716', borderBottomColor: '#2B3835', borderBottomWidth: 1, borderTopColor: '#2B3835', borderTopWidth: 1 },
  option: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  selectedOption: { backgroundColor: '#15221E' },
  optionName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  optionMeta: { color: '#91A09C', fontSize: 11, marginTop: 3 },
});
