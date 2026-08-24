import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Badge, Card, LoadingState, PrimaryButton, Screen, SectionTitle } from '@/components/ui';
import type { Pengguna, RoleUser } from '@/lib/types';

const STORAGE_USER_KEY = '@rtmanager_current_user_v1';

export interface AuthContextValue {
  currentUser: Pengguna | null;
  role: RoleUser | null;
  isAuthenticated: boolean;
  login: (user: Pengguna) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: RoleUser[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthGate');
  return context;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Pengguna | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_USER_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setCurrentUser(parsed);
        } catch {}
      }
      setLoading(false);
    });
  }, []);

  async function login(user: Pengguna) {
    setCurrentUser(user);
    await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
  }

  async function logout() {
    setCurrentUser(null);
    await AsyncStorage.removeItem(STORAGE_USER_KEY);
  }

  function hasRole(...roles: RoleUser[]): boolean {
    if (!currentUser) return false;
    if (currentUser.role === 'ADMIN') return true; // Super Admin has universal access
    return roles.includes(currentUser.role);
  }

  if (loading) return <LoadingState />;

  if (!currentUser) {
    return <MultiRoleLoginScreen onLoginSuccess={login} />;
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role: currentUser.role,
        isAuthenticated: true,
        login,
        logout,
        hasRole,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

function MultiRoleLoginScreen({ onLoginSuccess }: { onLoginSuccess: (user: Pengguna) => Promise<void> }) {
  const db = useSQLiteContext();
  const scheme = useColorScheme();

  const [step, setStep] = useState<'kredensial' | 'otp'>('kredensial');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [targetUser, setTargetUser] = useState<Pengguna | null>(null);

  // OTP State
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [timer, setTimer] = useState(60);
  const [loadingAction, setLoadingAction] = useState(false);
  const [otpNotification, setOtpNotification] = useState<string | null>(null);

  // Countdown timer for OTP
  useEffect(() => {
    let interval: any = null;
    if (step === 'otp' && timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  function showAlert(title: string, msg: string) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  }

  function generate6DigitOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async function handleVerifyCredentials() {
    if (!identifier.trim()) {
      showAlert('Wajib Diisi', 'Masukkan Username atau Nomor HP Anda.');
      return;
    }
    if (!password.trim()) {
      showAlert('Wajib Diisi', 'Masukkan Password Anda.');
      return;
    }

    setLoadingAction(true);
    try {
      const user = await db.getFirstAsync<Pengguna>(
        `SELECT * FROM pengguna WHERE (username = ? OR no_hp = ?) AND aktif = 1`,
        identifier.trim().toLowerCase(),
        identifier.trim()
      );

      if (!user) {
        showAlert('Akun Tidak Ditemukan', 'Username atau No. HP tidak terdaftar sebagai pengurus.');
        return;
      }

      if (user.password !== password.trim()) {
        showAlert('Password Salah', 'Password yang Anda masukkan tidak sesuai.');
        return;
      }

      // Credentials match -> Generate OTP and proceed
      const newOtp = generate6DigitOtp();
      setGeneratedOtp(newOtp);
      setTargetUser(user);
      setOtpInput('');
      setTimer(60);
      setStep('otp');

      // Show security OTP banner
      setOtpNotification(
        `🔐 KODE VERIFIKASI OTP: ${newOtp}\nKode keamanan untuk ${user.nama_lengkap} (${user.role}). Jangan berikan kepada siapapun.`
      );
    } catch (e: any) {
      showAlert('Gagal Login', e?.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoadingAction(false);
    }
  }

  function handleKirimWhatsApp() {
    if (!targetUser || !generatedOtp) return;
    let clean = targetUser.no_hp.replace(/[^\d]/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    if (clean.startsWith('8')) clean = '62' + clean;

    const message = encodeURIComponent(
      `🔐 *[KODE OTP RT MANAGER]*\n` +
      `Halo *${targetUser.nama_lengkap}*,\n` +
      `Kode verifikasi login Anda adalah: *${generatedOtp}*\n` +
      `Gunakan kode ini untuk masuk sebagai *${targetUser.role}*.\n` +
      `Jangan berikan kode ini kepada siapapun demi keamanan.`
    );

    Linking.openURL(`https://wa.me/${clean}?text=${message}`).catch(() => {
      showAlert('Info OTP', `Kode OTP Anda adalah: ${generatedOtp}`);
    });
  }

  function handleResendOtp() {
    const newOtp = generate6DigitOtp();
    setGeneratedOtp(newOtp);
    setTimer(60);
    setOtpInput('');
    setOtpNotification(`🔐 KODE OTP BARU: ${newOtp}`);
  }

  async function handleVerifyOtp() {
    if (!otpInput.trim()) {
      showAlert('Wajib Diisi', 'Masukkan 6 digit kode OTP.');
      return;
    }

    if (otpInput.trim() !== generatedOtp) {
      showAlert('Kode OTP Salah', 'Kode OTP yang Anda masukkan tidak sesuai.');
      return;
    }

    if (targetUser) {
      await onLoginSuccess(targetUser);
    }
  }

  // Quick Demo Account Helper
  function fillDemoAccount(u: string, p: string) {
    setIdentifier(u);
    setPassword(p);
  }

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header Branding */}
        <View style={styles.brandHeader}>
          <Text style={{ fontSize: 44, textAlign: 'center', marginBottom: 6 }}>🏡</Text>
          <Text style={styles.brandTitle}>RT MANAGER</Text>
          <Text style={[styles.brandSub, { color: Colors[scheme].muted }]}>
            Perumahan Hangtuah · Grand Residence City
          </Text>
        </View>

        {step === 'kredensial' ? (
          <Card style={styles.cardBox}>
            <Text style={styles.cardHeading}>Masuk Pengurus RT</Text>
            <Text style={[styles.cardDesc, { color: Colors[scheme].muted }]}>
              Silakan login dengan Username / No HP dan Password Anda.
            </Text>

            <View style={styles.fieldWrapper}>
              <Text style={[styles.fieldLabel, { color: Colors[scheme].muted }]}>Username atau Nomor HP</Text>
              <TextInput
                placeholder="Contoh: admin atau 081234567890"
                placeholderTextColor={Colors[scheme].muted}
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                style={[
                  styles.input,
                  { backgroundColor: Colors[scheme].background, borderColor: Colors[scheme].border, color: Colors[scheme].text },
                ]}
              />
            </View>

            <View style={styles.fieldWrapper}>
              <Text style={[styles.fieldLabel, { color: Colors[scheme].muted }]}>Password</Text>
              <TextInput
                placeholder="Masukkan password"
                placeholderTextColor={Colors[scheme].muted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={[
                  styles.input,
                  { backgroundColor: Colors[scheme].background, borderColor: Colors[scheme].border, color: Colors[scheme].text },
                ]}
              />
            </View>

            <PrimaryButton
              title={loadingAction ? 'Memverifikasi...' : 'Lanjut ke Verifikasi OTP →'}
              onPress={handleVerifyCredentials}
              disabled={loadingAction || !identifier.trim() || !password.trim()}
            />
          </Card>
        ) : (
          <Card style={styles.cardBox}>
            <Text style={styles.cardHeading}>Verifikasi Kode OTP</Text>
            <Text style={[styles.cardDesc, { color: Colors[scheme].muted }]}>
              Kode OTP 6-digit telah digenerate untuk {targetUser?.nama_lengkap} ({targetUser?.role}) pada nomor{' '}
              {targetUser?.no_hp}.
            </Text>

            {/* Simulated Live OTP Security Box */}
            {otpNotification && (
              <View style={styles.otpBanner}>
                <Text style={styles.otpBannerTitle}>🛡️ SIMULASI SMS / WHATSAPP GATEWAY</Text>
                <Text style={styles.otpBannerCode}>{generatedOtp}</Text>
                <Text style={styles.otpBannerDesc}>
                  Masukkan 6 digit kode di atas untuk verifikasi otentikasi 2 langkah.
                </Text>
              </View>
            )}

            <View style={styles.fieldWrapper}>
              <Text style={[styles.fieldLabel, { color: Colors[scheme].muted }]}>Masukkan 6-Digit Kode OTP</Text>
              <TextInput
                placeholder="6 Digit OTP"
                placeholderTextColor={Colors[scheme].muted}
                value={otpInput}
                onChangeText={(t) => setOtpInput(t.replace(/[^0-9]/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                style={[
                  styles.input,
                  styles.otpInput,
                  { backgroundColor: Colors[scheme].background, borderColor: Colors[scheme].border, color: Colors[scheme].text },
                ]}
              />
            </View>

            <PrimaryButton
              title="✅ Verifikasi & Masuk Sekarang"
              onPress={handleVerifyOtp}
              disabled={otpInput.length !== 6}
            />

            {/* Actions for OTP */}
            <View style={{ marginTop: 14, gap: 10 }}>
              <Pressable
                onPress={handleKirimWhatsApp}
                style={[styles.waBtn, { backgroundColor: '#16a34a' }]}>
                <Text style={styles.waBtnText}>💬 Buka / Kirim OTP ke WhatsApp ({targetUser?.no_hp})</Text>
              </Pressable>

              <View style={styles.resendRow}>
                {timer > 0 ? (
                  <Text style={[styles.timerText, { color: Colors[scheme].muted }]}>
                    Kirim ulang kode dalam {timer} detik
                  </Text>
                ) : (
                  <Pressable onPress={handleResendOtp}>
                    <Text style={{ color: Colors[scheme].primary, fontWeight: '700' }}>
                      🔄 Kirim Ulang Kode OTP
                    </Text>
                  </Pressable>
                )}
              </View>

              <Pressable onPress={() => setStep('kredensial')} style={{ paddingVertical: 8, alignItems: 'center' }}>
                <Text style={{ color: Colors[scheme].muted, fontSize: 13 }}>← Ganti Akun / Kembali</Text>
              </Pressable>
            </View>
          </Card>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    paddingVertical: 20,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#0e9f6e',
  },
  brandSub: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '600',
  },
  cardBox: {
    padding: 22,
  },
  cardHeading: {
    fontSize: 20,
    fontWeight: '800',
  },
  cardDesc: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  fieldWrapper: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  otpInput: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 8,
  },
  demoTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  demoChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  demoChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  demoChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  otpBanner: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  otpBannerTitle: {
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  otpBannerCode: {
    color: '#1e40af',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 6,
    marginVertical: 4,
  },
  otpBannerDesc: {
    color: '#3b82f6',
    fontSize: 11,
    textAlign: 'center',
  },
  waBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  resendRow: {
    alignItems: 'center',
    marginTop: 4,
  },
  timerText: {
    fontSize: 12,
  },
});
