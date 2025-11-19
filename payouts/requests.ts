import { useState } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { Button, TextInput, RadioButton, Text, SegmentedButtons } from 'react-native-paper';
import { router } from 'expo-router';
import { PayoutService } from '@/lib/payouts';
import { useChama } from '@/contexts/ChamaContext';

export default function RequestPayoutScreen() {
  const { currentChama } = useChama();
  const [formData, setFormData] = useState({
    amount: '',
    request_type: 'payout' as 'payout' | 'loan',
    purpose: '',
    interest_rate: '',
    repayment_period: '',
  });
  const [loading, setLoading] = useState(false);

  const handleRequestPayout = async () => {
    if (!formData.amount || !formData.purpose) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    const amount = parseFloat(formData.amount);
    if (amount <= 0) {
      Alert.alert('Error', 'Amount must be positive');
      return;
    }

    if (formData.purpose.length < 5) {
      Alert.alert('Error', 'Purpose must be at least 5 characters');
      return;
    }

    setLoading(true);
    const result = await PayoutService.requestPayout({
      chama_id: currentChama.id,
      amount: amount,
      request_type: formData.request_type,
      purpose: formData.purpose,
      interest_rate: formData.interest_rate ? parseFloat(formData.interest_rate) : undefined,
      repayment_period: formData.repayment_period ? parseInt(formData.repayment_period) : undefined,
    });

    setLoading(false);
    
    if (result.success) {
      Alert.alert('Success', 'Payout request submitted successfully!');
      router.back();
    } else {
      Alert.alert('Error', result.error);
    }
  };

  return (
    <ScrollView className="flex-1 p-4 bg-white">
      <Text variant="headlineMedium" className="text-center mb-6 text-purple-600">
        Request Payout/Loan
      </Text>
      
      <SegmentedButtons
        value={formData.request_type}
        onValueChange={(value) => setFormData({ ...formData, request_type: value as any })}
        buttons={[
          { value: 'payout', label: 'Payout' },
          { value: 'loan', label: 'Loan' },
        ]}
        className="mb-6"
      />
      
      <TextInput
        label="Amount (KES) *"
        value={formData.amount}
        onChangeText={(text) => setFormData({ ...formData, amount: text.replace(/[^0-9]/g, '') })}
        keyboardType="numeric"
        className="mb-4"
        mode="outlined"
        left={<TextInput.Affix text="KSh " />}
      />
      
      <TextInput
        label="Purpose *"
        value={formData.purpose}
        onChangeText={(text) => setFormData({ ...formData, purpose: text })}
        multiline
        numberOfLines={3}
        className="mb-4"
        mode="outlined"
        placeholder="Describe what you need the funds for..."
      />
      
      {formData.request_type === 'loan' && (
        <>
          <TextInput
            label="Interest Rate (%)"
            value={formData.interest_rate}
            onChangeText={(text) => setFormData({ ...formData, interest_rate: text.replace(/[^0-9.]/g, '') })}
            keyboardType="numeric"
            className="mb-4"
            mode="outlined"
            left={<TextInput.Affix text="% " />}
          />
          
          <TextInput
            label="Repayment Period (Months)"
            value={formData.repayment_period}
            onChangeText={(text) => setFormData({ ...formData, repayment_period: text.replace(/[^0-9]/g, '') })}
            keyboardType="numeric"
            className="mb-6"
            mode="outlined"
            left={<TextInput.Affix text="Months " />}
          />
        </>
      )}
      
      <Button
        mode="contained"
        onPress={handleRequestPayout}
        loading={loading}
        disabled={loading}
        className="bg-purple-600"
      >
        Submit Request
      </Button>

      <Text variant="bodySmall" className="text-gray-500 mt-4 text-center">
        Your request will be voted on by chama members. Majority approval is required.
      </Text>
    </ScrollView>
  );
}