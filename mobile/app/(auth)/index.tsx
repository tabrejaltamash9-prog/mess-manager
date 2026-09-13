import React, { useState, useEffect } from 'react';
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
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Colors, Spacing, Radius, Typography, Shadow } from '../../constants/theme';
import { api, getServerUrl, setServerUrl, resetServerUrl, DEFAULT_SERVER_URL } from '../../lib/api';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // Server URL settings
  const [activeServerUrl, setActiveServerUrl] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadServerUrl();
  }, []);

  async function loadServerUrl() {
    const url = await getServerUrl();
    setActiveServerUrl(url);
    setInputUrl(url);
  }

  async function handleTestConnection(urlToTest: string) {
    const clean = urlToTest.trim().replace(/\/+$/, '');
    if (!clean) {
      setTestResult({ success: false, message: 'Please enter a server URL.' });
      return;
    }
    setTestingConnection(true);
    setTestResult(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${clean}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        setTestResult({ success: true, message: 'Connected successfully!' });
      } else {
        setTestResult({ success: false, message: `Server replied with HTTP ${res.status}` });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.name === 'AbortError' ? 'Connection timed out (5s).' : 'Could not reach server.',
      });
    } finally {
      setTestingConnection(false);
    }
  }

  async function handleSaveServerUrl() {
    const clean = inputUrl.trim().replace(/\/+$/, '');
    if (!clean) {
      Alert.alert('Error', 'Server URL cannot be empty.');
      return;
    }
    await setServerUrl(clean);
    setActiveServerUrl(clean);
    setModalVisible(false);
    setTestResult(null);
    Alert.alert('Saved', `Server URL set to:\n${clean}`);
  }

  async function handleResetServerUrl() {
    const defaultUrl = await resetServerUrl();
    setActiveServerUrl(defaultUrl);
    setInputUrl(defaultUrl);
    setTestResult(null);
  }

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
      const msg = err.message ?? 'Failed to send OTP. Please try again.';
      const isNetworkErr =
        msg.includes('Cannot reach') ||
        msg.includes('Connection timed out') ||
        msg.includes('Network request failed');

      if (isNetworkErr) {
        Alert.alert(
          'Connection Failed',
          `${msg}\n\nWould you like to check or change your Server URL?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: '⚙️ Configure Server',
              onPress: () => {
                setInputUrl(activeServerUrl);
                setTestResult(null);
                setModalVisible(true);
              },
            },
          ]
        );
      } else {
        Alert.alert('Notice', msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Top Header Bar with Prominent Settings Button */}
      <View style={styles.topHeader}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={styles.topSettingsBtn}
          onPress={() => {
            setInputUrl(activeServerUrl);
            setTestResult(null);
            setModalVisible(true);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.topSettingsIcon}>⚙️</Text>
          <Text style={styles.topSettingsText}>Server URL</Text>
        </TouchableOpacity>
      </View>

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

          {/* Active Server URL Banner */}
          <TouchableOpacity
            style={styles.serverCardBanner}
            onPress={() => {
              setInputUrl(activeServerUrl);
              setTestResult(null);
              setModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.serverCardBannerContent}>
              <Text style={styles.serverCardBannerLabel}>🌐 Connected to:</Text>
              <Text style={styles.serverCardBannerUrl} numberOfLines={1}>
                {activeServerUrl || 'Tap to configure server'}
              </Text>
            </View>
            <Text style={styles.serverCardBannerEdit}>Change ⚙️</Text>
          </TouchableOpacity>

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

      {/* Server URL Configuration Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>⚙️ Server Configuration</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Enter your backend API URL (e.g. Render public URL, local Wi-Fi IP, or tunnel).
            </Text>

            <Text style={styles.label}>Backend URL</Text>
            <TextInput
              style={styles.input}
              value={inputUrl}
              onChangeText={(txt) => {
                setInputUrl(txt);
                setTestResult(null);
              }}
              placeholder="https://your-backend.onrender.com"
              placeholderTextColor={Colors.gray400}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            {/* Test Connection Status */}
            {testResult && (
              <View
                style={[
                  styles.testResultBox,
                  testResult.success ? styles.testSuccess : styles.testError,
                ]}
              >
                <Text
                  style={[
                    styles.testResultText,
                    testResult.success ? styles.testSuccessText : styles.testErrorText,
                  ]}
                >
                  {testResult.success ? '✅ ' : '❌ '}
                  {testResult.message}
                </Text>
              </View>
            )}

            {/* Modal Buttons */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btnOutline, testingConnection && styles.buttonDisabled]}
                onPress={() => handleTestConnection(inputUrl)}
                disabled={testingConnection}
              >
                {testingConnection ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Text style={styles.btnOutlineText}>Test Connection</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnPrimary} onPress={handleSaveServerUrl}>
                <Text style={styles.btnPrimaryText}>Save & Apply</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.btnReset}
              onPress={handleResetServerUrl}
            >
              <Text style={styles.btnResetText}>Reset to Default ({DEFAULT_SERVER_URL})</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },

  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === 'ios' ? 50 : 36,
    paddingBottom: Spacing.xs,
  },

  topSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.gray200,
    ...Shadow.sm,
  },

  topSettingsIcon: {
    fontSize: 13,
    marginRight: 5,
  },

  topSettingsText: {
    ...Typography.tiny,
    color: Colors.gray700,
    fontWeight: '600',
  },

  serverCardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.lg,
  },

  serverCardBannerContent: {
    flex: 1,
    marginRight: Spacing.sm,
  },

  serverCardBannerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primaryDark,
    marginBottom: 2,
  },

  serverCardBannerUrl: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },

  serverCardBannerEdit: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },

  container: {
    flexGrow: 1,
    padding: Spacing.lg,
    paddingTop: 10,
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

  serverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray100,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full ?? 999,
    marginBottom: Spacing.lg,
    maxWidth: '90%',
  },

  serverPillIcon: {
    fontSize: 13,
    marginRight: Spacing.xs,
  },

  serverPillText: {
    ...Typography.tiny,
    color: Colors.gray600,
    fontWeight: '500',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },

  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    paddingBottom: 40,
    ...Shadow.lg,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },

  modalTitle: {
    ...Typography.h3,
    color: Colors.black,
  },

  modalClose: {
    fontSize: 20,
    color: Colors.gray400,
    padding: Spacing.xs,
  },

  modalSubtitle: {
    ...Typography.caption,
    color: Colors.gray500,
    marginBottom: Spacing.lg,
    lineHeight: 18,
  },

  testResultBox: {
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },

  testSuccess: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.success,
  },

  testError: {
    backgroundColor: Colors.errorLight,
    borderColor: Colors.error,
  },

  testResultText: {
    ...Typography.caption,
    fontWeight: '500',
  },

  testSuccessText: {
    color: Colors.successDark,
  },

  testErrorText: {
    color: Colors.errorDark,
  },

  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },

  btnOutline: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  btnOutlineText: {
    ...Typography.bodyMd,
    color: Colors.primary,
    fontWeight: '600',
  },

  btnPrimary: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  btnPrimaryText: {
    ...Typography.bodyMd,
    color: Colors.white,
    fontWeight: '600',
  },

  btnReset: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },

  btnResetText: {
    ...Typography.tiny,
    color: Colors.gray500,
    textDecorationLine: 'underline',
  },
});
