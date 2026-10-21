// Full-screen System celebrations: quest cleared, streak frozen, level up, slip.
// Built from a few reusable pieces: shockwave rings, a particle burst, a spinning emblem and staggered text.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import Animated, {
  Easing, FadeIn, FadeOut, interpolate, useAnimatedStyle, useSharedValue,
  withDelay, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Space, glow } from '@/constants/theme';
import { useFxStore, FxEvent } from '@/store/fxStore';

const { width: W } = Dimensions.get('window');
const DURATION: Record<FxEvent['kind'], number> = { cleared: 2800, frozen: 3200, levelup: 3400, slip: 2400 };

export function CelebrationOverlay() {
  const event = useFxStore((s) => s.queue[0]);
  const shift = useFxStore((s) => s.shift);

  useEffect(() => {
    if (!event) return;
    if (event.kind === 'slip') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const t = setTimeout(shift, DURATION[event.kind]);
    return () => clearTimeout(t);
  }, [event]);

  if (!event) return null;
  const color =
    event.kind === 'cleared' ? (event.avoid ? Colors.shadow : Colors.success)
    : event.kind === 'frozen' ? Colors.frost
    : event.kind === 'levelup' ? Colors.shadow
    : Colors.danger;

  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(250)} style={StyleSheet.absoluteFill}>
      <Pressable style={styles.backdrop} onPress={shift}>
        {/* Keyed so every event replays its animations from scratch */}
        <Scene key={JSON.stringify(event)} event={event} color={color} />
        <Text style={styles.tap}>TAP TO CONTINUE</Text>
      </Pressable>
    </Animated.View>
  );
}

function Scene({ event, color }: { event: FxEvent; color: string }) {
  const icon: React.ComponentProps<typeof Ionicons>['name'] =
    event.kind === 'cleared' ? (event.avoid ? 'shield-checkmark' : 'checkmark')
    : event.kind === 'frozen' ? 'snow'
    : event.kind === 'levelup' ? 'arrow-up'
    : 'alert';

  return (
    <View style={styles.scene}>
      <View style={styles.burst}>
        {event.kind !== 'slip' && [0, 180, 360].map((d) => <Shockwave key={d} delay={d} color={color} />)}
        {event.kind !== 'slip' && <Particles color={color} shards={event.kind === 'frozen'} />}
        {event.kind === 'levelup' && <LightBeam color={color} />}
        <Emblem color={color} icon={icon} shake={event.kind === 'slip'} />
      </View>
      <Content event={event} color={color} />
    </View>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function Shockwave({ delay, color }: { delay: number; color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.15, 1], [0, 0.9, 0]),
    transform: [{ scale: interpolate(p.value, [0, 1], [0.3, 2.6]) }, { rotate: '45deg' }],
  }));
  return <Animated.View style={[styles.ring, { borderColor: color }, style]} />;
}

function Particles({ color, shards }: { color: string; shards: boolean }) {
  const parts = useMemo(
    () => Array.from({ length: 22 }, (_, i) => ({
      angle: (i / 22) * Math.PI * 2 + Math.random() * 0.4,
      dist: 90 + Math.random() * 90,
      size: shards ? 6 + Math.random() * 8 : 3 + Math.random() * 5,
      delay: Math.random() * 160,
      spin: (Math.random() - 0.5) * 540,
    })),
    []
  );
  return <>{parts.map((pt, i) => <Particle key={i} {...pt} color={color} shard={shards} />)}</>;
}

function Particle({ angle, dist, size, delay, spin, color, shard }: {
  angle: number; dist: number; size: number; delay: number; spin: number; color: string; shard: boolean;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(120 + delay, withTiming(1, { duration: 1200, easing: Easing.out(Easing.quad) }));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.1, 0.7, 1], [0, 1, 0.8, 0]),
    transform: [
      { translateX: Math.cos(angle) * dist * p.value },
      // A little gravity at the end
      { translateY: Math.sin(angle) * dist * p.value + 40 * p.value * p.value },
      { rotate: `${spin * p.value}deg` },
      { scale: interpolate(p.value, [0, 1], [1, 0.4]) },
    ],
  }));
  return (
    <Animated.View
      style={[
        { position: 'absolute', width: size, height: shard ? size * 2.2 : size, backgroundColor: color, borderRadius: shard ? 1 : size / 2 },
        glow(color),
        style,
      ]}
    />
  );
}

function LightBeam({ color }: { color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withSequence(withTiming(1, { duration: 500 }), withDelay(900, withTiming(0, { duration: 700 })));
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: p.value * 0.55, transform: [{ scaleY: 0.3 + p.value * 0.7 }] }));
  return <Animated.View style={[styles.beam, { backgroundColor: color }, style]} />;
}

function Emblem({ color, icon, shake }: { color: string; icon: React.ComponentProps<typeof Ionicons>['name']; shake: boolean }) {
  const scale = useSharedValue(0);
  const rot = useSharedValue(-180);
  const x = useSharedValue(0);
  const pulse = useSharedValue(1);
  useEffect(() => {
    scale.value = withSpring(1, { damping: 9, stiffness: 140 });
    rot.value = withSpring(45, { damping: 12 });
    pulse.value = withDelay(600, withRepeat(withSequence(withTiming(1.08, { duration: 500 }), withTiming(1, { duration: 500 })), -1));
    if (shake) x.value = withDelay(250, withSequence(...[10, -10, 8, -8, 4, 0].map((v) => withTiming(v, { duration: 60 }))));
  }, []);
  const box = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { scale: scale.value * pulse.value }, { rotate: `${rot.value}deg` }],
  }));
  const inner = useAnimatedStyle(() => ({ transform: [{ rotate: `${-rot.value}deg` }] }));
  return (
    <Animated.View style={[styles.emblem, { borderColor: color }, glow(color, 'strong'), box]}>
      <Animated.View style={inner}>
        <Ionicons name={icon} size={46} color={color} />
      </Animated.View>
    </Animated.View>
  );
}

/** Text that rises in after `delay` ms. */
function Rise({ delay, children }: { delay: number; children: React.ReactNode }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withSpring(1, { damping: 14 }));
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * 24 }] }));
  return <Animated.View style={[{ alignItems: 'center' }, style]}>{children}</Animated.View>;
}

function CountUp({ to, delay, style }: { to: number; delay: number; style: any }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf: ReturnType<typeof setInterval>;
    const start = setTimeout(() => {
      const t0 = Date.now();
      raf = setInterval(() => {
        const k = Math.min(1, (Date.now() - t0) / 700);
        setN(Math.round(to * (1 - Math.pow(1 - k, 3))));
        if (k >= 1) clearInterval(raf);
      }, 30);
    }, delay);
    return () => { clearTimeout(start); clearInterval(raf); };
  }, [to]);
  return <Text style={style}>+{n}</Text>;
}

function Content({ event, color }: { event: FxEvent; color: string }) {
  switch (event.kind) {
    case 'cleared':
      return (
        <View style={styles.text}>
          <Rise delay={250}><Text style={[styles.kicker, { color }]}>[{event.avoid ? 'STAYED CLEAN' : 'QUEST CLEARED'}]</Text></Rise>
          <Rise delay={350}><Text style={styles.title}>{event.title}</Text></Rise>
          <Rise delay={500}>
            <View style={styles.statRow}>
              <CountUp to={event.points} delay={500} style={[styles.points, { color: Colors.gold }]} />
              <Text style={styles.unit}>PTS</Text>
              <Text style={[styles.streak]}>🔥 {event.streak}</Text>
            </View>
          </Rise>
          {event.freezeEarned && (
            <Rise delay={800}><Text style={[styles.line, { color: Colors.frost }]}>❄ STREAK FREEZE EARNED</Text></Rise>
          )}
          {event.bonuses.map((b, i) => (
            <Rise key={b} delay={950 + i * 150}><Text style={[styles.line, { color: Colors.ember }]}>⚡ {b}</Text></Rise>
          ))}
        </View>
      );
    case 'frozen':
      return (
        <View style={styles.text}>
          <Rise delay={250}><Text style={[styles.kicker, { color }]}>[STREAK PROTECTED]</Text></Rise>
          <Rise delay={350}><Text style={styles.title}>FREEZE ACTIVATED</Text></Rise>
          {event.saves.map((s, i) => (
            <Rise key={s.name} delay={550 + i * 140}>
              <Text style={styles.line}>❄ {s.name} · {s.streak}-day streak survived</Text>
            </Rise>
          ))}
          <Rise delay={700 + event.saves.length * 140}>
            <Text style={styles.sub}>You missed a day. A freeze covered it.</Text>
          </Rise>
        </View>
      );
    case 'levelup':
      return (
        <View style={styles.text}>
          <Rise delay={300}><Text style={[styles.kicker, { color }]}>[LEVEL UP]</Text></Rise>
          <Rise delay={420}><Text style={[styles.big, { color }]}>LV {event.level}</Text></Rise>
          {event.rankFrom !== event.rankTo && (
            <Rise delay={700}><Text style={[styles.line, { color: Colors.gold }]}>RANK UP · {event.rankFrom} → {event.rankTo}</Text></Rise>
          )}
          <Rise delay={850}><Text style={styles.sub}>The System acknowledges your growth.</Text></Rise>
        </View>
      );
    case 'slip':
      return (
        <View style={styles.text}>
          <Rise delay={200}><Text style={[styles.kicker, { color }]}>[LOGGED]</Text></Rise>
          <Rise delay={300}><Text style={styles.title}>{event.name}</Text></Rise>
          <Rise delay={450}>
            <Text style={styles.sub}>
              {event.freezes > 0
                ? `Honesty noted. A freeze (${event.freezes} left) will protect your streak tonight.`
                : 'Honesty noted. The streak resets, but tomorrow is a new day.'}
            </Text>
          </Rise>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2,4,10,0.93)', alignItems: 'center', justifyContent: 'center' },
  scene: { alignItems: 'center', width: W },
  burst: { width: 260, height: 260, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 110, height: 110, borderWidth: 2, borderRadius: 6 },
  beam: { position: 'absolute', width: 70, height: 900, borderRadius: 35 },
  emblem: {
    width: 104, height: 104, borderRadius: 8, borderWidth: 2,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  text: { alignItems: 'center', paddingHorizontal: Space.xl, gap: 6 },
  kicker: { fontFamily: Fonts.display, fontSize: 14, letterSpacing: 3 },
  title: { fontFamily: Fonts.display, fontSize: 26, letterSpacing: 2, color: Colors.textPrimary, textAlign: 'center' },
  big: { fontFamily: Fonts.display, fontSize: 56, letterSpacing: 3 },
  statRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  points: { fontFamily: Fonts.display, fontSize: 40 },
  unit: { fontFamily: Fonts.displaySemi, fontSize: 13, color: Colors.textMuted, marginRight: Space.md },
  streak: { fontFamily: Fonts.display, fontSize: 24, color: Colors.ember },
  line: { fontFamily: Fonts.displaySemi, fontSize: 14, letterSpacing: 1.2, color: Colors.textPrimary, textAlign: 'center' },
  sub: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },
  tap: { position: 'absolute', bottom: 60, fontFamily: Fonts.displaySemi, fontSize: 10, letterSpacing: 2, color: Colors.textMuted },
});
