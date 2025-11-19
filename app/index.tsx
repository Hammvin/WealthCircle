import { Redirect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAuth } from '../contexts/auth_context';

export default function Index() {
  const { user, isLoading } = useAuth();

  // Show loading indicator
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0ea5e9" />
        <Text style={{ marginTop: 10, color: '#6b7280' }}>Loading WealthCircle...</Text>
      </View>
    );
  }

  // Redirect based on authentication status
  if (user) {
    return <Redirect href="./dashboard" />;
  } else {
    return <Redirect href="./welcome" />;
  }
}