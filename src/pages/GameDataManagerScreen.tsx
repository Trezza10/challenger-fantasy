import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';

type PlayType = 'Run' | 'Pass' | 'Interception' | 'Kick' | 'Punt' | 'Sack' | 'Penalty';
type GameStatus = 'FINAL' | 'LIVE' | 'SCHEDULED';
interface ManagedGame { away: string; awayScore: number; clock: string; home: string; homeScore: number; id: string; possession: string; quarter: number; status: GameStatus; week: number; yardLine: number; }
interface LocalPlay {
  description: string;
  fieldDelta: number;
  id: string;
  overturned: boolean;
  playerId: string;
  playerName: string;
  possession: string;
  quarter: number;
  receiverId: string | null;
  receiverName: string | null;
  clock: string;
  stamp: string;
  touchdown: boolean;
  type: PlayType;
  yards: number;
}
interface GamePlayer { id: string; name: string; number: number; position: 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF'; team: string; }

const weeks = Array.from({ length: 18 }, (_, index) => index + 1);
const nflTeams = ['ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS'];

/** Produces a complete 16-game mock slate for every week until the schedule API exists. */
const initialGames: ManagedGame[] = weeks.flatMap((week) => Array.from({ length: 16 }, (_, index) => {
  const away = nflTeams[(index + week - 1) % nflTeams.length];
  const home = nflTeams[(nflTeams.length - 1 - index + week - 1) % nflTeams.length];
  return {
    away,
    awayScore: 0,
    clock: '15:00',
    home,
    homeScore: 0,
    id: `week-${week}-${away}-${home}`,
    possession: index % 2 === 0 ? away : home,
    quarter: 1,
    status: 'SCHEDULED' as const,
    week,
    yardLine: 20,
  };
}));

const playTypes: { icon: keyof typeof Ionicons.glyphMap; type: PlayType }[] = [
  { icon: 'walk-outline', type: 'Run' },
  { icon: 'arrow-forward-circle-outline', type: 'Pass' },
  { icon: 'swap-horizontal-outline', type: 'Interception' },
  { icon: 'football-outline', type: 'Kick' },
  { icon: 'airplane-outline', type: 'Punt' },
  { icon: 'flash-outline', type: 'Sack' },
  { icon: 'flag-outline', type: 'Penalty' },
];

const rosterNames = [
  ['Marcus', 'Reed'], ['Eli', 'Brooks'], ['Devin', 'Price'], ['Jordan', 'Hayes'],
  ['Cameron', 'Ross'], ['Malik', 'Ward'], ['Trevor', 'Lane'], ['Andre', 'Stone'],
  ['Cole', 'Bennett'], ['Darius', 'Grant'], ['Noah', 'Foster'],
];
const rosterPositions: GamePlayer['position'][] = ['QB', 'QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'K', 'DEF', 'DEF'];

function getTeamRoster(team: string): GamePlayer[] {
  const teamOffset = Math.max(0, nflTeams.indexOf(team));
  return rosterPositions.map((position, index) => {
    const [first, last] = rosterNames[(index + teamOffset) % rosterNames.length];
    return { id: `${team}-${position}-${index}`, name: `${first} ${last}`, number: ((teamOffset * 7 + index * 11) % 98) + 1, position, team };
  });
}

const digitsOnly = (value: string) => value.replace(/\D/g, '');
const signedIntegerOnly = (value: string) => {
  const negative = value.startsWith('-');
  const digits = digitsOnly(value);
  return `${negative && digits ? '-' : ''}${digits}`;
};

/** Frontend-only operations console; all entries remain local until APIs are approved. */
export function GameDataManagerScreen() {
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [games, setGames] = useState(initialGames);
  const weekGames = useMemo(() => games.filter((game) => game.week === selectedWeek), [games, selectedWeek]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const selectedGame = selectedGameId ? weekGames.find((game) => game.id === selectedGameId) ?? null : null;
  const [playType, setPlayType] = useState<PlayType>('Run');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedReceiverId, setSelectedReceiverId] = useState<string | null>(null);
  const [yards, setYards] = useState('');
  const [isTouchdown, setIsTouchdown] = useState(false);
  const [editingPlayId, setEditingPlayId] = useState<string | null>(null);
  const [editTouchdown, setEditTouchdown] = useState(false);
  const [editYards, setEditYards] = useState('');
  const [editQuarter, setEditQuarter] = useState(1);
  const [editClock, setEditClock] = useState('15:00');
  const [plays, setPlays] = useState<Record<string, LocalPlay[]>>({});
  const offenseRoster = selectedGame ? getTeamRoster(selectedGame.possession) : [];
  const defendingTeam = selectedGame
    ? selectedGame.possession === selectedGame.away ? selectedGame.home : selectedGame.away
    : '';
  const primaryRoster = playType === 'Interception' || playType === 'Sack'
    ? getTeamRoster(defendingTeam)
    : offenseRoster;
  const visiblePrimaryRoster = primaryRoster.filter((player) => {
    if (playType === 'Pass') return player.position === 'QB';
    if (playType === 'Run') return ['QB', 'RB', 'WR'].includes(player.position);
    if (playType === 'Kick' || playType === 'Punt') return player.position === 'K';
    if (playType === 'Interception' || playType === 'Sack') return player.position === 'DEF';
    return true;
  });
  const receiverRoster = offenseRoster.filter((player) => ['RB', 'WR', 'TE'].includes(player.position));
  const selectedPlayer = primaryRoster.find((player) => player.id === selectedPlayerId);
  const selectedReceiver = receiverRoster.find((player) => player.id === selectedReceiverId);
  const gameIsFinal = selectedGame?.status === 'FINAL';
  const canRecordPlay = Boolean(selectedGame && !gameIsFinal && selectedPlayer && (playType !== 'Pass' || selectedReceiver));

  const updateGame = (changes: Partial<ManagedGame>) => {
    if (!selectedGame) return;
    setGames((current) => current.map((game) => game.id === selectedGame.id ? { ...game, ...changes } : game));
  };

  const recordPlay = () => {
    if (!selectedGame || gameIsFinal || !selectedPlayer || (playType === 'Pass' && !selectedReceiver)) return;
    const yardAmount = Math.max(-100, Math.min(100, Number.parseInt(yards, 10) || 0));
    const nextYardLine = Math.max(0, Math.min(100, selectedGame.yardLine + yardAmount));
    const playerDescription = playType === 'Pass'
      ? `${selectedPlayer.name} to ${selectedReceiver!.name}`
      : selectedPlayer.name;
    const description = `${playType} · ${playerDescription}${yardAmount ? ` · ${yardAmount > 0 ? '+' : ''}${yardAmount} ${playMeasurementUnit(playType)}` : ''}${isTouchdown ? ' · TOUCHDOWN' : ''}`;
    const play: LocalPlay = {
      description,
      fieldDelta: nextYardLine - selectedGame.yardLine,
      id: `local-${Date.now()}`,
      overturned: false,
      playerId: selectedPlayer.id,
      playerName: selectedPlayer.name,
      possession: selectedGame.possession,
      quarter: selectedGame.quarter,
      receiverId: selectedReceiver?.id ?? null,
      receiverName: selectedReceiver?.name ?? null,
      clock: selectedGame.clock,
      stamp: `Q${selectedGame.quarter} ${selectedGame.clock}`,
      touchdown: isTouchdown,
      type: playType,
      yards: yardAmount,
    };
    setPlays((current) => ({ ...current, [selectedGame.id]: [play, ...(current[selectedGame.id] ?? [])] }));
    const scoreChanges = isTouchdown
      ? selectedGame.possession === selectedGame.away
        ? { awayScore: selectedGame.awayScore + 6 }
        : { homeScore: selectedGame.homeScore + 6 }
      : {};
    updateGame({ status: 'LIVE', yardLine: nextYardLine, ...scoreChanges });
    setSelectedPlayerId(null);
    setSelectedReceiverId(null);
    setIsTouchdown(false);
    setYards('');
  };

  const reversePlayEffects = (play: LocalPlay) => {
    if (!selectedGame || play.overturned) return;
    setGames((current) => current.map((game) => {
      if (game.id !== selectedGame.id) return game;
      const scoreChanges = play.touchdown
        ? play.possession === game.away
          ? { awayScore: Math.max(0, game.awayScore - 6) }
          : { homeScore: Math.max(0, game.homeScore - 6) }
        : {};
      return { ...game, ...scoreChanges, yardLine: Math.max(0, Math.min(100, game.yardLine - play.fieldDelta)) };
    }));
  };

  const overturnPlay = (play: LocalPlay) => {
    if (!selectedGame || gameIsFinal || play.overturned) return;
    reversePlayEffects(play);
    setPlays((current) => ({
      ...current,
      [selectedGame.id]: (current[selectedGame.id] ?? []).map((entry) => entry.id === play.id ? { ...entry, overturned: true } : entry),
    }));
  };

  const beginEditPlay = (play: LocalPlay) => {
    if (!selectedGame || gameIsFinal || play.overturned) return;
    setEditingPlayId(play.id);
    setEditYards(String(play.yards));
    setEditTouchdown(play.touchdown);
    setEditQuarter(play.quarter);
    setEditClock(play.clock);
  };

  const saveEditedPlay = (play: LocalPlay) => {
    if (!selectedGame || gameIsFinal || play.overturned) return;
    const nextYards = Math.max(-100, Math.min(100, Number.parseInt(editYards, 10) || 0));
    const fieldBeforePlay = Math.max(0, Math.min(100, selectedGame.yardLine - play.fieldDelta));
    const nextYardLine = Math.max(0, Math.min(100, fieldBeforePlay + nextYards));
    const nextFieldDelta = nextYardLine - fieldBeforePlay;
    setGames((current) => current.map((game) => {
      if (game.id !== selectedGame.id) return game;
      let awayScore = game.awayScore;
      let homeScore = game.homeScore;
      if (play.touchdown) {
        if (play.possession === game.away) awayScore = Math.max(0, awayScore - 6);
        else homeScore = Math.max(0, homeScore - 6);
      }
      if (editTouchdown) {
        if (play.possession === game.away) awayScore += 6;
        else homeScore += 6;
      }
      return { ...game, awayScore, homeScore, yardLine: nextYardLine };
    }));
    const playerDescription = play.type === 'Pass' && play.receiverName
      ? `${play.playerName} to ${play.receiverName}`
      : play.playerName;
    const description = `${play.type} · ${playerDescription}${nextYards ? ` · ${nextYards > 0 ? '+' : ''}${nextYards} ${playMeasurementUnit(play.type)}` : ''}${editTouchdown ? ' · TOUCHDOWN' : ''}`;
    setPlays((current) => ({
      ...current,
      [selectedGame.id]: (current[selectedGame.id] ?? []).map((entry) => entry.id === play.id
        ? { ...entry, clock: editClock, description, fieldDelta: nextFieldDelta, quarter: editQuarter, stamp: `Q${editQuarter} ${editClock}`, touchdown: editTouchdown, yards: nextYards }
        : entry),
    }));
    setEditingPlayId(null);
  };

  return <View style={styles.screen}>
    <View style={styles.header}><View><Text style={styles.eyebrow}>AUTHORIZED GAME OPERATIONS</Text><Text style={styles.title}>Live data manager</Text><Text style={styles.subtitle}>Frontend preview · entries are local and are not publishing scores yet.</Text></View><View style={styles.secureBadge}><Ionicons color={colors.accent} name="radio" size={15} /><Text style={styles.secureText}>STAFF ONLY</Text></View></View>

    <ScrollView contentContainerStyle={styles.weekTrack} horizontal showsHorizontalScrollIndicator={false}>
      {weeks.map((week) => <Pressable key={week} onPress={() => { setSelectedWeek(week); setSelectedGameId(null); }} style={[styles.weekPill, week === selectedWeek && styles.activeWeekPill]}><Text style={[styles.weekLabel, week === selectedWeek && styles.activeWeekLabel]}>WEEK</Text><Text style={[styles.weekNumber, week === selectedWeek && styles.activeWeekNumber]}>{week}</Text></Pressable>)}
    </ScrollView>

    {weekGames.length === 0 ? <View style={styles.empty}><Ionicons color={colors.muted} name="calendar-outline" size={28} /><Text style={styles.emptyTitle}>No games loaded for Week {selectedWeek}</Text><Text style={styles.emptyCopy}>The backend schedule feed will populate this week later.</Text></View> : <>
      {!selectedGame && <View style={styles.slate}>
        <View style={styles.slateHeader}><View><Text style={styles.sectionLabel}>WEEK {selectedWeek} GAME SLATE</Text><Text style={styles.slateTitle}>Choose a matchup</Text></View><Text style={styles.gameCount}>{weekGames.length} GAMES</Text></View>
        <View style={styles.gameGrid}>{weekGames.map((game) => <Pressable accessibilityLabel={`Open ${game.away} at ${game.home}`} key={game.id} onPress={() => setSelectedGameId(game.id)} style={styles.gameCard}>
          <View style={styles.gameCardTop}><Text style={[styles.status, game.status === 'LIVE' && styles.liveStatus]}>{game.status}</Text><Text style={styles.gameClock}>{game.status === 'LIVE' ? `Q${game.quarter} · ${game.clock}` : game.status === 'FINAL' ? 'FINAL' : 'SUN · 1:00 PM'}</Text></View>
          <View style={styles.teamLine}><View style={styles.teamIdentity}><View style={styles.teamMark}><Text style={styles.teamMarkText}>{game.away.slice(0, 1)}</Text></View><Text style={styles.team}>{game.away}</Text></View><Text style={styles.score}>{game.awayScore}</Text></View>
          <View style={styles.teamLine}><View style={styles.teamIdentity}><View style={[styles.teamMark, styles.homeTeamMark]}><Text style={styles.teamMarkText}>{game.home.slice(0, 1)}</Text></View><Text style={styles.team}>{game.home}</Text></View><Text style={styles.score}>{game.homeScore}</Text></View>
          <View style={styles.openGame}><Text style={styles.openGameText}>OPEN GAME</Text><Ionicons color={colors.accent} name="arrow-forward" size={14} /></View>
        </Pressable>)}</View>
      </View>}

      {selectedGame && <View style={styles.console}>
        <Pressable accessibilityLabel={`Back to Week ${selectedWeek} games`} onPress={() => setSelectedGameId(null)} style={styles.backButton}><Ionicons color={colors.accent} name="chevron-back" size={17} /><Text style={styles.backText}>BACK TO WEEK {selectedWeek} GAMES</Text></Pressable>
        <View style={styles.scoreHeader}><View><Text style={styles.matchup}>{selectedGame.away} <Text style={styles.at}>AT</Text> {selectedGame.home}</Text><Text style={styles.possession}>{selectedGame.possession} BALL · {fieldPositionLabel(selectedGame)}</Text></View><Text style={styles.bigScore}>{selectedGame.awayScore}–{selectedGame.homeScore}</Text></View>
        <FootballField game={selectedGame} />

        {gameIsFinal && <View style={styles.finalBanner}><Ionicons color="#FF9B9B" name="lock-closed" size={18} /><View style={styles.playCopy}><Text style={styles.finalTitle}>GAME FINALIZED</Text><Text style={styles.finalCopy}>Play entry and game controls are locked.</Text></View></View>}

        <Text style={styles.sectionLabel}>PLAY TYPE</Text>
        <ScrollView contentContainerStyle={styles.playTypes} horizontal showsHorizontalScrollIndicator={false}>
          {playTypes.map((option) => <Pressable disabled={gameIsFinal} key={option.type} onPress={() => { setPlayType(option.type); setSelectedPlayerId(null); setSelectedReceiverId(null); setIsTouchdown(false); }} style={[styles.playType, playType === option.type && styles.activePlayType, gameIsFinal && styles.disabledButton]}><Ionicons color={playType === option.type ? colors.background : colors.textSecondary} name={option.icon} size={17} /><Text style={[styles.playTypeText, playType === option.type && styles.activePlayTypeText]}>{option.type.toUpperCase()}</Text></Pressable>)}
        </ScrollView>
        <View pointerEvents={gameIsFinal ? 'none' : 'auto'} style={gameIsFinal && styles.lockedContent}>
          <PlayerPicker label={`${playType === 'Pass' ? 'PASSER' : playerLabel(playType)} · ${visiblePrimaryRoster[0]?.team ?? ''}`} onSelect={setSelectedPlayerId} players={visiblePrimaryRoster} selectedId={selectedPlayerId} />
          {playType === 'Pass' && <PlayerPicker label={`RECEIVER · ${selectedGame.possession}`} onSelect={setSelectedReceiverId} players={receiverRoster} selectedId={selectedReceiverId} />}
          <View style={styles.entryRow}>
            <View style={styles.numberField}><Text style={styles.controlLabel}>{measurementLabel(playType)}</Text><TextInput keyboardType="numbers-and-punctuation" maxLength={4} onChangeText={(value) => { const sanitized = signedIntegerOnly(value); const parsed = Number.parseInt(sanitized, 10); setYards(Number.isNaN(parsed) ? sanitized : String(Math.max(-100, Math.min(100, parsed)))); }} placeholder="0" placeholderTextColor={colors.muted} style={styles.entryInput} value={yards} /></View>
            <Pressable onPress={() => setIsTouchdown((current) => !current)} style={[styles.touchdownToggle, isTouchdown && styles.activeTouchdown]}><Ionicons color={isTouchdown ? colors.background : colors.accent} name={isTouchdown ? 'checkmark-circle' : 'trophy-outline'} size={17} /><Text style={[styles.touchdownText, isTouchdown && styles.activeTouchdownText]}>TOUCHDOWN</Text></Pressable>
            <Pressable disabled={!canRecordPlay} onPress={recordPlay} style={[styles.recordButton, !canRecordPlay && styles.disabledButton]}><Ionicons color={colors.background} name="add" size={18} /><Text style={styles.recordText}>RECORD PLAY</Text></Pressable>
          </View>
        </View>

        <View style={styles.feed}>
          <View style={styles.feedHeader}><Text style={styles.sectionLabel}>LOCAL PLAY FEED</Text><Text style={styles.feedCount}>{(plays[selectedGame.id] ?? []).length} EVENTS</Text></View>
          {(plays[selectedGame.id] ?? []).length === 0
            ? <Text style={styles.noPlays}>No plays entered in this preview session.</Text>
            : (plays[selectedGame.id] ?? []).map((play) => <View key={play.id} style={[styles.playRecord, play.overturned && styles.overturnedPlay]}>
              <View style={styles.playRow}>
                <View style={styles.playIcon}><Ionicons color={play.overturned ? colors.muted : colors.accent} name={play.overturned ? 'close-circle-outline' : 'flash-outline'} size={14} /></View>
                <View style={styles.playCopy}><Text style={[styles.playDescription, play.overturned && styles.overturnedText]}>{play.description}</Text><Text style={styles.playStamp}>{play.stamp} · {play.type.toUpperCase()}{play.overturned ? ' · OVERTURNED' : ''}</Text></View>
                {!play.overturned && <View style={styles.playActions}>
                  <Pressable disabled={gameIsFinal} onPress={() => beginEditPlay(play)} style={[styles.playAction, gameIsFinal && styles.disabledButton]}><Ionicons color={colors.accent} name="create-outline" size={13} /><Text style={styles.playActionText}>EDIT</Text></Pressable>
                  <Pressable disabled={gameIsFinal} onPress={() => overturnPlay(play)} style={[styles.playAction, styles.overturnAction, gameIsFinal && styles.disabledButton]}><Ionicons color="#FF9B9B" name="return-down-back-outline" size={13} /><Text style={styles.overturnActionText}>OVERTURN</Text></Pressable>
                </View>}
              </View>
              {editingPlayId === play.id && <View style={styles.inlineEditor}>
                <View style={styles.inlineQuarterField}><Text style={styles.controlLabel}>QUARTER</Text><View style={styles.inlineControls}>{[1, 2, 3, 4].map((quarter) => <Pressable key={quarter} onPress={() => setEditQuarter(quarter)} style={[styles.inlineQuarterButton, editQuarter === quarter && styles.activeSquare]}><Text style={[styles.squareText, editQuarter === quarter && styles.activeSquareText]}>{quarter}</Text></Pressable>)}</View></View>
                <View style={styles.inlineClockField}><Text style={styles.controlLabel}>PLAY CLOCK</Text><View style={styles.clockRow}><TextInput keyboardType="number-pad" maxLength={2} onChangeText={(value) => setEditClock(`${Math.min(15, Number.parseInt(digitsOnly(value), 10) || 0).toString().padStart(2, '0')}:${editClock.split(':')[1] ?? '00'}`)} style={styles.inlineClockInput} value={editClock.split(':')[0]} /><Text style={styles.clockColon}>:</Text><TextInput keyboardType="number-pad" maxLength={2} onChangeText={(value) => setEditClock(`${editClock.split(':')[0] ?? '00'}:${Math.min(59, Number.parseInt(digitsOnly(value), 10) || 0).toString().padStart(2, '0')}`)} style={styles.inlineClockInput} value={editClock.split(':')[1]} /></View></View>
                <View style={styles.inlineEditField}><Text style={styles.controlLabel}>{measurementLabel(play.type)}</Text><TextInput keyboardType="numbers-and-punctuation" maxLength={4} onChangeText={(value) => { const sanitized = signedIntegerOnly(value); const parsed = Number.parseInt(sanitized, 10); setEditYards(Number.isNaN(parsed) ? sanitized : String(Math.max(-100, Math.min(100, parsed)))); }} style={styles.inlineEditInput} value={editYards} /></View>
                <Pressable onPress={() => setEditTouchdown((current) => !current)} style={[styles.touchdownToggle, editTouchdown && styles.activeTouchdown]}><Ionicons color={editTouchdown ? colors.background : colors.accent} name={editTouchdown ? 'checkmark-circle' : 'trophy-outline'} size={15} /><Text style={[styles.touchdownText, editTouchdown && styles.activeTouchdownText]}>TOUCHDOWN</Text></Pressable>
                <View style={styles.inlineEditActions}><Pressable onPress={() => setEditingPlayId(null)} style={styles.cancelEditButton}><Text style={styles.cancelEditText}>CANCEL</Text></Pressable><Pressable onPress={() => saveEditedPlay(play)} style={styles.saveEditButton}><Ionicons color={colors.background} name="checkmark" size={14} /><Text style={styles.saveEditText}>SAVE UPDATE</Text></Pressable></View>
              </View>}
            </View>)}
        </View>

        <View style={styles.gameStateSection}>
          <View style={styles.feedHeader}><View><Text style={styles.sectionLabel}>GAME STATE</Text><Text style={styles.stateHelp}>Update the clock, quarter, possession, and ball location.</Text></View>{gameIsFinal ? <Pressable onPress={() => updateGame({ status: 'LIVE' })} style={styles.reopenButton}><Ionicons color={colors.accent} name="lock-open-outline" size={14} /><Text style={styles.reopenText}>REOPEN GAME</Text></Pressable> : <Pressable onPress={() => updateGame({ clock: '00:00', status: 'FINAL' })} style={styles.endGameButton}><Ionicons color="#FFFFFF" name="stop-circle-outline" size={15} /><Text style={styles.endGameText}>END GAME</Text></Pressable>}</View>
          <View pointerEvents={gameIsFinal ? 'none' : 'auto'} style={[styles.controlsGrid, gameIsFinal && styles.lockedContent]}>
            <View style={styles.controlCard}><Text style={styles.controlLabel}>QUARTER</Text><View style={styles.inlineControls}>{[1, 2, 3, 4].map((quarter) => <Pressable key={quarter} onPress={() => updateGame({ quarter, status: 'LIVE' })} style={[styles.squareButton, selectedGame.quarter === quarter && styles.activeSquare]}><Text style={[styles.squareText, selectedGame.quarter === quarter && styles.activeSquareText]}>{quarter}</Text></Pressable>)}</View></View>
            <View style={styles.controlCard}><Text style={styles.controlLabel}>GAME CLOCK</Text><View style={styles.clockRow}><TextInput keyboardType="number-pad" maxLength={2} onChangeText={(value) => updateGame({ clock: `${Math.min(15, Number.parseInt(digitsOnly(value), 10) || 0).toString().padStart(2, '0')}:${selectedGame.clock.split(':')[1] ?? '00'}`, status: 'LIVE' })} placeholder="00" placeholderTextColor={colors.muted} style={styles.clockInput} value={selectedGame.clock.split(':')[0]} /><Text style={styles.clockColon}>:</Text><TextInput keyboardType="number-pad" maxLength={2} onChangeText={(value) => updateGame({ clock: `${selectedGame.clock.split(':')[0] ?? '00'}:${Math.min(59, Number.parseInt(digitsOnly(value), 10) || 0).toString().padStart(2, '0')}`, status: 'LIVE' })} placeholder="00" placeholderTextColor={colors.muted} style={styles.clockInput} value={selectedGame.clock.split(':')[1]} /></View></View>
            <View style={styles.controlCard}><Text style={styles.controlLabel}>POSSESSION</Text><View style={styles.inlineControls}>{[selectedGame.away, selectedGame.home].map((team) => <Pressable key={team} onPress={() => { updateGame({ possession: team, status: 'LIVE' }); setSelectedPlayerId(null); setSelectedReceiverId(null); }} style={[styles.teamButton, selectedGame.possession === team && styles.activeSquare]}><Text style={[styles.squareText, selectedGame.possession === team && styles.activeSquareText]}>{team}</Text></Pressable>)}</View></View>
            <View style={styles.controlCard}><Text style={styles.controlLabel}>BALL POSITION · {selectedGame.yardLine}</Text><View style={styles.inlineControls}><Pressable onPress={() => updateGame({ yardLine: Math.max(0, selectedGame.yardLine - 5), status: 'LIVE' })} style={styles.adjustButton}><Text style={styles.adjustText}>−5</Text></Pressable><TextInput keyboardType="number-pad" maxLength={3} onChangeText={(value) => updateGame({ yardLine: Math.max(0, Math.min(100, Number.parseInt(digitsOnly(value), 10) || 0)), status: 'LIVE' })} style={styles.yardInput} value={String(selectedGame.yardLine)} /><Pressable onPress={() => updateGame({ yardLine: Math.min(100, selectedGame.yardLine + 5), status: 'LIVE' })} style={styles.adjustButton}><Text style={styles.adjustText}>+5</Text></Pressable></View></View>
          </View>
        </View>
      </View>}
    </>}
  </View>;
}

function FootballField({ game }: { game: ManagedGame }) {
  return <View style={styles.field}>
    <View style={[styles.endZone, styles.leftEndZone]}><Text style={styles.endZoneText}>{game.away}</Text></View>
    <View style={[styles.endZone, styles.rightEndZone]}><Text style={styles.endZoneText}>{game.home}</Text></View>
    {Array.from({ length: 9 }, (_, index) => <View key={index} style={[styles.yardStripe, { left: `${16.4 + index * 8.4}%` }]}><Text style={styles.yardNumber}>{index < 5 ? (index + 1) * 10 : (9 - index) * 10}</Text></View>)}
    <View style={[styles.ballLine, { left: `${Math.max(8, Math.min(92, 8 + game.yardLine * .84))}%` }]}><View style={styles.ballMarker}><Ionicons color="#4B2C15" name="american-football" size={13} /></View></View>
    <View style={styles.fieldCenter}><Text style={styles.fieldLogo}>{game.home.slice(0, 3).toUpperCase()}</Text></View>
  </View>;
}

function PlayerPicker({ label, onSelect, players, selectedId }: { label: string; onSelect: (id: string) => void; players: GamePlayer[]; selectedId: string | null }) {
  return <View style={styles.playerTable}>
    <View style={styles.playerTableHeader}><Text style={styles.sectionLabel}>{label}</Text><Text style={styles.tableHint}>SELECT FROM TEAM ROSTER</Text></View>
    <View style={styles.columnHeader}><Text style={styles.numberColumn}>#</Text><Text style={styles.nameColumn}>PLAYER</Text><Text style={styles.positionColumn}>POS</Text></View>
    {players.map((player) => <Pressable key={player.id} onPress={() => onSelect(player.id)} style={[styles.playerRow, selectedId === player.id && styles.selectedPlayerRow]}>
      <Text style={[styles.numberColumn, styles.playerCell]}>{player.number}</Text>
      <Text style={[styles.nameColumn, styles.playerName]}>{player.name}</Text>
      <Text style={[styles.positionColumn, styles.playerCell]}>{player.position}</Text>
      {selectedId === player.id && <Ionicons color={colors.accent} name="checkmark-circle" size={17} />}
    </Pressable>)}
  </View>;
}

function fieldPositionLabel(game: ManagedGame) {
  if (game.yardLine === 50) return '50 YARD LINE';
  const side = game.yardLine < 50 ? game.away : game.home;
  return `${side} ${game.yardLine < 50 ? game.yardLine : 100 - game.yardLine}`;
}

function playerLabel(playType: PlayType) {
  const labels: Record<PlayType, string> = {
    Run: 'BALL CARRIER',
    Pass: 'PASSER',
    Interception: 'INTERCEPTING PLAYER',
    Kick: 'KICKER',
    Punt: 'PUNTER',
    Sack: 'DEFENDER',
    Penalty: 'PLAYER',
  };
  return labels[playType];
}

function measurementLabel(playType: PlayType) {
  const labels: Record<PlayType, string> = {
    Run: 'RUSHING YARDS',
    Pass: 'PASSING YARDS',
    Interception: 'INTERCEPTION RETURN YARDS',
    Kick: 'KICK DISTANCE (YARDS)',
    Punt: 'PUNT DISTANCE (YARDS)',
    Sack: 'YARDS LOST',
    Penalty: 'PENALTY YARDS',
  };
  return labels[playType];
}

function playMeasurementUnit(playType: PlayType) {
  return playType === 'Kick' || playType === 'Punt' ? 'yard distance' : 'yds';
}

const styles = StyleSheet.create({
  screen: { gap: 14 },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', marginTop: 3 },
  subtitle: { color: colors.textSecondary, fontSize: 10, marginTop: 5 },
  secureBadge: { alignItems: 'center', backgroundColor: '#17221E', borderColor: '#31523A', borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 7 },
  secureText: { color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: .6 },
  weekTrack: { gap: 8, paddingRight: 8 },
  weekPill: { alignItems: 'center', backgroundColor: colors.card, borderColor: colors.border, borderRadius: 10, borderWidth: 1, height: 54, justifyContent: 'center', width: 58 },
  activeWeekPill: { backgroundColor: colors.accent, borderColor: colors.accent },
  weekLabel: { color: colors.muted, fontSize: 7, fontWeight: '900', letterSpacing: .6 },
  activeWeekLabel: { color: '#3D5500' },
  weekNumber: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 1 },
  activeWeekNumber: { color: colors.background },
  slate: { gap: 12 },
  slateHeader: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' },
  slateTitle: { color: colors.text, fontSize: 21, fontWeight: '900', marginTop: 3 },
  gameCount: { color: colors.accent, fontSize: 8, fontWeight: '900' },
  gameGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gameCard: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 13, borderWidth: 1, flexBasis: 152, flexGrow: 1, maxWidth: 260, minWidth: 152, padding: 12 },
  gameCardTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  status: { color: colors.muted, fontSize: 7, fontWeight: '900', letterSpacing: .5 },
  liveStatus: { color: colors.accent },
  gameClock: { color: colors.textSecondary, fontSize: 7, fontWeight: '800' },
  teamLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  teamIdentity: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  teamMark: { alignItems: 'center', backgroundColor: '#25352F', borderRadius: 12, height: 24, justifyContent: 'center', width: 24 },
  homeTeamMark: { backgroundColor: '#29361C' },
  teamMarkText: { color: colors.text, fontSize: 9, fontWeight: '900' },
  team: { color: colors.text, fontSize: 13, fontWeight: '900' },
  score: { color: colors.text, fontSize: 14, fontWeight: '900' },
  openGame: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', gap: 4, justifyContent: 'flex-end', marginTop: 8, paddingTop: 8 },
  openGameText: { color: colors.accent, fontSize: 7, fontWeight: '900' },
  console: { backgroundColor: '#0B1110', borderColor: colors.border, borderRadius: 17, borderWidth: 1, gap: 14, padding: 14 },
  backButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 3 },
  backText: { color: colors.accent, fontSize: 8, fontWeight: '900' },
  scoreHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  matchup: { color: colors.text, fontSize: 17, fontWeight: '900' },
  at: { color: colors.muted, fontSize: 9 },
  possession: { color: colors.accent, fontSize: 8, fontWeight: '900', marginTop: 4 },
  bigScore: { color: colors.text, fontSize: 25, fontWeight: '900' },
  finalBanner: { alignItems: 'center', backgroundColor: '#2B1719', borderColor: '#6B3035', borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 10, padding: 11 },
  finalTitle: { color: '#FFB1B4', fontSize: 10, fontWeight: '900' },
  finalCopy: { color: '#C88E91', fontSize: 8, marginTop: 2 },
  lockedContent: { opacity: .4 },
  field: { backgroundColor: '#174D2B', borderColor: '#477A55', borderRadius: 12, borderWidth: 1, height: 142, overflow: 'hidden', position: 'relative' },
  endZone: { alignItems: 'center', backgroundColor: '#123D23', bottom: 0, justifyContent: 'center', position: 'absolute', top: 0, width: '8%' },
  leftEndZone: { left: 0 },
  rightEndZone: { right: 0 },
  endZoneText: { color: '#A8CCB2', fontSize: 8, fontWeight: '900', transform: [{ rotate: '-90deg' }] },
  yardStripe: { borderLeftColor: 'rgba(255,255,255,.28)', borderLeftWidth: 1, bottom: 0, position: 'absolute', top: 0 },
  yardNumber: { color: 'rgba(255,255,255,.46)', fontSize: 7, fontWeight: '900', left: 3, position: 'absolute', top: 8 },
  ballLine: { alignItems: 'center', backgroundColor: '#FF4F54', bottom: 0, position: 'absolute', top: 0, width: 2 },
  ballMarker: { alignItems: 'center', backgroundColor: '#F6E6C9', borderRadius: 12, height: 24, justifyContent: 'center', left: -11, position: 'absolute', top: 57, width: 24 },
  fieldCenter: { alignItems: 'center', alignSelf: 'center', backgroundColor: 'rgba(255,255,255,.1)', borderRadius: 28, height: 56, justifyContent: 'center', marginTop: 42, width: 56 },
  fieldLogo: { color: 'rgba(255,255,255,.55)', fontSize: 18, fontWeight: '900' },
  controlsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  controlCard: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 11, borderWidth: 1, flexBasis: 160, flexGrow: 1, padding: 11 },
  controlLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: .6, marginBottom: 8 },
  inlineControls: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  squareButton: { alignItems: 'center', backgroundColor: '#18201F', borderRadius: 7, height: 34, justifyContent: 'center', width: 34 },
  activeSquare: { backgroundColor: colors.accent },
  squareText: { color: colors.textSecondary, fontSize: 11, fontWeight: '900' },
  activeSquareText: { color: colors.background },
  teamButton: { alignItems: 'center', backgroundColor: '#18201F', borderRadius: 7, flex: 1, height: 34, justifyContent: 'center' },
  clockRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  clockInput: { backgroundColor: '#18201F', borderRadius: 7, color: colors.text, fontSize: 17, fontWeight: '900', paddingHorizontal: 10, paddingVertical: 7, textAlign: 'center', width: 54 },
  clockColon: { color: colors.text, fontSize: 18, fontWeight: '900' },
  adjustButton: { alignItems: 'center', backgroundColor: '#18201F', borderRadius: 7, height: 34, justifyContent: 'center', width: 42 },
  adjustText: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  yardInput: { backgroundColor: '#18201F', borderRadius: 7, color: colors.text, flex: 1, fontSize: 14, fontWeight: '900', height: 34, textAlign: 'center' },
  sectionLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: .8 },
  playTypes: { gap: 7, paddingRight: 6 },
  playType: { alignItems: 'center', backgroundColor: colors.card, borderColor: colors.border, borderRadius: 9, borderWidth: 1, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 9 },
  activePlayType: { backgroundColor: colors.accent, borderColor: colors.accent },
  playTypeText: { color: colors.textSecondary, fontSize: 8, fontWeight: '900' },
  activePlayTypeText: { color: colors.background },
  playerTable: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 11, borderWidth: 1, overflow: 'hidden' },
  playerTableHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', padding: 11 },
  tableHint: { color: colors.accent, fontSize: 7, fontWeight: '900' },
  columnHeader: { backgroundColor: '#111917', flexDirection: 'row', paddingHorizontal: 11, paddingVertical: 7 },
  playerRow: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', minHeight: 42, paddingHorizontal: 11, paddingVertical: 7 },
  selectedPlayerRow: { backgroundColor: '#17251E', borderLeftColor: colors.accent, borderLeftWidth: 3, paddingLeft: 8 },
  numberColumn: { color: colors.muted, fontSize: 8, fontWeight: '900', width: 34 },
  nameColumn: { color: colors.muted, flex: 1, fontSize: 8, fontWeight: '900' },
  positionColumn: { color: colors.muted, fontSize: 8, fontWeight: '900', width: 40 },
  playerCell: { color: colors.textSecondary, fontSize: 10 },
  playerName: { color: colors.text, fontSize: 11 },
  entryRow: { alignItems: 'flex-end', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  numberField: { flexGrow: 1, minWidth: 150 },
  entryInput: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 9, borderWidth: 1, color: colors.text, minWidth: 85, paddingHorizontal: 11, paddingVertical: 10 },
  touchdownToggle: { alignItems: 'center', backgroundColor: '#17221E', borderColor: '#31523A', borderRadius: 9, borderWidth: 1, flexDirection: 'row', gap: 6, minHeight: 43, paddingHorizontal: 12 },
  activeTouchdown: { backgroundColor: colors.accent, borderColor: colors.accent },
  touchdownText: { color: colors.accent, fontSize: 8, fontWeight: '900' },
  activeTouchdownText: { color: colors.background },
  recordButton: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 9, flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: 43, paddingHorizontal: 14 },
  disabledButton: { opacity: .35 },
  recordText: { color: colors.background, fontSize: 9, fontWeight: '900' },
  feed: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 11, borderWidth: 1, padding: 12 },
  feedHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  feedCount: { color: colors.accent, fontSize: 8, fontWeight: '900' },
  noPlays: { color: colors.muted, fontSize: 10, paddingVertical: 15, textAlign: 'center' },
  playRecord: { borderTopColor: colors.border, borderTopWidth: 1 },
  playRow: { alignItems: 'center', flexDirection: 'row', gap: 9, paddingVertical: 10 },
  playIcon: { alignItems: 'center', backgroundColor: '#17221E', borderRadius: 15, height: 30, justifyContent: 'center', width: 30 },
  playCopy: { flex: 1 },
  playDescription: { color: colors.text, fontSize: 10, fontWeight: '800' },
  playStamp: { color: colors.muted, fontSize: 8, marginTop: 3 },
  playActions: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  playAction: { alignItems: 'center', backgroundColor: '#17221E', borderColor: '#31523A', borderRadius: 7, borderWidth: 1, flexDirection: 'row', gap: 3, paddingHorizontal: 7, paddingVertical: 6 },
  playActionText: { color: colors.accent, fontSize: 7, fontWeight: '900' },
  overturnAction: { backgroundColor: '#281719', borderColor: '#633035' },
  overturnActionText: { color: '#FF9B9B', fontSize: 7, fontWeight: '900' },
  overturnedPlay: { opacity: .55 },
  overturnedText: { textDecorationLine: 'line-through' },
  inlineEditor: { alignItems: 'flex-end', backgroundColor: '#111A17', borderColor: '#31523A', borderRadius: 9, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10, padding: 10 },
  inlineQuarterField: { minWidth: 154 },
  inlineQuarterButton: { alignItems: 'center', backgroundColor: '#18201F', borderRadius: 7, height: 34, justifyContent: 'center', width: 34 },
  inlineClockField: { minWidth: 126 },
  inlineClockInput: { backgroundColor: '#18201F', borderRadius: 7, color: colors.text, fontSize: 13, fontWeight: '900', height: 34, textAlign: 'center', width: 44 },
  inlineEditField: { flexGrow: 1, minWidth: 115 },
  inlineEditInput: { backgroundColor: '#18201F', borderColor: colors.border, borderRadius: 7, borderWidth: 1, color: colors.text, fontSize: 13, fontWeight: '900', minHeight: 39, paddingHorizontal: 10 },
  inlineEditActions: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  cancelEditButton: { borderColor: colors.border, borderRadius: 7, borderWidth: 1, justifyContent: 'center', minHeight: 39, paddingHorizontal: 10 },
  cancelEditText: { color: colors.textSecondary, fontSize: 7, fontWeight: '900' },
  saveEditButton: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 7, flexDirection: 'row', gap: 4, justifyContent: 'center', minHeight: 39, paddingHorizontal: 10 },
  saveEditText: { color: colors.background, fontSize: 7, fontWeight: '900' },
  gameStateSection: { backgroundColor: '#0E1614', borderColor: colors.border, borderRadius: 12, borderWidth: 1, gap: 12, padding: 12 },
  stateHelp: { color: colors.muted, fontSize: 8, marginTop: 3 },
  endGameButton: { alignItems: 'center', backgroundColor: '#9F3037', borderRadius: 8, flexDirection: 'row', gap: 5, paddingHorizontal: 11, paddingVertical: 8 },
  endGameText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
  reopenButton: { alignItems: 'center', borderColor: colors.accent, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 5, paddingHorizontal: 11, paddingVertical: 8 },
  reopenText: { color: colors.accent, fontSize: 8, fontWeight: '900' },
  empty: { alignItems: 'center', backgroundColor: colors.card, borderColor: colors.border, borderRadius: 14, borderWidth: 1, padding: 30 },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 10 },
  emptyCopy: { color: colors.muted, fontSize: 10, marginTop: 5 },
});
