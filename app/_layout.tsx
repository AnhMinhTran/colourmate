import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import 'react-native-reanimated';

import { useColorScheme } from '@/src/ui/hooks/use-color-scheme.web';
import { migrateDb } from '@/src/infrastructure/db/migrate';
import { seedColours } from '@/src/infrastructure/seed/seedColours';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#111' }}>
        <Text style={{ color: '#ff4444', fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Startup Error</Text>
        <Text style={{ color: '#fff', fontSize: 13, textAlign: 'center' }}>{error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' }}>
        <ActivityIndicator size="large" color="#4A90D9" />
        <Text style={{ color: '#fff', marginTop: 16, fontSize: 14 }}>{status}</Text>
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SQLiteProvider databaseName="colourmate.db">
      <AppLoader>
        <GestureHandlerRootView>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              <Stack.Screen name="colour/[id]" options={{ title: 'Color Details' }} />
              <Stack.Screen name="recipe/[id]" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </GestureHandlerRootView>
      </AppLoader>
    </SQLiteProvider>
  );
}
