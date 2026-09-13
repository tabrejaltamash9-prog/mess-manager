import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  ScrollView,
  Vibration,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Typography, Shadow } from '../../constants/theme';

interface ScanResult {
  success: boolean;
  reason?: string;
  student?: {
    name: string;
    roll_no: string;
    email: string;
    department: string | null;
    hostel_block: string | null;
    photo_url: string | null;
  };
  scanned_at?: string;
  already_scanned_at?: string;
}

export default function ScanResultScreen() {
  const insets = useSafeAreaInsets();
  const { resultJson } = useLocalSearchParams<{ resultJson: string }>();
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  let result: ScanResult;
  try {
    result = JSON.parse(resultJson ?? '{}');
  } catch {
    result = { success: false, reason: 'Invalid scan data.' };
  }

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    // Vibration feedback
    if (result.success) {
      Vibration.vibrate([0, 100, 50, 100]); // success pattern
    } else {
      Vibration.vibrate([0, 400]); // error buzz
    }
  }, []);

  const isSuccess = result.success;
  const student = result.student;

  function formatTime(iso?: string) {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  return (
    <View style={[styles.screen, isSuccess ? styles.screenSuccess : styles.screenError]}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + 32 }]}
        bounces={false}
      >
        <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: fadeAnim }}>

          {/* Status Icon */}
          <View style={styles.statusIconContainer}>
            <Text style={styles.statusIcon}>{isSuccess ? '✅' : '❌'}</Text>
          </View>

          {/* Status Text */}
          <Text style={[styles.statusTitle, isSuccess ? styles.textSuccess : styles.textError]}>
            {isSuccess ? 'Meal Approved' : 'Access Denied'}
          </Text>

          {isSuccess ? (
            <>
              {/* Student Photo — primary visual for staff verification */}
              {student?.photo_url ? (
                <View style={styles.photoContainer}>
                  <Image
                    source={{ uri: student.photo_url }}
                    style={styles.studentPhoto}
                    resizeMode="cover"
                  />
                  <View style={styles.photoVerifyBanner}>
                    <Text style={styles.photoVerifyText}>
                      👆 Verify the person in front matches this photo
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.noPhotoPlaceholder}>
                  <Text style={{ fontSize: 48 }}>👤</Text>
                  <Text style={styles.noPhotoText}>No photo registered</Text>
                </View>
              )}

              {/* Student Info */}
              <View style={[styles.infoCard, Shadow.md]}>
                <InfoRow label="Name" value={student?.name ?? ''} large />
                <InfoRow label="Roll No" value={student?.roll_no ?? ''} large />
                <InfoRow label="Email" value={student?.email ?? ''} />
                {student?.department && <InfoRow label="Department" value={student.department} />}
                {student?.hostel_block && <InfoRow label="Block" value={student.hostel_block} />}
                <InfoRow label="Scanned At" value={formatTime(result.scanned_at)} />
              </View>

              {/* Serve button */}
              <TouchableOpacity
                style={styles.serveButton}
                onPress={() => router.back()}
                activeOpacity={0.85}
              >
                <Text style={styles.serveText}>✓ Serve & Scan Next</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Rejection reason */}
              <View style={styles.reasonCard}>
                <Text style={styles.reasonText}>{result.reason ?? 'Unknown error.'}</Text>
                {result.already_scanned_at && (
                  <Text style={styles.alreadyTime}>
                    Recorded at {formatTime(result.already_scanned_at)}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => router.back()}
                activeOpacity={0.85}
              >
                <Text style={styles.retryText}>← Back to Scanner</Text>
              </TouchableOpacity>
            </>
          )}

        </Animated.View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value, large }: { label: string; value: string; large?: boolean }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, large && rowStyles.largeValue]}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  label: { ...Typography.caption, color: Colors.gray500, flex: 1 },
  value: { ...Typography.captionMd, color: Colors.black, flex: 2, textAlign: 'right' },
  largeValue: { ...Typography.bodyMd, color: Colors.black },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  screenSuccess: { backgroundColor: Colors.successLight },
  screenError: { backgroundColor: Colors.errorLight },

  container: { padding: Spacing.lg, alignItems: 'center' },

  statusIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.md,
    ...Shadow.lg,
  },

  statusIcon: { fontSize: 52 },

  statusTitle: {
    ...Typography.h1,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },

  textSuccess: { color: Colors.successDark },
  textError: { color: Colors.errorDark },

  photoContainer: {
    width: '100%',
    marginBottom: Spacing.lg,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.lg,
  },

  studentPhoto: {
    width: '100%',
    height: 300,
    backgroundColor: Colors.gray200,
  },

  photoVerifyBanner: {
    backgroundColor: Colors.warning,
    padding: Spacing.sm,
  },

  photoVerifyText: {
    ...Typography.captionMd,
    color: Colors.white,
    textAlign: 'center',
  },

  noPhotoPlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: Colors.gray100,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  noPhotoText: { ...Typography.body, color: Colors.gray500 },

  infoCard: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },

  serveButton: {
    width: '100%',
    backgroundColor: Colors.success,
    borderRadius: Radius.md,
    paddingVertical: 18,
    alignItems: 'center',
    ...Shadow.md,
  },
  serveText: { ...Typography.h3, color: Colors.white },

  reasonCard: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadow.sm,
  },
  reasonText: { ...Typography.h3, color: Colors.error, textAlign: 'center', marginBottom: Spacing.sm },
  alreadyTime: { ...Typography.body, color: Colors.gray500 },

  retryButton: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.error,
  },
  retryText: { ...Typography.h4, color: Colors.error },
});
