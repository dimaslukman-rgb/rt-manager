import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
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
import type { LaporPakRT, StatusLaporan } from '@/lib/types';

const STATUS_FILTERS: (StatusLaporan | 'Semua')[] = ['Semua', 'Terkirim', 'Ditindaklanjuti', 'Selesai'];
const STATUS_OPTIONS: StatusLaporan[] = ['Terkirim', 'Dibaca', 'Ditindaklanjuti', 'Selesai'];

export default function InboxLaporanScreen() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const { currentUser, hasRole } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<StatusLaporan | 'Semua'>('Semua');
  const [laporanList, setLaporanList] = useState<LaporPakRT[]>([]);

  // Response Modal State
  const [selectedLaporan, setSelectedLaporan] = useState<LaporPakRT | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [tanggapanText, setTanggapanText] = useState('');
  const [statusTanggapan, setStatusTanggapan] = useState<StatusLaporan>('Ditindaklanjuti');

  const loadInbox = useCallback(async () => {
    try {
      let query = 'SELECT * FROM lapor_rt ';
      const params: any[] = [];

      if (filterStatus !== 'Semua') {
        query += 'WHERE status = ? ';
        params.push(filterStatus);
      }

      query += 'ORDER BY id DESC';
      const rows = await db.getAllAsync<LaporPakRT>(query, ...params);
      setLaporanList(rows);
    } finally {
      setLoading(false);
    }
  }, [db, filterStatus]);

  useFocusEffect(
    useCallback(() => {
      loadInbox();
    }, [loadInbox])
  );

  function showAlert(title: string, msg: string) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  }

  function openDetailModal(item: LaporPakRT) {
    setSelectedLaporan(item);
    setTanggapanText(item.tanggapan || '');
    setStatusTanggapan(item.status === 'Terkirim' ? 'Ditindaklanjuti' : item.status);
    setModalVisible(true);
  }

  async function handleSimpanTanggapan() {
    if (!selectedLaporan) return;
    setSaving(true);
    try {
      const namaPengurus = currentUser?.nama_lengkap || 'Pengurus RT';
      await db.runAsync(
        `UPDATE lapor_rt SET status = ?, tanggapan = ?, ditanggapi_oleh = ? WHERE id = ?`,
        statusTanggapan,
        tanggapanText.trim(),
        namaPengurus,
        selectedLaporan.id
      );

      setModalVisible(false);
      await loadInbox();
      showAlert('Tanggapan Tersimpan', 'Tanggapan dan status laporan berhasil diperbarui.');
    } catch (e: any) {
      showAlert('Gagal Menyimpan', e?.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSaving(false);
    }
  }

  function handleHubungiWA(noHp: string, nama: string, judulLaporan: string) {
    if (!noHp) {
      showAlert('Info', 'Nomor telepon pelapor tidak tersedia.');
      return;
    }
    let clean = noHp.replace(/[^\d]/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    if (clean.startsWith('8')) clean = '62' + clean;

    const pesan = encodeURIComponent(
      `Halo *${nama}*,\n\nSaya *${currentUser?.nama_lengkap || 'Pengurus RT'}* menanggapi laporan Anda di RT Manager terkait:\n*${judulLaporan}*.\n\nTerima kasih.`
    );
    Linking.openURL(`https://wa.me/${clean}?text=${pesan}`);
  }

  function handleTelepon(noHp: string) {
    if (!noHp) return;
    Linking.openURL(`tel:${noHp}`);
  }

  async function handleHapusLaporan(item: LaporPakRT) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Hapus laporan "${item.judul}" dari warga ${item.nama_pelapor}?`)) {
        await db.runAsync('DELETE FROM lapor_rt WHERE id = ?', item.id);
        await loadInbox();
      }
    } else {
      Alert.alert('Hapus Laporan', `Hapus laporan "${item.judul}"?`, [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            await db.runAsync('DELETE FROM lapor_rt WHERE id = ?', item.id);
            await loadInbox();
          },
        },
      ]);
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

  const unreadCount = laporanList.filter((l) => l.status === 'Terkirim').length;

  return (
    <Screen>
      {/* Header Info */}
      <Card style={[styles.heroCard, { backgroundColor: '#1e293b' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>📥 Kotak Masuk (Inbox) Laporan Warga</Text>
            <Text style={styles.heroSub}>
              Aduan & aspirasi dari warga untuk jajaran Ketua, Wakil, Bendahara, dan Sekretaris RT.
            </Text>
          </View>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount} BARU</Text>
            </View>
          )}
        </View>
      </Card>

      {/* Filter Tabs */}
      <SectionTitle>Filter Status Laporan</SectionTitle>
      <Chips
        options={STATUS_FILTERS}
        value={filterStatus}
        onChange={(val) => setFilterStatus(val as any)}
      />

      <SectionTitle>Daftar Laporan ({laporanList.length})</SectionTitle>
      {laporanList.length === 0 ? (
        <EmptyState message={`Tidak ada laporan warga dengan status "${filterStatus}".`} />
      ) : (
        laporanList.map((item) => (
          <Card key={item.id} style={{ marginBottom: 12 }}>
            <View style={styles.laporanRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                  <Badge label={item.status} variant={getStatusVariant(item.status)} />
                  <Badge label={item.kategori} variant="info" />
                </View>
                <Text style={styles.laporanJudul}>{item.judul}</Text>
                <Text style={[styles.pelaporInfo, { color: Colors[scheme].muted }]}>
                  👤 Dari: <Text style={{ fontWeight: '700', color: Colors[scheme].text }}>{item.nama_pelapor}</Text>
                  {item.alamat_pelapor ? ` · 📍 ${item.alamat_pelapor}` : ''}
                </Text>
                <Text style={[styles.pelaporInfo, { color: Colors[scheme].muted }]}>
                  📅 {formatTanggal(item.tanggal)} {item.no_hp_pelapor ? `· 📞 ${item.no_hp_pelapor}` : ''}
                </Text>
              </View>
            </View>

            <Text style={[styles.laporanIsi, { color: Colors[scheme].text }]}>{item.isi}</Text>

            {/* Tanggapan status preview */}
            {item.tanggapan ? (
              <View style={[styles.tanggapanPreview, { backgroundColor: '#f0fdf4', borderColor: '#86efac' }]}>
                <Text style={{ color: '#166534', fontSize: 12, fontWeight: '800' }}>
                  💬 Tanggapan ({item.ditanggapi_oleh || 'Pengurus'}):
                </Text>
                <Text style={{ color: '#15803d', fontSize: 12, marginTop: 2 }}>{item.tanggapan}</Text>
              </View>
            ) : null}

            {/* Actions for Pengurus */}
            <View style={styles.actionButtons}>
              <Pressable
                onPress={() => openDetailModal(item)}
                style={[styles.btnAction, { backgroundColor: Colors[scheme].primaryMuted }]}>
                <Text style={{ color: Colors[scheme].primary, fontWeight: '700', fontSize: 12 }}>
                  💬 Beri Tanggapan / Ubah Status
                </Text>
              </Pressable>

              {item.no_hp_pelapor ? (
                <Pressable
                  onPress={() => handleHubungiWA(item.no_hp_pelapor, item.nama_pelapor, item.judul)}
                  style={[styles.btnAction, { backgroundColor: '#dcfce7' }]}>
                  <Text style={{ color: '#15803d', fontWeight: '700', fontSize: 12 }}>💬 WhatsApp</Text>
                </Pressable>
              ) : null}

              {hasRole('ADMIN') && (
                <Pressable
                  onPress={() => handleHapusLaporan(item)}
                  style={[styles.btnSmall, { backgroundColor: '#fee2e2' }]}>
                  <Text style={{ color: '#dc2626', fontWeight: '700', fontSize: 12 }}>🗑️</Text>
                </Pressable>
              )}
            </View>
          </Card>
        ))
      )}

      {/* Modal Respon / Balas Laporan Warga */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBody, { backgroundColor: Colors[scheme].card }]}>
            <Text style={styles.modalTitle}>💬 Tanggapan Pengurus RT</Text>
            <Text style={[styles.modalSub, { color: Colors[scheme].muted }]}>
              Laporan: <Text style={{ fontWeight: '700', color: Colors[scheme].text }}>{selectedLaporan?.judul}</Text> dari{' '}
              {selectedLaporan?.nama_pelapor}
            </Text>

            <SectionTitle>Pilih Status Tindak Lanjut</SectionTitle>
            <Chips
              options={STATUS_OPTIONS}
              value={statusTanggapan}
              onChange={(s) => setStatusTanggapan(s as StatusLaporan)}
            />

            <View style={{ marginTop: 12, marginBottom: 12 }}>
              <Text style={[styles.fieldLabel, { color: Colors[scheme].muted }]}>Tuliskan Balasan / Tindakan untuk Warga</Text>
              <TextInput
                placeholder="Contoh: Laporan sudah diterima, petugas kebersihan / security sedang mengecek lokasi..."
                placeholderTextColor={Colors[scheme].muted}
                value={tanggapanText}
                onChangeText={setTanggapanText}
                multiline
                numberOfLines={4}
                style={[
                  styles.textArea,
                  { backgroundColor: Colors[scheme].background, borderColor: Colors[scheme].border, color: Colors[scheme].text },
                ]}
              />
            </View>

            <View style={{ marginTop: 8 }}>
              <PrimaryButton
                title={saving ? 'Menyimpan...' : 'Simpan & Kirim Tanggapan'}
                onPress={handleSimpanTanggapan}
                disabled={saving}
                loading={saving}
              />
            </View>

            <Pressable onPress={() => setModalVisible(false)} style={{ marginTop: 12 }}>
              <Text style={{ textAlign: 'center', color: Colors[scheme].muted, fontWeight: '600' }}>Tutup</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderColor: 'transparent',
    marginBottom: 12,
    padding: 16,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  heroSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  unreadBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  laporanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  laporanJudul: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  pelaporInfo: {
    fontSize: 12,
    marginTop: 2,
  },
  laporanIsi: {
    fontSize: 13,
    lineHeight: 19,
    marginVertical: 10,
  },
  tanggapanPreview: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  btnAction: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnSmall: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBody: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 13,
    marginBottom: 12,
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
    minHeight: 80,
  },
});
