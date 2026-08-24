import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Card, EmptyState, FAB, Field, LoadingState, PrimaryButton, Screen } from '@/components/ui';
import { todayISO } from '@/lib/db';
import { formatTanggal } from '@/lib/format';

interface RondaRow {
  id: number;
  tanggal: string;
  pos: string;
  petugas: string;
  keterangan: string;
}

export default function RondaScreen() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RondaRow[]>([]);
  const [modal, setModal] = useState(false);
  const [tanggal, setTanggal] = useState(todayISO());
  const [pos, setPos] = useState('Pos Utama RT');
  const [petugas, setPetugas] = useState('');
  const [keterangan, setKeterangan] = useState('');

  const load = useCallback(async () => {
    try {
      const all = await db.getAllAsync<RondaRow>('SELECT * FROM ronda ORDER BY tanggal DESC, id DESC');
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
    if (!petugas.trim()) return;
    await db.runAsync(
      'INSERT INTO ronda (tanggal, pos, petugas, keterangan) VALUES (?, ?, ?, ?)',
      tanggal || todayISO(),
      pos.trim() || 'Pos Utama',
      petugas.trim(),
      keterangan.trim()
    );
    setModal(false);
    setPetugas('');
    setKeterangan('');
    load();
  }

  async function hapus(id: number) {
    Alert.alert('Hapus Jadwal', 'Hapus jadwal ronda ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await db.runAsync('DELETE FROM ronda WHERE id = ?', id);
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
          <EmptyState message="Belum ada jadwal ronda" />
        ) : (
          rows.map((r) => (
            <Card key={r.id}>
              <Pressable onPress={() => hapus(r.id)}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{r.pos}</Text>
                    <Text style={[styles.meta, { color: Colors[scheme].muted }]}>
                      Tanggal: {formatTanggal(r.tanggal)}
                    </Text>
                    <Text style={[styles.desc, { color: Colors[scheme].text }]}>Petugas: {r.petugas}</Text>
                    {r.keterangan ? (
                      <Text style={[styles.meta, { color: Colors[scheme].muted }]}>Catatan: {r.keterangan}</Text>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            </Card>
          ))
        )}
      </Screen>
      <FAB label="Jadwal" onPress={() => setModal(true)} />

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBody, { backgroundColor: Colors[scheme].card }]}>
            <Text style={styles.modalTitle}>Tambah Jadwal Ronda</Text>
            <Field label="Tanggal (YYYY-MM-DD)" value={tanggal} onChangeText={setTanggal} placeholder="2025-01-15" />
            <Field label="Pos Ronda" value={pos} onChangeText={setPos} placeholder="Pos 1 / Pos Utama" />
            <Field label="Petugas Ronda (Pisahkan dengan koma)" value={petugas} onChangeText={setPetugas} placeholder="Bpk Budi, Bpk Joko, Bpk Agus" multiline />
            <Field label="Keterangan / Jam" value={keterangan} onChangeText={setKeterangan} placeholder="Pukul 22.00 - 04.00" />
            <PrimaryButton title="Simpan" onPress={simpan} disabled={!petugas.trim()} />
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
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    marginTop: 3,
  },
  desc: {
    fontSize: 14,
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
