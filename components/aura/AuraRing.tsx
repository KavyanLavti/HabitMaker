import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withDelay
} from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';

interface Props {
  level: number;
  displayName: string;
  size?: number;
}

function getAuraConfig(level: number) {
  if (level >= 20) return { rings: 3, color: Colors.accent, speed: 600, label: 'CORONA' };
  if (level >= 10) return { rings: 3, color: '#FF8C42', speed: 800, label: 'EMBER' };
  if (level >= 5) return { rings: 2, color: '#F5B942', speed: 1200, label: 'AMBER' };
  return { rings: 1, color: '#6B9EBF', speed: 2000, label: 'FORGE' };
}

function Ring({ color, delay, scale: baseScale, size }: { color: string; delay: number; scale: number; size: number }) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(1.12, { duration: 900 }), withTiming(1, { duration: 900 })),
        -1
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value * baseScale }],
    opacity: 0.4 / baseScale,
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: color,
        },
      ]}
    />
  );
}

export function AuraRing({ level, displayName, size = 100 }: Props) {
  const config = getAuraConfig(level);

  return (
    <View style={[styles.container, { width: size + 80, height: size + 80 }]}>
      {config.rings >= 1 && <Ring color={config.color} delay={0} scale={1.4} size={size} />}
      {config.rings >= 2 && <Ring color={config.color} delay={300} scale={1.7} size={size} />}
      {config.rings >= 3 && <Ring color={config.color} delay={600} scale={2.0} size={size} />}
      <View style={[styles.core, { width: size, height: size, borderRadius: size / 2, borderColor: config.color }]}>
        <Text style={[styles.levelNum, { color: config.color }]}>{level}</Text>
        <Text style={styles.levelLabel}>{config.label}</Text>
      </View>
      <Text style={styles.name}>{displayName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  core: {
    backgroundColor: Colors.surface,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNum: { fontFamily: 'BebasNeue', fontSize: 36 },
  levelLabel: { fontFamily: 'DMSans', fontSize: 9, color: Colors.textMuted, letterSpacing: 2 },
  name: {
    marginTop: 60,
    fontFamily: 'DMSansBold',
    fontSize: 14,
    color: Colors.textPrimary,
    position: 'absolute',
    bottom: -10,
  },
});
