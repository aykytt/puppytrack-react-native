import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import {
  useFonts,
  DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  Fraunces_700Bold, Fraunces_900Black,
} from '@expo-google-fonts/fraunces';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/lib/AuthContext';
import { LangProvider } from '../src/lib/LangContext';

SplashScreen.preventAutoHideAsync();

function RootGuard() {
  const { user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (user === undefined) return;
    const inAuth = segments[0] === '(auth)' || segments[0] === 'auth';
    if (!user && !inAuth) router.replace('/(auth)/login');
    else if (user && inAuth) router.replace('/(tabs)/');
  }, [user, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold,
    Fraunces_700Bold, Fraunces_900Black,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <LangProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootGuard />
      </AuthProvider>
    </LangProvider>
  );
}
