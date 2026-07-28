import Ionicons from '@expo/vector-icons/Ionicons';
import { Dimensions, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRef, useState } from 'react';
import { colors } from '../../theme/colors';
import { PowerCard } from '../../types/fantasy';

// These heights create the tray's three intended resting positions.
const SNAP_POINTS = { collapsed: 48, peek: 154, expanded: 270 } as const;
const MIN_HEIGHT = SNAP_POINTS.collapsed;
const MAX_HEIGHT = SNAP_POINTS.expanded;
const screenCenterX = Dimensions.get('window').width / 2;

/**
 * A resizable tray for the manager's playable cards.
 * Drag its header up to reveal more of the hand, or down to minimize it.
 */
export function HandTray({ cards, isOverValidTarget, onCardDragEnd, onCardDragMove, onCardDragStart, onCardDrop, onCardPress }: { cards: PowerCard[]; isOverValidTarget: boolean; onCardDragEnd: () => void; onCardDragMove: (card: PowerCard, x: number, y: number) => void; onCardDragStart: (card: PowerCard) => void; onCardDrop: (card: PowerCard, x: number, y: number) => void; onCardPress: (card: PowerCard) => void }) {
  const [height, setHeight] = useState<number>(SNAP_POINTS.collapsed);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [activeCardLift, setActiveCardLift] = useState(0);
  // A ref gives PanResponder the newest height without recreating its handlers every render.
  const trayHeight = useRef<number>(SNAP_POINTS.collapsed);
  const dragStartHeight = useRef<number>(SNAP_POINTS.collapsed);

  /** Updates the visual height and the gesture ref together. */
  const setTrayHeight = (nextHeight: number) => {
    trayHeight.current = nextHeight;
    setHeight(nextHeight);
  };

  /** Makes the tray accessible without a drag: tap to collapse or fully open it. */
  const toggleTray = () => setTrayHeight(
    trayHeight.current <= SNAP_POINTS.collapsed + 2 ? SNAP_POINTS.expanded : SNAP_POINTS.collapsed,
  );

  // PanResponder keeps this interaction dependency-free and works in Expo Go.
  const panResponder = useRef(
    PanResponder.create({
      // The handle owns the touch from the beginning, so parent scrolling cannot steal a drag.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStartHeight.current = height;
      },
      onPanResponderMove: (_, gesture) => {
        // Dragging upward produces a negative dy, so subtracting grows the tray.
        const nextHeight = clamp(dragStartHeight.current - gesture.dy, MIN_HEIGHT, MAX_HEIGHT);
        setTrayHeight(nextHeight);
      },
      onPanResponderRelease: (_, gesture) => {
        // A near-stationary release is treated as a simple tap on the handle.
        if (Math.abs(gesture.dy) < 6) {
          toggleTray();
          return;
        }

        // Settle on the closest intentional resting position after a drag ends.
        setTrayHeight(getNearestSnapPoint(trayHeight.current, gesture.vy));
      },
      onPanResponderTerminate: () => {
        setTrayHeight(getNearestSnapPoint(trayHeight.current));
      },
    }),
  ).current;

  const isCollapsed = height <= SNAP_POINTS.collapsed + 2;

  /** Collapses the tray behind the active card to reveal more valid drop targets. */
  const beginCardDrag = (card: PowerCard) => {
    // The tray is bottom-anchored, so compensate for its upward content shift on collapse.
    setActiveCardLift(trayHeight.current - SNAP_POINTS.collapsed);
    setActiveCardId(card.id);
    setTrayHeight(SNAP_POINTS.collapsed);
    onCardDragStart(card);
  };

  /** Removes the temporary floating-card state once the gesture finishes. */
  const finishCardDrag = () => {
    setActiveCardId(null);
    setActiveCardLift(0);
    onCardDragEnd();
  };

  return (
    <>
      {!isCollapsed && !activeCardId && (
        <Pressable
          accessibilityLabel="Close card inventory"
          onPress={() => setTrayHeight(SNAP_POINTS.collapsed)}
          style={styles.dismissLayer}
        />
      )}
      <View style={[styles.tray, { height }]}>
        <View {...panResponder.panHandlers} accessibilityRole="button" accessibilityLabel="Toggle your hand" style={styles.handle}>
          <View style={styles.grabber} />
          <Text style={styles.title}>INVENTORY ({cards.reduce((total, card) => total + card.quantity, 0)})</Text>
          <Ionicons color={colors.textSecondary} name={isCollapsed ? 'chevron-up' : 'chevron-down'} size={18} />
        </View>

        {(!isCollapsed || activeCardId) && <>
          <View style={styles.cards}>
            {cards.map((card) => <HandCard card={card} hidden={isCollapsed && card.id !== activeCardId} isOverValidTarget={card.id === activeCardId && isOverValidTarget} key={card.id} lift={card.id === activeCardId ? activeCardLift : 0} onDragEnd={finishCardDrag} onDragMove={onCardDragMove} onDragStart={beginCardDrag} onDrop={onCardDrop} onPress={onCardPress} />)}
          </View>
          {!activeCardId && <Text style={styles.hint}>Drag a card onto a player, or drag this header up or down</Text>}
        </>}
      </View>
    </>
  );
}

/** Returns a value constrained to the tray's allowed size range. */
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** Finds the closest state, while a quick flick moves all the way in its direction. */
function getNearestSnapPoint(height: number, velocityY = 0) {
  if (velocityY <= -0.7) return SNAP_POINTS.expanded;
  if (velocityY >= 0.7) return SNAP_POINTS.collapsed;

  return Object.values(SNAP_POINTS).reduce((closest, snapPoint) => (
    Math.abs(snapPoint - height) < Math.abs(closest - height) ? snapPoint : closest
  ));
}

/** Draggable card preview that reports its release position to the matchup screen. */
function HandCard({ card, hidden, isOverValidTarget, lift, onDragEnd, onDragMove, onDragStart, onDrop, onPress }: { card: PowerCard; hidden: boolean; isOverValidTarget: boolean; lift: number; onDragEnd: () => void; onDragMove: (card: PowerCard, x: number, y: number) => void; onDragStart: (card: PowerCard) => void; onDrop: (card: PowerCard, x: number, y: number) => void; onPress: (card: PowerCard) => void }) {
  const [translation, setTranslation] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [pointerX, setPointerX] = useState(screenCenterX);
  // Fan the card from the bottom-center of the screen rather than from its original slot.
  const rotation = Math.max(-9, Math.min(9, (pointerX - screenCenterX) / 18));
  const cardPanResponder = useRef(PanResponder.create({
    // Claim taps as well as drags so a stationary press can open card details.
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3,
    onPanResponderGrant: (_, gesture) => { setPointerX(gesture.x0); setIsDragging(true); onDragStart(card); },
    onPanResponderMove: (_, gesture) => { setPointerX(gesture.moveX); setTranslation({ x: gesture.dx, y: gesture.dy }); onDragMove(card, gesture.moveX, gesture.moveY); },
    onPanResponderRelease: (_, gesture) => {
      setPointerX(screenCenterX); setTranslation({ x: 0, y: 0 });
      setIsDragging(false);
      if (Math.abs(gesture.dx) < 3 && Math.abs(gesture.dy) < 3) {
        onDragEnd();
        onPress(card);
        return;
      }
      onDrop(card, gesture.moveX, gesture.moveY);
      // Preserve the measured target through onDrop, then clear drag state.
      onDragEnd();
    },
    onPanResponderTerminate: () => { setPointerX(screenCenterX); setTranslation({ x: 0, y: 0 }); setIsDragging(false); onDragEnd(); },
  })).current;

  return (
    <View {...cardPanResponder.panHandlers} pointerEvents={hidden ? "none" : "auto"} style={[styles.card, { borderColor: card.accent, transform: [{ translateX: translation.x }, { translateY: translation.y - lift }, { scale: isDragging ? 1.12 : 1 }, { rotate: `${rotation}deg` }] }, hidden && styles.hiddenCard, isDragging && styles.draggingCard, isOverValidTarget && styles.armedCard]}>
      {!isDragging && <View style={[styles.quantityBadge, { borderColor: card.accent }]}><Text style={styles.quantityText}>{card.quantity}</Text></View>}
      <View style={[styles.cardGlow, { backgroundColor: card.accent }]} />
      {isOverValidTarget && <View pointerEvents="none" style={styles.mutedOverlay} />}
      <Ionicons color={card.accent} name={card.icon} size={36} />
      <Text style={[styles.cardLabel, { color: card.accent }]}>{card.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dismissLayer: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0, zIndex: 9 },
  tray: { backgroundColor: '#0A1010', borderColor: '#263330', borderRadius: 16, borderWidth: 1, elevation: 10, overflow: 'visible', zIndex: 10 },
  handle: { alignItems: 'center', flexDirection: 'row', height: SNAP_POINTS.collapsed, justifyContent: 'space-between', paddingHorizontal: 16 },
  grabber: { backgroundColor: '#4A5654', borderRadius: 3, height: 4, left: '50%', marginLeft: -18, position: 'absolute', top: 7, width: 36 },
  title: { color: colors.text, fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', paddingHorizontal: 12, paddingTop: 4 },
  card: { alignItems: 'center', backgroundColor: '#101516', borderRadius: 9, borderWidth: 1, height: 86, justifyContent: 'center', overflow: 'hidden', width: 62 },
  quantityBadge: { alignItems: 'center', backgroundColor: '#101516', borderRadius: 10, borderWidth: 1, height: 20, justifyContent: 'center', left: 4, position: 'absolute', top: 4, width: 20 },
  quantityText: { color: colors.text, fontSize: 10, fontWeight: '900' },
  draggingCard: { elevation: 30, opacity: 0.95, shadowColor: '#000000', shadowOffset: { height: 8, width: 0 }, shadowOpacity: 0.55, shadowRadius: 12, zIndex: 30 },
  hiddenCard: { opacity: 0 },
  armedCard: { opacity: 0.68 },
  mutedOverlay: { backgroundColor: 'rgba(112, 123, 120, 0.35)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  cardGlow: { height: 2, opacity: 0.8, position: 'absolute', top: 0, width: '100%' },
  cardLabel: { fontSize: 8, fontWeight: '900', marginTop: 4 },
  hint: { color: '#70807C', fontSize: 10, marginTop: 9, textAlign: 'center' },
});
