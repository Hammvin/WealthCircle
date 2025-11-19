import { FlatList, Text, View } from 'react-native';
import { useChama } from '../../contexts/ChamaContext';

export default function ChamasScreen() {
  const { userChamas, loading, selectChama } = useChama();

  if (loading) {
    return (
      <View>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View>
      <Text>My Chamas</Text>
      <FlatList
        data={userChamas}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View>
            <Text>{item.name}</Text>
            <Text>{item.savings_goal}</Text>
          </View>
        )}
      />
    </View>
  );
}