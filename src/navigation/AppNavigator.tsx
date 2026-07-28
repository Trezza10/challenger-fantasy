import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth, useUser } from '@clerk/expo';
import { StatusBar } from 'expo-status-bar';
import { ComponentProps, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Linking, Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HandTray } from '../features/hand/HandTray';
import { CardDetailsModal } from '../features/hand/CardDetailsModal';
import { WeeklyCardClaimModal } from '../features/hand/WeeklyCardClaimModal';
import { LeagueSelector } from '../features/league/LeagueSelector';
import { LeagueManagementModal } from '../features/league/LeagueManagementModal';
import { PlayerDetailsModal } from '../features/matchup/PlayerDetailsModal';
import { ScoreBreakdownModal } from '../features/matchup/ScoreBreakdownModal';
import { LoadingIndicator } from '../features/ui/LoadingIndicator';
import { serviceConfig } from '../config/services';
import { useActiveTab } from '../hooks/useActiveTab';
import { useServiceData } from '../hooks/useServiceData';
import { getPlatformRoles } from '../auth/platformRoles';
import { AdminScreen } from '../pages/AdminScreen';
import { GameDataManagerScreen } from '../pages/GameDataManagerScreen';
import { HomeScreen } from '../pages/HomeScreen';
import { LeagueScreen } from '../pages/LeagueScreen';
import { MatchupScreen } from '../pages/MatchupScreen';
import { ProfileScreen } from '../pages/ProfileScreen';
import { TeamScreen } from '../pages/TeamScreen';
import { fantasyService } from '../services/fantasy';
import { colors } from '../theme/colors';
import { layout } from '../theme/layout';
import { AppliedModifier, CardClaimState, LeagueSummary, MatchupPlayerData, PowerCard, RosterLineup } from '../types/fantasy';
import { Tab } from '../types/navigation';

type IconName = ComponentProps<typeof Ionicons>['name'];
interface PlayerDropTarget { isManagerTeam: boolean; node: View | null; player: MatchupPlayerData; }
interface MeasuredPlayerDropTarget extends PlayerDropTarget { height: number; width: number; x: number; y: number; }

/** Configuration for each destination shown in the bottom tab bar. */
const standardTabs: { activeIcon: IconName; icon: IconName; name: Tab }[] = [
  { name: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { name: 'Team', icon: 'people-outline', activeIcon: 'people' },
  { name: 'Matchup', icon: 'swap-horizontal-outline', activeIcon: 'swap-horizontal' },
  { name: 'League', icon: 'shield-outline', activeIcon: 'shield' },
  { name: 'Profile', icon: 'person-outline', activeIcon: 'person' },
];
const isWeb = Platform.OS === 'web';

/**
 * The app's current lightweight navigator.
 * It also coordinates card drops because the hand tray and player table live in separate areas.
 */
export function AppNavigator() {
  const { user } = useUser();
  const { sessionClaims } = useAuth();
  const [activeTab, setActiveTab] = useActiveTab();
  const platformRoles = getPlatformRoles(
    user?.publicMetadata as Record<string, unknown> | undefined,
    sessionClaims as Record<string, unknown> | undefined,
  );
  const canViewAdmin = platformRoles.has('admin');
  const canManageGameData = platformRoles.has('game_data_manager');
  const tabs = [
    ...standardTabs.slice(0, 4),
    ...(canViewAdmin ? [{ activeIcon: 'shield-checkmark' as IconName, icon: 'shield-checkmark-outline' as IconName, name: 'Admin' as Tab }] : []),
    ...(canManageGameData ? [{ activeIcon: 'radio' as IconName, icon: 'radio-outline' as IconName, name: 'Game Data' as Tab }] : []),
    standardTabs[4],
  ];
  const leaguesRequest = useServiceData(fantasyService.getLeagues, `leagues-${user?.id ?? 'anonymous'}`);
  const [selectedLeague, setSelectedLeague] = useState<LeagueSummary | null>(null);
  const [isManagingLeagues, setIsManagingLeagues] = useState(false);
  const activeLeagueId = selectedLeague?.id ?? 'challengers';
  /** Changes the data source whenever the global league selector changes. */
  const loadSelectedLeagueMatchup = useCallback(() => fantasyService.getMatchup(activeLeagueId), [activeLeagueId]);
  const matchupRequest = useServiceData(loadSelectedLeagueMatchup);
  const loadSelectedLeagueRoster = useCallback(() => fantasyService.getRoster(activeLeagueId), [activeLeagueId]);
  const rosterRequest = useServiceData(loadSelectedLeagueRoster);
  const [appliedCards, setAppliedCards] = useState<Record<string, AppliedModifier[]>>({});
  const [handInventory, setHandInventory] = useState<PowerCard[]>([]);
  const [managerRoster, setManagerRoster] = useState<RosterLineup | null>(null);
  const [isEditingRoster, setIsEditingRoster] = useState(false);
  const [isViewingYourMatchup, setIsViewingYourMatchup] = useState(true);
  const [isViewingYourTeam, setIsViewingYourTeam] = useState(true);
  const [isPullingToRefresh, setIsPullingToRefresh] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isChatKeyboardActive, setIsChatKeyboardActive] = useState(false);
  const [homeViewKey, setHomeViewKey] = useState(0);
  const [leagueViewKey, setLeagueViewKey] = useState(0);
  const [matchupViewKey, setMatchupViewKey] = useState(0);
  const [selectedPlayer, setSelectedPlayer] = useState<MatchupPlayerData | null>(null);
  const [scoreBreakdownPlayer, setScoreBreakdownPlayer] = useState<MatchupPlayerData | null>(null);
  const [selectedCard, setSelectedCard] = useState<PowerCard | null>(null);
  const [draggingCard, setDraggingCard] = useState<PowerCard | null>(null);
  const [cardClaim, setCardClaim] = useState<CardClaimState | null>(null);
  const [isCardClaimOpen, setIsCardClaimOpen] = useState(false);
  const [isClaimingCard, setIsClaimingCard] = useState(false);
  const [hoveredPlayerName, setHoveredPlayerName] = useState<string | null>(null);
  const inventoryRef = useRef<PowerCard[]>([]);
  const cardMutationInFlight = useRef(false);
  const playerTargets = useRef<Record<string, PlayerDropTarget>>({});
  const measuredPlayerTargets = useRef<MeasuredPlayerDropTarget[]>([]);
  const hoveredPlayerTarget = useRef<PlayerDropTarget | null>(null);
  const dragMeasurementGeneration = useRef(0);
  const pageScrollRef = useRef<ScrollView>(null);
  const pageEndHandler = useRef<() => void>(() => {});
  const rosterEditActions = useRef<{ discard: () => void; save: () => void } | null>(null);
  const pageRefreshHandler = useRef<() => Promise<void>>(matchupRequest.refetch);

  /** Rehydrates memberships after Clerk restores the browser/native session.
   * A short second fetch covers web reloads where the first token request is still settling.
   */
  useEffect(() => {
    if (!user?.id) return;
    void leaguesRequest.refetch();
    const retry = setTimeout(() => void leaguesRequest.refetch(), 750);
    return () => clearTimeout(retry);
  }, [user?.id]);

  /** Immediately removes a staff destination if Clerk refreshes without that role. */
  useEffect(() => {
    if (activeTab === 'Admin' && !canViewAdmin) setActiveTab('Home');
    if (activeTab === 'Game Data' && !canManageGameData) setActiveTab('Home');
  }, [activeTab, canManageGameData, canViewAdmin, setActiveTab]);

  /** Seeds the local, consumable inventory once the selected data provider finishes loading. */
  useEffect(() => {
    if (matchupRequest.data) {
      inventoryRef.current = matchupRequest.data.hand;
      setHandInventory(matchupRequest.data.hand);
      const allInitialModifiers = [
        ...matchupRequest.data.initialModifiers,
        ...matchupRequest.data.leagueMatchups.flatMap((matchup) => matchup.initialModifiers ?? []),
      ].filter((modifier, index, modifiers) => modifiers.findIndex((candidate) => candidate.id === modifier.id) === index);

      setAppliedCards(allInitialModifiers.reduce<Record<string, AppliedModifier[]>>((grouped, modifier) => {
        grouped[modifier.playerName] = [...(grouped[modifier.playerName] ?? []), modifier];
        return grouped;
      }, {}));
    }
  }, [matchupRequest.data]);

  useEffect(() => {
    if (rosterRequest.data) setManagerRoster(rosterRequest.data);
  }, [rosterRequest.data]);

  useEffect(() => {
    if (!selectedLeague) { setCardClaim(null); return; }
    void fantasyService.getCardClaim(selectedLeague.id)
      .then(setCardClaim)
      .catch(() => setCardClaim(null));
  }, [selectedLeague]);

  /** Draft completion happens inside League HQ, so re-check claim eligibility whenever Team is opened. */
  useEffect(() => {
    if (activeTab !== 'Team' || !selectedLeague) return;
    void fantasyService.getCardClaim(selectedLeague.id)
      .then(setCardClaim)
      .catch(() => setCardClaim(null));
  }, [activeTab, selectedLeague]);

  /** Selects the first available league after the mock or API list has loaded. */
  useEffect(() => {
    if (!selectedLeague && leaguesRequest.data?.[0]) setSelectedLeague(leaguesRequest.data[0]);
  }, [leaguesRequest.data, selectedLeague]);

  /** Resets league-scoped views before loading the newly selected league's data. */
  const selectLeague = useCallback((league: LeagueSummary) => {
    setSelectedLeague(league);
    setIsViewingYourMatchup(true);
    setIsViewingYourTeam(true);
    setMatchupViewKey((key) => key + 1);
    setSelectedPlayer(null);
  }, []);

  /** Refreshes membership choices and activates a league immediately after create/join. */
  const handleLeagueReady = useCallback((league: LeagueSummary) => {
    selectLeague(league);
    void leaguesRequest.refetch();
  }, [leaguesRequest.refetch, selectLeague]);

  /** Accepts invitation links when the app is launched or resumed from email/messages. */
  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) return;
      try {
        const parsed = new URL(url);
        const credential = parsed.searchParams.get('token') ?? parsed.searchParams.get('code');
        if (!credential) return;
        const managerName = user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'Manager';
        void fantasyService.joinLeague(credential, undefined, managerName, user?.primaryEmailAddress?.emailAddress)
          .then((access) => {
            handleLeagueReady({ id: access.leagueId, maxMembers: access.maxMembers, memberCount: access.memberCount, name: access.name });
            Alert.alert('League joined', `Welcome to ${access.name}.`);
          })
          .catch((error: unknown) => Alert.alert('Unable to join league', error instanceof Error ? error.message : 'The invitation could not be accepted.'));
      } catch {
        // Ignore unrelated or malformed incoming URLs.
      }
    };

    void Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, [handleLeagueReady, user]);

  /** Registers the active standard page's refresh callback with the shared scroll container. */
  const registerPageRefresh = useCallback((refresh: () => Promise<void>) => {
    pageRefreshHandler.current = refresh;
    return () => {
      if (pageRefreshHandler.current === refresh) pageRefreshHandler.current = async () => {};
    };
  }, []);

  /** Lets feed-style pages request their next cursor page as the shared scroll view reaches its end. */
  const registerPageEnd = useCallback((handler: () => void) => {
    pageEndHandler.current = handler;
    return () => { if (pageEndHandler.current === handler) pageEndHandler.current = () => {}; };
  }, []);

  /** Starts a fresh request for whichever page is currently visible. */
  const handleRefresh = useCallback(async () => {
    setIsPullingToRefresh(false);
    setIsRefreshing(true);
    try {
      // Keep the native indicator visible long enough to make a fast local API refresh perceptible.
      await Promise.all([
        pageRefreshHandler.current(),
        new Promise<void>((resolve) => setTimeout(resolve, 650)),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  /** Uses the matchup request for the two roster-driven pages. */
  useEffect(() => {
    if (activeTab === 'Matchup' || activeTab === 'Team') {
      pageRefreshHandler.current = async () => {
        await Promise.all([matchupRequest.refetch(), rosterRequest.refetch()]);
      };
      void Promise.all([matchupRequest.refetch(), rosterRequest.refetch()]);
    }
  }, [activeTab, matchupRequest.refetch, rosterRequest.refetch]);

  /** A shared ScrollView must not carry a long page's offset into a newly selected tab or league. */
  useEffect(() => {
    pageScrollRef.current?.scrollTo({ animated: false, y: 0 });
    setIsPullingToRefresh(false);
  }, [activeLeagueId, activeTab]);

  /** Checks the supplied SQL card's team and position restrictions before a play. */
  const canPlayCard = useCallback((card: PowerCard, player: MatchupPlayerData, isManagerTeam: boolean) => {
    const teamMatches = card.allowedTeam === 'SELF' ? isManagerTeam : !isManagerTeam;
    const positionMatches = card.allowedPositions.includes('ALL') || card.allowedPositions.includes(player.position);
    return teamMatches && positionMatches && !player.gameStarted;
  }, []);

  /** Registers the native player view and target metadata for card drops. */
  const registerDropTarget = useCallback((player: MatchupPlayerData, isManagerTeam: boolean, node: View | null) => {
    playerTargets.current[player.name] = { isManagerTeam, node, player };
  }, []);

  /** Measures each target once when dragging begins instead of on every pointer movement. */
  const beginCardDrag = useCallback((card: PowerCard) => {
    setDraggingCard(card);
    measuredPlayerTargets.current = [];
    hoveredPlayerTarget.current = null;
    const generation = ++dragMeasurementGeneration.current;
    Object.values(playerTargets.current).forEach((target) => {
      target.node?.measureInWindow((x, y, width, height) => {
        if (dragMeasurementGeneration.current !== generation) return;
        measuredPlayerTargets.current.push({ ...target, height, width, x, y });
      });
    });
  }, []);

  /** Performs synchronous hit-testing against the layouts captured at drag start. */
  const updateCardHover = useCallback((card: PowerCard, hoverX: number, hoverY: number) => {
    const target = measuredPlayerTargets.current.find(({ height, width, x, y }) =>
      hoverX >= x && hoverX <= x + width && hoverY >= y && hoverY <= y + height);
    const validTarget = target && canPlayCard(card, target.player, target.isManagerTeam) ? target : null;
    hoveredPlayerTarget.current = validTarget;
    setHoveredPlayerName((current) => current === validTarget?.player.name ? current : validTarget?.player.name ?? null);
  }, [canPlayCard]);

  /**
   * Applies a card optimistically so the inventory and player icon react on release.
   * The backend response replaces the temporary modifier; failures restore both.
   */
  const applyCardDrop = useCallback((card: PowerCard, dropX: number, dropY: number) => {
    const measuredTarget = measuredPlayerTargets.current.find(({ height, width, x, y }) =>
      dropX >= x && dropX <= x + width && dropY >= y && dropY <= y + height);
    const target = measuredTarget && canPlayCard(card, measuredTarget.player, measuredTarget.isManagerTeam)
      ? measuredTarget
      : hoveredPlayerTarget.current;
    if (!target || !canPlayCard(card, target.player, target.isManagerTeam) || cardMutationInFlight.current) return;

    const player = target.player;
    const inventoryCard = inventoryRef.current.find((item) => item.id === card.id);
    if (!inventoryCard || inventoryCard.quantity <= 0) return;
    if (!player.id && !serviceConfig.useMockServices) {
      Alert.alert('Unable to play card', 'This player is missing the backend identifier required to play a card.');
      return;
    }

    const previousInventory = inventoryRef.current;
    const nextInventory = previousInventory
      .map((item) => item.id === card.id ? { ...item, quantity: item.quantity - 1 } : item)
      .filter((item) => item.quantity > 0);
    const pendingId = `pending-${Date.now()}-${card.id}`;
    const pendingModifier: AppliedModifier = {
      card: { ...card, quantity: 1 },
      id: pendingId,
      playedBy: 'manager',
      playedByName: 'You',
      playerId: player.id,
      playerName: player.name,
    };

    cardMutationInFlight.current = true;
    inventoryRef.current = nextInventory;
    setHandInventory(nextInventory);
    setAppliedCards((current) => ({
      ...current,
      [player.name]: [...(current[player.name] ?? []), pendingModifier],
    }));

    void fantasyService.playCard(activeLeagueId, card.id, player.id ?? player.name)
      .then((modifier) => {
        setAppliedCards((current) => ({
          ...current,
          [player.name]: (current[player.name] ?? []).map((item) => item.id === pendingId ? modifier : item),
        }));
      })
      .catch((error: unknown) => {
        inventoryRef.current = previousInventory;
        setHandInventory(previousInventory);
        setAppliedCards((current) => ({
          ...current,
          [player.name]: (current[player.name] ?? []).filter((item) => item.id !== pendingId),
        }));
        Alert.alert('Card play failed', error instanceof Error ? error.message : 'Please try again.');
      })
      .finally(() => { cardMutationInFlight.current = false; });
  }, [activeLeagueId, canPlayCard]);

  /** Removes a pre-game modifier and restores that card to the player's inventory. */
  const removeSelectedModifier = useCallback((modifier: AppliedModifier) => {
    if (!selectedPlayer || selectedPlayer.gameStarted) return;
    if (!modifier || modifier.playedBy !== 'manager') return;

    void fantasyService.removeCard(activeLeagueId, modifier.id)
      .then(() => {
        const existingCard = inventoryRef.current.find((card) => card.id === modifier.card.id);
        const nextInventory = existingCard
          ? inventoryRef.current.map((card) => card.id === modifier.card.id ? { ...card, quantity: card.quantity + 1 } : card)
          : [...inventoryRef.current, { ...modifier.card, quantity: 1 }];

        inventoryRef.current = nextInventory;
        setHandInventory(nextInventory);
        setAppliedCards((current) => {
          const next = { ...current };
          next[selectedPlayer.name] = (next[selectedPlayer.name] ?? []).filter((item) => item.id !== modifier.id);
          if (next[selectedPlayer.name].length === 0) delete next[selectedPlayer.name];
          return next;
        });
      })
      .catch((error: unknown) => Alert.alert('Unable to remove card', error instanceof Error ? error.message : 'Please try again.'));
  }, [activeLeagueId, selectedPlayer]);

  const claimWeeklyCard = useCallback(async (card: PowerCard) => {
    if (!cardClaim?.offerId || isClaimingCard) return;
    setIsClaimingCard(true);
    try {
      const nextClaim = await fantasyService.claimCard(activeLeagueId, cardClaim.offerId, card.id);
      setCardClaim(nextClaim);
      const existing = inventoryRef.current.find((item) => item.id === card.id);
      const nextInventory = existing
        ? inventoryRef.current.map((item) => item.id === card.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...inventoryRef.current, { ...card, quantity: 1 }];
      inventoryRef.current = nextInventory;
      setHandInventory(nextInventory);
      if (nextClaim.remainingClaims === 0) {
        setIsCardClaimOpen(false);
        Alert.alert('Weekly cards claimed', 'Your new cards are ready in your inventory.');
      }
    } catch (error) {
      Alert.alert('Unable to claim card', error instanceof Error ? error.message : 'Please try again.');
      void fantasyService.getCardClaim(activeLeagueId).then(setCardClaim).catch(() => {});
    } finally {
      setIsClaimingCard(false);
    }
  }, [activeLeagueId, cardClaim, isClaimingCard]);

  const saveManagerRoster = useCallback(async (roster: RosterLineup) => {
    const missingPlayerId = [...roster.starters, ...roster.bench].some((slot) => !slot.player.id);
    if (missingPlayerId && !serviceConfig.useMockServices) throw new Error('A roster player is missing the backend identifier required to save.');
    const savedRoster = await fantasyService.saveLineup(activeLeagueId, roster);
    setManagerRoster(savedRoster);
  }, [activeLeagueId]);

  /** Saves or discards a Team-screen draft before leaving that tab. */
  const navigateToTab = useCallback((tab: Tab) => {
    const completeNavigation = () => {
      setActiveTab(tab);
      if (tab === 'Home') setHomeViewKey((key) => key + 1);
      if (tab === 'League') setLeagueViewKey((key) => key + 1);
      if (tab === 'Matchup') { setIsViewingYourMatchup(true); setMatchupViewKey((key) => key + 1); }
    };
    if (isEditingRoster && tab !== 'Team') {
      Alert.alert('Save roster changes?', 'Your lineup edits have not been saved yet.', [
        { text: 'Discard', style: 'destructive', onPress: () => { rosterEditActions.current?.discard(); completeNavigation(); } },
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Save', onPress: () => { rosterEditActions.current?.save(); completeNavigation(); } },
      ]);
      return;
    }
    completeNavigation();
  }, [isEditingRoster, setActiveTab]);

  const screen = activeTab === 'Admin' && canViewAdmin
    ? <AdminScreen />
    : activeTab === 'Game Data' && canManageGameData
      ? <GameDataManagerScreen />
      : activeTab === 'Matchup'
    ? <MatchupScreen appliedCards={appliedCards} canPlayCard={canPlayCard} data={matchupRequest.data} draggingCard={draggingCard} error={matchupRequest.error} hoveredPlayerName={hoveredPlayerName} key={`${activeLeagueId}-${matchupViewKey}`} managerRoster={managerRoster} onMatchupSelectionChange={setIsViewingYourMatchup} onRegisterDropTarget={registerDropTarget} onSelectPlayer={setSelectedPlayer} onSelectScore={setScoreBreakdownPlayer} />
    : activeTab === 'Team'
      ? <TeamScreen appliedCards={appliedCards} canPlayCard={canPlayCard} draggingCard={draggingCard} error={matchupRequest.error ?? rosterRequest.error} hoveredPlayerName={hoveredPlayerName} key={activeLeagueId} managerRoster={managerRoster} matchupData={matchupRequest.data} onCardPress={setSelectedCard} onManagerRosterChange={saveManagerRoster} onRegisterReachEnd={registerPageEnd} onRegisterRosterEditActions={(actions) => { rosterEditActions.current = actions; }} onRosterEditingChange={setIsEditingRoster} onRegisterDropTarget={registerDropTarget} onSelectPlayer={setSelectedPlayer} onSelectScore={setScoreBreakdownPlayer} onTeamSelectionChange={setIsViewingYourTeam} />
    : activeTab === 'League'
      ? <LeagueScreen key={leagueViewKey} onChatInputBlur={() => setIsChatKeyboardActive(false)} onChatInputFocus={() => { setIsChatKeyboardActive(true); setTimeout(() => pageScrollRef.current?.scrollToEnd({ animated: true }), 120); }} onRegisterReachEnd={registerPageEnd} onRegisterRefresh={registerPageRefresh} selectedLeague={selectedLeague} />
      : activeTab === 'Home'
        ? <HomeScreen key={homeViewKey} onRegisterRefresh={registerPageRefresh} selectedLeague={selectedLeague} />
        : <ProfileScreen onRegisterRefresh={registerPageRefresh} />;

  // Keeps the branded loading view visible only while the initial league data is unavailable.
  const isBootstrapping = (leaguesRequest.isLoading && !leaguesRequest.data)
    || (matchupRequest.isLoading && !matchupRequest.data)
    || (rosterRequest.isLoading && !rosterRequest.data);
  if (isBootstrapping) return <StartupLoadingScreen />;

  if (leaguesRequest.data?.length === 0 && !canViewAdmin && !canManageGameData) {
    return <SafeAreaView style={layout.app}>
      <StatusBar style="light" />
      <View style={styles.emptyLeagueScreen}>
        <View style={styles.emptyLeagueIcon}><Ionicons color={colors.accent} name="shield-outline" size={36} /></View>
        <Text style={styles.emptyLeagueTitle}>Start your fantasy season</Text>
        <Text style={styles.emptyLeagueCopy}>This account isn’t in a league yet. Create one as commissioner or join with an invitation code.</Text>
        <Pressable onPress={() => setIsManagingLeagues(true)} style={styles.emptyLeagueButton}><Text style={styles.emptyLeagueButtonText}>CREATE OR JOIN A LEAGUE</Text></Pressable>
      </View>
      <LeagueManagementModal onClose={() => setIsManagingLeagues(false)} onLeagueReady={handleLeagueReady} selectedLeague={null} visible={isManagingLeagues} />
    </SafeAreaView>;
  }

  const navigation = <View style={[styles.tabBar, isWeb && styles.sideBar]}>
    {isWeb && <Image resizeMode="contain" source={require('../../assets/challengers-wordmark-4.png')} style={styles.sideBarWordmark} />}
    {tabs.map((tab) => {
      const active = activeTab === tab.name;
      return (
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} key={tab.name} onPress={() => navigateToTab(tab.name)} style={({ pressed }) => [styles.tab, isWeb && styles.sideTab, active && isWeb && styles.activeSideTab, pressed && styles.pressed]}>
          <View style={styles.iconFrame}><Ionicons color={active ? colors.accent : colors.muted} name={active ? tab.activeIcon : tab.icon} size={21} /></View>
          <Text style={[styles.label, isWeb && styles.sideLabel, active && styles.activeLabel]}>{tab.name}</Text>
        </Pressable>
      );
    })}
  </View>;

  return (
    <SafeAreaView style={layout.app}>
      <StatusBar style="light" />
      <View style={[styles.appShell, isWeb && styles.webShell]}>
        {isWeb && navigation}
        <View style={styles.mainColumn}>
          {activeTab !== 'Admin' && activeTab !== 'Game Data' && <LeagueSelector leagues={leaguesRequest.data ?? []} onManage={() => setIsManagingLeagues(true)} onSelect={selectLeague} selectedLeague={selectedLeague} />}
          <ScrollView automaticallyAdjustKeyboardInsets alwaysBounceVertical contentContainerStyle={[layout.content, styles.refreshableContent, isChatKeyboardActive && styles.chatKeyboardContent]} keyboardShouldPersistTaps="handled" onScroll={(event) => { const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent; setIsPullingToRefresh(contentOffset.y < -8); if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 80) pageEndHandler.current(); }} onScrollBeginDrag={(event) => setIsPullingToRefresh(event.nativeEvent.contentOffset.y <= 0)} onScrollEndDrag={() => !isRefreshing && setIsPullingToRefresh(false)} onTouchCancel={() => !isRefreshing && setIsPullingToRefresh(false)} ref={pageScrollRef} refreshControl={<RefreshControl colors={[colors.accent]} onRefresh={handleRefresh} progressBackgroundColor={colors.card} progressViewOffset={8} refreshing={isRefreshing} tintColor={colors.accent} />} scrollEventThrottle={16} style={styles.scroll}>
            <View style={[layout.screen, isWeb && styles.webScreen]}>{screen}</View>
          </ScrollView>

          {(isPullingToRefresh || isRefreshing) && <View pointerEvents="none" style={styles.pullIndicator}>
            {isRefreshing ? <LoadingIndicator size="small" /> : <Ionicons color={colors.accent} name="refresh" size={23} />}
          </View>}

          {activeTab === 'Team' && cardClaim && cardClaim.remainingClaims > 0 && <Pressable onPress={() => setIsCardClaimOpen(true)} style={styles.claimCardsButton}><Ionicons color={colors.background} name="gift" size={16} /><Text style={styles.claimCardsText}>CLAIM WEEKLY CARDS · {cardClaim.remainingClaims} LEFT</Text></Pressable>}
          {((activeTab === 'Matchup' && isViewingYourMatchup) || (activeTab === 'Team' && isViewingYourTeam)) && matchupRequest.data && (
            <HandTray cards={handInventory} isOverValidTarget={hoveredPlayerName !== null} onCardDragEnd={() => { dragMeasurementGeneration.current += 1; setDraggingCard(null); setHoveredPlayerName(null); hoveredPlayerTarget.current = null; measuredPlayerTargets.current = []; }} onCardDragMove={updateCardHover} onCardDragStart={beginCardDrag} onCardDrop={applyCardDrop} onCardPress={setSelectedCard} />
          )}
          {!isWeb && navigation}
        </View>
      </View>

      <CardDetailsModal card={selectedCard} onClose={() => setSelectedCard(null)} />
      <WeeklyCardClaimModal busy={isClaimingCard} claim={cardClaim} onChoose={(card) => void claimWeeklyCard(card)} onClose={() => setIsCardClaimOpen(false)} visible={isCardClaimOpen} />
      <PlayerDetailsModal modifiers={selectedPlayer ? appliedCards[selectedPlayer.name] ?? [] : []} onClose={() => setSelectedPlayer(null)} onRemoveModifier={removeSelectedModifier} player={selectedPlayer} />
      <ScoreBreakdownModal onClose={() => setScoreBreakdownPlayer(null)} player={scoreBreakdownPlayer} />
      <LeagueManagementModal onClose={() => setIsManagingLeagues(false)} onLeagueReady={handleLeagueReady} selectedLeague={selectedLeague} visible={isManagingLeagues} />

    </SafeAreaView>
  );
}

/** In-app companion to the native splash screen while the first data requests resolve. */
function StartupLoadingScreen() {
  return <SafeAreaView style={styles.startupScreen}>
    <StatusBar style="light" />
    <Image resizeMode="contain" source={require('../../assets/challengers-wordmark-4.png')} style={styles.startupWordmark} />
    <LoadingIndicator />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  startupScreen: { alignItems: 'center', backgroundColor: colors.background, flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  startupWordmark: { height: 142, marginBottom: 24, maxWidth: 510, width: '100%' },
  chatKeyboardContent: { paddingBottom: 14 },
  appShell: { flex: 1 },
  webShell: { flexDirection: 'row' },
  mainColumn: { flex: 1, minWidth: 0 },
  webScreen: { alignSelf: 'center', maxWidth: 1100, width: '100%' },
  scroll: { flex: 1 },
  refreshableContent: { flexGrow: 1 },
  claimCardsButton: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.accent, borderRadius: 9, flexDirection: 'row', gap: 7, marginBottom: 7, paddingHorizontal: 13, paddingVertical: 9 },
  claimCardsText: { color: colors.background, fontSize: 9, fontWeight: '900', letterSpacing: .55 },
  pullIndicator: { alignItems: 'center', elevation: 50, left: 0, position: 'absolute', right: 0, top: 8, zIndex: 50 },
  tabBar: { backgroundColor: '#090E0E', borderTopColor: '#202A28', borderTopWidth: 1, flexDirection: 'row', paddingBottom: 14, paddingHorizontal: 8, paddingTop: 9 },
  sideBar: { borderRightColor: '#202A28', borderRightWidth: 1, borderTopWidth: 0, flexDirection: 'column', gap: 5, paddingBottom: 18, paddingHorizontal: 12, paddingTop: 14, width: 196 },
  sideBarWordmark: { height: 62, marginBottom: 16, width: '100%' },
  tab: { alignItems: 'center', flex: 1, gap: 4 },
  sideTab: { borderRadius: 10, flexDirection: 'row', flexGrow: 0, gap: 11, justifyContent: 'flex-start', minHeight: 48, paddingHorizontal: 12 },
  activeSideTab: { backgroundColor: '#17221E' },
  sideLabel: { fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.65 },
  iconFrame: { alignItems: 'center', height: 25, justifyContent: 'center', width: 27 },
  label: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  activeLabel: { color: colors.accent },
  emptyLeagueScreen: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: 30 },
  emptyLeagueIcon: { alignItems: 'center', backgroundColor: '#17221E', borderColor: '#3B5C25', borderRadius: 32, borderWidth: 1, height: 64, justifyContent: 'center', width: 64 },
  emptyLeagueTitle: { color: colors.text, fontSize: 25, fontWeight: '900', marginTop: 18, textAlign: 'center' },
  emptyLeagueCopy: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 8, maxWidth: 340, textAlign: 'center' },
  emptyLeagueButton: { backgroundColor: colors.accent, borderRadius: 10, marginTop: 22, paddingHorizontal: 18, paddingVertical: 13 },
  emptyLeagueButtonText: { color: colors.background, fontSize: 10, fontWeight: '900', letterSpacing: .7 },
});
