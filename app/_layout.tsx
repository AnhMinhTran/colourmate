import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import 'react-native-reanimated';

import {
  Cinzel_400Regular,
  Cinzel_700Bold,
} from '@expo-google-fonts/cinzel';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import { migrateDb } from '@/src/infrastructure/db/migrate';
import { seedColours } from '@/src/infrastructure/seed/seedColours';
import {
  ACCENT_GOLD,
  BG_PRIMARY,
  BG_CARD,
  BORDER_DEFAULT,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/src/ui/constants/theme';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

/**
 * Custom dark theme that uses the Warhammer-inspired palette.
 * Extends React Navigation's DarkTheme so all navigator chrome
 * (headers, cards, borders) picks up the correct colours.
 */
const WarhammerTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: ACCENT_GOLD,
    background: BG_PRIMARY,
    card: BG_CARD,
    text: TEXT_PRIMARY,
    border: BORDER_DEFAULT,
    notification: ACCENT_GOLD,
  },
};

/**
 * Handles DB migration and seed data before the main app renders.
 *
 * @param children - The child tree to render once the DB is ready.
 * @returns Loading spinner while bootstrapping, error view on failure,
 *          or the child tree on success.
 */
function AppLoader({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [status, setStatus] = useState('Starting...');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setStatus('Running migrations...');
        await migrateDb(db);
        setStatus('Seeding colours...');
        await seedColours(db);
        setStatus('Done');
        setReady(true);
      } catch (e) {
        setError(String(e));
      } finally {
        SplashScreen.hideAsync();
      }
    })();
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: BG_PRIMARY }}>
        <Text style={{ color: '#C45C5C', fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Startup Error</Text>
        <Text style={{ color: TEXT_PRIMARY, fontSize: 13, textAlign: 'center' }}>{error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG_PRIMARY }}>
        <ActivityIndicator size="large" color={ACCENT_GOLD} />
        <Text style={{ color: TEXT_SECONDARY, marginTop: 16, fontSize: 14 }}>{status}</Text>
      </View>
    );
  }

  return <>{children}</>;
}

/**
 * Root layout – loads custom fonts, wraps with SQLite provider,
 * and applies the Warhammer dark theme to all navigation chrome.
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Cinzel: Cinzel_400Regular,
    Cinzel_Bold: Cinzel_700Bold,
    Inter: Inter_400Regular,
    Inter_Medium: Inter_500Medium,
    Inter_SemiBold: Inter_600SemiBold,
    Inter_Bold: Inter_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SQLiteProvider databaseName="colourmate.db">
      <AppLoader>
        <GestureHandlerRootView>
          <ThemeProvider value={WarhammerTheme}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              <Stack.Screen
                name="colour/[id]"
                options={{
                  title: 'Color Details',
                  headerStyle: { backgroundColor: BG_CARD },
                  headerTintColor: ACCENT_GOLD,
                  headerTitleStyle: { color: TEXT_PRIMARY },
                }}
              />
              <Stack.Screen name="recipe/[id]" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style="light" />
          </ThemeProvider>
        </GestureHandlerRootView>
      </AppLoader>
    </SQLiteProvider>
  );
}
