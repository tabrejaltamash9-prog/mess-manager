import React, { useState, useRef, useEffect } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, Radius, Typography, Shadow } from '../../constants/theme';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

export default function OtpScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { setTokens, setUser } = useAuthStore();

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const inputRefs = useRef<Array<TextInput | null>>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  function handleOtpChange(index: number, value: string) {
    // Allow only digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (digit && index === 5) {
      const complete = [...newOtp.slice(0, 5), digit].join('');
      if (complete.length === 6) {
        handleVerify(complete);
      }
    }
  }

  function handleKeyPress(index: number, key: string) {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleVerify(code?: string) {
    const otpCode = code ?? otp.join('');
    if (otpCode.length !== 6) {
      Alert.alert('Incomplete', 'Please enter all 6 digits.');
      return;
    }

    setLoading(true);
    try {
      const result = await api.verifyOtp(email, otpCode);
      setTokens(result.accessToken, result.refreshToken);
      setUser({
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.role,
        roll_no: result.user.roll_no,
        department: result.user.department,
        hostel_block: result.user.hostel_block,
        photo_url: result.user.photo_url,
      });

      // Root layout handles redirect based on role
    } catch (err: any) {
      Alert.alert('Invalid Code', err.message ?? 'Incorrect OTP. Please try again.');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (countdown > 0) return;
    setResendLoading(true);
    try {
      await api.requestOtp(email);
      setCountdown(60);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      Alert.alert('Code Sent', 'A new OTP has been sent to your email.');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Back */}
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>📧</Text>
          </View>
          <Text style={styles.title}>Check Your Email</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.emailHighlight}>{email}</Text>
          </Text>
        </View>

        {/* OTP Input */}
        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputRefs.current[index] = ref; }}
              style={[styles.otpInput, digit ? styles.otpFilled : null]}
              value={digit}
              onChangeText={(val) => handleOtpChange(index, val)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              editable={!loading}
            />
          ))}
        </View>

        {/* Verify Button */}
        <TouchableOpacity
          style={[styles.button, (loading || otp.join('').length !== 6) && styles.buttonDisabled]}
          onPress={() => handleVerify()}
          disabled={loading || otp.join('').length !== 6}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.buttonText}>Verify & Sign In</Text>
          )}
        </TouchableOpacity>

        {/* Resend */}
        <TouchableOpacity
          onPress={handleResend}
          disabled={countdown > 0 || resendLoading}
          style={styles.resendButton}
        >
          <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
            {countdown > 0
              ? `Resend code in ${countdown}s`
              : resendLoading
              ? 'Sending...'
              : 'Resend code'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          💡 Code expires in 5 minutes. Check spam folder if not received.
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

  back: { alignSelf: 'flex-start', marginBottom: Spacing.xl },
  backText: { ...Typography.bodyMd, color: Colors.primary },

  header: { alignItems: 'center', marginBottom: Spacing.xl },

  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },

  icon: { fontSize: 40 },

  title: { ...Typography.h2, color: Colors.black, marginBottom: Spacing.sm },

  subtitle: {
    ...Typography.body,
    color: Colors.gray500,
    textAlign: 'center',
    lineHeight: 22,
  },

  emailHighlight: { color: Colors.primary, fontWeight: '600' },

  otpContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },

  otpInput: {
    width: 48,
    height: 58,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
    borderRadius: Radius.md,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: Colors.black,
    backgroundColor: Colors.surface,
    ...Shadow.sm,
  },

  otpFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
    color: Colors.primary,
  },

  button: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },

  buttonDisabled: { opacity: 0.4 },

  buttonText: { ...Typography.h4, color: Colors.white },

  resendButton: { marginBottom: Spacing.xl },

  resendText: { ...Typography.bodyMd, color: Colors.primary },
  resendDisabled: { color: Colors.gray400 },

  hint: {
    ...Typography.caption,
    color: Colors.gray400,
    textAlign: 'center',
    lineHeight: 18,
  },
});
