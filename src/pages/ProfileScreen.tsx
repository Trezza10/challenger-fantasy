import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Card } from '../features/ui/Card';
import { ServiceState } from '../features/ui/ServiceState';
import { Stat } from '../features/ui/Stat';
import { useServiceData } from '../hooks/useServiceData';
import { fantasyService } from '../services/fantasy';

/** Manager account page and future home for preferences. */
export function ProfileScreen({ onRegisterRefresh }: { onRegisterRefresh: (refresh: () => Promise<void>) => () => void }) {
  const { data, error, isLoading, refetch } = useServiceData(fantasyService.getProfile);

  /** Connects the shared pull-to-refresh control to this page's service call. */
  useEffect(() => onRegisterRefresh(refetch), [onRegisterRefresh, refetch]);
  if (!data) return <ServiceState error={error} isLoading={isLoading} />;

  return <Card title="Manager profile"><Stat label="Name" value={data.name} /><Stat label="Member since" value={data.memberSince} /><Text style={styles.text}>Account settings and notifications will live here.</Text></Card>;
}

const styles = StyleSheet.create({ text: { color: '#BBC5C3', fontSize: 14, lineHeight: 21 } });
