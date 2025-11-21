import { SplashScreen, Stack } from 'expo-router';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../contexts/auth_context';
import { ChamaProvider } from '../contexts/ChamaContext';
import '../lib/polyfills';


SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="chamas" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="change-password" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ChamaProvider>
        <RootLayoutNav />
      </ChamaProvider>
    </AuthProvider>
  );
}