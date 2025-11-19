import React from 'react';
import { View } from 'react-native';

/**
 * WelcomeBackground Component
 * Provides the background design for the welcome screen
 * Can be enhanced with gradients, patterns, or animations
 */
export default function WelcomeBackground() {
  return (
    <View className="absolute inset-0">
      {/* Top decorative circles */}
      <View className="absolute -top-20 -right-20 w-40 h-40 bg-primary-100 rounded-full opacity-50" />
      <View className="absolute top-10 -left-10 w-32 h-32 bg-success-100 rounded-full opacity-30" />
      
      {/* Bottom decorative circles */}
      <View className="absolute -bottom-20 -left-20 w-48 h-48 bg-warning-100 rounded-full opacity-40" />
      <View className="absolute bottom-32 -right-10 w-28 h-28 bg-primary-200 rounded-full opacity-30" />
      
      {/* Center decorative element */}
      <View className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <View className="w-64 h-64 border-2 border-primary-200 rounded-full opacity-20" />
        <View className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-success-200 rounded-full opacity-30" />
      </View>
    </View>
  );
}