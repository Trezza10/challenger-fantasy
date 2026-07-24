import { useCallback, useEffect, useState } from 'react';
import { ServiceState } from '../features/ui/ServiceState';
import { LeagueDetail, LeagueDestination, LeagueHub } from '../features/league/LeagueViews';
import { useServiceData } from '../hooks/useServiceData';
import { fantasyService } from '../services/fantasy';
import { LeagueSummary } from '../types/fantasy';

/**
 * Thin page coordinator for League HQ.
 * Feature views live together under features/league so page-level navigation stays easy to follow.
 */
export function LeagueScreen({ onChatInputBlur, onChatInputFocus, onRegisterReachEnd, onRegisterRefresh, selectedLeague }: { onChatInputBlur: () => void; onChatInputFocus: () => void; onRegisterReachEnd: (handler: () => void) => () => void; onRegisterRefresh: (refresh: () => Promise<void>) => () => void; selectedLeague?: LeagueSummary | null }) {
  const [destination, setDestination] = useState<LeagueDestination | null>(null);
  const loadSelectedLeague = useCallback(() => fantasyService.getLeague(selectedLeague?.id), [selectedLeague?.id]);
  const { data, error, isLoading, refetch } = useServiceData(loadSelectedLeague);

  /** Registers this league-specific service request with the shared pull-to-refresh container. */
  useEffect(() => onRegisterRefresh(refetch), [onRegisterRefresh, refetch]);
  /** A new league always returns to its own hub instead of retaining a previous detail page. */
  useEffect(() => setDestination(null), [selectedLeague?.id]);
  if (!data) return <ServiceState error={error} isLoading={isLoading} />;

  return destination
    ? <LeagueDetail data={data} destination={destination} isCommissioner={selectedLeague?.id === 'challengers'} leagueId={selectedLeague?.id ?? 'challengers'} onBack={() => setDestination(null)} onChatInputBlur={onChatInputBlur} onChatInputFocus={onChatInputFocus} onRegisterReachEnd={onRegisterReachEnd} />
    : <LeagueHub data={data} memberCount={selectedLeague?.memberCount ?? data.memberCount} onSelect={setDestination} />;
}
