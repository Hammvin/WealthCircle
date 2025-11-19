import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  loading?: boolean;
  disabled?: boolean;
}

export default function Button({ 
  title, 
  onPress, 
  variant = 'primary', 
  loading = false, 
  disabled = false 
}: ButtonProps) {
  const getButtonStyle = () => {
    switch (variant) {
      case 'secondary':
        return 'bg-gray-500';
      case 'outline':
        return 'bg-transparent border border-primary-600';
      default:
        return 'bg-primary-600';
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'outline':
        return 'text-primary-600';
      default:
        return 'text-white';
    }
  };

  return (
    <TouchableOpacity
      className={`py-4 rounded-xl ${getButtonStyle()} ${
        disabled || loading ? 'opacity-50' : ''
      }`}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text className={`text-center text-lg font-semibold ${getTextStyle()}`}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}