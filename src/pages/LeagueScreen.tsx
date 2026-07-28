import { useCallback, useEffect, useState } from 'react';
import { ServiceState } from '../features/ui/ServiceState';
import { LeagueDetail, LeagueDestination, LeagueHub } from '../features/league/LeagueViews';
import { SwipeBackView } from '../features/ui/SwipeBackView';
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
  const loadLeagueMembers = useCallback(() => fantasyService.getLeagueMembers(selectedLeague?.id ?? 'challengers'), [selectedLeague?.id]);
  // The selected league ID is stable across navigation, so League HQ and Settings reuse the same session data.
  const { data, error, isLoading, refetch } = useServiceData(loadSelectedLeague, `league:${selectedLeague?.id ?? 'challengers'}`);
  const membersRequest = useServiceData(loadLeagueMembers, `league-members:${selectedLeague?.id ?? 'challengers'}`);
  const currentMember = membersRequest.data?.find((member) => member.isCurrentUser);

  /** Registers this league-specific service request with the shared pull-to-refresh container. */
  useEffect(() => onRegisterRefresh(async () => { await Promise.all([refetch(), membersRequest.refetch()]); }), [membersRequest.refetch, onRegisterRefresh, refetch]);
  /** A new league always returns to its own hub instead of retaining a previous detail page. */
  useEffect(() => setDestination(null), [selectedLeague?.id]);
  if (!data) return <ServiceState error={error} isLoading={isLoading} />;

  return destination
    ? <SwipeBackView onBack={() => setDestination(null)}><LeagueDetail data={data} destination={destination} isCommissioner={currentMember?.role === 'commissioner'} leagueId={selectedLeague?.id ?? 'challengers'} members={membersRequest.data ?? []} onBack={() => setDestination(null)} onChatInputBlur={onChatInputBlur} onChatInputFocus={onChatInputFocus} onRegisterReachEnd={onRegisterReachEnd} /></SwipeBackView>
    : <LeagueHub currentRank={currentMember?.rank ?? null} data={data} memberCount={membersRequest.data?.length ?? data.memberCount} onSelect={setDestination} />;
}
