import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { getPositionColor } from '../../theme/positions';
import { AppliedModifier, MatchupPlayerData, Position, PowerCard } from '../../types/fantasy';
import { getAvatarUrl } from '../../utils/formatters';
import { getGameInfo } from '../../utils/gameInfo';

/** Data needed to render one left-versus-right player matchup row. */
interface MatchupPlayerProps {
  leftAppliedCards?: AppliedModifier[];
  leftName: string;
  leftPlayer: MatchupPlayerData;
  leftScore: string;
  draggingCard: PowerCard | null;
  hoveredPlayerName: string | null;
  canPlayCard: (card: PowerCard, player: MatchupPlayerData, isManagerTeam: boolean) => boolean;
  onRegisterDropTarget: (player: MatchupPlayerData, isManagerTeam: boolean, node: View | null) => void;
  onSelectPlayer: (player: MatchupPlayerData) => void;
  position: Position;
  rightAppliedCards?: AppliedModifier[];
  rightName: string;
  rightPlayer: MatchupPlayerData;
  rightScore: string;
}

/** Renders an individual position battle inside the matchup lineup. */
export function MatchupPlayer({ canPlayCard, draggingCard, hoveredPlayerName, leftAppliedCards, leftName, leftPlayer, leftScore, onRegisterDropTarget, onSelectPlayer, position, rightAppliedCards, rightName, rightPlayer, rightScore }: MatchupPlayerProps) {
  const leftIsValid = Boolean(draggingCard && canPlayCard(draggingCard, leftPlayer, true));
  const rightIsValid = Boolean(draggingCard && canPlayCard(draggingCard, rightPlayer, false));
  const leftIsInvalid = Boolean(draggingCard && !leftIsValid);
  const rightIsInvalid = Boolean(draggingCard && !rightIsValid);
  return (
    <View style={styles.row}>
      <View ref={(node) => onRegisterDropTarget(leftPlayer, true, node)} style={[styles.playerSide, leftIsInvalid && styles.invalidTarget]}>
        <Pressable onPress={() => onSelectPlayer(leftPlayer)} style={styles.playerPressable}><Avatar isValidTarget={leftIsValid} name={leftName} /><PlayerDetails appliedCards={leftAppliedCards} isHoveredTarget={hoveredPlayerName === leftPlayer.name} name={leftName} position={position} team={leftPlayer.team} /></Pressable>
      </View>
      <Text numberOfLines={1} style={[styles.score, leftIsInvalid && styles.invalidTarget]}>{leftScore}</Text>
      <Text style={[styles.position, { color: getPositionColor(position) }]}>{position}</Text>
      <Text numberOfLines={1} style={[styles.score, styles.rightScore, rightIsInvalid && styles.invalidTarget]}>{rightScore}</Text>
      <View ref={(node) => onRegisterDropTarget(rightPlayer, false, node)} style={[styles.playerSide, styles.rightPlayer, rightIsInvalid && styles.invalidTarget]}>
        <Pressable onPress={() => onSelectPlayer(rightPlayer)} style={[styles.playerPressable, styles.rightPlayer]}><PlayerDetails appliedCards={rightAppliedCards} isHoveredTarget={hoveredPlayerName === rightPlayer.name} name={rightName} position={position} team={rightPlayer.team} /><Avatar isValidTarget={rightIsValid} name={rightName} opponent /></Pressable>
      </View>
    </View>
  );
}

/** Uses an initial as a temporary avatar until player images are available. */
function Avatar({ isValidTarget, name, opponent = false }: { isValidTarget: boolean; name: string; opponent?: boolean }) {
  return <View style={[styles.avatar, opponent && styles.opponentAvatar, isValidTarget && styles.validAvatar]}><Image source={{ uri: getAvatarUrl(name) }} style={styles.avatarImage} /></View>;
}

/** Keeps a player's name and position presentation consistent on both sides. */
function PlayerDetails({ appliedCards = [], isHoveredTarget, name, position, team }: { appliedCards?: AppliedModifier[]; isHoveredTarget: boolean; name: string; position: Position; team: string }) {
  const game = getGameInfo(team);
  return <View style={styles.playerDetails}><Text ellipsizeMode="tail" numberOfLines={1} style={[styles.name, isHoveredTarget && styles.hoveredName]}>{name}</Text><Text numberOfLines={1} style={styles.meta}><Text style={{ color: getPositionColor(position) }}>{position}</Text><Text style={styles.teamMeta}> · {team} vs {game.opponent} · {game.time}</Text></Text>{appliedCards.length > 0 && <View style={styles.appliedIcons}>{appliedCards.map((modifier) => <Ionicons color={modifier.card.accent} key={modifier.id} name={modifier.card.icon} size={14} />)}</View>}</View>;
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', borderBottomColor: '#202A28', borderBottomWidth: 1, flexDirection: 'row', minHeight: 66, paddingHorizontal: 10, position: 'relative' },
  playerSide: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 7, minWidth: 0 },
  invalidTarget: { opacity: 0.28 },
  playerPressable: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 7, minWidth: 0 },
  rightPlayer: { justifyContent: 'flex-end' },
  avatar: { alignItems: 'center', backgroundColor: '#29565B', borderRadius: 15, height: 30, justifyContent: 'center', width: 30 },
  opponentAvatar: { backgroundColor: '#554069' },
  validAvatar: { borderColor: colors.accent, borderWidth: 2 },
  avatarImage: { borderRadius: 14, height: 28, width: 28 },
  playerDetails: { flex: 1, minWidth: 0 },
  name: { color: '#F3F6F5', flexShrink: 1, fontSize: 12, fontWeight: '700' },
  hoveredName: { fontSize: 15, textShadowColor: 'rgba(182, 255, 0, 0.65)', textShadowRadius: 8 },
  meta: { color: '#83A49F', fontSize: 9, fontWeight: '700', marginTop: 2 },
  teamMeta: { color: '#BBC5C3' },
  appliedIcons: { flexDirection: 'row', gap: 3, marginTop: 3 },
  // A fixed width prevents decimal scores from wrapping into two lines.
  score: { color: colors.text, flexShrink: 0, fontSize: 12, fontWeight: '800', textAlign: 'center', width: 38 },
  rightScore: { marginRight: 6 },
  position: { color: '#8B9693', fontSize: 8, fontWeight: '800', textAlign: 'center', width: 34 },
});
