import { useState, useEffect } from 'react';
import { View, ScrollView, Alert, StyleSheet } from 'react-native';
import { Button, TextInput, RadioButton, Text, SegmentedButtons } from 'react-native-paper';
import { router } from 'expo-router';
import { PayoutService } from '@/lib/payouts';
import { useChama } from '@/contexts/ChamaContext';

// Security configuration
const SECURITY_CONFIG = {
  MAX_AMOUNT: 1000000,
  MIN_AMOUNT: 1,
  MIN_PURPOSE_LENGTH: 5,
  MAX_PURPOSE_LENGTH: 500,
  MAX_INTEREST_RATE: 100,
  MAX_REPAYMENT_MONTHS: 36,
} as const;

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
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Input sanitization
  const sanitizeInput = (input: string, type: 'text' | 'number' | 'decimal' = 'text'): string => {
    let sanitized = input.trim();
    
    switch (type) {
      case 'number':
        sanitized = sanitized.replace(/[^\d]/g, '');
        break;
      case 'decimal':
        sanitized = sanitized.replace(/[^\d.]/g, '');
        // Remove extra decimal points
        const parts = sanitized.split('.');
        if (parts.length > 2) {
          sanitized = parts[0] + '.' + parts.slice(1).join('');
        }
        break;
      default:
        sanitized = sanitized
          .replace(/[<>"'`;\\/&|$#{}[\]=]/g, '')
          .substring(0, SECURITY_CONFIG.MAX_PURPOSE_LENGTH);
    }
    
    return sanitized;
  };

  // Validation functions
  const validateForm = (): { valid: boolean; errors: {[key: string]: string} } => {
    const newErrors: {[key: string]: string} = {};

    // Amount validation
    if (!formData.amount.trim()) {
      newErrors.amount = 'Amount is required';
    } else {
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount < SECURITY_CONFIG.MIN_AMOUNT) {
        newErrors.amount = `Amount must be at least ${SECURITY_CONFIG.MIN_AMOUNT} KES`;
      } else if (amount > SECURITY_CONFIG.MAX_AMOUNT) {
        newErrors.amount = `Amount cannot exceed ${SECURITY_CONFIG.MAX_AMOUNT} KES`;
      }
    }

    // Purpose validation
    if (!formData.purpose.trim()) {
      newErrors.purpose = 'Purpose is required';
    } else if (formData.purpose.length < SECURITY_CONFIG.MIN_PURPOSE_LENGTH) {
      newErrors.purpose = `Purpose must be at least ${SECURITY_CONFIG.MIN_PURPOSE_LENGTH} characters`;
    } else if (formData.purpose.length > SECURITY_CONFIG.MAX_PURPOSE_LENGTH) {
      newErrors.purpose = `Purpose too long (max ${SECURITY_CONFIG.MAX_PURPOSE_LENGTH} characters)`;
    }

    // Loan-specific validations
    if (formData.request_type === 'loan') {
      if (formData.interest_rate.trim()) {
        const interestRate = parseFloat(formData.interest_rate);
        if (isNaN(interestRate) || interestRate < 0 || interestRate > SECURITY_CONFIG.MAX_INTEREST_RATE) {
          newErrors.interest_rate = `Interest rate must be between 0 and ${SECURITY_CONFIG.MAX_INTEREST_RATE}%`;
        }
      }

      if (formData.repayment_period.trim()) {
        const repaymentPeriod = parseInt(formData.repayment_period);
        if (isNaN(repaymentPeriod) || repaymentPeriod < 1 || repaymentPeriod > SECURITY_CONFIG.MAX_REPAYMENT_MONTHS) {
          newErrors.repayment_period = `Repayment period must be between 1 and ${SECURITY_CONFIG.MAX_REPAYMENT_MONTHS} months`;
        }
      }
    }

    return { valid: Object.keys(newErrors).length === 0, errors: newErrors };
  };

  const handleInputChange = (field: string, value: string, type: 'text' | 'number' | 'decimal' = 'text') => {
    const sanitizedValue = sanitizeInput(value, type);
    setFormData(prev => ({ ...prev, [field]: sanitizedValue }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleRequestTypeChange = (value: string) => {
    setFormData(prev => ({ 
      ...prev, 
      request_type: value as 'payout' | 'loan',
      // Reset loan-specific fields when switching to payout
      ...(value === 'payout' ? { interest_rate: '', repayment_period: '' } : {})
    }));
    // Clear errors
    setErrors({});
  };

  const handleRequestPayout = async () => {
    // Validate form
    const validation = validateForm();
    if (!validation.valid) {
      setErrors(validation.errors);
      Alert.alert('Validation Error', 'Please fix the errors in the form');
      return;
    }

    if (!currentChama?.id) {
      Alert.alert('Error', 'No chama selected');
      return;
    }

    setLoading(true);
    try {
      const result = await PayoutService.requestPayout({
        chama_id: currentChama.id,
        amount: parseFloat(formData.amount),
        request_type: formData.request_type,
        purpose: formData.purpose,
        interest_rate: formData.interest_rate ? parseFloat(formData.interest_rate) : undefined,
        repayment_period: formData.repayment_period ? parseInt(formData.repayment_period) : undefined,
      });

      if (result.success) {
        Alert.alert('Success', 'Payout request submitted successfully! It will now be voted on by chama members.');
        router.back();
      } else {
        Alert.alert('Error', result.error || 'Failed to submit request');
      }
    } catch (error: any) {
      console.error('Payout request error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Security: Clear sensitive data when component unmounts
  useEffect(() => {
    return () => {
      setFormData({
        amount: '',
        request_type: 'payout',
        purpose: '',
        interest_rate: '',
        repayment_period: '',
      });
    };
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Request Payout/Loan</Text>
      
      <SegmentedButtons
        value={formData.request_type}
        onValueChange={handleRequestTypeChange}
        buttons={[
          { value: 'payout', label: 'Payout' },
          { value: 'loan', label: 'Loan' },
        ]}
        style={styles.segmentedButtons}
      />
      
      <TextInput
        label="Amount (KES) *"
        value={formData.amount}
        onChangeText={(text) => handleInputChange('amount', text, 'decimal')}
        keyboardType="numeric"
        style={styles.input}
        mode="outlined"
        error={!!errors.amount}
        left={<TextInput.Affix text="KSh " />}
      />
      {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
      
      <TextInput
        label="Purpose *"
        value={formData.purpose}
        onChangeText={(text) => handleInputChange('purpose', text, 'text')}
        multiline
        numberOfLines={3}
        style={styles.input}
        mode="outlined"
        error={!!errors.purpose}
        placeholder="Describe what you need the funds for..."
      />
      {errors.purpose && <Text style={styles.errorText}>{errors.purpose}</Text>}
      
      {formData.request_type === 'loan' && (
        <View style={styles.loanSection}>
          <TextInput
            label="Interest Rate (%)"
            value={formData.interest_rate}
            onChangeText={(text) => handleInputChange('interest_rate', text, 'decimal')}
            keyboardType="numeric"
            style={styles.input}
            mode="outlined"
            error={!!errors.interest_rate}
            left={<TextInput.Affix text="% " />}
          />
          {errors.interest_rate && <Text style={styles.errorText}>{errors.interest_rate}</Text>}
          
          <TextInput
            label="Repayment Period (Months)"
            value={formData.repayment_period}
            onChangeText={(text) => handleInputChange('repayment_period', text, 'number')}
            keyboardType="numeric"
            style={styles.input}
            mode="outlined"
            error={!!errors.repayment_period}
            left={<TextInput.Affix text="Months " />}
          />
          {errors.repayment_period && <Text style={styles.errorText}>{errors.repayment_period}</Text>}
        </View>
      )}
      
      <Button
        mode="contained"
        onPress={handleRequestPayout}
        loading={loading}
        disabled={loading}
        style={styles.button}
        contentStyle={styles.buttonContent}
      >
        Submit Request
      </Button>

      <Text style={styles.footerText}>
        Your request will be voted on by chama members. Majority approval is required.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  contentContainer: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
    color: '#7c3aed', // purple-600
  },
  segmentedButtons: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 8,
  },
  loanSection: {
    marginBottom: 8,
  },
  button: {
    marginTop: 16,
    backgroundColor: '#7c3aed', // purple-600
  },
  buttonContent: {
    paddingVertical: 8,
  },
  errorText: {
    color: '#dc2626', // red-600
    fontSize: 12,
    marginBottom: 12,
    marginLeft: 4,
  },
  footerText: {
    color: '#6b7280', // gray-500
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
});