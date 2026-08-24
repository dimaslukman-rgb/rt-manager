import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth';
import { startEmergencySiren, stopEmergencySiren } from '@/lib/siren';
import type { LaporanDarurat } from '@/lib/types';

// Global custom event name for immediate panic button dispatch
export const PANIC_TRIGGER_EVENT = 'rt_manager_panic_alert_triggered';

export function broadcastPanicAlert() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PANIC_TRIGGER_EVENT));
  }
}

export function EmergencyAlertListener() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const router = useRouter();
  const { currentUser, isSecurity, isPengurus } = useAuth();

  const [activeDarurat, setActiveDarurat] = useState<LaporanDarurat | null>(null);
  const [dismissedId, setDismissedId] = useState<number | null>(null);
  const sirenTriggeredRef = useRef(false);

  // Animation for flashing siren badge
  const flashAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [flashAnim]);

  const checkEmergency = useCallback(async () => {
    if (!currentUser) return;

    try {
      const rows = await db.getAllAsync<LaporanDarurat>(
        "SELECT * FROM darurat WHERE status = 'Aktif' ORDER BY id DESC LIMIT 1"
      );

      if (rows && rows.length > 0) {
        const latest = rows[0];
        if (latest.id !== dismissedId) {
          setActiveDarurat(latest);

          // If current logged-in role is SECURITY, trigger audio siren automatically!
          if (isSecurity && !sirenTriggeredRef.current) {
            sirenTriggeredRef.current = true;
            startEmergencySiren();
          }
        }
      } else {
        if (sirenTriggeredRef.current) {
          stopEmergencySiren();
          sirenTriggeredRef.current = false;
        }
        setActiveDarurat(null);
      }
    } catch (e) {
      // Ignore background query errors
    }
  }, [db, currentUser, isSecurity, dismissedId]);

  // Polling check every 4 seconds + custom event listener
  useEffect(() => {
    checkEmergency();
    const interval = setInterval(checkEmergency, 4000);

    const onCustomEvent = () => checkEmergency();
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener(PANIC_TRIGGER_EVENT, onCustomEvent);
    }

    return () => {
      clearInterval(interval);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener(PANIC_TRIGGER_EVENT, onCustomEvent);
      }
      stopEmergencySiren();
    };
  }, [checkEmergency]);

  // Stop siren when unmounting or changing account
  useEffect(() => {
    return () => {
      stopEmergencySiren();
    };
  }, []);

  async function handleMatikanSirineDanTangani() {
    stopEmergencySiren();
    sirenTriggeredRef.current = false;

    if (activeDarurat) {
      try {
        await db.runAsync(
          "UPDATE darurat SET status = 'Ditangani' WHERE id = ?",
          activeDarurat.id
        );
      } catch {}
      setDismissedId(activeDarurat.id);
      setActiveDarurat(null);
      broadcastPanicAlert();
    }
  }

  function handleDismissPengurus() {
    if (activeDarurat) {
      setDismissedId(activeDarurat.id);
      setActiveDarurat(null);
    }
  }

  function handleCall(phone: string) {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  }

  function handleWA(phone: string, nama: string, lokasi: string) {
    if (!phone) return;
    let clean = phone.replace(/[^\d]/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    if (clean.startsWith('8')) clean = '62' + clean;

    const pesan = encodeURIComponent(
      `Halo *${nama}*,\nSaya *${currentUser?.nama_lengkap || 'Petugas Security/Pengurus RT'}* sedang menanggapi sinyal darurat Anda di *${lokasi}*. Petugas segera menuju lokasi!`
    );
    Linking.openURL(`https://wa.me/${clean}?text=${pesan}`);
  }

  if (!activeDarurat) return null;

  // 1. POPUP / MODAL KHUSUS SECURITY (DENGAN SUARA SIRINE & ALERT MERAH PENUH)
  if (isSecurity) {
    return (
      <Modal visible transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.securityAlertCard}>
            {/* Flashing Siren Header */}
            <Animated.View style={[styles.flasherHeader, { opacity: flashAnim }]}>
              <Text style={styles.flasherText}>🚨 SIAGA SATPAM: PANIC BUTTON AKTIF! 🚨</Text>
            </Animated.View>

            <View style={{ padding: 18 }}>
              <View style={styles.sirenStatusRow}>
                <Text style={{ fontSize: 28 }}>🔊</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sirenPlayingText}>SIRINE POS SATPAM BERBUNYI</Text>
                  <Text style={styles.sirenSubText}>Ada warga yang menekan tombol panik!</Text>
                </View>
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>Detail Panggilan Darurat:</Text>
                <Text style={styles.infoItem}>
                  👤 Pelapor: <Text style={{ fontWeight: '800', color: '#111827' }}>{activeDarurat.nama_pelapor}</Text>
                </Text>
                <Text style={styles.infoItem}>
                  📍 Lokasi: <Text style={{ fontWeight: '800', color: '#dc2626' }}>{activeDarurat.alamat_pelapor || 'Perumahan Hangtuah'}</Text>
                </Text>
                <Text style={styles.infoItem}>
                  ⚠️ Kategori: <Text style={{ fontWeight: '800' }}>{activeDarurat.kategori}</Text>
                </Text>
                {activeDarurat.keterangan ? (
                  <Text style={styles.infoItem}>
                    📝 Keterangan: <Text style={{ fontStyle: 'italic' }}>{activeDarurat.keterangan}</Text>
                  </Text>
                ) : null}
              </View>

              {/* Quick Actions */}
              <View style={styles.actionGrid}>
                {activeDarurat.telepon_pelapor ? (
                  <>
                    <Pressable
                      onPress={() => handleCall(activeDarurat.telepon_pelapor)}
                      style={[styles.btnAction, { backgroundColor: '#2563eb' }]}>
                      <Text style={styles.btnActionText}>📞 Telepon Pelapor</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleWA(activeDarurat.telepon_pelapor, activeDarurat.nama_pelapor, activeDarurat.alamat_pelapor)}
                      style={[styles.btnAction, { backgroundColor: '#16a34a' }]}>
                      <Text style={styles.btnActionText}>💬 WhatsApp Pelapor</Text>
                    </Pressable>
                  </>
                ) : null}
              </View>

              <Pressable
                onPress={handleMatikanSirineDanTangani}
                style={styles.stopSirenBtn}>
                <Text style={styles.stopSirenBtnText}>⏹️ MATIKAN SIRINE & TANGANI LOKASI</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // 2. POPUP NOTIFIKASI SENYAP UNTUK PENGURUS RT (KETUA, WAKIL, BENDAHARA, SEKRETARIS, ADMIN)
  if (isPengurus) {
    return (
      <View style={styles.pengurusFloatingBanner}>
        <View style={styles.pengurusRow}>
          <View style={styles.pengurusIconCircle}>
            <Text style={{ fontSize: 22 }}>🚨</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.pengurusTitle}>
              NOTIFIKASI PANIC BUTTON ({activeDarurat.kategori})
            </Text>
            <Text style={styles.pengurusSub}>
              👤 <Text style={{ fontWeight: '800' }}>{activeDarurat.nama_pelapor}</Text> · 📍 {activeDarurat.alamat_pelapor || 'Lingkungan RT'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Pressable
              onPress={() => {
                handleDismissPengurus();
                router.push('/darurat');
              }}
              style={styles.btnLihat}>
              <Text style={styles.btnLihatText}>Lihat</Text>
            </Pressable>
            <Pressable onPress={handleDismissPengurus} style={styles.btnTutup}>
              <Text style={styles.btnTutupText}>✕</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  securityAlertCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#dc2626',
    elevation: 10,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
  },
  flasherHeader: {
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  flasherText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sirenStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  sirenPlayingText: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '900',
  },
  sirenSubText: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: 2,
  },
  infoBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 8,
  },
  infoItem: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 4,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  btnAction: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActionText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  stopSirenBtn: {
    backgroundColor: '#111827',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopSirenBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  // Silent Banner for Pengurus
  pengurusFloatingBanner: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 8,
    backgroundColor: '#fee2e2',
    borderWidth: 1.5,
    borderColor: '#ef4444',
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  pengurusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pengurusIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pengurusTitle: {
    color: '#991b1b',
    fontSize: 12,
    fontWeight: '900',
  },
  pengurusSub: {
    color: '#7f1d1d',
    fontSize: 11,
    marginTop: 2,
  },
  btnLihat: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnLihatText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  btnTutup: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTutupText: {
    color: '#7f1d1d',
    fontSize: 12,
    fontWeight: '800',
  },
});
