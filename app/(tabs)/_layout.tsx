import { Tabs } from 'expo-router';
import React from 'react';

import { AppColors } from '@/src/ui/constants/theme';
import { HapticTab } from '@/src/ui/components/haptic-tab';
import { IconSymbol } from '@/src/ui/components/icon-symbol';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: AppColors.interactive,
        tabBarInactiveTintColor: AppColors.muted,
        tabBarStyle: {
          backgroundColor: AppColors.surface,
          borderTopColor: AppColors.border,
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
