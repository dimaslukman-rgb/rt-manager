import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Badge, Card, Chips, EmptyState, FAB, Field, LoadingState, PrimaryButton, Screen, SectionTitle } from '@/components/ui';
import { todayISO } from '@/lib/db';
import { formatRupiah, formatTanggal } from '@/lib/format';
import type { Transaksi } from '@/lib/types';

const JENIS = ['Masuk', 'Keluar'] as const;
const KATEGORI = ['Iuran', 'Sumbangan', 'Pengeluaran', 'Kas', 'Lainnya'] as const;

export default function KasScreen() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Transaksi[]>([]);
  const [modal, setModal] = useState(false);
  const [jenis, setJenis] = useState<typeof JENIS[number]>('Masuk');
  const [kategori, setKategori] = useState<typeof KATEGORI[number]>('Iuran');
  const [keterangan, setKeterangan] = useState('');
  const [nominal, setNominal] = useState('');
  const [tanggal, setTanggal] = useState(todayISO());

  const load = useCallback(async () => {
    try {
      const all = await db.getAllAsync<Transaksi>(
        'SELECT * FROM transaksi ORDER BY tanggal DESC, id DESC'
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
    const n = Number(nominal.replace(/[^0-9]/g, '')) || 0;
    if (n <= 0) return;
    await db.runAsync(
      'INSERT INTO transaksi (tanggal, jenis, kategori, keterangan, nominal) VALUES (?, ?, ?, ?, ?)',
      tanggal || todayISO(),
      jenis,
      kategori,
      keterangan || kategori,
      n
    );
    setModal(false);
    setKeterangan('');
    setNominal('');
    load();
  }

  async function hapus(id: number) {
    await db.runAsync('DELETE FROM transaksi WHERE id = ?', id);
    load();
  }

  if (loading) return <LoadingState />;

  const masuk = rows.filter((r) => r.jenis === 'Masuk').reduce((a, b) => a + b.nominal, 0);
  const keluar = rows.filter((r) => r.jenis === 'Keluar').reduce((a, b) => a + b.nominal, 0);

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Card style={{ backgroundColor: Colors[scheme].card }}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={[styles.summaryLabel, { color: Colors[scheme].muted }]}>Total Masuk</Text>
              <Text style={[styles.summaryValue, { color: Colors[scheme].success }]}>{formatRupiah(masuk)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.summaryLabel, { color: Colors[scheme].muted }]}>Total Keluar</Text>
              <Text style={[styles.summaryValue, { color: Colors[scheme].danger }]}>{formatRupiah(keluar)}</Text>
            </View>
          </View>
        </Card>

        <SectionTitle>Riwayat Transaksi</SectionTitle>
        {rows.length === 0 ? (
          <EmptyState message="Belum ada transaksi" />
        ) : (
          rows.map((t) => (
            <Card key={t.id}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Badge label={t.jenis} variant={t.jenis === 'Masuk' ? 'success' : 'danger'} />
                    <Text style={styles.name}>{t.kategori}</Text>
                  </View>
                  <Text style={[styles.meta, { color: Colors[scheme].muted }]}>
                    {formatTanggal(t.tanggal)} · {t.keterangan}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text
                    style={[
                      styles.amount,
                      { color: t.jenis === 'Masuk' ? Colors[scheme].success : Colors[scheme].danger },
                    ]}>
                    {t.jenis === 'Masuk' ? '+' : '−'} {formatRupiah(t.nominal)}
                  </Text>
                  <Pressable onPress={() => hapus(t.id)} hitSlop={8}>
                    <Text style={{ color: Colors[scheme].danger, fontSize: 12 }}>Hapus</Text>
                  </Pressable>
                </View>
              </View>
            </Card>
          ))
        )}
      </Screen>
      <FAB label="Transaksi" onPress={() => setModal(true)} />

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBody, { backgroundColor: Colors[scheme].card }]}>
            <Text style={styles.modalTitle}>Catat Transaksi</Text>
            <SectionTitle>Jenis</SectionTitle>
            <Chips options={JENIS} value={jenis} onChange={setJenis} />
            <SectionTitle>Kategori</SectionTitle>
            <Chips options={KATEGORI} value={kategori} onChange={setKategori} />
            <Field label="Tanggal (YYYY-MM-DD)" value={tanggal} onChangeText={setTanggal} placeholder="2025-01-15" keyboardType="numbers-and-punctuation" />
            <Field label="Keterangan" value={keterangan} onChangeText={setKeterangan} placeholder="Deskripsi transaksi" />
            <Field label="Nominal (Rp)" value={nominal} onChangeText={(v) => setNominal(v.replace(/[^0-9]/g, ''))} placeholder="50000" keyboardType="number-pad" />
            <PrimaryButton title="Simpan" onPress={simpan} />
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 12,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    marginTop: 4,
  },
  amount: {
    fontSize: 15,
    fontWeight: '800',
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
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  cancel: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
  },
});