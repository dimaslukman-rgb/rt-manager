import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

/**
 * Aurora Glass accent — translucent glass card.
 *
 * On web, react-native-web 0.21 supports `experimental_backdropFilter` for a real
 * frosted-glass blur; React Native's ViewStyle type does not declare that key, so
 * the web-only style object is cast with `as any`.
 * On native it degrades gracefully to a translucent background + soft shadow.
 */
export function GlassCard({ children, style }: { children: React.ReactNode; style?: object }) {
  const scheme = useColorScheme();
  const blurStyle =
    Platform.OS === 'web'
      ? ({ experimental_backdropFilter: 'blur(12px)' } as any)
      : null;
  return (
    <View
      style={[
        styles.glass,
        {
          backgroundColor: Colors[scheme].glassCard,
          borderColor: Colors[scheme].glassBorder,
        },
        blurStyle,
        style,
      ]}>
      {children}
    </View>
  );
}

/**
 * Aurora Glass accent — staggered drop-in entrance.
 * Children slide/fade in with a delay of `index * 80` ms.
 * Respects the system "reduce motion" setting (renders without animation).
 */
export function StaggerIn({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children: React.ReactNode;
  style?: object;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return <View style={style}>{children}</View>;
  }
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 80).duration(500)}
      style={style as any}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glass: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#1a2030',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
});
