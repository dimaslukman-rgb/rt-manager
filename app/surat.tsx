import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Badge, Card, Chips, EmptyState, FAB, Field, LoadingState, PrimaryButton, Screen, SectionTitle } from '@/components/ui';
import { todayISO } from '@/lib/db';
import { formatTanggal } from '@/lib/format';
import type { StatusSurat, Surat, Warga } from '@/lib/types';

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
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Surat[]>([]);
  const [wargaList, setWargaList] = useState<Warga[]>([]);
  const [modal, setModal] = useState(false);
  const [jenisSurat, setJenisSurat] = useState<typeof JENIS_SURAT[number]>('Surat Pengantar SKCK');
  const [pemohonId, setPemohonId] = useState('');
  const [keperluan, setKeperluan] = useState('');

  const load = useCallback(async () => {
    try {
      const [surat, warga] = await Promise.all([
        db.getAllAsync<Surat>(
          `SELECT s.*, COALESCE(w.nama, '—') as pemohon_nama
           FROM surat s LEFT JOIN warga w ON w.id = s.pemohon_id
           ORDER BY s.tanggal_pengajuan DESC, s.id DESC`
        ),
        db.getAllAsync<Warga>('SELECT * FROM warga ORDER BY nama ASC'),
      ]);
      setRows(surat);
      setWargaList(warga);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function simpan() {
    if (!pemohonId) return;
    await db.runAsync(
      'INSERT INTO surat (pemohon_id, jenis_surat, keperluan, status, tanggal_pengajuan) VALUES (?, ?, ?, ?, ?)',
      Number(pemohonId),
      jenisSurat,
      keperluan,
      'Diajukan',
      todayISO()
    );
    setModal(false);
    setPemohonId('');
    setKeperluan('');
    load();
  }

  async function updateStatus(id: number) {
    const surat = rows.find((r) => r.id === id);
    if (!surat) return;
    Alert.alert('Ubah Status', `Status saat ini: ${surat.status}`, [
      { text: 'Batal', style: 'cancel' },
      ...STATUS.map((s) => ({
        text: s,
        onPress: async () => {
          await db.runAsync(
            'UPDATE surat SET status = ?, tanggal_selesai = ? WHERE id = ?',
            s,
            s === 'Selesai' ? todayISO() : null,
            id
          );
          load();
        },
      })),
    ]);
  }

  if (loading) return <LoadingState />;

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        {rows.length === 0 ? (
          <EmptyState message="Belum ada pengajuan surat" />
        ) : (
          rows.map((s) => (
            <Card key={s.id}>
              <Pressable onPress={() => updateStatus(s.id)}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{s.jenis_surat}</Text>
                    <Text style={[styles.meta, { color: Colors[scheme].muted }]}>
                      Pemohon: {s.pemohon_nama} · {formatTanggal(s.tanggal_pengajuan)}
                    </Text>
                    {s.keperluan ? (
                      <Text style={[styles.meta, { color: Colors[scheme].muted }]}>Keperluan: {s.keperluan}</Text>
                    ) : null}
                  </View>
                  <Badge label={s.status} variant={statusVariant[s.status]} />
                </View>
              </Pressable>
            </Card>
          ))
        )}
      </Screen>
      <FAB label="Pengajuan" onPress={() => setModal(true)} />

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBody, { backgroundColor: Colors[scheme].card }]}>
            <Text style={styles.modalTitle}>Ajukan Surat</Text>

            <Text style={[styles.fieldLabel, { color: Colors[scheme].muted }]}>Pemohon</Text>
            {wargaList.length === 0 ? (
              <Text style={{ color: Colors[scheme].danger, marginBottom: 10 }}>
                Belum ada warga. Tambahkan warga dulu.
              </Text>
            ) : (
              <Chips
                options={wargaList.map((w) => String(w.id)) as never}
                value={pemohonId}
                onChange={setPemohonId}
              />
            )}
            {wargaList.length > 0 && (
              <Text style={[styles.hint, { color: Colors[scheme].muted }]}>
                {wargaList.slice(0, 8).map((w) => `${w.id}: ${w.nama}`).join('  ·  ')}
              </Text>
            )}

            <SectionTitle>Jenis Surat</SectionTitle>
            <Chips options={JENIS_SURAT} value={jenisSurat} onChange={(v) => setJenisSurat(v)} />

            <Field
              label="Keperluan"
              value={keperluan}
              onChangeText={setKeperluan}
              placeholder="Keperluan pengajuan surat"
              multiline
            />
            <PrimaryButton title="Ajukan" onPress={simpan} disabled={!pemohonId} />
            <Pressable onPress={() => setModal(false)} style={{ marginTop: 12 }}>
              <Text style={[styles.cancel, { color: Colors[scheme].muted }]}>Batal</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    marginTop: 3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalBody: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '88%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  hint: {
    fontSize: 12,
    marginTop: -6,
    marginBottom: 8,
  },
  cancel: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
  },
});