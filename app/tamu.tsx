import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Badge, Card, Chips, EmptyState, FAB, Field, LoadingState, PrimaryButton, Screen, SectionTitle } from '@/components/ui';
import { todayISO, currentTime } from '@/lib/db';
import { formatTanggal } from '@/lib/format';
import type { BukuTamu, JenisTamu } from '@/lib/types';

const JENIS_TAMU: JenisTamu[] = ['Tamunan', 'Berkunjung', 'Transaksi', 'Rombongan', 'Lainnya'];

export default function TamuScreen() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BukuTamu[]>([]);
  const [modal, setModal] = useState(false);
  const [nama, setNama] = useState('');
  const [alamat, setAlamat] = useState('');
  const [keperluan, setKeperluan] = useState('');
  const [jenis, setJenis] = useState<JenisTamu>('Berkunjung');
  const [catatan, setCatatan] = useState('');

  const load = useCallback(async () => {
    try {
      const all = await db.getAllAsync<BukuTamu>('SELECT * FROM buku_tamu ORDER BY tanggal DESC, id DESC');
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
    if (!nama.trim() || !keperluan.trim()) return;
    await db.runAsync(
      'INSERT INTO buku_tamu (nama, alamat, keperluan, jenis, tanggal, jam, catatan) VALUES (?, ?, ?, ?, ?, ?, ?)',
      nama.trim(),
      alamat.trim(),
      keperluan.trim(),
      jenis,
      todayISO(),
      currentTime(),
      catatan.trim()
    );
    setModal(false);
    setNama('');
    setAlamat('');
    setKeperluan('');
    setCatatan('');
    load();
  }

  async function hapus(id: number) {
    Alert.alert('Hapus Buku Tamu', 'Hapus catatan tamu ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await db.runAsync('DELETE FROM buku_tamu WHERE id = ?', id);
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
          <EmptyState message="Belum ada catatan buku tamu" />
        ) : (
          rows.map((t) => (
            <Card key={t.id}>
              <Pressable onPress={() => hapus(t.id)}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{t.nama}</Text>
                    <Text style={[styles.meta, { color: Colors[scheme].muted }]}>
                      {formatTanggal(t.tanggal)} · {t.jam} · {t.alamat || 'Alamat -'}
                    </Text>
                    <Text style={[styles.desc, { color: Colors[scheme].text }]}>Keperluan: {t.keperluan}</Text>
                    {t.catatan ? (
                      <Text style={[styles.meta, { color: Colors[scheme].muted }]}>Catatan: {t.catatan}</Text>
                    ) : null}
                  </View>
                  <Badge label={t.jenis} variant="info" />
                </View>
              </Pressable>
            </Card>
          ))
        )}
      </Screen>
      <FAB label="Tamu" onPress={() => setModal(true)} />

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBody, { backgroundColor: Colors[scheme].card }]}>
            <Text style={styles.modalTitle}>Catat Buku Tamu</Text>
            <Field label="Nama Tamu" value={nama} onChangeText={setNama} placeholder="Nama lengkap" />
            <Field label="Alamat / Asal" value={alamat} onChangeText={setAlamat} placeholder="Asal instansi / alamat" />
            <Field label="Keperluan" value={keperluan} onChangeText={setKeperluan} placeholder="Tujuan kunjungan" />
            <SectionTitle>Jenis Kunjungan</SectionTitle>
            <Chips options={JENIS_TAMU} value={jenis} onChange={(v) => setJenis(v)} />
            <Field label="Catatan Tambahan" value={catatan} onChangeText={setCatatan} placeholder="Opsional" />
            <PrimaryButton title="Simpan" onPress={simpan} disabled={!nama.trim() || !keperluan.trim()} />
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
    fontWeight: '600',
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
  cancel: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
  },
});
