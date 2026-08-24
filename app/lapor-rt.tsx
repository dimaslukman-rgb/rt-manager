import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Badge, Card, Chips, EmptyState, Field, LoadingState, PrimaryButton, Screen, SectionTitle } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatTanggal } from '@/lib/format';
import type { KategoriLaporan, LaporPakRT, StatusLaporan } from '@/lib/types';

const KATEGORI_LIST: KategoriLaporan[] = [
  'Aduan Lingkungan',
  'Keamanan & Ketertiban',
  'Fasilitas & Lampu Jalan',
  'Kebersihan & Sampah',
  'Administrasi & Iuran',
  'Usulan & Saran',
];

export default function LaporPakRTScreen() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const { currentUser, isWarga } = useAuth();

  const [activeTab, setActiveTab] = useState<'buat' | 'riwayat'>('buat');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [laporanList, setLaporanList] = useState<LaporPakRT[]>([]);

  // Form State
  const [namaCustom, setNamaCustom] = useState('');
  const [noHpCustom, setNoHpCustom] = useState('');
  const [judul, setJudul] = useState('');
  const [kategori, setKategori] = useState<KategoriLaporan>('Aduan Lingkungan');
  const [isi, setIsi] = useState('');
  const [alamat, setAlamat] = useState('');
  const [fotoUri, setFotoUri] = useState('');

  const loadRiwayat = useCallback(async () => {
    try {
      let rows: LaporPakRT[] = [];
      if (currentUser?.id && !isWarga) {
        rows = await db.getAllAsync<LaporPakRT>(
          'SELECT * FROM lapor_rt WHERE pengguna_id = ? ORDER BY id DESC',
          currentUser.id
        );
      } else {
        rows = await db.getAllAsync<LaporPakRT>('SELECT * FROM lapor_rt ORDER BY id DESC');
      }
      setLaporanList(rows);
    } finally {
      setLoading(false);
    }
  }, [db, currentUser, isWarga]);

  useFocusEffect(
    useCallback(() => {
      loadRiwayat();
    }, [loadRiwayat])
  );

  function showAlert(title: string, msg: string) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  }

  async function handleKirimLaporan() {
    if (!judul.trim()) {
      showAlert('Wajib Diisi', 'Mohon isi judul aduan atau aspirasi Anda.');
      return;
    }
    if (!isi.trim()) {
      showAlert('Wajib Diisi', 'Mohon tuliskan isi laporan/keluhan secara rinci.');
      return;
    }

    setSaving(true);
    try {
      const namaPelapor = namaCustom.trim() || 'Warga Anonim';
      const noHpPelapor = noHpCustom.trim() || '';
      const alamatPelapor = alamat.trim() || 'Perumahan Hangtuah';

      await db.runAsync(
        `INSERT INTO lapor_rt (pengguna_id, nama_pelapor, no_hp_pelapor, alamat_pelapor, judul, kategori, isi, foto_uri, status, tanggal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Terkirim', datetime('now'))`,
        currentUser?.id ?? null,
        namaPelapor,
        noHpPelapor,
        alamatPelapor,
        judul.trim(),
        kategori,
        isi.trim(),
        fotoUri.trim()
      );

      // Reset form
      setJudul('');
      setIsi('');
      setAlamat('');
      setNamaCustom('');
      setNoHpCustom('');
      setFotoUri('');

      await loadRiwayat();
      setActiveTab('riwayat');
      showAlert('Laporan Terkirim! 🚀', 'Laporan Anda telah berhasil terkirim ke Inbox Pengurus RT (Ketua, Wakil, Bendahara, & Sekretaris).');
    } catch (e: any) {
      showAlert('Gagal Mengirim', e?.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSaving(false);
    }
  }

  function getStatusVariant(s: StatusLaporan) {
    switch (s) {
      case 'Terkirim':
        return 'warning';
      case 'Dibaca':
        return 'info';
      case 'Ditindaklanjuti':
        return 'primary';
      case 'Selesai':
        return 'success';
      default:
        return 'info';
    }
  }

  if (loading) return <LoadingState />;

  return (
    <Screen>
      {/* Header Banner */}
      <Card style={[styles.heroCard, { backgroundColor: '#0e9f6e' }]}>
        <Text style={styles.heroTitle}>📢 Lapor Pak RT!</Text>
        <Text style={styles.heroSub}>
          Layanan aspirasi, pengaduan fasilitas, kebersihan, keamanan, dan keluhan warga (Bisa Anonim / Bebas Identitas).
        </Text>
      </Card>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <Pressable
          onPress={() => setActiveTab('buat')}
          style={[
            styles.tabButton,
            activeTab === 'buat' && { backgroundColor: Colors[scheme].primary },
          ]}>
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'buat' ? '#fff' : Colors[scheme].text },
            ]}>
            ✍️ Buat Laporan / Aduan
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('riwayat')}
          style={[
            styles.tabButton,
            activeTab === 'riwayat' && { backgroundColor: Colors[scheme].primary },
          ]}>
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'riwayat' ? '#fff' : Colors[scheme].text },
            ]}>
            📋 Riwayat Laporan ({laporanList.length})
          </Text>
        </Pressable>
      </View>

      {activeTab === 'buat' ? (
        <Card>
          <Text style={styles.formTitle}>Formulir Laporan / Aspirasi Warga</Text>
          <Text style={[styles.formDesc, { color: Colors[scheme].muted }]}>
            Laporan ini bersifat <Text style={{ fontWeight: '700' }}>rahasia</Text> dan diteruskan langsung ke jajaran Pengurus RT.
          </Text>

          <Field
            label="Nama Pelapor / Inisial (Opsional / Boleh Dikosongkan)"
            value={namaCustom}
            onChangeText={setNamaCustom}
            placeholder="Kosongkan jika ingin Anonim (atau isi misal: Warga Blok B)"
          />

          <Field
            label="No. WhatsApp / HP untuk Dihubungi (Opsional)"
            value={noHpCustom}
            onChangeText={setNoHpCustom}
            placeholder="08xxxxxxxxxx (Kosongkan jika tidak ingin dihubungi)"
            keyboardType="phone-pad"
          />

          <Field
            label="Alamat / Lokasi Kejadian"
            value={alamat}
            onChangeText={setAlamat}
            placeholder="Contoh: Lampu Depan Rumah Blok B3 No. 12"
          />

          <Field
            label="Judul Laporan / Keluhan"
            value={judul}
            onChangeText={setJudul}
            placeholder="Contoh: Lampu jalan mati di Blok B3, Tumpukan Sampah, dll"
          />

          <SectionTitle>Pilih Kategori Laporan</SectionTitle>
          <Chips
            options={KATEGORI_LIST}
            value={kategori}
            onChange={(k) => setKategori(k as KategoriLaporan)}
          />

          <View style={styles.fieldWrapper}>
            <Text style={[styles.fieldLabel, { color: Colors[scheme].muted }]}>Isi Laporan / Keluhan Lengkap</Text>
            <TextInput
              placeholder="Ceritakan detail kejadian, waktu, atau saran perbaikan yang Anda harapkan..."
              placeholderTextColor={Colors[scheme].muted}
              value={isi}
              onChangeText={setIsi}
              multiline
              numberOfLines={4}
              style={[
                styles.textArea,
                { backgroundColor: Colors[scheme].background, borderColor: Colors[scheme].border, color: Colors[scheme].text },
              ]}
            />
          </View>

          {/* Info Privasi Anonim */}
          <View style={[styles.privacyBox, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
            <Text style={{ color: '#166534', fontSize: 12, fontWeight: '700' }}>
              🔒 Privasi Warga Terjaga
            </Text>
            <Text style={{ color: '#15803d', fontSize: 11, marginTop: 2, lineHeight: 16 }}>
              Anda dapat mengirim laporan tanpa mencantumkan identitas (Anonim). Laporan akan tetap masuk dan diproses oleh pengurus RT.
            </Text>
          </View>

          <View style={{ marginTop: 14 }}>
            <PrimaryButton
              title={saving ? 'Mengirim...' : 'Kirim Laporan ke Pengurus RT 🚀'}
              onPress={handleKirimLaporan}
              disabled={saving || !judul.trim() || !isi.trim()}
              loading={saving}
            />
          </View>
        </Card>
      ) : (
        <View>
          <SectionTitle>Riwayat Laporan Warga ({laporanList.length})</SectionTitle>
          {laporanList.length === 0 ? (
            <EmptyState message="Belum ada laporan atau aduan yang dikirim. Klik tab 'Buat Laporan / Aduan' untuk mengirim aspirasi." />
          ) : (
            laporanList.map((item) => (
              <Card key={item.id} style={{ marginBottom: 12 }}>
                <View style={styles.laporanHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                      <Badge label={item.status} variant={getStatusVariant(item.status)} />
                      <Badge label={item.kategori} variant="info" />
                    </View>
                    <Text style={styles.laporanJudul}>{item.judul}</Text>
                    <Text style={[styles.laporanDate, { color: Colors[scheme].muted }]}>
                      👤 {item.nama_pelapor || 'Warga Anonim'} · 📅 {formatTanggal(item.tanggal)} {item.alamat_pelapor ? `· 📍 ${item.alamat_pelapor}` : ''}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.laporanIsi, { color: Colors[scheme].text }]}>{item.isi}</Text>

                {/* Balasan dari Pengurus RT */}
                {item.tanggapan ? (
                  <View style={[styles.tanggapanBox, { backgroundColor: '#f0fdf4', borderColor: '#86efac' }]}>
                    <Text style={{ color: '#166534', fontSize: 13, fontWeight: '800' }}>
                      💬 Tanggapan dari {item.ditanggapi_oleh || 'Pengurus RT'}:
                    </Text>
                    <Text style={{ color: '#15803d', fontSize: 13, marginTop: 4, lineHeight: 18 }}>
                      {item.tanggapan}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.tanggapanBox, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
                    <Text style={{ color: Colors[scheme].muted, fontSize: 12, fontStyle: 'italic' }}>
                      ⏳ Menunggu respon / tindakan dari jajaran Pengurus RT.
                    </Text>
                  </View>
                )}
              </Card>
            ))
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderColor: 'transparent',
    marginBottom: 12,
    padding: 18,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },
  heroSub: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  formDesc: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 12,
  },
  fieldWrapper: {
    marginTop: 10,
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 90,
  },
  privacyBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    marginBottom: 6,
  },
  laporanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  laporanJudul: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  laporanDate: {
    fontSize: 12,
    marginTop: 3,
  },
  laporanIsi: {
    fontSize: 14,
    lineHeight: 20,
    marginVertical: 10,
  },
  tanggapanBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
  },
});
