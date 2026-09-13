import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Typography, Shadow } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../lib/api';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();

  async function handleLogout() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try { await api.logout(); } catch {}
            logout();
            router.replace('/(auth)');
          },
        },
      ]
    );
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing.md }]}
    >
      {/* Avatar */}
      <View style={styles.avatarSection}>
        {user?.photo_url ? (
          <Image source={{ uri: user.photo_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
        )}
        <Text style={styles.name}>{user?.name}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>Student</Text>
        </View>
      </View>

      {/* Info Card */}
      <View style={[styles.infoCard, Shadow.md]}>
        <Text style={styles.sectionTitle}>Academic Info</Text>
        <InfoRow label="Roll Number" value={user?.roll_no ?? ''} />
        <InfoRow label="Email" value={user?.email ?? ''} />
        <InfoRow label="Department" value={user?.department ?? ''} />
        <InfoRow label="Hostel Block" value={user?.hostel_block ?? ''} />
      </View>

      <Text style={styles.readOnlyNote}>
        ℹ️ Profile details are managed by the admin. Contact admin to make changes.
      </Text>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.85}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.lg, paddingBottom: 40 },

  avatarSection: { alignItems: 'center', marginBottom: Spacing.xl },

  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: Colors.primary,
    marginBottom: Spacing.md,
  },

  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: 3,
    borderColor: Colors.primary,
  },

  avatarInitial: { fontSize: 42, fontWeight: '700', color: Colors.primary },

  name: { ...Typography.h2, color: Colors.black, marginBottom: Spacing.xs },

  roleBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  roleText: { ...Typography.captionMd, color: Colors.primary },

  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },

  sectionTitle: { ...Typography.h4, color: Colors.gray700, marginBottom: Spacing.md },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },

  infoLabel: { ...Typography.caption, color: Colors.gray500 },
  infoValue: { ...Typography.captionMd, color: Colors.black, maxWidth: '60%', textAlign: 'right' },

  readOnlyNote: {
    ...Typography.caption,
    color: Colors.gray400,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },

  logoutButton: {
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.error + '40',
  },

  logoutText: { ...Typography.h4, color: Colors.error },
});
