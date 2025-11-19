import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/auth_context';
import { ChamaMember, chamaService } from '../services/chama-service';

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [chamas, setChamas] = useState<ChamaMember[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load user's chamas
  const loadChamas = async () => {
    if (!user) return;
    
    try {
      const result = await chamaService.getUserChamas(user.id);
      if (result.success) {
        setChamas(result.data || []);
      }
    } catch (error) {
      console.error('Error loading chamas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadChamas();
    }
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChamas();
    setRefreshing(false);
  };

  const formatCurrency = (amount: number) => {
    return `KSh ${amount?.toLocaleString() || '0'}`;
  };

  const handleLogout = async () => {
    await logout();
    router.replace('./welcome');
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text className="text-lg text-primary-600">Loading your Chamas...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-primary-600 px-6 pt-12 pb-6">
        <View className="flex-row justify-between items-center mb-4">
          <View>
            <Text className="text-white text-lg">Welcome back,</Text>
            <Text className="text-white text-2xl font-bold">{user?.full_name}</Text>
          </View>
          <TouchableOpacity 
            onPress={handleLogout}
            className="bg-primary-700 px-4 py-2 rounded-lg"
          >
            <Text className="text-white text-sm">Logout</Text>
          </TouchableOpacity>
        </View>
        
        <Text className="text-primary-200 text-sm">
          {chamas.length} Chama{chamas.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView 
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Chama List */}
        {chamas.map((member) => (
          <View key={member.chama_id} className="mx-6 mt-4 bg-white rounded-2xl p-6 shadow-sm">
            <Text className="text-xl font-bold text-gray-800 mb-2">
              {member.chamas?.name}
            </Text>
            <Text className="text-gray-500 text-sm mb-4">
              Your role: {member.role}
            </Text>
            
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="text-gray-500 text-sm">Monthly Contribution</Text>
                <Text className="text-lg font-semibold text-gray-800">
                  {formatCurrency(member.chamas?.contribution_amount || 0)}
                </Text>
              </View>
              <TouchableOpacity className="bg-primary-50 px-4 py-2 rounded-lg">
                <Text className="text-primary-600 font-medium">View</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Empty State */}
        {chamas.length === 0 && (
          <View className="mx-6 mt-8 bg-white rounded-2xl p-8 items-center">
            <Text className="text-6xl mb-4">👥</Text>
            <Text className="text-lg font-semibold text-gray-800 mb-2">
              No Chamas Yet
            </Text>
            <Text className="text-gray-500 text-center mb-4">
              Join or create your first Chama to start growing your wealth together
            </Text>
            <TouchableOpacity className="bg-primary-600 px-6 py-3 rounded-lg">
              <Text className="text-white font-semibold">Create Chama</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}