import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/src/ui/components/haptic-tab';
import { IconSymbol } from '@/src/ui/components/icon-symbol';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: '#4A90D9',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inventory',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="paintpalette.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="colourPicker"
        options={{
          title: 'Colour Sampler',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="eyedropper.halffull" color={color} />,
        }}
      />
      <Tabs.Screen
        name="munsell3d"
        options={{
          title: '3D View',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="cube.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
