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
import type { JadwalSecurity, SecurityPersonel, ShiftSecurity, StatusSecurity } from '@/lib/types';

const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as const;
const SHIFT_LIST: ShiftSecurity[] = [
  'Pagi - Siang (05:00 - 17:00)',
  'Sore - Malam (17:00 - 05:00)',
];
const STATUS_LIST: StatusSecurity[] = ['Aktif', 'Cuti', 'Off'];

export default function SecurityScreen() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const { currentUser, hasRole } = useAuth();
  const canManage = hasRole('ADMIN', 'KETUA_RT');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [personelList, setPersonelList] = useState<SecurityPersonel[]>([]);
  const [jadwalList, setJadwalList] = useState<JadwalSecurity[]>([]);
  const [selectedHari, setSelectedHari] = useState<string>('Semua');

  // Modal Personil State
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [nama, setNama] = useState('');
  const [nik, setNik] = useState('');
  const [noHp, setNoHp] = useState('');
  const [posJaga, setPosJaga] = useState('Pos Gerbang Utama');
  const [jabatan, setJabatan] = useState('Anggota Security');
  const [shiftTetap, setShiftTetap] = useState<ShiftSecurity>('Pagi - Siang (05:00 - 17:00)');
  const [status, setStatus] = useState<StatusSecurity>('Aktif');

  // Detect current real-time shift
  const now = new Date();
  const currentHour = now.getHours();
  const isShiftPagi = currentHour >= 5 && currentHour < 17;
  const currentShiftName: ShiftSecurity = isShiftPagi
    ? 'Pagi - Siang (05:00 - 17:00)'
    : 'Sore - Malam (17:00 - 05:00)';

  const dayIndex = (now.getDay() + 6) % 7; // 0 for Monday, 6 for Sunday
  const todayName = HARI_LIST[dayIndex];

  const loadData = useCallback(async () => {
    try {
      const [personel, jadwal] = await Promise.all([
        db.getAllAsync<SecurityPersonel>('SELECT * FROM security ORDER BY id ASC'),
        db.getAllAsync<JadwalSecurity>('SELECT * FROM jadwal_security ORDER BY id ASC'),
      ]);
      setPersonelList(personel);
      setJadwalList(jadwal);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  function showAlert(title: string, msg: string) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  }

  function handleCall(phone: string) {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  }

  function handleWhatsApp(phone: string, namaPetugas: string) {
    if (!phone) return;
    let clean = phone.replace(/[^\d]/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    if (clean.startsWith('8')) clean = '62' + clean;

    const pesan = encodeURIComponent(
      `Halo *${namaPetugas}* (Security Perumahan Hangtuah),\nSaya ingin koordinasi mengenai keamanan lingkungan.\nTerima kasih.`
    );
    Linking.openURL(`https://wa.me/${clean}?text=${pesan}`);
  }

  function openAddModal() {
    setEditId(null);
    setNama('');
    setNik('');
    setNoHp('');
    setPosJaga('Pos Gerbang Utama');
    setJabatan('Anggota Security');
    setShiftTetap('Pagi - Siang (05:00 - 17:00)');
    setStatus('Aktif');
    setModalVisible(true);
  }

  function openEditModal(item: SecurityPersonel) {
    setEditId(item.id);
    setNama(item.nama);
    setNik(item.nik || '');
    setNoHp(item.no_hp);
    setPosJaga(item.pos_jaga);
    setJabatan(item.jabatan);
    setShiftTetap(item.shift_tetap);
    setStatus(item.status);
    setModalVisible(true);
  }

  async function handleSimpanPersonil() {
    if (!nama.trim()) {
      showAlert('Wajib Diisi', 'Masukkan nama personil security.');
      return;
    }
    if (!noHp.trim()) {
      showAlert('Wajib Diisi', 'Masukkan nomor telepon/WA personil security.');
      return;
    }

    setSaving(true);
    try {
      if (editId) {
        await db.runAsync(
          `UPDATE security SET nama = ?, nik = ?, no_hp = ?, pos_jaga = ?, jabatan = ?, shift_tetap = ?, status = ? WHERE id = ?`,
          nama.trim(),
          nik.trim(),
          noHp.trim(),
          posJaga.trim(),
          jabatan.trim(),
          shiftTetap,
          status,
          editId
        );
      } else {
        await db.runAsync(
          `INSERT INTO security (nama, nik, no_hp, pos_jaga, jabatan, shift_tetap, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          nama.trim(),
          nik.trim(),
          noHp.trim(),
          posJaga.trim(),
          jabatan.trim(),
          shiftTetap,
          status
        );
      }

      setModalVisible(false);
      await loadData();
      showAlert('Berhasil', editId ? 'Data personil security diperbarui.' : 'Personil security baru berhasil ditambahkan.');
    } catch (e: any) {
      showAlert('Gagal Menyimpan', e?.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSaving(false);
    }
  }

  async function handleHapusPersonil(item: SecurityPersonel) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Hapus data personil security ${item.nama}?`)) {
        await db.runAsync('DELETE FROM security WHERE id = ?', item.id);
        await loadData();
      }
    } else {
      Alert.alert('Hapus Personil', `Hapus data ${item.nama}?`, [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            await db.runAsync('DELETE FROM security WHERE id = ?', item.id);
            await loadData();
          },
        },
      ]);
    }
  }

  if (loading) return <LoadingState />;

  // Filter on-duty personnel for current shift
  const onDutyPersonnel = personelList.filter(
    (p) => p.status === 'Aktif' && p.shift_tetap === currentShiftName
  );

  const todayJadwal = jadwalList.filter(
    (j) => j.hari === todayName && j.shift === currentShiftName
  );

  const filteredJadwal =
    selectedHari === 'Semua'
      ? jadwalList
      : jadwalList.filter((j) => j.hari === selectedHari);

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        {/* 1. ON DUTY REAL-TIME BANNER */}
        <Card style={[styles.onDutyCard, { backgroundColor: isShiftPagi ? '#065f46' : '#1e1b4b' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 24 }}>{isShiftPagi ? '☀️' : '🌙'}</Text>
              <View>
                <Text style={styles.onDutyTitle}>SECURITY ON DUTY</Text>
                <Text style={styles.onDutySub}>
                  Hari {todayName} · {currentShiftName}
                </Text>
              </View>
            </View>
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>● LIVE BERDINAS</Text>
            </View>
          </View>

          {todayJadwal.length > 0 && (
            <View style={styles.onDutyScheduleBox}>
              <Text style={styles.onDutyScheduleText}>
                🛡️ Petugas Bertugas: <Text style={{ fontWeight: '800', color: '#fff' }}>{todayJadwal[0].petugas_nama}</Text>
              </Text>
              <Text style={styles.onDutyPosText}>
                📍 Penempatan: {todayJadwal[0].pos_jaga} ({todayJadwal[0].keterangan})
              </Text>
            </View>
          )}

          {/* Quick Contact buttons to On-Duty Personnel */}
          <View style={styles.quickContactRow}>
            {onDutyPersonnel.map((p) => (
              <View key={p.id} style={styles.onDutyPersonCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.onDutyPersonName}>👮 {p.nama}</Text>
                  <Text style={styles.onDutyPersonRole}>{p.jabatan} · {p.pos_jaga}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Pressable onPress={() => handleCall(p.no_hp)} style={styles.callBtn}>
                    <Text style={styles.callBtnText}>📞 Hubungi</Text>
                  </Pressable>
                  <Pressable onPress={() => handleWhatsApp(p.no_hp, p.nama)} style={styles.waBtn}>
                    <Text style={styles.waBtnText}>💬 WA</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* 2. JADWAL DINAS SHIFT MINGGUAN */}
        <SectionTitle>Jadwal Dinas & Shift Security</SectionTitle>
        <Chips
          options={['Semua', ...HARI_LIST]}
          value={selectedHari}
          onChange={(h) => setSelectedHari(h)}
        />

        <View style={{ marginTop: 10 }}>
          {filteredJadwal.map((item) => {
            const isPagi = item.shift.includes('Pagi');
            return (
              <Card key={item.id} style={{ marginBottom: 10 }}>
                <View style={styles.jadwalHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Badge label={item.hari} variant="primary" />
                    <Badge label={isPagi ? '☀️ Pagi - Siang' : '🌙 Sore - Malam'} variant={isPagi ? 'warning' : 'info'} />
                  </View>
                  <Text style={[styles.jadwalPos, { color: Colors[scheme].muted }]}>📍 {item.pos_jaga}</Text>
                </View>

                <Text style={styles.jadwalPetugas}>👮 {item.petugas_nama}</Text>
                <Text style={[styles.jadwalKet, { color: Colors[scheme].muted }]}>
                  ⏰ {item.shift} · {item.keterangan}
                </Text>
              </Card>
            );
          })}
        </View>

        {/* 3. DAFTAR ANGGOTA PERSONIL SECURITY */}
        <View style={styles.sectionHeaderRow}>
          <SectionTitle>Daftar Anggota Security ({personelList.length})</SectionTitle>
          {canManage && (
            <Pressable onPress={openAddModal} style={styles.addInlineBtn}>
              <Text style={{ color: Colors[scheme].primary, fontWeight: '700', fontSize: 13 }}>
                + Tambah Personil
              </Text>
            </Pressable>
          )}
        </View>

        {personelList.map((p) => (
          <Card key={p.id} style={{ marginBottom: 10 }}>
            <View style={styles.personelRow}>
              <View style={styles.avatarBox}>
                <Text style={{ fontSize: 26 }}>👮</Text>
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={styles.personelName}>{p.nama}</Text>
                  <Badge label={p.status} variant={p.status === 'Aktif' ? 'success' : 'danger'} />
                </View>
                <Text style={[styles.personelMeta, { color: Colors[scheme].muted }]}>
                  {p.jabatan} · 📍 {p.pos_jaga}
                </Text>
                <Text style={[styles.personelMeta, { color: Colors[scheme].muted }]}>
                  ⏰ Shift: {p.shift_tetap}
                </Text>
                <Text style={[styles.personelMeta, { color: Colors[scheme].muted }]}>
                  📞 Kontak: {p.no_hp}
                </Text>
              </View>

              <View style={styles.personelActions}>
                <Pressable onPress={() => handleCall(p.no_hp)} style={styles.actionIconBtn}>
                  <Text style={{ fontSize: 16 }}>📞</Text>
                </Pressable>
                <Pressable onPress={() => handleWhatsApp(p.no_hp, p.nama)} style={styles.actionIconBtn}>
                  <Text style={{ fontSize: 16 }}>💬</Text>
                </Pressable>
                {canManage && (
                  <>
                    <Pressable onPress={() => openEditModal(p)} style={styles.actionIconBtn}>
                      <Text style={{ fontSize: 16 }}>✏️</Text>
                    </Pressable>
                    <Pressable onPress={() => handleHapusPersonil(p)} style={[styles.actionIconBtn, { backgroundColor: '#fee2e2' }]}>
                      <Text style={{ fontSize: 16, color: '#dc2626' }}>🗑️</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          </Card>
        ))}
      </Screen>

      {canManage && <FAB label="Tambah Security" onPress={openAddModal} />}

      {/* Modal Tambah/Edit Personil Security (Khusus Super Admin & Ketua RT) */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBody, { backgroundColor: Colors[scheme].card }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {editId ? '✏️ Edit Data Personil Security' : '👮 Tambah Personil Security Baru'}
              </Text>
              <Text style={[styles.modalSub, { color: Colors[scheme].muted }]}>
                Hanya dapat dikelola oleh Super Admin & Ketua RT.
              </Text>

              <Field
                label="Nama Lengkap Personil"
                value={nama}
                onChangeText={setNama}
                placeholder="Contoh: Bpk. Joko Susilo"
              />

              <Field
                label="NIK (Nomor Induk Kependudukan - Opsional)"
                value={nik}
                onChangeText={setNik}
                placeholder="16 Digit NIK"
                keyboardType="number-pad"
              />

              <Field
                label="Nomor WhatsApp / HP"
                value={noHp}
                onChangeText={setNoHp}
                placeholder="08xxxxxxxxxx"
                keyboardType="phone-pad"
              />

              <Field
                label="Pos Jaga / Penempatan"
                value={posJaga}
                onChangeText={setPosJaga}
                placeholder="Contoh: Pos Gerbang Utama / Patroli Lingkungan"
              />

              <Field
                label="Jabatan"
                value={jabatan}
                onChangeText={setJabatan}
                placeholder="Contoh: Komandan Regu (Danru) / Anggota Security"
              />

              <SectionTitle>Shift Tetap</SectionTitle>
              <Chips options={SHIFT_LIST} value={shiftTetap} onChange={(s) => setShiftTetap(s as ShiftSecurity)} />

              <SectionTitle>Status Keaktifan</SectionTitle>
              <Chips options={STATUS_LIST} value={status} onChange={(st) => setStatus(st as StatusSecurity)} />

              <View style={{ marginTop: 16 }}>
                <PrimaryButton
                  title={saving ? 'Menyimpan...' : 'Simpan Personil Security'}
                  onPress={handleSimpanPersonil}
                  disabled={saving || !nama.trim() || !noHp.trim()}
                  loading={saving}
                />
              </View>

              <Pressable onPress={() => setModalVisible(false)} style={{ marginTop: 12, marginBottom: 16 }}>
                <Text style={{ textAlign: 'center', color: Colors[scheme].muted, fontWeight: '600' }}>Batal</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  onDutyCard: {
    borderColor: 'transparent',
    padding: 16,
    marginBottom: 14,
    borderRadius: 16,
  },
  onDutyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  onDutySub: {
    color: '#e2e8f0',
    fontSize: 12,
    marginTop: 2,
  },
  liveBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  onDutyScheduleBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    marginBottom: 8,
  },
  onDutyScheduleText: {
    color: '#e2e8f0',
    fontSize: 13,
  },
  onDutyPosText: {
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 2,
  },
  quickContactRow: {
    marginTop: 6,
    gap: 8,
  },
  onDutyPersonCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  onDutyPersonName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  onDutyPersonRole: {
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 1,
  },
  callBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  callBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  waBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  waBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  jadwalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  jadwalPos: {
    fontSize: 12,
  },
  jadwalPetugas: {
    fontSize: 15,
    fontWeight: '800',
  },
  jadwalKet: {
    fontSize: 12,
    marginTop: 3,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  addInlineBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  personelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBox: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personelName: {
    fontSize: 15,
    fontWeight: '800',
  },
  personelMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  personelActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 12,
    marginBottom: 12,
  },
});
