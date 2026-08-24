import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Card, EmptyState, LoadingState, Screen, SectionTitle } from '@/components/ui';
import { BULAN, todayISO } from '@/lib/db';
import { formatRupiah } from '@/lib/format';
import type { PembayaranIuran, Pengaturan } from '@/lib/types';

export default function IuranScreen() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const now = new Date();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulanIdx, setBulanIdx] = useState(now.getMonth());
  const [tahun, setTahun] = useState(now.getFullYear());
  const [daftar, setDaftar] = useState<PembayaranIuran[]>([]);
  const [pengaturan, setPengaturan] = useState<Pengaturan | null>(null);

  const bulan = BULAN[bulanIdx];

  const ensureIuran = useCallback(async (nominal: number) => {
    const kk = await db.getAllAsync<{ id: number; kepala_keluarga: string }>(
      'SELECT id, kepala_keluarga FROM keluarga ORDER BY kepala_keluarga ASC'
    );
    for (const item of kk) {
      await db.runAsync(
        `INSERT OR IGNORE INTO iuran (keluarga_id, bulan, tahun, nominal, status)
         VALUES (?, ?, ?, ?, 'Belum')`,
        item.id,
        bulan,
        tahun,
        nominal
      );
    }
  }, [db, bulan, tahun]);

  const load = useCallback(async () => {
    try {
      const sets = await Promise.all([
        db.getFirstAsync<Pengaturan>('SELECT * FROM pengaturan WHERE id = 1'),
        db.getAllAsync<PembayaranIuran>(
          `SELECT i.*, k.kepala_keluarga
           FROM iuran i JOIN keluarga k ON k.id = i.keluarga_id
           WHERE i.bulan = ? AND i.tahun = ?
           ORDER BY k.kepala_keluarga ASC`,
          bulan,
          tahun
        ),
      ]);
       const settings = sets[0];
       setPengaturan(settings);
       const rows = sets[1];
       const kkCount = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM keluarga');
       if (rows.length < (kkCount?.c ?? 0)) {
         await ensureIuran(settings?.nominal_iuran ?? 50000);
        const fresh = await db.getAllAsync<PembayaranIuran>(
          `SELECT i.*, k.kepala_keluarga
           FROM iuran i JOIN keluarga k ON k.id = i.keluarga_id
           WHERE i.bulan = ? AND i.tahun = ?
           ORDER BY k.kepala_keluarga ASC`,
          bulan,
          tahun
        );
        setDaftar(fresh);
      } else {
        setDaftar(rows);
      }
    } finally {
      setLoading(false);
    }
  }, [db, bulan, tahun, ensureIuran]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  async function toggleStatus(item: PembayaranIuran) {
    setSaving(true);
    try {
      const lunas = item.status === 'Lunas';
      await db.runAsync(
        'UPDATE iuran SET status = ?, tanggal_bayar = ? WHERE id = ?',
        lunas ? 'Belum' : 'Lunas',
        lunas ? null : todayISO(),
        item.id
      );
      if (lunas) {
        await db.runAsync(
          'DELETE FROM transaksi WHERE kategori = ? AND keterangan = ? AND nominal = ?',
          'Iuran',
          `${item.kepala_keluarga} - ${item.bulan} ${item.tahun}`,
          item.nominal
        );
      } else {
        await db.runAsync(
          `INSERT INTO transaksi (tanggal, jenis, kategori, keterangan, nominal)
           VALUES (?, 'Masuk', ?, ?, ?)`,
          todayISO(),
          'Iuran',
          `${item.kepala_keluarga} - ${item.bulan} ${item.tahun}`,
          item.nominal
        );
      }
      setDaftar((prev) =>
        prev.map((p) =>
          p.id === item.id
            ? {
                ...p,
                status: lunas ? 'Belum' : 'Lunas',
                tanggal_bayar: lunas ? null : todayISO(),
              }
            : p
        )
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;

  const lunasCount = daftar.filter((d) => d.status === 'Lunas').length;
  const totalNominal = daftar.filter((d) => d.status === 'Belum').reduce((a, b) => a + b.nominal, 0);

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Iuran {bulan}</Text>
        <Text style={[styles.sub, { color: Colors[scheme].muted }]}>Nominal: {formatRupiah(pengaturan?.nominal_iuran ?? 0)} / KK</Text>
      </Card>

      <View style={styles.navRow}>
        <Pressable
          onPress={() => {
            if (bulanIdx === 0) {
              setBulanIdx(11);
              setTahun((t) => t - 1);
            } else setBulanIdx((b) => b - 1);
          }}
          style={[styles.navBtn, { backgroundColor: Colors[scheme].card, borderColor: Colors[scheme].border }]}>
          <Text style={styles.navBtnText}>‹ Bulan Sebelumnya</Text>
        </Pressable>
        <Text style={styles.navLabel}>
          {bulan} {tahun}
        </Text>
        <Pressable
          onPress={() => {
            if (bulanIdx === 11) {
              setBulanIdx(0);
              setTahun((t) => t + 1);
            } else setBulanIdx((b) => b + 1);
          }}
          style={[styles.navBtn, { backgroundColor: Colors[scheme].card, borderColor: Colors[scheme].border }]}>
          <Text style={styles.navBtnText}>Berikutnya ›</Text>
        </Pressable>
      </View>

      <Card>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryValue}>{lunasCount}/{daftar.length}</Text>
            <Text style={[styles.summaryLabel, { color: Colors[scheme].muted }]}>KK lunas</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.summaryValue, { color: Colors[scheme].warning }]}>{formatRupiah(totalNominal)}</Text>
            <Text style={[styles.summaryLabel, { color: Colors[scheme].muted }]}>Belum dibayar</Text>
          </View>
        </View>
      </Card>

      <SectionTitle>Daftar Pembayaran</SectionTitle>
      {daftar.length === 0 ? (
        <EmptyState message="Belum ada keluarga. Tambahkan keluarga di menu Warga." />
      ) : (
        daftar.map((item) => (
          <Card key={item.id}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.kepala_keluarga}</Text>
                <Text style={[styles.meta, { color: Colors[scheme].muted }]}>
                  {formatRupiah(item.nominal)}
                  {item.tanggal_bayar ? ` · dibayar ${item.tanggal_bayar}` : ''}
                </Text>
              </View>
              <Pressable
                onPress={() => toggleStatus(item)}
                disabled={saving}
                style={[
                  styles.statusBtn,
                  {
                    backgroundColor:
                      item.status === 'Lunas' ? Colors[scheme].successMuted : Colors[scheme].warningMuted,
                  },
                ]}>
                <Text
                  style={{
                    color: item.status === 'Lunas' ? Colors[scheme].success : Colors[scheme].warning,
                    fontWeight: '700',
                  }}>
                  {item.status === 'Lunas' ? '✓ Lunas' : 'Belum'}
                </Text>
              </Pressable>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  sub: {
    fontSize: 13,
    marginTop: 4,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  navBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  navBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  navLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 12,
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
    marginTop: 2,
  },
  statusBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});