import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';

interface WelcomeButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  fullWidth?: boolean;
}

/**
 * WelcomeButton Component
 * Custom button designed specifically for the welcome screen
 * Features rounded design with smooth animations
 */
export default function WelcomeButton({ 
  title, 
  onPress, 
  variant = 'primary', 
  loading = false, 
  disabled = false,
  icon,
  fullWidth = true
}: WelcomeButtonProps) {
  const getButtonStyle = () => {
    const baseStyle = 'py-4 rounded-2xl shadow-lg';
    const widthStyle = fullWidth ? 'w-full' : 'px-8';
    
    switch (variant) {
      case 'secondary':
        return `${baseStyle} ${widthStyle} bg-gray-100 border border-gray-300`;
      case 'outline':
        return `${baseStyle} ${widthStyle} bg-transparent border-2 border-primary-500`;
      default:
        return `${baseStyle} ${widthStyle} bg-primary-500`;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'secondary':
        return 'text-gray-800';
      case 'outline':
        return 'text-primary-600';
      default:
        return 'text-white';
    }
  };

  const getShadowStyle = () => {
    if (disabled) return '';
    
    switch (variant) {
      case 'primary':
        return 'shadow-primary-200';
      case 'secondary':
        return 'shadow-gray-200';
      case 'outline':
        return 'shadow-primary-100';
      default:
        return 'shadow-primary-200';
    }
  };

  return (
    <TouchableOpacity
      className={`${getButtonStyle()} ${getShadowStyle()} ${
        disabled || loading ? 'opacity-60' : 'opacity-100'
      } active:opacity-80`}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator 
          color={variant === 'outline' ? '#0ea5e9' : 'white'} 
          size="small" 
        />
      ) : (
        <Text className={`text-center text-lg font-semibold ${getTextStyle()}`}>
          {icon && `${icon} `}{title}
        </Text>
      )}
    </TouchableOpacity>
  );
}