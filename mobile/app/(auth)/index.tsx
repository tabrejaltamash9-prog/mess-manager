import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Colors, Spacing, Radius, Typography, Shadow } from '../../constants/theme';
import { api } from '../../lib/api';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSendOtp() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await api.requestOtp(trimmed);
      router.push({ pathname: '/(auth)/otp', params: { email: trimmed } });
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.iconContainer}>
            <Text style={styles.heroIcon}>🍽️</Text>
          </View>
          <Text style={styles.appName}>Mess QR</Text>
          <Text style={styles.tagline}>College Meal Attendance</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>
          <Text style={styles.cardSubtitle}>
            Enter your college email to receive a login code
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>College Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@college.edu"
              placeholderTextColor={Colors.gray400}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSendOtp}
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSendOtp}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.buttonText}>Send Login Code →</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.hint}>
            📧 A 6-digit code will be sent to your email
          </Text>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Only registered college emails are accepted.{'\n'}Contact admin if you're unable to log in.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },

  container: {
    flexGrow: 1,
    padding: Spacing.lg,
    paddingTop: 60,
    alignItems: 'center',
  },

  hero: { alignItems: 'center', marginBottom: Spacing.xl },

  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Shadow.md,
  },

  heroIcon: { fontSize: 44 },

  appName: {
    ...Typography.h1,
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },

  tagline: {
    ...Typography.body,
    color: Colors.gray500,
  },

  card: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    ...Shadow.lg,
    marginBottom: Spacing.lg,
  },

  cardTitle: {
    ...Typography.h2,
    color: Colors.black,
    marginBottom: Spacing.xs,
  },

  cardSubtitle: {
    ...Typography.body,
    color: Colors.gray500,
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },

  inputContainer: { marginBottom: Spacing.md },

  label: {
    ...Typography.captionMd,
    color: Colors.gray700,
    marginBottom: Spacing.xs,
  },

  input: {
    borderWidth: 1.5,
    borderColor: Colors.gray200,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.black,
    backgroundColor: Colors.gray50,
  },

  button: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },

  buttonDisabled: { opacity: 0.6 },

  buttonText: {
    ...Typography.h4,
    color: Colors.white,
  },

  hint: {
    ...Typography.caption,
    color: Colors.gray500,
    textAlign: 'center',
  },

  footer: {
    ...Typography.tiny,
    color: Colors.gray400,
    textAlign: 'center',
    lineHeight: 18,
  },
});
