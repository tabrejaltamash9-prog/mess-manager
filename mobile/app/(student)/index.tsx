import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Typography, Shadow, MealColors, MealIcons } from '../../constants/theme';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

interface MealWindow {
  id: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner';
  date: string;
  start_time: string;
  end_time: string;
  status: 'upcoming' | 'open' | 'closed';
}

interface MealData {
  window: MealWindow | null;
  qr: string | null;
  already_scanned: boolean;
  scanned_at: string | null;
}

function Countdown({ targetTime, label }: { targetTime: string; label: string }) {
  const [diff, setDiff] = useState(0);

  useEffect(() => {
    const update = () => setDiff(new Date(targetTime).getTime() - Date.now());
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [targetTime]);

  if (diff <= 0) return null;

  const totalSecs = Math.floor(diff / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  const parts = h > 0
    ? `${h}h ${m}m ${s}s`
    : m > 0
    ? `${m}m ${s}s`
    : `${s}s`;

  return (
    <Text style={styles.countdown}>{label} {parts}</Text>
  );
}

export default function StudentHome() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [data, setData] = useState<MealData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const result = await api.getCurrentMeal();
      setData(result as MealData);
    } catch {
      // handle gracefully
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Poll every 30s to catch window status changes
  useEffect(() => {
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, []);

  const mealType = data?.window?.meal_type;
  const mealColor = mealType ? MealColors[mealType] : Colors.primary;
  const mealIcon = mealType ? MealIcons[mealType] : '🍽️';

  function getMealTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing.md }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Greeting */}
      <View style={styles.greeting}>
        <Text style={styles.greetingText}>Good day, {user?.name?.split(' ')[0]} 👋</Text>
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
      </View>

      {/* Meal Card */}
      {data?.window ? (
        <View style={[styles.mealCard, { borderColor: mealColor }]}>
          <View style={styles.mealCardHeader}>
            <View style={[styles.mealIconBadge, { backgroundColor: mealColor + '20' }]}>
              <Text style={styles.mealIconText}>{mealIcon}</Text>
            </View>
            <View style={styles.mealCardInfo}>
              <Text style={[styles.mealName, { color: mealColor }]}>
                {data.window.meal_type.charAt(0).toUpperCase() + data.window.meal_type.slice(1)}
              </Text>
              <Text style={styles.mealTime}>
                {getMealTime(data.window.start_time)} – {getMealTime(data.window.end_time)}
              </Text>
            </View>
            <View style={[styles.statusBadge,
              data.window.status === 'open' ? styles.statusOpen :
              data.window.status === 'upcoming' ? styles.statusUpcoming :
              styles.statusClosed
            ]}>
              <Text style={styles.statusText}>
                {data.window.status === 'open' ? '● Open' :
                 data.window.status === 'upcoming' ? '● Upcoming' : '● Closed'}
              </Text>
            </View>
          </View>

          {/* Countdown */}
          {data.window.status === 'upcoming' && (
            <Countdown targetTime={data.window.start_time} label="Opens in" />
          )}
          {data.window.status === 'open' && (
            <Countdown targetTime={data.window.end_time} label="Closes in" />
          )}

          {/* Already scanned */}
          {data.already_scanned && (
            <View style={styles.scannedBanner}>
              <Text style={styles.scannedIcon}>✅</Text>
              <Text style={styles.scannedText}>
                Meal taken at {data.scanned_at ? getMealTime(data.scanned_at) : ''}
              </Text>
            </View>
          )}

          {/* QR Button */}
          {data.window.status === 'open' && !data.already_scanned && (
            <TouchableOpacity
              style={[styles.qrButton, { backgroundColor: mealColor }]}
              onPress={() => router.push('/(student)/qr')}
              activeOpacity={0.85}
            >
              <Text style={styles.qrButtonText}>Show My QR Code 📱</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.noMealCard}>
          <Text style={styles.noMealIcon}>😴</Text>
          <Text style={styles.noMealTitle}>No Active Meal</Text>
          <Text style={styles.noMealSubtitle}>
            Check back when the next meal window opens.
          </Text>
        </View>
      )}

      {/* Quick stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, Shadow.sm]}>
          <Text style={styles.statIcon}>📊</Text>
          <Text style={styles.statLabel}>This Week</Text>
          <TouchableOpacity onPress={() => router.push('/(student)/history')}>
            <Text style={[styles.statAction, { color: Colors.primary }]}>View History →</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.statCard, Shadow.sm]}>
          <Text style={styles.statIcon}>👤</Text>
          <Text style={styles.statLabel}>{user?.roll_no ?? 'Roll No'}</Text>
          <TouchableOpacity onPress={() => router.push('/(student)/profile')}>
            <Text style={[styles.statAction, { color: Colors.primary }]}>View Profile →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },

  container: { padding: Spacing.lg, paddingBottom: 32 },

  greeting: { marginBottom: Spacing.lg },
  greetingText: { ...Typography.h2, color: Colors.black },
  dateText: { ...Typography.body, color: Colors.gray500, marginTop: 2 },

  mealCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1.5,
    marginBottom: Spacing.lg,
    ...Shadow.md,
  },

  mealCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  mealIconBadge: { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  mealIconText: { fontSize: 26 },
  mealCardInfo: { flex: 1 },
  mealName: { ...Typography.h4 },
  mealTime: { ...Typography.caption, color: Colors.gray500, marginTop: 2 },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  statusOpen: { backgroundColor: Colors.successLight },
  statusUpcoming: { backgroundColor: Colors.warningLight },
  statusClosed: { backgroundColor: Colors.gray100 },
  statusText: { ...Typography.tiny, fontWeight: '600', color: Colors.gray700 },

  countdown: { ...Typography.captionMd, color: Colors.gray500, marginBottom: Spacing.md, textAlign: 'center' },

  scannedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  scannedIcon: { fontSize: 20, marginRight: Spacing.sm },
  scannedText: { ...Typography.bodyMd, color: Colors.successDark },

  qrButton: {
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    ...Shadow.sm,
  },
  qrButtonText: { ...Typography.h4, color: Colors.white },

  noMealCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadow.sm,
  },
  noMealIcon: { fontSize: 48, marginBottom: Spacing.md },
  noMealTitle: { ...Typography.h3, color: Colors.gray700, marginBottom: Spacing.xs },
  noMealSubtitle: { ...Typography.body, color: Colors.gray400, textAlign: 'center' },

  statsRow: { flexDirection: 'row', gap: Spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
  },
  statIcon: { fontSize: 28, marginBottom: Spacing.xs },
  statLabel: { ...Typography.caption, color: Colors.gray500, marginBottom: Spacing.xs },
  statAction: { ...Typography.captionMd },
});
