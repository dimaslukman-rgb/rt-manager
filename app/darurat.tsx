import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Badge, Card, EmptyState, LoadingState, PrimaryButton, Screen, SectionTitle } from '@/components/ui';
import { isSirenPlaying, playPanicAlertBeep, startEmergencySiren, stopEmergencySiren } from '@/lib/siren';
import { broadcastPanicAlert } from '@/components/emergency-listener';
import type { KategoriDarurat, LaporanDarurat, StatusDarurat } from '@/lib/types';
import { formatTanggal } from '@/lib/format';

const KATEGORI_LIST: KategoriDarurat[] = [
  'Orang Mencurigakan',
  'Pencurian/Kejahatan',
  'Medis/Sakit Kritis',
  'Kebakaran',
  'Bencana/Pohon Tumbang',
  'Bantuan Mendesak',
];

export default function DaruratScreen() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const [tab, setTab] = useState<'lapor' | 'security'>('lapor');
  const [loading, setLoading] = useState(true);
  const [laporanList, setLaporanList] = useState<LaporanDarurat[]>([]);
  const [sirenOn, setSirenOn] = useState(false);

  // Form State
  const [nama, setNama] = useState('');
  const [alamat, setAlamat] = useState('');
  const [telepon, setTelepon] = useState('');
  const [kategori, setKategori] = useState<KategoriDarurat>('Orang Mencurigakan');
  const [keterangan, setKeterangan] = useState('');
  const [fotoUri, setFotoUri] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alertSuccess, setAlertSuccess] = useState(false);

  const loadLaporan = useCallback(async () => {
    try {
      const rows = await db.getAllAsync<LaporanDarurat>(
        `SELECT * FROM darurat ORDER BY CASE WHEN status = 'Aktif' THEN 0 WHEN status = 'Ditangani' THEN 1 ELSE 2 END, id DESC`
      );
      setLaporanList(rows);
      setSirenOn(isSirenPlaying());
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadLaporan();
    }, [loadLaporan])
  );

  // Auto-detect GPS on first open
  useEffect(() => {
    detectLocation();
  }, []);

  function detectLocation() {
    setGpsLoading(true);
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
          setGpsLoading(false);
        },
        (err) => {
          console.warn('GPS error:', err.message);
          // Fallback to Jakarta area if permission denied
          if (!lat) {
            setLat(-6.2088);
            setLng(106.8456);
          }
          setGpsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLat(-6.2088);
      setLng(106.8456);
      setGpsLoading(false);
    }
  }

  function handlePhotoUpload(e: any) {
    const file = e.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFotoUri(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function toggleSiren() {
    if (isSirenPlaying()) {
      stopEmergencySiren();
      setSirenOn(false);
    } else {
      startEmergencySiren();
      setSirenOn(true);
    }
  }

  async function kirimPanicButton() {
    if (!nama.trim()) {
      showAlert('Wajib Diisi', 'Mohon masukkan nama pelapor.');
      return;
    }
    if (!telepon.trim()) {
      showAlert('Wajib Diisi', 'Mohon masukkan nomor HP aktif yang dapat dihubungi.');
      return;
    }
    if (!keterangan.trim()) {
      showAlert('Wajib Diisi', 'Mohon jelaskan keterangan situasi darurat.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Trigger loud siren sound
      startEmergencySiren();
      setSirenOn(true);
      playPanicAlertBeep();

      // 2. Save into database
      await db.runAsync(
        `INSERT INTO darurat (nama_pelapor, alamat_pelapor, telepon_pelapor, kategori, keterangan, foto_uri, latitude, longitude, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Aktif')`,
        nama.trim(),
        alamat.trim(),
        telepon.trim(),
        kategori,
        keterangan.trim(),
        fotoUri,
        lat ?? -6.2088,
        lng ?? 106.8456
      );

      setAlertSuccess(true);
      broadcastPanicAlert();
      await loadLaporan();
      setTab('security');
    } catch (e: any) {
      showAlert('Gagal Mengirim Laporan', e?.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(id: number, nextStatus: StatusDarurat) {
    await db.runAsync('UPDATE darurat SET status = ? WHERE id = ?', nextStatus, id);
    if (nextStatus === 'Selesai' || nextStatus === 'Ditangani') {
      stopEmergencySiren();
      setSirenOn(false);
    }
    broadcastPanicAlert();
    await loadLaporan();
  }

  async function callPhone(phone: string) {
    if (!phone) return;
    const url = `tel:${phone.replace(/[^\d+]/g, '')}`;
    Linking.openURL(url).catch(() => showAlert('Panggilan Gagal', 'Perangkat tidak mendukung panggilan telepon.'));
  }

  async function openWhatsApp(phone: string, l: LaporanDarurat) {
    if (!phone) return;
    let clean = phone.replace(/[^\d]/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    if (clean.startsWith('8')) clean = '62' + clean;

    const text = encodeURIComponent(
      `🚨 *[PANIC BUTTON RT - DARURAT]*\n` +
      `Halo Bpk/Ibu *${l.nama_pelapor}* (${l.alamat_pelapor}), kami dari Tim Keamanan/Security RT telah menerima sinyal darurat:\n` +
      `📌 *Kategori:* ${l.kategori}\n` +
      `📝 *Keterangan:* ${l.keterangan}\n` +
      (l.latitude && l.longitude ? `📍 *Peta Lokasi:* https://www.google.com/maps?q=${l.latitude},${l.longitude}\n` : '') +
      `Petugas sedang meluncur ke lokasi Anda!`
    );

    const waUrl = `https://wa.me/${clean}?text=${text}`;
    Linking.openURL(waUrl).catch(() => showAlert('WhatsApp Gagal', 'Tidak dapat membuka aplikasi WhatsApp.'));
  }

  function openMaps(latitude: number | null, longitude: number | null) {
    if (!latitude || !longitude) return;
    const url = `https://www.google.com/maps?q=${latitude},${longitude}`;
    Linking.openURL(url);
  }

  function showAlert(title: string, msg: string) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  }

  if (loading) return <LoadingState />;

  const aktifCount = laporanList.filter((x) => x.status === 'Aktif').length;

  return (
    <Screen>
      {/* Siren Emergency Alert Banner */}
      <View style={[styles.sirenBanner, { backgroundColor: sirenOn ? '#dc2626' : '#1f2937' }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sirenTitle}>
            {sirenOn ? '🚨 SIRINE DARURAT SEDANG BUNYI!' : '🛡️ Sistem Panic Button Aktif'}
          </Text>
          <Text style={styles.sirenSub}>
            {sirenOn ? 'Sinyal bahaya berbunyi ke pos security & patroli' : 'Tekan tombol darurat saat membutuhkan bantuan segera'}
          </Text>
        </View>
        <Pressable
          onPress={toggleSiren}
          style={[styles.sirenBtn, { backgroundColor: sirenOn ? '#ffffff' : '#dc2626' }]}>
          <Text style={[styles.sirenBtnText, { color: sirenOn ? '#dc2626' : '#ffffff' }]}>
            {sirenOn ? 'Matikan Sirine' : 'Tes Sirine'}
          </Text>
        </Pressable>
      </View>

      {/* Mode Switch Tabs */}
      <View style={styles.tabSwitch}>
        <Pressable
          onPress={() => setTab('lapor')}
          style={[
            styles.tabItem,
            tab === 'lapor' && { backgroundColor: Colors[scheme].primary, borderColor: Colors[scheme].primary },
          ]}>
          <Text style={[styles.tabItemText, tab === 'lapor' && { color: '#fff', fontWeight: '800' }]}>
            🚨 Lapor Darurat (Warga)
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('security')}
          style={[
            styles.tabItem,
            tab === 'security' && { backgroundColor: Colors[scheme].primary, borderColor: Colors[scheme].primary },
          ]}>
          <Text style={[styles.tabItemText, tab === 'security' && { color: '#fff', fontWeight: '800' }]}>
            👮 Security & Patroli {aktifCount > 0 && `(${aktifCount})`}
          </Text>
        </Pressable>
      </View>

      {tab === 'lapor' ? (
        <View>
          {alertSuccess && (
            <View style={styles.successBox}>
              <Text style={styles.successTitle}>✅ Sinyal Panic Button Berhasil Dikirim!</Text>
              <Text style={styles.successSub}>
                Sirine telah dibunyikan dan data darurat telah diteruskan ke tim security.
              </Text>
            </View>
          )}

          <Card style={styles.panicCard}>
            <Text style={styles.formHeading}>Kirim Sinyal Bahaya / Bantuan Cepat</Text>
            <Text style={[styles.formSub, { color: Colors[scheme].muted }]}>
              Data Anda akan langsung diteruskan ke seluruh tim security gerbang & regu patroli.
            </Text>

            <SectionTitle>1. Kategori Situasi Darurat</SectionTitle>
            <View style={styles.kategoriGrid}>
              {KATEGORI_LIST.map((k) => {
                const active = k === kategori;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setKategori(k)}
                    style={[
                      styles.kategoriChip,
                      {
                        backgroundColor: active ? '#fee2e2' : Colors[scheme].card,
                        borderColor: active ? '#dc2626' : Colors[scheme].border,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.kategoriChipText,
                        { color: active ? '#dc2626' : Colors[scheme].text, fontWeight: active ? '700' : '500' },
                      ]}>
                      {k}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <SectionTitle>2. Data Diri Pelapor</SectionTitle>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: Colors[scheme].muted }]}>Nama Pelapor *</Text>
              <TextInput
                placeholder="Contoh: Bpk. Bambang"
                placeholderTextColor={Colors[scheme].muted}
                value={nama}
                onChangeText={setNama}
                style={[styles.input, { backgroundColor: Colors[scheme].background, borderColor: Colors[scheme].border, color: Colors[scheme].text }]}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: Colors[scheme].muted }]}>Alamat / Blok No. Rumah</Text>
              <TextInput
                placeholder="Contoh: Blok B4 No. 12"
                placeholderTextColor={Colors[scheme].muted}
                value={alamat}
                onChangeText={setAlamat}
                style={[styles.input, { backgroundColor: Colors[scheme].background, borderColor: Colors[scheme].border, color: Colors[scheme].text }]}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: Colors[scheme].muted }]}>
                Nomor HP / WhatsApp Aktif * (Untuk Dihubungi Security)
              </Text>
              <TextInput
                placeholder="Contoh: 081234567890"
                placeholderTextColor={Colors[scheme].muted}
                value={telepon}
                onChangeText={setTelepon}
                keyboardType="phone-pad"
                style={[styles.input, { backgroundColor: Colors[scheme].background, borderColor: Colors[scheme].border, color: Colors[scheme].text }]}
              />
            </View>

            <SectionTitle>3. Keterangan Kejadian</SectionTitle>
            <View style={styles.fieldGroup}>
              <TextInput
                placeholder="Jelaskan detail situasi darurat, ciri-ciri pelaku, kondisi korban, atau bantuan yang dibutuhkan..."
                placeholderTextColor={Colors[scheme].muted}
                value={keterangan}
                onChangeText={setKeterangan}
                multiline
                numberOfLines={3}
                style={[styles.input, styles.textArea, { backgroundColor: Colors[scheme].background, borderColor: Colors[scheme].border, color: Colors[scheme].text }]}
              />
            </View>

            <SectionTitle>4. Lokasi GPS & Foto Kondisi Lapangan</SectionTitle>
            <View style={styles.locationBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.locationLabel}>
                  {lat && lng ? '📍 Koordinat GPS Terkunci' : '⚠️ Menunggu Deteksi GPS'}
                </Text>
                <Text style={[styles.locationCoord, { color: Colors[scheme].muted }]}>
                  {lat && lng ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'Nyalakan GPS lokasi pada perangkat Anda'}
                </Text>
              </View>
              <Pressable
                onPress={detectLocation}
                disabled={gpsLoading}
                style={[styles.gpsBtn, { backgroundColor: Colors[scheme].primaryMuted }]}>
                <Text style={{ color: Colors[scheme].primary, fontWeight: '700', fontSize: 12 }}>
                  {gpsLoading ? 'Mencari...' : '🔄 Perbarui GPS'}
                </Text>
              </Pressable>
            </View>

            {/* Photo Attachment */}
            <View style={{ marginTop: 12, marginBottom: 20 }}>
              <Text style={[styles.fieldLabel, { color: Colors[scheme].muted }]}>Foto Kondisi / Bukti Lapangan</Text>
              {Platform.OS === 'web' && (
                <input
                  type="file"
                  id="darurat-foto-file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  style={{ display: 'none' }}
                />
              )}
              {fotoUri ? (
                <View style={styles.photoPreviewWrapper}>
                  <Image source={{ uri: fotoUri }} style={styles.photoPreview} />
                  <Pressable
                    onPress={() => setFotoUri('')}
                    style={styles.deletePhotoBtn}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✕ Hapus Foto</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    if (Platform.OS === 'web') {
                      document.getElementById('darurat-foto-file')?.click();
                    } else {
                      showAlert('Upload Foto', 'Pilih foto atau ambil dari kamera perangkat.');
                    }
                  }}
                  style={[styles.uploadBtn, { borderColor: Colors[scheme].border, backgroundColor: Colors[scheme].background }]}>
                  <Text style={{ fontSize: 24, marginBottom: 4 }}>📷</Text>
                  <Text style={{ fontWeight: '700', color: Colors[scheme].text }}>Ambil / Upload Foto Lapangan</Text>
                  <Text style={{ fontSize: 12, color: Colors[scheme].muted, marginTop: 2 }}>
                    Kamera HP atau File Gambar
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Panic Button Trigger */}
            <Pressable
              onPress={kirimPanicButton}
              disabled={submitting}
              style={[styles.bigPanicBtn, { opacity: submitting ? 0.6 : 1 }]}>
              <Text style={styles.bigPanicIcon}>🚨</Text>
              <Text style={styles.bigPanicText}>KIRIM SINYAL PANIC BUTTON</Text>
              <Text style={styles.bigPanicSub}>Bunyikan sirine & teruskan darurat ke Security</Text>
            </Pressable>
          </Card>
        </View>
      ) : (
        <View>
          <SectionTitle>Laporan Darurat Masuk ({laporanList.length})</SectionTitle>
          {laporanList.length === 0 ? (
            <EmptyState message="Belum ada laporan darurat. Lingkungan aman dan kondusif." />
          ) : (
            laporanList.map((l) => {
              const isAktif = l.status === 'Aktif';
              const isDitangani = l.status === 'Ditangani';

              return (
                <Card
                  key={l.id}
                  style={[
                    styles.reportCard,
                    isAktif && { borderColor: '#dc2626', borderWidth: 2, backgroundColor: '#fef2f2' },
                  ]}>
                  {/* Header Item */}
                  <View style={styles.reportHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Badge
                          label={l.status.toUpperCase()}
                          variant={isAktif ? 'danger' : isDitangani ? 'warning' : 'success'}
                        />
                        <Text style={styles.reportCategory}>{l.kategori}</Text>
                      </View>
                      <Text style={[styles.reportDate, { color: Colors[scheme].muted }]}>
                        {formatTanggal(l.created_at.slice(0, 10))} · {l.created_at.slice(11, 16) || 'Baru saja'}
                      </Text>
                    </View>
                  </View>

                  {/* Pelapor Info */}
                  <View style={styles.pelaporInfo}>
                    <Text style={styles.pelaporName}>👤 {l.nama_pelapor}</Text>
                    {l.alamat_pelapor ? (
                      <Text style={[styles.pelaporDetail, { color: Colors[scheme].muted }]}>
                        🏠 {l.alamat_pelapor}
                      </Text>
                    ) : null}
                    <Text style={[styles.pelaporDetail, { color: Colors[scheme].muted }]}>
                      📞 {l.telepon_pelapor}
                    </Text>
                  </View>

                  {/* Keterangan */}
                  <View style={styles.keteranganBox}>
                    <Text style={styles.keteranganText}>"{l.keterangan}"</Text>
                  </View>

                  {/* Foto Lapangan */}
                  {l.foto_uri ? (
                    <View style={{ marginTop: 10 }}>
                      <Text style={[styles.fieldLabel, { color: Colors[scheme].muted }]}>📸 Foto Kondisi:</Text>
                      <Image source={{ uri: l.foto_uri }} style={styles.reportPhoto} />
                    </View>
                  ) : null}

                  {/* Action Buttons for Security */}
                  <View style={styles.actionGrid}>
                    <Pressable
                      onPress={() => callPhone(l.telepon_pelapor)}
                      style={[styles.securityActionBtn, { backgroundColor: '#2563eb' }]}>
                      <Text style={styles.securityActionText}>📞 Panggil Telepon</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => openWhatsApp(l.telepon_pelapor, l)}
                      style={[styles.securityActionBtn, { backgroundColor: '#16a34a' }]}>
                      <Text style={styles.securityActionText}>💬 Call WhatsApp</Text>
                    </Pressable>
                  </View>

                  {l.latitude && l.longitude ? (
                    <Pressable
                      onPress={() => openMaps(l.latitude, l.longitude)}
                      style={[styles.mapsBtn, { backgroundColor: Colors[scheme].primaryMuted }]}>
                      <Text style={[styles.mapsBtnText, { color: Colors[scheme].primary }]}>
                        📍 Buka Peta Lokasi di Google Maps ({l.latitude.toFixed(4)}, {l.longitude.toFixed(4)})
                      </Text>
                    </Pressable>
                  ) : null}

                  {/* Status Toggle Buttons */}
                  <View style={styles.statusActionRow}>
                    {isAktif && (
                      <Pressable
                        onPress={() => updateStatus(l.id, 'Ditangani')}
                        style={[styles.statusBtn, { backgroundColor: '#d97706' }]}>
                        <Text style={styles.statusBtnText}>🛡️ Tangani Laporan</Text>
                      </Pressable>
                    )}
                    {l.status !== 'Selesai' && (
                      <Pressable
                        onPress={() => updateStatus(l.id, 'Selesai')}
                        style={[styles.statusBtn, { backgroundColor: '#059669' }]}>
                        <Text style={styles.statusBtnText}>✅ Tandai Selesai</Text>
                      </Pressable>
                    )}
                  </View>
                </Card>
              );
            })
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sirenBanner: {
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  sirenTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  sirenSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 2,
  },
  sirenBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  sirenBtnText: {
    fontWeight: '800',
    fontSize: 13,
  },
  tabSwitch: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  tabItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  successBox: {
    backgroundColor: '#dcfce7',
    borderColor: '#16a34a',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  successTitle: {
    color: '#15803d',
    fontWeight: '800',
    fontSize: 15,
  },
  successSub: {
    color: '#166534',
    fontSize: 13,
    marginTop: 4,
  },
  panicCard: {
    padding: 18,
  },
  formHeading: {
    fontSize: 18,
    fontWeight: '800',
  },
  formSub: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 12,
  },
  kategoriGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  kategoriChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  kategoriChipText: {
    fontSize: 13,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    gap: 10,
  },
  locationLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  locationCoord: {
    fontSize: 12,
    marginTop: 2,
  },
  gpsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  uploadBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPreviewWrapper: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 6,
  },
  photoPreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  deletePhotoBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  bigPanicBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#dc2626',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  bigPanicIcon: {
    fontSize: 36,
    marginBottom: 4,
  },
  bigPanicText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bigPanicSub: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    marginTop: 4,
  },
  reportCard: {
    marginBottom: 16,
    padding: 16,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  reportCategory: {
    fontSize: 15,
    fontWeight: '800',
  },
  reportDate: {
    fontSize: 12,
    marginTop: 4,
  },
  pelaporInfo: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    gap: 4,
  },
  pelaporName: {
    fontSize: 14,
    fontWeight: '700',
  },
  pelaporDetail: {
    fontSize: 12,
  },
  keteranganBox: {
    paddingVertical: 4,
    marginBottom: 8,
  },
  keteranganText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  reportPhoto: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    marginTop: 6,
    resizeMode: 'cover',
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  securityActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityActionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  mapsBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapsBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  statusBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});
