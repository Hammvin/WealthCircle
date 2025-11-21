import { Link, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  BackHandler,
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

export default function LoginScreen() {
  const [formData, setFormData] = useState({
    phoneNumber: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);
  
  const router = useRouter();
  const { login } = useAuth();

  // Handle back button to prevent accidental navigation
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, []);

  // Auto-clear lockout
  useEffect(() => {
    if (lockoutTime) {
      const timer = setTimeout(() => {
        setLockoutTime(null);
        setFailedAttempts(0);
      }, lockoutTime - Date.now());
      
      return () => clearTimeout(timer);
    }
  }, [lockoutTime]);

  const handleChange = (field: string, value: string) => {
    // Enhanced input sanitization at UI level
    const sanitizedValue = value.replace(/[<>"'`;\\/&|$#{}[\]=]/g, '').substring(0, 100);
    setFormData(prev => ({ ...prev, [field]: sanitizedValue }));
  };

  const handleLogin = async () => {
    // Check if account is temporarily locked
    if (lockoutTime && Date.now() < lockoutTime) {
      const remainingTime = Math.ceil((lockoutTime - Date.now()) / 1000 / 60);
      Alert.alert('Account Locked', `Too many failed attempts. Try again in ${remainingTime} minutes.`);
      return;
    }

    // Enhanced validation with input length checks
    if (!formData.phoneNumber.trim() || !formData.password.trim()) {
      Alert.alert('Error', 'Please enter your phone number and password');
      return;
    }

    if (formData.phoneNumber.replace(/\s/g, '').length < 9) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    if (formData.password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    // Input length security checks
    if (formData.phoneNumber.length > 16 || formData.password.length > 100) {
      Alert.alert('Error', 'Invalid input length detected');
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(formData.phoneNumber, formData.password);
      
      if (result.success) {
        // Reset failed attempts on success
        setFailedAttempts(0);
        setLockoutTime(null);
        
        // Success - navigation handled by auth context
        router.replace('/dashboard');
      } else {
        // Increment failed attempts
        const newFailedAttempts = failedAttempts + 1;
        setFailedAttempts(newFailedAttempts);
        
        // Implement progressive lockout
        if (newFailedAttempts >= 5) {
          const lockoutDuration = 15 * 60 * 1000; // 15 minutes
          setLockoutTime(Date.now() + lockoutDuration);
          Alert.alert('Account Locked', 'Too many failed attempts. Account locked for 15 minutes.');
        } else {
          Alert.alert('Login Failed', result.error || 'Please check your credentials and try again');
        }
        
        // Clear password field for security
        setFormData(prev => ({ ...prev, password: '' }));
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      // Clear password field for security
      setFormData(prev => ({ ...prev, password: '' }));
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhoneNumber = (text: string) => {
  // Remove all non-digit characters and plus sign for processing
  const cleaned = text.replace(/[^\d+]/g, '');
  
  // Handle +254 prefix specially - keep the + for validation
  if (cleaned.startsWith('+254')) {
    const numbersOnly = cleaned.slice(0, 13); // +254712345678 (13 chars)
    handleChange('phoneNumber', numbersOnly);
    return;
  }
  
  // Handle 254 prefix (without plus) - add + for proper format
  if (cleaned.startsWith('254') && cleaned.length >= 12) {
    const numbersOnly = '+' + cleaned.slice(0, 12);
    handleChange('phoneNumber', numbersOnly);
    return;
  }
  
  // Handle local format (0 prefix) - convert to +254 format
  if (cleaned.startsWith('0') && cleaned.length >= 10) {
    const numbersOnly = '+254' + cleaned.slice(1, 10);
    handleChange('phoneNumber', numbersOnly);
    return;
  }
  
  // For partial input starting with 254 (without +), allow it to build
  if (cleaned.startsWith('254') && cleaned.length < 12) {
    handleChange('phoneNumber', '+' + cleaned);
    return;
  }
  
  // For partial input starting with 0, allow it to build
  if (cleaned.startsWith('0') && cleaned.length < 10) {
    handleChange('phoneNumber', cleaned);
    return;
  }
  
  // For partial input starting with +254, allow it to build
  if (cleaned.startsWith('+254') && cleaned.length < 13) {
    handleChange('phoneNumber', cleaned);
    return;
  }
  
  // For any other input (like starting with 7), just pass through
  handleChange('phoneNumber', cleaned);
};

  const getLockoutMessage = () => {
    if (!lockoutTime) return null;
    
    const remainingTime = Math.ceil((lockoutTime - Date.now()) / 1000 / 60);
    return `Account temporarily locked. Try again in ${remainingTime} minutes.`;
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to your WealthCircle account</Text>
            
            {/* Security notice */}
            <View style={styles.securityNotice}>
              <Text style={styles.securityText}>
                🔒 Your security is our priority. We use advanced encryption to protect your data.
              </Text>
            </View>
          </View>

          {/* Lockout Message */}
          {lockoutTime && (
            <View style={styles.lockoutBanner}>
              <Text style={styles.lockoutText}>{getLockoutMessage()}</Text>
            </View>
          )}

          {/* Login Form */}
          <View style={styles.form}>
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
                style={[styles.input, lockoutTime && styles.inputDisabled]}
                placeholder="Enter your password"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                value={formData.password}
                onChangeText={(value) => handleChange('password', value)}
                autoCapitalize="none"
                autoComplete="password"
                editable={!isLoading && !lockoutTime}
                onSubmitEditing={lockoutTime ? undefined : handleLogin}
                autoCorrect={false}
                spellCheck={false}
                maxLength={100}
              />
              
              {/* Password strength indicator */}
              {formData.password.length > 0 && (
                <View style={styles.passwordStrength}>
                  <View style={[
                    styles.strengthBar, 
                    formData.password.length < 8 ? styles.strengthWeak :
                    formData.password.length < 12 ? styles.strengthMedium :
                    styles.strengthStrong
                  ]} />
                  <Text style={styles.strengthText}>
                    {formData.password.length < 8 ? 'Weak' :
                     formData.password.length < 12 ? 'Medium' : 'Strong'}
                  </Text>
                </View>
              )}
            </View>

            {/* Failed attempts warning */}
            {failedAttempts > 0 && failedAttempts < 5 && (
              <View style={styles.warningBanner}>
                <Text style={styles.warningText}>
                  {`${5 - failedAttempts} attempts remaining before temporary lockout`}
                </Text>
              </View>
            )}

            {/* Forgot Password Link */}
            <TouchableOpacity 
              style={styles.forgotPasswordContainer}
              onPress={() => router.push('./forgot-password')}
              disabled={isLoading || !!lockoutTime}
            >
              <Text style={[
                styles.forgotPasswordText,
                (isLoading || lockoutTime) && styles.linkDisabled
              ]}>
                Forgot Password?
              </Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={[
                styles.loginButton, 
                (isLoading || lockoutTime) && styles.loginButtonDisabled
              ]}
              onPress={handleLogin}
              disabled={isLoading || !!lockoutTime}
            >
              <Text style={styles.loginButtonText}>
                {isLoading ? 'Signing In...' : 
                 lockoutTime ? 'Account Locked' : 'Sign In'}
              </Text>
            </TouchableOpacity>

            {/* Signup link */}
            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>
                Don't have an account?{' '}
                <Link href="./signup" style={[
                  styles.signupLink,
                  (isLoading || lockoutTime) && styles.linkDisabled
                ]}>
                  Create one here
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
    marginBottom: 32,
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
    marginBottom: 16,
  },
  securityNotice: {
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0ea5e9',
  },
  securityText: {
    fontSize: 12,
    color: '#0369a1',
    textAlign: 'center',
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  lockoutBanner: {
    backgroundColor: '#fef2f2',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
    marginBottom: 20,
  },
  lockoutText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  warningBanner: {
    backgroundColor: '#fffbeb',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  warningText: {
    color: '#d97706',
    fontSize: 12,
    fontWeight: '500',
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
  inputDisabled: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
    color: '#9ca3af',
  },
  passwordStrength: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  strengthBar: {
    height: 4,
    flex: 1,
    borderRadius: 2,
  },
  strengthWeak: {
    backgroundColor: '#ef4444',
  },
  strengthMedium: {
    backgroundColor: '#f59e0b',
  },
  strengthStrong: {
    backgroundColor: '#10b981',
  },
  strengthText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginTop: -8,
  },
  forgotPasswordText: {
    color: '#0ea5e9',
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
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
  loginButtonDisabled: {
    backgroundColor: '#7dd3fc',
  },
  loginButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  signupContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  signupText: {
    color: '#6b7280',
    fontSize: 14,
  },
  signupLink: {
    color: '#0ea5e9',
    fontWeight: '600',
  },
  linkDisabled: {
    color: '#9ca3af',
  },
});