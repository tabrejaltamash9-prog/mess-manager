import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Vibration,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Typography } from '../../constants/theme';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

export default function StaffScanner() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [counter, setCounter] = useState<{ scanned: number; total: number } | null>(null);
  const [currentWindowId, setCurrentWindowId] = useState<string | null>(null);
  const lastScanRef = useRef<string>('');
  const scanCooldown = useRef(false);

  useEffect(() => {
    requestPermission();
    loadCurrentWindow();
  }, []);

  // Refresh counter every 15s
  useEffect(() => {
    if (!currentWindowId) return;
    const t = setInterval(() => loadCounter(currentWindowId), 15000);
    return () => clearInterval(t);
  }, [currentWindowId]);

  async function loadCurrentWindow() {
    try {
      const data = await api.getCurrentMeal();
      if (data.window?.id) {
        setCurrentWindowId(data.window.id);
        loadCounter(data.window.id);
      }
    } catch {}
  }

  async function loadCounter(windowId: string) {
    try {
      const c = await api.getScanCounter(windowId);
      setCounter(c);
    } catch {}
  }

  async function handleBarCodeScanned({ data }: { data: string }) {
    if (scanCooldown.current || data === lastScanRef.current) return;

    scanCooldown.current = true;
    lastScanRef.current = data;
    setScanning(false);

    try {
      Vibration.vibrate(80);
      const result = await api.verifyScan(data);

      router.push({
        pathname: '/(staff)/result',
        params: { resultJson: JSON.stringify(result) },
      });

      // Refresh counter
      if (currentWindowId) loadCounter(currentWindowId);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Scan failed. Try again.', [
        { text: 'OK', onPress: () => { setScanning(true); scanCooldown.current = false; lastScanRef.current = ''; } },
      ]);
    }
  }

  // Resume scanning when coming back from result screen
  useFocusEffect(
    useCallback(() => {
      const resume = () => {
        setScanning(true);
        scanCooldown.current = false;
        lastScanRef.current = '';
      };
      // Small delay to allow result screen to fully unmount
      const t = setTimeout(resume, 500);
      return () => clearTimeout(t);
    }, [])
  );

  function handleLogout() {
    Alert.alert('Sign Out', 'Sign out of staff mode?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: () => { logout(); router.replace('/(auth)'); },
      },
    ]);
  }

  if (!permission) {
    return <View style={styles.flex} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <Text style={{ fontSize: 56 }}>📷</Text>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionSub}>The scanner needs camera permission to read QR codes.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      {/* Camera */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torchOn}
        onBarcodeScanned={scanning ? handleBarCodeScanned : undefined}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Top Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
        <View>
          <Text style={styles.staffName}>{user?.name}</Text>
          <Text style={styles.staffRole}>Mess Staff · Scanner</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Viewfinder */}
      <View style={styles.viewfinderContainer}>
        <View style={styles.viewfinder}>
          {/* Corner brackets */}
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
        <Text style={styles.scanHint}>Point at student's QR code</Text>
      </View>

      {/* Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.md }]}>
        {/* Counter */}
        {counter && (
          <View style={styles.counterBadge}>
            <Text style={styles.counterText}>
              ✅ {counter.scanned} / {counter.total} scanned
            </Text>
          </View>
        )}

        {/* Torch Toggle */}
        <TouchableOpacity
          style={styles.torchButton}
          onPress={() => setTorchOn((v) => !v)}
          activeOpacity={0.8}
        >
          <Text style={styles.torchIcon}>{torchOn ? '🔦' : '💡'}</Text>
          <Text style={styles.torchLabel}>{torchOn ? 'Torch On' : 'Torch Off'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const BRACKET = 3;
const BRACKET_SIZE = 28;
const VF_SIZE = 250;

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#000' },

  permissionScreen: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  permissionTitle: { ...Typography.h2, color: Colors.black },
  permissionSub: { ...Typography.body, color: Colors.gray500, textAlign: 'center' },
  permBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14,
    marginTop: Spacing.md,
  },
  permBtnText: { ...Typography.bodyMd, color: Colors.white },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  staffName: { ...Typography.h4, color: Colors.white },
  staffRole: { ...Typography.caption, color: 'rgba(255,255,255,0.7)' },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  logoutText: { ...Typography.captionMd, color: Colors.white },

  viewfinderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  viewfinder: {
    width: VF_SIZE,
    height: VF_SIZE,
    position: 'relative',
  },

  corner: {
    position: 'absolute',
    width: BRACKET_SIZE,
    height: BRACKET_SIZE,
    borderColor: Colors.white,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: BRACKET, borderLeftWidth: BRACKET },
  cornerTR: { top: 0, right: 0, borderTopWidth: BRACKET, borderRightWidth: BRACKET },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: BRACKET, borderLeftWidth: BRACKET },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: BRACKET, borderRightWidth: BRACKET },

  scanHint: {
    ...Typography.body,
    color: 'rgba(255,255,255,0.85)',
    marginTop: Spacing.xl,
  },

  bottomBar: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    alignItems: 'center',
    gap: Spacing.md,
  },

  counterBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
  },
  counterText: { ...Typography.bodyMd, color: Colors.white },

  torchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  torchIcon: { fontSize: 18 },
  torchLabel: { ...Typography.caption, color: Colors.white },
});
