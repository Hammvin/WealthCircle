import { Text, View } from 'react-native';
import { useAuth } from '../contexts/auth_context';
import { useChama } from '../contexts/ChamaContext';

export default function Dashboard() {
  const { user } = useAuth();
  const { userChamas, loading } = useChama();

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Welcome, {user?.email}</Text>
      <Text>Your Chamas: {userChamas.length}</Text>
    </View>
  );
}