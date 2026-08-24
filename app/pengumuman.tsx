import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Badge, Card, EmptyState, FAB, Field, LoadingState, PrimaryButton, Screen, SectionTitle } from '@/components/ui';
import { todayISO } from '@/lib/db';
import { formatTanggal } from '@/lib/format';
import type { Pengumuman } from '@/lib/types';

export default function PengumumanScreen() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Pengumuman[]>([]);
  const [modal, setModal] = useState(false);
  const [judul, setJudul] = useState('');
  const [isi, setIsi] = useState('');
  const [penting, setPenting] = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await db.getAllAsync<Pengumuman>(
        'SELECT * FROM pengumuman ORDER BY tanggal DESC, id DESC'
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
      'INSERT INTO pengumuman (judul, isi, tanggal, penting) VALUES (?, ?, ?, ?)',
      judul.trim(),
      isi.trim(),
      todayISO(),
      penting ? 1 : 0
    );
    setModal(false);
    setJudul('');
    setIsi('');
    setPenting(false);
    load();
  }

  async function hapus(id: number) {
    Alert.alert('Hapus Pengumuman', 'Hapus pengumuman ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await db.runAsync('DELETE FROM pengumuman WHERE id = ?', id);
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
          <EmptyState message="Belum ada pengumuman / berita" />
        ) : (
          rows.map((p) => (
            <Card key={p.id}>
              <Pressable onPress={() => hapus(p.id)}>
                <View style={styles.rowBetween}>
                  <Text style={styles.title}>{p.judul}</Text>
                  {p.penting === 1 && <Badge label="Penting" variant="danger" />}
                </View>
                <Text style={[styles.meta, { color: Colors[scheme].muted }]}>
                  {formatTanggal(p.tanggal)}
                </Text>
                {p.isi ? (
                  <Text style={[styles.desc, { color: Colors[scheme].muted }]} numberOfLines={4}>
                    {p.isi}
                  </Text>
                ) : null}
              </Pressable>
            </Card>
          ))
        )}
      </Screen>
      <FAB label="Tulis" onPress={() => setModal(true)} />

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBody, { backgroundColor: Colors[scheme].card }]}>
            <Text style={styles.modalTitle}>Tulis Pengumuman</Text>
            <Field label="Judul" value={judul} onChangeText={setJudul} placeholder="Judul pengumuman" />
            <Field label="Isi" value={isi} onChangeText={setIsi} placeholder="Isi pengumuman / berita" multiline />
            <Pressable onPress={() => setPenting((v) => !v)} style={styles.pentingRow}>
              <Text style={{ fontSize: 15 }}>{penting ? '☑️' : '⬜️'}</Text>
              <Text style={styles.pentingText}>Tandai sebagai PENTING</Text>
            </Pressable>
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
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
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
  pentingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 12,
  },
  pentingText: {
    fontSize: 15,
    fontWeight: '600',
  },
  cancel: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
  },
});