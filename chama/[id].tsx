import { ChamaService } from '@/lib/chama';
import { ContributionService } from '@/lib/contributions';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { ActivityIndicator, Button, Card, Divider, Text } from 'react-native-paper';

export default function ChamaDetailsScreen() {
  const { id } = useLocalSearchParams();
  const [chama, setChama] = useState(null);
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadChamaDetails();
  }, [id]);

  const loadChamaDetails = async () => {
    if (!id) return;
    
    setLoading(true);
    const [chamaResult, contributionsResult] = await Promise.all([
      ChamaService.getChamaDetails(id as string),
      ContributionService.getChamaContributions(id as string),
    ]);
    
    setLoading(false);
    
    if (chamaResult.success) {
      setChama(chamaResult.chama);
    } else {
      Alert.alert('Error', chamaResult.error);
    }
    
    if (contributionsResult.success) {
      setContributions(contributionsResult.contributions);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChamaDetails();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#6B21A8" />
        <Text className="mt-4 text-gray-600">Loading chama details...</Text>
      </View>
    );
  }

  if (!chama) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text className="text-gray-600">Chama not found</Text>
        <Button mode="contained" onPress={() => router.back()} className="mt-4 bg-purple-600">
          Go Back
        </Button>
      </View>
    );
  }

  return (
    <ScrollView 
      className="flex-1 bg-white"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View className="p-4">
        <Text variant="headlineMedium" className="text-center mb-2 text-purple-600">
          {chama.name}
        </Text>
        
        <Text variant="bodyMedium" className="text-center text-gray-600 mb-6">
          {chama.savings_goal}
        </Text>

        <Card className="mb-6">
          <Card.Content>
            <View className="flex-row justify-between mb-4">
              <View className="items-center flex-1">
                <Text variant="titleLarge" className="font-bold text-purple-700">
                  KSh {chama.total_kitty}
                </Text>
                <Text variant="bodySmall" className="text-gray-500">
                  Total Kitty
                </Text>
              </View>
              
              <View className="w-px bg-gray-300" />
              
              <View className="items-center flex-1">
                <Text variant="titleLarge" className="font-bold text-purple-700">
                  KSh {chama.contribution_amount}
                </Text>
                <Text variant="bodySmall" className="text-gray-500">
                  Per {chama.contribution_cycle}
                </Text>
              </View>
            </View>
            
            <View className="flex-row justify-between">
              <View className="items-center flex-1">
                <Text variant="bodyMedium" className="font-semibold text-gray-700">
                  {chama.members?.length || 0}
                </Text>
                <Text variant="bodySmall" className="text-gray-500">
                  Members
                </Text>
              </View>
              
              <View className="w-px bg-gray-300" />
              
              <View className="items-center flex-1">
                <Text variant="bodyMedium" className="font-semibold text-gray-700">
                  {contributions.length}
                </Text>
                <Text variant="bodySmall" className="text-gray-500">
                  Contributions
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Divider className="my-4" />

        <Text variant="titleLarge" className="mb-4 text-purple-600">
          Members
        </Text>
        
        {chama.members?.map((member, index) => (
          <Card key={index} className="mb-2">
            <Card.Content className="flex-row justify-between items-center">
              <View>
                <Text variant="bodyLarge" className="font-medium">
                  {member.user?.full_name}
                </Text>
                <Text variant="bodySmall" className="text-gray-500 capitalize">
                  {member.role}
                </Text>
              </View>
              <Text variant="bodySmall" className="text-purple-600">
                {member.user?.phone_number}
              </Text>
            </Card.Content>
          </Card>
        ))}

        <Divider className="my-4" />

        <Text variant="titleLarge" className="mb-4 text-purple-600">
          Recent Contributions
        </Text>
        
        {contributions.slice(0, 5).map((contribution, index) => (
          <Card key={contribution.id} className="mb-2">
            <Card.Content className="flex-row justify-between items-center">
              <View>
                <Text variant="bodyMedium" className="font-medium">
                  {contribution.member?.user?.full_name}
                </Text>
                <Text variant="bodySmall" className="text-gray-500">
                  {new Date(contribution.created_at).toLocaleDateString()}
                </Text>
              </View>
              <Text variant="bodyLarge" className="font-semibold text-green-600">
                KSh {contribution.amount}
              </Text>
            </Card.Content>
          </Card>
        ))}

        {contributions.length === 0 && (
          <Text variant="bodyMedium" className="text-gray-500 text-center py-8">
            No contributions yet
          </Text>
        )}
      </View>
    </ScrollView>
  );
}