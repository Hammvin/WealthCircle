import { ChamaService } from '@/lib/chama';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Button, RadioButton, Text, TextInput } from 'react-native-paper';

export default function CreateChamaScreen() {
  const [formData, setFormData] = useState({
    name: '',
    savings_goal: '',
    contribution_cycle: 'monthly' as 'weekly' | 'monthly',
    contribution_amount: '',
  });
  const [loading, setLoading] = useState(false);

  const handleCreateChama = async () => {
    if (!formData.name || !formData.savings_goal || !formData.contribution_amount) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    setLoading(true);
    const result = await ChamaService.createChama({
      ...formData,
      contribution_amount: parseFloat(formData.contribution_amount),
    });

    setLoading(false);
    
    if (result.success) {
      Alert.alert('Success', 'Chama created successfully!');
      router.push('/chamas');
    } else {
      Alert.alert('Error', result.error);
    }
  };

  return (
    <ScrollView className="flex-1 p-4 bg-white">
      <Text variant="headlineMedium" className="text-center mb-6 text-purple-600">
        Create Your Chama
      </Text>
      
      <TextInput
        label="Chama Name *"
        value={formData.name}
        onChangeText={(text) => setFormData({ ...formData, name: text })}
        className="mb-4"
        mode="outlined"
      />
      
      <TextInput
        label="Savings Goal *"
        value={formData.savings_goal}
        onChangeText={(text) => setFormData({ ...formData, savings_goal: text })}
        className="mb-4"
        mode="outlined"
        placeholder="e.g., Land Purchase, Business Investment"
      />
      
      <Text variant="titleMedium" className="mb-2">Contribution Cycle *</Text>
      <RadioButton.Group
        onValueChange={(value) => setFormData({ ...formData, contribution_cycle: value as any })}
        value={formData.contribution_cycle}
      >
        <View className="flex-row items-center">
          <RadioButton value="weekly" />
          <Text>Weekly</Text>
        </View>
        <View className="flex-row items-center">
          <RadioButton value="monthly" />
          <Text>Monthly</Text>
        </View>
      </RadioButton.Group>
      
      <TextInput
        label="Contribution Amount (KES) *"
        value={formData.contribution_amount}
        onChangeText={(text) => setFormData({ ...formData, contribution_amount: text })}
        keyboardType="numeric"
        className="mb-6 mt-4"
        mode="outlined"
      />
      
      <Button
        mode="contained"
        onPress={handleCreateChama}
        loading={loading}
        disabled={loading}
        className="bg-purple-600"
      >
        Create Chama
      </Button>
    </ScrollView>
  );
}