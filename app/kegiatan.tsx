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
import type { JenisKegiatan, Kegiatan } from '@/lib/types';

const JENIS: JenisKegiatan[] = ['Rapat', 'Kerja Bakti', 'Sosial', 'Keagamaan', 'Perayaan', 'Lainnya'];

export default function KegiatanScreen() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Kegiatan[]>([]);
  const [modal, setModal] = useState(false);
  const [judul, setJudul] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [tanggal, setTanggal] = useState(todayISO());
  const [waktu, setWaktu] = useState('');
  const [lokasi, setLokasi] = useState('');
  const [jenis, setJenis] = useState<JenisKegiatan>('Rapat');

  const load = useCallback(async () => {
    try {
      const all = await db.getAllAsync<Kegiatan>(
        'SELECT * FROM kegiatan ORDER BY tanggal DESC, id DESC'
      );
      setRows(all);
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
    if (!judul.trim()) return;
    await db.runAsync(
      'INSERT INTO kegiatan (judul, deskripsi, tanggal, waktu, lokasi, jenis) VALUES (?, ?, ?, ?, ?, ?)',
      judul.trim(),
      deskripsi.trim(),
      tanggal || todayISO(),
      waktu.trim(),
      lokasi.trim(),
      jenis
    );
    setModal(false);
    setJudul('');
    setDeskripsi('');
    setWaktu('');
    setLokasi('');
    load();
  }

  async function hapus(id: number) {
    Alert.alert('Hapus Kegiatan', 'Hapus kegiatan ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await db.runAsync('DELETE FROM kegiatan WHERE id = ?', id);
          load();
        },
      },
    ]);
  }

  if (loading) return <LoadingState />;

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        {rows.length === 0 ? (
          <EmptyState message="Belum ada kegiatan" />
        ) : (
          rows.map((k) => (
            <Card key={k.id}>
              <Pressable onPress={() => hapus(k.id)}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{k.judul}</Text>
                    <Text style={[styles.meta, { color: Colors[scheme].muted }]}>
                      {formatTanggal(k.tanggal)} {k.waktu ? `· ${k.waktu}` : ''}
                      {k.lokasi ? `\n📍 ${k.lokasi}` : ''}
                    </Text>
                    {k.deskripsi ? (
                      <Text style={[styles.desc, { color: Colors[scheme].muted }]}>{k.deskripsi}</Text>
                    ) : null}
                  </View>
                  <Badge label={k.jenis} variant="info" />
                </View>
              </Pressable>
            </Card>
          ))
        )}
      </Screen>
      <FAB label="Kegiatan" onPress={() => setModal(true)} />

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBody, { backgroundColor: Colors[scheme].card }]}>
            <Text style={styles.modalTitle}>Tambah Kegiatan</Text>
            <Field label="Judul" value={judul} onChangeText={setJudul} placeholder="e.g. Kerja bakti RW" />
            <Field label="Deskripsi" value={deskripsi} onChangeText={setDeskripsi} placeholder="Keterangan kegiatan" multiline />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Field label="Tanggal" value={tanggal} onChangeText={setTanggal} placeholder="2025-01-15" />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Field label="Waktu" value={waktu} onChangeText={setWaktu} placeholder="08:00" />
              </View>
            </View>
            <Field label="Lokasi" value={lokasi} onChangeText={setLokasi} placeholder="Balai RW / Jalan ..." />
            <SectionTitle>Jenis</SectionTitle>
            <Chips options={JENIS} value={jenis} onChange={(v) => setJenis(v)} />
            <PrimaryButton title="Simpan" onPress={simpan} disabled={!judul.trim()} />
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
  desc: {
    fontSize: 13,
    marginTop: 6,
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
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
  },
  cancel: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
  },
});