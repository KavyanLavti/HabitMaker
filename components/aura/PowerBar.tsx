import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';

interface Props {
  progress: number; // 0-1
  level: number;
  pointsPerLevel: number;
  lifetimePoints: number;
}

export function PowerBar({ progress, level, pointsPerLevel, lifetimePoints }: Props) {
  const fillAnim = useSharedValue(0);

  useEffect(() => {
    fillAnim.value = withTiming(progress, { duration: 800 });
  }, [progress]);

  const fillStyle = useAnimatedStyle(() => ({
    height: `${fillAnim.value * 100}%`,
  }));

  const nextLevelPoints = level * pointsPerLevel;
  const currentLevelPoints = lifetimePoints % pointsPerLevel;

  return (
    <View style={styles.container}>
      <View style={styles.barBg}>
        <Animated.View style={[styles.barFill, fillStyle]} />
      </View>
      <View style={styles.labels}>
        <Text style={styles.lvlNext}>LV {level + 1}</Text>
        <Text style={styles.pts}>{currentLevelPoints}/{pointsPerLevel}</Text>
        <Text style={styles.lvlCur}>LV {level}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barBg: {
    width: 16,
    height: 120,
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 8,
  },
  labels: { justifyContent: 'space-between', height: 120 },
  lvlNext: { fontFamily: 'DMSans', fontSize: 10, color: Colors.textMuted },
  pts: { fontFamily: 'DMSansBold', fontSize: 11, color: Colors.accent },
  lvlCur: { fontFamily: 'DMSans', fontSize: 10, color: Colors.textMuted },
});
