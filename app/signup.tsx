import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../contexts/auth_context';

export default function SignupScreen() {
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const { signup } = useAuth();

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSignup = async () => {
    // Enhanced validation with secure practices
    if (!formData.fullName.trim() || !formData.phoneNumber.trim() || 
        !formData.password.trim() || !formData.confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Input sanitization check
    if (formData.fullName.length > 100 || formData.phoneNumber.length > 16) {
      Alert.alert('Error', 'Invalid input length detected');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    // Check for weak password patterns
    const weakPatterns = ['123456', 'password', 'qwerty', 'admin'];
    const lowerPassword = formData.password.toLowerCase();
    if (weakPatterns.some(pattern => lowerPassword.includes(pattern))) {
      Alert.alert('Error', 'Password is too common or predictable');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signup(formData.phoneNumber, formData.password, formData.fullName);
      
      if (result.success) {
        Alert.alert(
          'Account Created', 
          'Your WealthCircle account has been created successfully!',
          [{ text: 'OK', onPress: () => router.replace('./dashboard') }]
        );
      } else {
        Alert.alert('Signup Failed', result.error || 'Please try again');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhoneNumber = (text: string) => {
    // Remove all non-digit characters and plus sign for processing
    const cleaned = text.replace(/[^\d+]/g, '');
    
    // Handle +254 prefix specially
    if (cleaned.startsWith('+254')) {
      const numbersOnly = cleaned.slice(0, 13); // +254712345678 (13 chars)
      handleChange('phoneNumber', numbersOnly);
      return;
    }
    
    // Handle 254 prefix (without plus)
    if (cleaned.startsWith('254') && cleaned.length >= 12) {
      const numbersOnly = '+' + cleaned.slice(0, 12);
      handleChange('phoneNumber', numbersOnly);
      return;
    }
    
    // Handle local format (0 prefix)
    if (cleaned.startsWith('0') && cleaned.length >= 10) {
      const numbersOnly = '+254' + cleaned.slice(1, 10);
      handleChange('phoneNumber', numbersOnly);
      return;
    }
    
    // For partial input or other cases, just pass through without formatting
    handleChange('phoneNumber', cleaned);
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join WealthCircle to manage your Chamas</Text>
          </View>

          {/* Signup Form */}
          <View style={styles.form}>
            {/* Full Name Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor="#9ca3af"
                value={formData.fullName}
                onChangeText={(value) => handleChange('fullName', value)}
                autoCapitalize="words"
                editable={!isLoading}
                maxLength={100}
                autoCorrect={false}
              />
            </View>

            {/* Phone Number Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., +254114768462, 254713658462, 0712345678"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                value={formData.phoneNumber}
                onChangeText={formatPhoneNumber}
                maxLength={16} // Allow for +254 format
                autoCapitalize="none"
                autoComplete="tel"
                editable={!isLoading}
                autoCorrect={false}
              />
              <Text style={styles.helperText}>
                Accepted formats: +254XXX, 254XXX, 07XXX, 01XXX
              </Text>
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Create a password (min. 8 characters)"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                value={formData.password}
                onChangeText={(value) => handleChange('password', value)}
                autoCapitalize="none"
                editable={!isLoading}
                autoCorrect={false}
                maxLength={100}
              />
              <Text style={styles.helperText}>
                Must include uppercase, lowercase, number, and special character
              </Text>
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Confirm your password"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                value={formData.confirmPassword}
                onChangeText={(value) => handleChange('confirmPassword', value)}
                autoCapitalize="none"
                editable={!isLoading}
                onSubmitEditing={handleSignup}
                autoCorrect={false}
                maxLength={100}
              />
            </View>

            {/* Signup Button */}
            <TouchableOpacity
              style={[styles.signupButton, isLoading && styles.signupButtonDisabled]}
              onPress={handleSignup}
              disabled={isLoading}
            >
              <Text style={styles.signupButtonText}>
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Text>
            </TouchableOpacity>

            {/* Terms Notice */}
            <View style={styles.termsNotice}>
              <Text style={styles.termsText}>
                By creating an account, you agree to our Terms of Service and Privacy Policy
              </Text>
            </View>

            {/* Login link */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>
                Already have an account?{' '}
                <Link href="./login" style={styles.loginLink}>
                  Sign in here
                </Link>
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  form: {
    gap: 20,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    backgroundColor: 'white',
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  signupButton: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginTop: 8,
  },
  signupButtonDisabled: {
    backgroundColor: '#7dd3fc',
  },
  signupButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  termsNotice: {
    backgroundColor: '#f3f4f6',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  termsText: {
    color: '#6b7280',
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
  },
  loginContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  loginText: {
    color: '#6b7280',
    fontSize: 14,
  },
  loginLink: {
    color: '#0ea5e9',
    fontWeight: '600',
  },
});