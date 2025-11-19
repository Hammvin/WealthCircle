import { useRouter } from 'expo-router';
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

export default function ChangePasswordScreen() {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const { changePassword } = useAuth();

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleChangePassword = async () => {
    // Validation
    if (!formData.currentPassword.trim() || !formData.newPassword.trim() || 
        !formData.confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (formData.newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      Alert.alert('Error', 'New password must be different from current password');
      return;
    }

    setIsLoading(true);

    try {
      const result = await changePassword(formData.currentPassword, formData.newPassword);
      
      if (result.success) {
        Alert.alert(
          'Password Changed', 
          'Your password has been updated successfully!',
          [{ text: 'OK', onPress: () => router.back() }]
        );
        // Clear form
        setFormData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      } else {
        Alert.alert('Change Failed', result.error || 'Please check your current password and try again');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
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
            <Text style={styles.title}>Change Password</Text>
            <Text style={styles.subtitle}>
              Update your password to keep your account secure
            </Text>
          </View>

          {/* Change Password Form */}
          <View style={styles.form}>
            {/* Current Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Current Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your current password"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                value={formData.currentPassword}
                onChangeText={(value) => handleChange('currentPassword', value)}
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>

            {/* New Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter new password (min. 6 characters)"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                value={formData.newPassword}
                onChangeText={(value) => handleChange('newPassword', value)}
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>

            {/* Confirm New Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm New Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Confirm your new password"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                value={formData.confirmPassword}
                onChangeText={(value) => handleChange('confirmPassword', value)}
                autoCapitalize="none"
                editable={!isLoading}
                onSubmitEditing={handleChangePassword}
              />
            </View>

            {/* Security Tips */}
            <View style={styles.tipsContainer}>
              <Text style={styles.tipsTitle}>Password Tips:</Text>
              <Text style={styles.tip}>• Use at least 6 characters</Text>
              <Text style={styles.tip}>• Include numbers and letters</Text>
              <Text style={styles.tip}>• Avoid common words</Text>
              <Text style={styles.tip}>• Don't reuse old passwords</Text>
            </View>

            {/* Change Password Button */}
            <TouchableOpacity
              style={[styles.changeButton, isLoading && styles.changeButtonDisabled]}
              onPress={handleChangePassword}
              disabled={isLoading}
            >
              <Text style={styles.changeButtonText}>
                {isLoading ? 'Updating...' : 'Update Password'}
              </Text>
            </TouchableOpacity>

            {/* Forgot Password link */}
            <View style={styles.forgotContainer}>
              <Text style={styles.forgotText}>
                Forgot your current password?{' '}
                <Text 
                  style={styles.forgotLink}
                  onPress={() => router.push('./forgot-password')}
                >
                  Reset it here
                </Text>
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
    lineHeight: 22,
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
  tipsContainer: {
    backgroundColor: '#f0f9ff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0c4a6e',
    marginBottom: 8,
  },
  tip: {
    fontSize: 12,
    color: '#0c4a6e',
    lineHeight: 16,
  },
  changeButton: {
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
  changeButtonDisabled: {
    backgroundColor: '#7dd3fc',
  },
  changeButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  forgotContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotText: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
  },
  forgotLink: {
    color: '#0ea5e9',
    fontWeight: '600',
  },
});