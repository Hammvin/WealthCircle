import { SplashScreen, Stack } from 'expo-router';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../contexts/auth_context';
import { ChamaProvider } from '../contexts/ChamaContext';

// Prevent the splash screen from auto-hiding
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
      <Stack.Screen name="contributions" />
      <Stack.Screen name="payouts" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="change-password" />
      <Stack.Screen name="test-db" />
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