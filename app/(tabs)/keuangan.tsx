import { useSQLiteContext } from 'expo-sqlite';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Card, EmptyState, LoadingState, Screen, SectionTitle } from '@/components/ui';
import { bulanKey } from '@/lib/db';
import { formatRupiah } from '@/lib/format';
import type { Transaksi } from '@/lib/types';

export default function KeuanganScreen() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [masuk, setMasuk] = useState(0);
  const [keluar, setKeluar] = useState(0);
  const [transaksi, setTransaksi] = useState<Transaksi[]>([]);
  const [bulan, setBulan] = useState(bulanKey(new Date()));
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [iuranLunas, setIuranLunas] = useState(0);
  const [iuranBelum, setIuranBelum] = useState(0);

  const load = useCallback(async () => {
    try {
      const [m, k, tr, iL, iB] = await Promise.all([
        db.getFirstAsync<{ s: number }>('SELECT COALESCE(SUM(nominal),0) as s FROM transaksi WHERE jenis = ?', 'Masuk'),
        db.getFirstAsync<{ s: number }>('SELECT COALESCE(SUM(nominal),0) as s FROM transaksi WHERE jenis = ?', 'Keluar'),
        db.getAllAsync<Transaksi>('SELECT * FROM transaksi ORDER BY tanggal DESC, id DESC LIMIT 5'),
        db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM iuran WHERE bulan = ? AND tahun = ? AND status = ?', bulan, tahun, 'Lunas'),
        db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM iuran WHERE bulan = ? AND tahun = ? AND status = ?', bulan, tahun, 'Belum'),
      ]);
      setMasuk(m?.s ?? 0);
      setKeluar(k?.s ?? 0);
      setTransaksi(tr);
      setIuranLunas(iL?.c ?? 0);
      setIuranBelum(iB?.c ?? 0);
    } finally {
      setLoading(false);
    }
  }, [db, bulan, tahun]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) return <LoadingState />;

  const saldo = masuk - keluar;

  return (
    <Screen>
      <Card style={[styles.balanceCard, { backgroundColor: Colors[scheme].primary, borderColor: 'transparent' }]}>
        <Text style={styles.balanceLabel}>Saldo Kas RT</Text>
        <Text style={styles.balanceValue}>{formatRupiah(saldo)}</Text>
        <View style={styles.balanceRow}>
          <View>
            <Text style={styles.balanceSub}>Pemasukan</Text>
            <Text style={styles.balanceSubValue}>+ {formatRupiah(masuk)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.balanceSub}>Pengeluaran</Text>
            <Text style={styles.balanceSubValue}>− {formatRupiah(keluar)}</Text>
          </View>
        </View>
      </Card>

      <SectionTitle>Aksi</SectionTitle>
      <View style={styles.actionRow}>
        <Pressable
          onPress={() => router.push('/keuangan/iuran')}
          style={[styles.actionCard, { backgroundColor: Colors[scheme].infoMuted }]}>
          <Text style={{ fontSize: 26 }}>💰</Text>
          <Text style={[styles.actionTitle, { color: Colors[scheme].info }]}>Iuran Warga</Text>
          <Text style={[styles.actionMeta, { color: Colors[scheme].muted }]}>
            {bulan} {tahun}: {iuranLunas} lunas, {iuranBelum} belum
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/keuangan/kas')}
          style={[styles.actionCard, { backgroundColor: Colors[scheme].successMuted }]}>
          <Text style={{ fontSize: 26 }}>🧾</Text>
          <Text style={[styles.actionTitle, { color: Colors[scheme].success }]}>Kas & Transaksi</Text>
          <Text style={[styles.actionMeta, { color: Colors[scheme].muted }]}>Catat masuk/keluar</Text>
        </Pressable>
      </View>
      <View style={styles.actionRow}>
        <Pressable
          onPress={() => router.push('/keuangan/laporan')}
          style={[styles.actionCard, { backgroundColor: Colors[scheme].warningMuted }]}>
          <Text style={{ fontSize: 26 }}>📊</Text>
          <Text style={[styles.actionTitle, { color: Colors[scheme].warning }]}>Laporan</Text>
          <Text style={[styles.actionMeta, { color: Colors[scheme].muted }]}>Rekap keuangan</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/keuangan/iuran')}
          style={styles.actionCard}>
          <Text style={{ fontSize: 26 }}>🏦</Text>
          <Text style={[styles.actionTitle, { color: Colors[scheme].text }]}>Iuran per KK</Text>
          <Text style={[styles.actionMeta, { color: Colors[scheme].muted }]}>Kelola iuran bulanan</Text>
        </Pressable>
      </View>

      <SectionTitle>Transaksi Terakhir</SectionTitle>
      {transaksi.length === 0 ? (
        <EmptyState message="Belum ada transaksi" />
      ) : (
        transaksi.map((t) => (
          <Card key={t.id}>
            <View style={styles.rowBetween}>
              <Text style={styles.itemTitle}>{t.kategori || t.keterangan || t.jenis}</Text>
              <Text
                style={[
                  styles.itemAmount,
                  { color: t.jenis === 'Masuk' ? Colors[scheme].success : Colors[scheme].danger },
                ]}>
                {t.jenis === 'Masuk' ? '+' : '−'} {formatRupiah(t.nominal)}
              </Text>
            </View>
            <Text style={[styles.itemMeta, { color: Colors[scheme].muted }]}>{t.tanggal}</Text>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  balanceCard: {
    paddingVertical: 24,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
  },
  balanceValue: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    marginTop: 4,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  balanceSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
  },
  balanceSubValue: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionCard: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  actionMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  itemAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  itemMeta: {
    fontSize: 12,
    marginTop: 4,
  },
});
