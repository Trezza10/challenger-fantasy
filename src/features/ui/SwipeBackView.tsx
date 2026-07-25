import { ReactNode, useEffect, useMemo, useRef } from 'react';
import { PanResponder, View, ViewProps } from 'react-native';

interface SwipeBackViewProps {
  children: ReactNode;
  onBack: () => void;
  style?: ViewProps['style'];
}

/**
 * Adds a familiar edge-swipe back gesture without taking over normal scrolling.
 * A gesture must start in the left edge and travel decisively to the right.
 */
export function SwipeBackView({ children, onBack, style }: SwipeBackViewProps) {
  const onBackRef = useRef(onBack);
  const hasTriggered = useRef(false);

  useEffect(() => { onBackRef.current = onBack; }, [onBack]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => gesture.x0 <= 32 && gesture.dx > 12 && gesture.dx > Math.abs(gesture.dy) * 1.5,
    onPanResponderGrant: () => { hasTriggered.current = false; },
    onPanResponderRelease: (_, gesture) => {
      if (!hasTriggered.current && gesture.dx >= 88 && gesture.dx > Math.abs(gesture.dy) * 1.5) {
        hasTriggered.current = true;
        onBackRef.current();
      }
    },
    onPanResponderTerminate: () => { hasTriggered.current = false; },
  }), []);

  return <View {...panResponder.panHandlers} style={style}>{children}</View>;
}
