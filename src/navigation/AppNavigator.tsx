import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { ComponentProps, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HandTray } from '../features/hand/HandTray';
import { CardDetailsModal } from '../features/hand/CardDetailsModal';
import { LeagueSelector } from '../features/league/LeagueSelector';
import { PlayerDetailsModal } from '../features/matchup/PlayerDetailsModal';
import { LoadingIndicator } from '../features/ui/LoadingIndicator';
import { useActiveTab } from '../hooks/useActiveTab';
import { useServiceData } from '../hooks/useServiceData';
import { HomeScreen } from '../pages/HomeScreen';
import { LeagueScreen } from '../pages/LeagueScreen';
import { MatchupScreen } from '../pages/MatchupScreen';
import { ProfileScreen } from '../pages/ProfileScreen';
import { TeamScreen } from '../pages/TeamScreen';
import { fantasyService } from '../services/fantasy';
import { colors } from '../theme/colors';
import { layout } from '../theme/layout';
import { AppliedModifier, LeagueSummary, MatchupPlayerData, PowerCard, RosterLineup } from '../types/fantasy';
import { Tab } from '../types/navigation';

type IconName = ComponentProps<typeof Ionicons>['name'];
interface PlayerDropTarget { isManagerTeam: boolean; node: View | null; player: MatchupPlayerData; }

/** Configuration for each destination shown in the bottom tab bar. */
const tabs: { activeIcon: IconName; icon: IconName; name: Tab }[] = [
  { name: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { name: 'Team', icon: 'people-outline', activeIcon: 'people' },
  { name: 'Matchup', icon: 'swap-horizontal-outline', activeIcon: 'swap-horizontal' },
  { name: 'League', icon: 'shield-outline', activeIcon: 'shield' },
  { name: 'Profile', icon: 'person-outline', activeIcon: 'person' },
];

/**
 * The app's current lightweight navigator.
 * It also coordinates card drops because the hand tray and player table live in separate areas.
 */
export function AppNavigator() {
  const [activeTab, setActiveTab] = useActiveTab();
  const leaguesRequest = useServiceData(fantasyService.getLeagues);
  const [selectedLeague, setSelectedLeague] = useState<LeagueSummary | null>(null);
  const activeLeagueId = selectedLeague?.id ?? 'challengers';
  /** Changes the data source whenever the global league selector changes. */
  const loadSelectedLeagueMatchup = useCallback(() => fantasyService.getMatchup(activeLeagueId), [activeLeagueId]);
  const matchupRequest = useServiceData(loadSelectedLeagueMatchup);
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
  const [selectedCard, setSelectedCard] = useState<PowerCard | null>(null);
  const [draggingCard, setDraggingCard] = useState<PowerCard | null>(null);
  const [hoveredPlayerName, setHoveredPlayerName] = useState<string | null>(null);
  const inventoryRef = useRef<PowerCard[]>([]);
  const playerTargets = useRef<Record<string, PlayerDropTarget>>({});
  const pageScrollRef = useRef<ScrollView>(null);
  const pageEndHandler = useRef<() => void>(() => {});
  const rosterEditActions = useRef<{ discard: () => void; save: () => void } | null>(null);
  const pageRefreshHandler = useRef<() => Promise<void>>(matchupRequest.refetch);

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
      setManagerRoster({
        bench: matchupRequest.data.benchMatchups.map((matchup, index) => ({ id: `bench-${index}`, kind: 'bench', player: matchup.left, position: matchup.left.position })),
        starters: matchupRequest.data.playerMatchups.map((matchup, index) => ({ id: `starter-${index}`, kind: 'starter', player: matchup.left, position: matchup.left.position })),
      });
    }
  }, [matchupRequest.data]);

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
    await pageRefreshHandler.current();
    setIsRefreshing(false);
  }, []);

  /** Uses the matchup request for the two roster-driven pages. */
  useEffect(() => {
    if (activeTab === 'Matchup' || activeTab === 'Team') pageRefreshHandler.current = matchupRequest.refetch;
  }, [activeTab, matchupRequest.refetch]);

  /** A shared ScrollView must not carry a long page's offset into a newly selected tab or league. */
  useEffect(() => {
    pageScrollRef.current?.scrollTo({ animated: false, y: 0 });
    setIsPullingToRefresh(false);
  }, [activeLeagueId, activeTab]);

  /** Checks the supplied SQL card's team and position restrictions before a play. */
  const canPlayCard = useCallback((card: PowerCard, player: MatchupPlayerData, isManagerTeam: boolean) => {
    const teamMatches = card.allowedTeam === 'SELF' ? isManagerTeam : !isManagerTeam;
    const positionMatches = card.allowedPositions.includes('ALL') || card.allowedPositions.includes(player.position);
    return teamMatches && positionMatches;
  }, []);

  /** Registers the native player view and target metadata for card drops. */
  const registerDropTarget = useCallback((player: MatchupPlayerData, isManagerTeam: boolean, node: View | null) => {
    playerTargets.current[player.name] = { isManagerTeam, node, player };
  }, []);

  /** Updates the player currently beneath a held card, ignoring ineligible drop targets. */
  const updateCardHover = useCallback((card: PowerCard, hoverX: number, hoverY: number) => {
    Object.values(playerTargets.current).forEach(({ isManagerTeam, node, player }) => {
      node?.measureInWindow((targetX, targetY, targetWidth, targetHeight) => {
        const isHovered = hoverX >= targetX && hoverX <= targetX + targetWidth && hoverY >= targetY && hoverY <= targetY + targetHeight;
        if (isHovered && canPlayCard(card, player, isManagerTeam)) setHoveredPlayerName(player.name);
        else setHoveredPlayerName((current) => current === player.name ? null : current);
      });
    });
  }, [canPlayCard]);

  /**
   * Finds the player under a released card, applies its effect, and consumes one inventory copy.
   * measureInWindow gives both the player and the card coordinates in the same screen space.
   */
  const applyCardDrop = useCallback((card: PowerCard, dropX: number, dropY: number) => {
    Object.values(playerTargets.current).forEach(({ isManagerTeam, node, player }) => {
      node?.measureInWindow((targetX, targetY, targetWidth, targetHeight) => {
        const isOverTarget = dropX >= targetX
          && dropX <= targetX + targetWidth
          && dropY >= targetY
          && dropY <= targetY + targetHeight;

        if (isOverTarget && canPlayCard(card, player, isManagerTeam)) {
          const inventoryCard = inventoryRef.current.find((item) => item.id === card.id);
          if (!inventoryCard || inventoryCard.quantity <= 0) return;

          const nextInventory = inventoryRef.current
            .map((item) => item.id === card.id ? { ...item, quantity: item.quantity - 1 } : item)
            .filter((item) => item.quantity > 0);

          inventoryRef.current = nextInventory;
          setHandInventory(nextInventory);
          setAppliedCards((current) => ({
            ...current,
            [player.name]: [...(current[player.name] ?? []), { card, id: `${card.id}-${Date.now()}`, playedBy: 'manager', playedByName: 'You', playerName: player.name }],
          }));
        }
      });
    });
  }, [canPlayCard]);

  /** Removes a pre-game modifier and restores that card to the player's inventory. */
  const removeSelectedModifier = useCallback((modifier: AppliedModifier) => {
    if (!selectedPlayer || selectedPlayer.gameStarted) return;
    if (!modifier || modifier.playedBy !== 'manager') return;

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
  }, [appliedCards, selectedPlayer]);

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

  const screen = activeTab === 'Matchup'
    ? <MatchupScreen appliedCards={appliedCards} canPlayCard={canPlayCard} data={matchupRequest.data} draggingCard={draggingCard} hoveredPlayerName={hoveredPlayerName} key={`${activeLeagueId}-${matchupViewKey}`} managerRoster={managerRoster} onMatchupSelectionChange={setIsViewingYourMatchup} onRegisterDropTarget={registerDropTarget} onSelectPlayer={setSelectedPlayer} />
    : activeTab === 'Team'
      ? <TeamScreen appliedCards={appliedCards} canPlayCard={canPlayCard} draggingCard={draggingCard} hoveredPlayerName={hoveredPlayerName} key={activeLeagueId} managerRoster={managerRoster} matchupData={matchupRequest.data} onCardPress={setSelectedCard} onManagerRosterChange={setManagerRoster} onRegisterReachEnd={registerPageEnd} onRegisterRosterEditActions={(actions) => { rosterEditActions.current = actions; }} onRosterEditingChange={setIsEditingRoster} onRegisterDropTarget={registerDropTarget} onSelectPlayer={setSelectedPlayer} onTeamSelectionChange={setIsViewingYourTeam} />
    : activeTab === 'League'
      ? <LeagueScreen key={leagueViewKey} onChatInputBlur={() => setIsChatKeyboardActive(false)} onChatInputFocus={() => { setIsChatKeyboardActive(true); setTimeout(() => pageScrollRef.current?.scrollToEnd({ animated: true }), 120); }} onRegisterReachEnd={registerPageEnd} onRegisterRefresh={registerPageRefresh} selectedLeague={selectedLeague} />
      : activeTab === 'Home'
        ? <HomeScreen key={homeViewKey} onRegisterRefresh={registerPageRefresh} />
        : <ProfileScreen onRegisterRefresh={registerPageRefresh} />;

  // Keeps the branded loading view visible only while the initial league data is unavailable.
  const isBootstrapping = (leaguesRequest.isLoading && !leaguesRequest.data) || (matchupRequest.isLoading && !matchupRequest.data);
  if (isBootstrapping) return <StartupLoadingScreen />;

  return (
    <SafeAreaView style={layout.app}>
      <StatusBar style="light" />
      <LeagueSelector leagues={leaguesRequest.data ?? []} onSelect={selectLeague} selectedLeague={selectedLeague} />
      <ScrollView automaticallyAdjustKeyboardInsets alwaysBounceVertical contentContainerStyle={[layout.content, styles.content, isChatKeyboardActive && styles.chatKeyboardContent]} keyboardShouldPersistTaps="handled" onScroll={(event) => { const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent; setIsPullingToRefresh(contentOffset.y < -8); if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 80) pageEndHandler.current(); }} onScrollBeginDrag={(event) => setIsPullingToRefresh(event.nativeEvent.contentOffset.y <= 0)} onScrollEndDrag={() => !isRefreshing && setIsPullingToRefresh(false)} onTouchCancel={() => !isRefreshing && setIsPullingToRefresh(false)} ref={pageScrollRef} refreshControl={<RefreshControl colors={[colors.accent]} onRefresh={handleRefresh} refreshing={isRefreshing} tintColor={colors.accent} />} scrollEventThrottle={16} style={styles.scroll}>
        <View style={layout.screen}>{screen}</View>
      </ScrollView>

      {(isPullingToRefresh || isRefreshing) && <View pointerEvents="none" style={styles.pullIndicator}>
        {isRefreshing ? <LoadingIndicator size="small" /> : <Ionicons color={colors.accent} name="refresh" size={23} />}
      </View>}

      {((activeTab === 'Matchup' && isViewingYourMatchup) || (activeTab === 'Team' && isViewingYourTeam)) && matchupRequest.data && (
        <HandTray cards={handInventory} isOverValidTarget={hoveredPlayerName !== null} onCardDragEnd={() => { setDraggingCard(null); setHoveredPlayerName(null); }} onCardDragMove={updateCardHover} onCardDragStart={setDraggingCard} onCardDrop={applyCardDrop} onCardPress={setSelectedCard} />
      )}

      <CardDetailsModal card={selectedCard} onClose={() => setSelectedCard(null)} />
      <PlayerDetailsModal modifiers={selectedPlayer ? appliedCards[selectedPlayer.name] ?? [] : []} onClose={() => setSelectedPlayer(null)} onRemoveModifier={removeSelectedModifier} player={selectedPlayer} />

      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const active = activeTab === tab.name;
          return (
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} key={tab.name} onPress={() => navigateToTab(tab.name)} style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
              <View style={styles.iconFrame}><Ionicons color={active ? colors.accent : colors.muted} name={active ? tab.activeIcon : tab.icon} size={21} /></View>
              <Text style={[styles.label, active && styles.activeLabel]}>{tab.name}</Text>
            </Pressable>
          );
        })}
      </View>
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
  scroll: { flex: 1 },
  content: { flexGrow: 1 },
  pullIndicator: { alignItems: 'center', elevation: 50, left: 0, position: 'absolute', right: 0, top: 8, zIndex: 50 },
  tabBar: { backgroundColor: '#090E0E', borderTopColor: '#202A28', borderTopWidth: 1, flexDirection: 'row', paddingBottom: 14, paddingHorizontal: 8, paddingTop: 9 },
  tab: { alignItems: 'center', flex: 1, gap: 4 },
  pressed: { opacity: 0.65 },
  iconFrame: { alignItems: 'center', height: 25, justifyContent: 'center', width: 27 },
  label: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  activeLabel: { color: colors.accent },
});
