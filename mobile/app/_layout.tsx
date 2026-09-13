import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '../store/authStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isAuthenticated, user } = useAuthStore();

  const [fontsLoaded] = useFonts({
    // Using system fonts for now; add custom fonts here if needed
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    if (!fontsLoaded) return;

    if (!isAuthenticated) {
      router.replace('/(auth)');
      return;
    }

    if (user?.role === 'student') {
      router.replace('/(student)');
    } else if (user?.role === 'mess_staff' || user?.role === 'admin') {
      router.replace('/(staff)');
    }
  }, [isAuthenticated, user, fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(student)" />
        <Stack.Screen name="(staff)" />
      </Stack>
    </>
  );
}
