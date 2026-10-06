import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Colors, Fonts, glow, rankFor } from '@/constants/theme';

/** Hunter rank badge: a rotated diamond with a pulsing aura that grows stronger with rank. */
export function RankEmblem({ level, size = 72 }: { level: number; size?: number }) {
  const rank = rankFor(level);
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.15, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1);
  }, []);

  const auraStyle = useAnimatedStyle(() => ({ transform: [{ rotate: '45deg' }, { scale: pulse.value }], opacity: 2 - pulse.value }));
  const inner = size * 0.72;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[styles.diamond, { width: inner, height: inner, borderColor: rank.color + '66' }, auraStyle]}
      />
      <View
        style={[
          styles.diamond,
          { width: inner, height: inner, borderColor: rank.color, transform: [{ rotate: '45deg' }] },
          glow(rank.color, 'strong'),
        ]}
      />
      <Text style={[styles.rank, { color: rank.color, fontSize: size * (rank.rank.length > 1 ? 0.26 : 0.36) }]}>
        {rank.rank}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  diamond: { position: 'absolute', borderWidth: 2, backgroundColor: Colors.surface, borderRadius: 3 },
  rank: { fontFamily: Fonts.display },
});
