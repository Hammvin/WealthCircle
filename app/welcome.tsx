import { Link } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      {/* Background Elements */}
      <View style={styles.background}>
        <View style={styles.circle1} />
        <View style={styles.circle2} />
        <View style={styles.circle3} />
        <View style={styles.circle4} />
      </View>
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>WC</Text>
          </View>
          
          <Text style={styles.title}>WealthCircle</Text>
          
          <Text style={styles.subtitle}>
            Your smart Chama companion. Manage group savings, track contributions, and grow together with AI-powered insights.
          </Text>
        </View>

        {/* Features Section */}
        <View style={styles.features}>
          <View style={styles.featureRow}>
            <View style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: '#f0f9ff' }]}>
                <Text style={[styles.featureIconText, { color: '#0ea5e9' }]}>💰</Text>
              </View>
              <Text style={styles.featureText}>Easy Contributions</Text>
            </View>
            
            <View style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: '#f0fdf4' }]}>
                <Text style={[styles.featureIconText, { color: '#22c55e' }]}>📊</Text>
              </View>
              <Text style={styles.featureText}>Smart Analytics</Text>
            </View>
            
            <View style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: '#fffbeb' }]}>
                <Text style={[styles.featureIconText, { color: '#f59e0b' }]}>🔒</Text>
              </View>
              <Text style={styles.featureText}>Bank-Grade Security</Text>
            </View>
          </View>
        </View>

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          <Link href="./login" asChild>
            <TouchableOpacity style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Get Started</Text>
            </TouchableOpacity>
          </Link>
          
          <Text style={styles.footerText}>
            Join thousands of Chamas growing their wealth together
          </Text>

          {/* Additional info */}
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
          💡   Already have an account?{' '}
              <Link href="./login">
                <Text style={styles.linkText}>Sign in here</Text>
              </Link>
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  circle1: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 160,
    height: 160,
    backgroundColor: '#e0f2fe',
    borderRadius: 80,
    opacity: 0.5,
  },
  circle2: {
    position: 'absolute',
    top: 40,
    left: -40,
    width: 128,
    height: 128,
    backgroundColor: '#dcfce7',
    borderRadius: 64,
    opacity: 0.3,
  },
  circle3: {
    position: 'absolute',
    bottom: -80,
    left: -80,
    width: 192,
    height: 192,
    backgroundColor: '#fef3c7',
    borderRadius: 96,
    opacity: 0.4,
  },
  circle4: {
    position: 'absolute',
    bottom: 128,
    right: -40,
    width: 112,
    height: 112,
    backgroundColor: '#e0f2fe',
    borderRadius: 56,
    opacity: 0.3,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 32,
  },
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  logo: {
    width: 128,
    height: 128,
    backgroundColor: '#e0f2fe',
    borderRadius: 64,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  logoText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#0ea5e9',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  features: {
    paddingHorizontal: 8,
    marginBottom: 48,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  featureItem: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 8,
  },
  featureIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  featureIconText: {
    fontSize: 24,
  },
  featureText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  ctaSection: {
    paddingBottom: 48,
  },
  primaryButton: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  footerText: {
    color: '#6b7280',
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 32,
  },
  infoBox: {
    backgroundColor: '#dbeafe',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  infoText: {
    color: '#1e40af',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
  linkText: {
    color: '#0ea5e9',
    fontWeight: 'bold',
  },
});