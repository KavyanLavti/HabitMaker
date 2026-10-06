import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function icon(name: IconName, active: IconName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? active : name} size={22} color={color} />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.systemDim,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarActiveTintColor: Colors.system,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontFamily: Fonts.displaySemi, fontSize: 10, letterSpacing: 1.2 },
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'TODAY', tabBarIcon: icon('flash-outline', 'flash') }} />
      <Tabs.Screen name="quests" options={{ title: 'QUESTS', tabBarIcon: icon('list-outline', 'list') }} />
      <Tabs.Screen name="gate" options={{ title: 'GATE', tabBarIcon: icon('lock-closed-outline', 'lock-closed') }} />
      <Tabs.Screen name="rewards" options={{ title: 'SHOP', tabBarIcon: icon('diamond-outline', 'diamond') }} />
      <Tabs.Screen name="status" options={{ title: 'STATUS', tabBarIcon: icon('person-outline', 'person') }} />
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}
