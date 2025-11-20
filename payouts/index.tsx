import { useChama } from '@/contexts/ChamaContext';
import { PayoutService } from '@/lib/payouts';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { ActivityIndicator, Card, FAB, Text } from 'react-native-paper';

export default function PayoutManagementScreen() {
  const { currentChama } = useChama();
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPayouts();
  }, [currentChama]);

  const loadPayouts = async () => {
    if (!currentChama) return;
    
    setLoading(true);
    const result = await PayoutService.getChamaPayouts(currentChama.id);
    setLoading(false);
    
    if (result.success) {
      setPayouts(result.payouts);
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPayouts();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#10B981';
      case 'rejected': return '#EF4444';
      case 'pending': return '#F59E0B';
      case 'disbursed': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#6B21A8" />
        <Text className="mt-4 text-gray-600">Loading payouts...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <ScrollView 
        className="p-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text variant="headlineMedium" className="text-center mb-6 text-purple-600">
          Payouts & Loans
        </Text>

        {payouts.length === 0 ? (
          <View className="items-center py-12">
            <Text variant="bodyLarge" className="text-gray-500 text-center mb-4">
              No payout requests yet
            </Text>
            <Text variant="bodyMedium" className="text-gray-400 text-center">
              Create your first payout or loan request to get started
            </Text>
          </View>
        ) : (
          payouts.map((payout) => (
            <Card key={payout.id} className="mb-4">
              <Card.Content>
                <View className="flex-row justify-between items-start mb-2">
                  <Text variant="titleMedium" className="flex-1">
                    {payout.member?.user?.full_name}
                  </Text>
                  <View 
                    className="px-2 py-1 rounded"
                    style={{ backgroundColor: `${getStatusColor(payout.status)}20` }}
                  >
                    <Text 
                      style={{ color: getStatusColor(payout.status) }}
                      className="text-xs font-medium capitalize"
                    >
                      {payout.status}
                    </Text>
                  </View>
                </View>
                
                <Text variant="bodyMedium" className="text-gray-600 mb-1">
                  {payout.purpose}
                </Text>
                
                <View className="flex-row justify-between items-center mt-2">
                  <Text variant="bodyLarge" className="font-semibold text-purple-700">
                    KSh {payout.amount}
                  </Text>
                  <Text variant="bodySmall" className="text-gray-500 capitalize">
                    {payout.request_type}
                  </Text>
                </View>

                {payout.votes && payout.votes.length > 0 && (
                  <View className="mt-3 pt-3 border-t border-gray-200">
                    <Text variant="bodySmall" className="text-gray-500 mb-1">
                      Votes ({payout.votes.length}):
                    </Text>
                    <View className="flex-row flex-wrap">
                      {payout.votes.map((vote, index) => (
                        <View key={index} className="flex-row items-center mr-3 mb-1">
                          <View 
                            className={`w-2 h-2 rounded-full mr-1 ${
                              vote.vote === 'approve' ? 'bg-green-500' : 'bg-red-500'
                            }`}
                          />
                          <Text variant="bodySmall" className="text-gray-600">
                            {vote.member?.user?.full_name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      <FAB
        icon="plus"
        className="absolute bottom-4 right-4 bg-purple-600"
        onPress={() => router.push('./payouts/request')}
      />
    </View>
  );
}