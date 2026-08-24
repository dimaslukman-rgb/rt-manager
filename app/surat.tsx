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
import { Badge, Card, Chips, EmptyState, FAB, Field, LoadingState, PrimaryButton, Screen, SectionTitle } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { todayISO } from '@/lib/db';
import { formatTanggal } from '@/lib/format';
import type { StatusSurat, Surat } from '@/lib/types';

const JENIS_SURAT = [
  'Surat Pengantar SKCK',
  'Surat Pengantar KTP',
  'Surat Pengantar KK',
  'Surat Domisili',
  'Surat Keterangan Usaha',
  'Surat Kehilangan',
  'Surat Pengantar Nikah',
  'Lainnya',
] as const;

const STATUS: StatusSurat[] = ['Diajukan', 'Diproses', 'Selesai', 'Ditolak'];

const statusVariant: Record<StatusSurat, 'warning' | 'info' | 'success' | 'danger'> = {
  Diajukan: 'warning',
  Diproses: 'info',
  Selesai: 'success',
  Ditolak: 'danger',
};

export default function SuratScreen() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const { isWarga, currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Surat[]>([]);

  // Form State Pengajuan
  const [modal, setModal] = useState(false);
  const [namaPemohon, setNamaPemohon] = useState('');
  const [nikPemohon, setNikPemohon] = useState('');
  const [alamatPemohon, setAlamatPemohon] = useState('');
  const [noHpPemohon, setNoHpPemohon] = useState('');
  const [jenisSurat, setJenisSurat] = useState<typeof JENIS_SURAT[number]>('Surat Pengantar SKCK');
  const [keperluan, setKeperluan] = useState('');

  // Modal Update Status untuk Pengurus
  const [statusModal, setStatusModal] = useState(false);
  const [selectedSurat, setSelectedSurat] = useState<Surat | null>(null);
  const [newStatus, setNewStatus] = useState<StatusSurat>('Diproses');
  const [catatanPengurus, setCatatanPengurus] = useState('');

  const load = useCallback(async () => {
    try {
      const surat = await db.getAllAsync<Surat>(
        `SELECT s.*, COALESCE(w.nama, s.nama_pemohon, 'Warga') as pemohon_nama
         FROM surat s LEFT JOIN warga w ON w.id = s.pemohon_id
         ORDER BY s.tanggal_pengajuan DESC, s.id DESC`
      );
      setRows(surat);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function showAlert(title: string, msg: string) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  }

  async function handleSimpanPengajuan() {
    if (!namaPemohon.trim()) {
      showAlert('Wajib Diisi', 'Mohon isi Nama Lengkap Pemohon.');
      return;
    }
    if (!alamatPemohon.trim()) {
      showAlert('Wajib Diisi', 'Mohon isi Alamat / Blok Rumah.');
      return;
    }
    if (!keperluan.trim()) {
      showAlert('Wajib Diisi', 'Mohon isi Keperluan Pengajuan Surat.');
      return;
    }

    setSaving(true);
    try {
      await db.runAsync(
        `INSERT INTO surat (nama_pemohon, nik_pemohon, no_hp_pemohon, alamat_pemohon, jenis_surat, keperluan, status, tanggal_pengajuan)
         VALUES (?, ?, ?, ?, ?, ?, 'Diajukan', ?)`,
        namaPemohon.trim(),
        nikPemohon.trim(),
        noHpPemohon.trim(),
        alamatPemohon.trim(),
        jenisSurat,
        keperluan.trim(),
        todayISO()
      );

      setModal(false);
      setNamaPemohon('');
      setNikPemohon('');
      setAlamatPemohon('');
      setNoHpPemohon('');
      setKeperluan('');
      await load();
      showAlert('Berhasil Mengajukan! 📄', 'Pengajuan surat pengantar Anda telah terkirim dan akan segera diproses oleh Pengurus RT.');
    } catch (e: any) {
      showAlert('Gagal', e?.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSaving(false);
    }
  }

  function openStatusModal(surat: Surat) {
    if (isWarga) return; // Warga hanya melihat
    setSelectedSurat(surat);
    setNewStatus(surat.status);
    setCatatanPengurus(surat.catatan_pengurus || '');
    setStatusModal(true);
  }

  async function handleSimpanStatus() {
    if (!selectedSurat) return;
    setSaving(true);
    try {
      await db.runAsync(
        'UPDATE surat SET status = ?, catatan_pengurus = ?, tanggal_selesai = ? WHERE id = ?',
        newStatus,
        catatanPengurus.trim(),
        newStatus === 'Selesai' ? todayISO() : null,
        selectedSurat.id
      );

      setStatusModal(false);
      await load();
      showAlert('Status Diperbarui', `Status surat telah diubah menjadi "${newStatus}".`);
    } catch (e: any) {
      showAlert('Gagal', e?.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSaving(false);
    }
  }

  function handleHubungiWA(surat: Surat) {
    const hp = surat.no_hp_pemohon;
    if (!hp) {
      showAlert('Info', 'Nomor telepon pemohon tidak dicantumkan.');
      return;
    }
    let clean = hp.replace(/[^\d]/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    if (clean.startsWith('8')) clean = '62' + clean;

    const nama = surat.nama_pemohon || surat.pemohon_nama || 'Warga';
    const pesan = encodeURIComponent(
      `Halo *${nama}*,\n\nSaya *${currentUser?.nama_lengkap || 'Pengurus RT'}* menginfokan pengajuan *${surat.jenis_surat}* Anda saat ini berstatus: *${surat.status}*.\n${surat.catatan_pengurus ? `\nCatatan: ${surat.catatan_pengurus}\n` : ''}\nTerima kasih.`
    );
    Linking.openURL(`https://wa.me/${clean}?text=${pesan}`);
  }

  async function handleHapus(id: number) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Hapus arsip pengajuan surat ini?')) {
        await db.runAsync('DELETE FROM surat WHERE id = ?', id);
        await load();
      }
    } else {
      Alert.alert('Hapus Surat', 'Hapus arsip pengajuan surat ini?', [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            await db.runAsync('DELETE FROM surat WHERE id = ?', id);
            await load();
          },
        },
      ]);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        {/* Banner Header */}
        <Card style={[styles.heroCard, { backgroundColor: '#0284c7' }]}>
          <Text style={styles.heroTitle}>📄 Surat & Pengajuan Pengantar RT</Text>
          <Text style={styles.heroSub}>
            Layanan pengajuan Surat Pengantar SKCK, KTP, KK, Domisili, Keterangan Usaha, dan keperluan warga lainnya.
          </Text>
        </Card>

        <SectionTitle>Daftar Pengajuan Surat ({rows.length})</SectionTitle>
        {rows.length === 0 ? (
          <EmptyState message="Belum ada pengajuan surat. Klik tombol '+ Ajukan Surat' untuk membuat pengajuan baru." />
        ) : (
          rows.map((s) => (
            <Card key={s.id} style={{ marginBottom: 12 }}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                    <Badge label={s.status} variant={statusVariant[s.status]} />
                    <Badge label={s.jenis_surat} variant="info" />
                  </View>

                  <Text style={styles.title}>{s.jenis_surat}</Text>
                  <Text style={[styles.meta, { color: Colors[scheme].muted }]}>
                    👤 Pemohon: <Text style={{ fontWeight: '700', color: Colors[scheme].text }}>{s.nama_pemohon || s.pemohon_nama || 'Warga'}</Text>
                    {s.nik_pemohon ? ` · NIK: ${s.nik_pemohon}` : ''}
                  </Text>
                  <Text style={[styles.meta, { color: Colors[scheme].muted }]}>
                    📍 {s.alamat_pemohon || 'Perumahan Hangtuah'} · 📅 {formatTanggal(s.tanggal_pengajuan)}
                    {s.no_hp_pemohon ? ` · 📞 ${s.no_hp_pemohon}` : ''}
                  </Text>

                  {s.keperluan ? (
                    <Text style={[styles.keperluanText, { color: Colors[scheme].text }]}>
                      🎯 Keperluan: {s.keperluan}
                    </Text>
                  ) : null}

                  {s.catatan_pengurus ? (
                    <View style={styles.catatanBox}>
                      <Text style={styles.catatanTitle}>💬 Catatan Pengurus RT:</Text>
                      <Text style={styles.catatanIsi}>{s.catatan_pengurus}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Actions */}
              <View style={styles.actionRow}>
                {!isWarga && (
                  <Pressable
                    onPress={() => openStatusModal(s)}
                    style={[styles.btnSmall, { backgroundColor: Colors[scheme].primaryMuted }]}>
                    <Text style={{ color: Colors[scheme].primary, fontWeight: '700', fontSize: 12 }}>
                      ✏️ Ubah Status & Catatan
                    </Text>
                  </Pressable>
                )}

                {s.no_hp_pemohon ? (
                  <Pressable
                    onPress={() => handleHubungiWA(s)}
                    style={[styles.btnSmall, { backgroundColor: '#dcfce7' }]}>
                    <Text style={{ color: '#15803d', fontWeight: '700', fontSize: 12 }}>💬 WhatsApp</Text>
                  </Pressable>
                ) : null}

                {!isWarga && (
                  <Pressable
                    onPress={() => handleHapus(s.id)}
                    style={[styles.btnSmall, { backgroundColor: '#fee2e2' }]}>
                    <Text style={{ color: '#dc2626', fontWeight: '700', fontSize: 12 }}>🗑️</Text>
                  </Pressable>
                )}
              </View>
            </Card>
          ))
        )}
      </Screen>

      <FAB label="Ajukan Surat" onPress={() => setModal(true)} />

      {/* Modal Ajukan Surat Mandiri */}
      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBody, { backgroundColor: Colors[scheme].card }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>📄 Formulir Pengajuan Surat Pengantar</Text>
              <Text style={[styles.modalSub, { color: Colors[scheme].muted }]}>
                Isi data diri Anda dengan lengkap untuk pembuatan surat pengantar resmi RT.
              </Text>

              <Field
                label="Nama Lengkap Pemohon"
                value={namaPemohon}
                onChangeText={setNamaPemohon}
                placeholder="Contoh: Budi Santoso"
              />

              <Field
                label="NIK (Nomor Induk Kependudukan - Opsional)"
                value={nikPemohon}
                onChangeText={setNikPemohon}
                placeholder="16 Digit NIK KTP"
                keyboardType="number-pad"
              />

              <Field
                label="Alamat / Blok Rumah"
                value={alamatPemohon}
                onChangeText={setAlamatPemohon}
                placeholder="Contoh: Blok A3 No. 12"
              />

              <Field
                label="Nomor WhatsApp / HP (Wajib untuk dikabari)"
                value={noHpPemohon}
                onChangeText={setNoHpPemohon}
                placeholder="Contoh: 081234567890"
                keyboardType="phone-pad"
              />

              <SectionTitle>Pilih Jenis Surat</SectionTitle>
              <Chips options={JENIS_SURAT} value={jenisSurat} onChange={(v) => setJenisSurat(v)} />

              <Field
                label="Keperluan Pengajuan Surat"
                value={keperluan}
                onChangeText={setKeperluan}
                placeholder="Contoh: Persyaratan melamar pekerjaan / Pembuatan KTP Baru"
                multiline
              />

              <View style={{ marginTop: 12 }}>
                <PrimaryButton
                  title={saving ? 'Mengirim...' : 'Kirim Pengajuan Surat 📄'}
                  onPress={handleSimpanPengajuan}
                  disabled={saving || !namaPemohon.trim() || !alamatPemohon.trim() || !keperluan.trim()}
                  loading={saving}
                />
              </View>

              <Pressable onPress={() => setModal(false)} style={{ marginTop: 12, marginBottom: 16 }}>
                <Text style={[styles.cancel, { color: Colors[scheme].muted }]}>Batal</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Ubah Status (Khusus Pengurus RT) */}
      <Modal visible={statusModal} transparent animationType="slide" onRequestClose={() => setStatusModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBody, { backgroundColor: Colors[scheme].card }]}>
            <Text style={styles.modalTitle}>✏️ Proses Pengajuan Surat</Text>
            <Text style={[styles.modalSub, { color: Colors[scheme].muted }]}>
              Pemohon: <Text style={{ fontWeight: '700', color: Colors[scheme].text }}>{selectedSurat?.nama_pemohon || selectedSurat?.pemohon_nama}</Text> ({selectedSurat?.jenis_surat})
            </Text>

            <SectionTitle>Ubah Status Surat</SectionTitle>
            <Chips options={STATUS} value={newStatus} onChange={(s) => setNewStatus(s as StatusSurat)} />

            <View style={{ marginTop: 12, marginBottom: 12 }}>
              <Text style={[styles.fieldLabel, { color: Colors[scheme].muted }]}>Catatan untuk Pemohon (Opsional)</Text>
              <TextInput
                placeholder="Contoh: Surat fisik sudah ditandatangani Ketua RT, silakan diambil di rumah Pak RT..."
                placeholderTextColor={Colors[scheme].muted}
                value={catatanPengurus}
                onChangeText={setCatatanPengurus}
                multiline
                numberOfLines={3}
                style={[
                  styles.textArea,
                  { backgroundColor: Colors[scheme].background, borderColor: Colors[scheme].border, color: Colors[scheme].text },
                ]}
              />
            </View>

            <PrimaryButton
              title={saving ? 'Menyimpan...' : 'Simpan Perubahan Status'}
              onPress={handleSimpanStatus}
              disabled={saving}
              loading={saving}
            />

            <Pressable onPress={() => setStatusModal(false)} style={{ marginTop: 12 }}>
              <Text style={[styles.cancel, { color: Colors[scheme].muted }]}>Tutup</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
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
    color: '#e0f2fe',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  meta: {
    fontSize: 12,
    marginTop: 3,
  },
  keperluanText: {
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  catatanBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  catatanTitle: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '800',
  },
  catatanIsi: {
    color: '#15803d',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  btnSmall: {
    paddingHorizontal: 12,
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
    maxHeight: '90%',
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
    minHeight: 70,
  },
  cancel: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
});