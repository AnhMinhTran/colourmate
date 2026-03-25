import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useColorScheme } from '@/src/ui/hooks/use-color-scheme.web';
import { migrateDb } from '@/src/infrastructure/db/migrate';
import { seedColours } from '@/src/infrastructure/seed/seedColours';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SQLiteProvider databaseName="colourmate.db" onInit={async (db) => { await migrateDb(db); await seedColours(db); }}>
      <GestureHandlerRootView>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </GestureHandlerRootView>
    </SQLiteProvider>
  );
}
