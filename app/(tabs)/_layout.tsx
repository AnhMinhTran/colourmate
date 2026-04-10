import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/src/ui/components/haptic-tab';
import { IconSymbol } from '@/src/ui/components/icon-symbol';
import {
  ACCENT_GOLD,
  BG_PRIMARY,
  BORDER_DEFAULT,
  TAB_BAR_BG,
  TEXT_MUTED,
} from '@/src/ui/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: ACCENT_GOLD,
        tabBarInactiveTintColor: TEXT_MUTED,
        tabBarStyle: {
          backgroundColor: TAB_BAR_BG,
          borderTopColor: BORDER_DEFAULT,
          borderTopWidth: 1,
        },
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
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="eyedropper" color={color} />,
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
        name="recipes"
        options={{
          title: 'Recipes',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="paintbrush.fill" color={color} />,
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
