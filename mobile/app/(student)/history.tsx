import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Typography, Shadow, MealColors, MealIcons } from '../../constants/theme';
import { api } from '../../lib/api';

interface HistoryItem {
  id: string;
  scanned_at: string;
  is_manual: boolean;
  meal_windows: {
    meal_type: 'breakfast' | 'lunch' | 'dinner';
    date: string;
  };
}

function HistoryRow({ item }: { item: HistoryItem }) {
  const mealType = item.meal_windows.meal_type;
  const color = MealColors[mealType] ?? Colors.primary;
  const icon = MealIcons[mealType] ?? '🍽️';

  const date = new Date(item.meal_windows.date).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const time = new Date(item.scanned_at).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <View style={[styles.row, Shadow.sm]}>
      <View style={[styles.rowIcon, { backgroundColor: color + '18' }]}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowMeal}>
          {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
          {item.is_manual && <Text style={styles.manualBadge}> (admin)</Text>}
        </Text>
        <Text style={styles.rowDate}>{date} · {time}</Text>
      </View>
      <View style={[styles.checkBadge, { backgroundColor: Colors.successLight }]}>
        <Text style={{ fontSize: 16 }}>✅</Text>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getHistory();
      setHistory(data as HistoryItem[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Meal History</Text>
        <Text style={styles.subtitle}>Last 7 days</Text>
      </View>

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <HistoryRow item={item} />}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 48, marginBottom: Spacing.md }}>📭</Text>
            <Text style={styles.emptyText}>No meals recorded in the last 7 days.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },

  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  title: { ...Typography.h2, color: Colors.black },
  subtitle: { ...Typography.caption, color: Colors.gray400 },

  list: { padding: Spacing.lg, gap: Spacing.sm, paddingTop: 0 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },

  rowIcon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  rowContent: { flex: 1 },
  rowMeal: { ...Typography.bodyMd, color: Colors.black },
  rowDate: { ...Typography.caption, color: Colors.gray500, marginTop: 2 },
  manualBadge: { ...Typography.caption, color: Colors.warning, fontStyle: 'italic' },
  checkBadge: { width: 36, height: 36, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { ...Typography.body, color: Colors.gray400, textAlign: 'center' },
});
