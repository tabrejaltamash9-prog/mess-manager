import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Brightness from 'expo-brightness';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Typography, Shadow, MealColors, MealIcons } from '../../constants/theme';
import { api } from '../../lib/api';

const { width } = Dimensions.get('window');
const QR_SIZE = width * 0.72;

function CountdownRing({ endTime }: { endTime: string }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, new Date(endTime).getTime() - Date.now());
      setRemaining(Math.floor(diff / 1000));
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [endTime]);

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;

  return (
    <View style={ringStyles.container}>
      <Text style={ringStyles.label}>Window closes in</Text>
      <Text style={ringStyles.time}>
        {m}:{s.toString().padStart(2, '0')}
      </Text>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  container: { alignItems: 'center', marginTop: Spacing.md },
  label: { ...Typography.caption, color: Colors.gray400 },
  time: { ...Typography.h3, color: Colors.primary, fontVariant: ['tabular-nums'] },
});

export default function QrScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [window, setWindow] = useState<any>(null);
  const [alreadyScanned, setAlreadyScanned] = useState(false);

  // Pulse animation for the QR frame
  const pulseAnim = new Animated.Value(1);
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.02, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Boost brightness when QR visible
  useEffect(() => {
    let prevBrightness = 1;
    (async () => {
      const { status } = await Brightness.requestPermissionsAsync();
      if (status === 'granted') {
        prevBrightness = await Brightness.getBrightnessAsync();
        await Brightness.setBrightnessAsync(1);
      }
    })();
    return () => {
      Brightness.setBrightnessAsync(prevBrightness).catch(() => {});
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await api.getCurrentMeal();
      if (!data.window) {
        setError('No active meal window right now.');
        return;
      }
      if (data.window.status !== 'open') {
        setError(`Meal window is ${data.window.status}. QR is only available when the window is open.`);
        return;
      }
      if (data.already_scanned) {
        setAlreadyScanned(true);
        setWindow(data.window);
        return;
      }
      setQr(data.qr);
      setWindow(data.window);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const mealColor = window?.meal_type ? MealColors[window.meal_type] : Colors.primary;
  const mealIcon = window?.meal_type ? MealIcons[window.meal_type] : '🍽️';

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (alreadyScanned) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={{ fontSize: 72 }}>✅</Text>
        <Text style={styles.doneTitle}>Meal Already Taken</Text>
        <Text style={styles.doneSubtitle}>Your attendance has been recorded for this meal.</Text>
      </View>
    );
  }

  if (error || !qr) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={{ fontSize: 56 }}>⏰</Text>
        <Text style={styles.errorTitle}>QR Not Available</Text>
        <Text style={styles.errorSub}>{error ?? 'Try again when the meal window opens.'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + Spacing.lg }]}>
      {/* Meal badge */}
      <View style={[styles.mealBadge, { backgroundColor: mealColor + '20' }]}>
        <Text style={styles.mealIcon}>{mealIcon}</Text>
        <Text style={[styles.mealLabel, { color: mealColor }]}>
          {window?.meal_type?.charAt(0).toUpperCase() + window?.meal_type?.slice(1)} QR
        </Text>
      </View>

      <Text style={styles.instruction}>Show this QR code to the mess staff</Text>

      {/* QR Frame */}
      <Animated.View style={[styles.qrFrame, { transform: [{ scale: pulseAnim }], borderColor: mealColor }]}>
        <QRCode
          value={qr}
          size={QR_SIZE}
          color={Colors.black}
          backgroundColor={Colors.white}
          ecl="M"
        />
      </Animated.View>

      {/* Countdown */}
      {window?.end_time && <CountdownRing endTime={window.end_time} />}

      <Text style={styles.hint}>
        🔒 QR is unique to you and this meal. Do not share it.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },

  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },

  mealBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },

  mealIcon: { fontSize: 18 },
  mealLabel: { ...Typography.h4 },

  instruction: {
    ...Typography.body,
    color: Colors.gray500,
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },

  qrFrame: {
    padding: 20,
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    borderWidth: 3,
    ...Shadow.lg,
  },

  hint: {
    ...Typography.caption,
    color: Colors.gray400,
    marginTop: Spacing.xl,
    textAlign: 'center',
    lineHeight: 18,
  },

  doneTitle: { ...Typography.h2, color: Colors.successDark, marginTop: Spacing.md, marginBottom: Spacing.sm },
  doneSubtitle: { ...Typography.body, color: Colors.gray500, textAlign: 'center' },

  errorTitle: { ...Typography.h3, color: Colors.gray700, marginTop: Spacing.md, marginBottom: Spacing.xs },
  errorSub: { ...Typography.body, color: Colors.gray400, textAlign: 'center', marginBottom: Spacing.lg },

  retryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 12,
  },
  retryText: { ...Typography.bodyMd, color: Colors.white },
});
