import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Card, Field, LoadingState, PrimaryButton, Screen, SectionTitle } from '@/components/ui';
import { formatRupiah } from '@/lib/format';
import type { Pengaturan } from '@/lib/types';

export default function PengaturanScreen() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [namaRt, setNamaRt] = useState('');
  const [kelurahan, setKelurahan] = useState('');
  const [kecamatan, setKecamatan] = useState('');
  const [kota, setKota] = useState('');
  const [nominalIuran, setNominalIuran] = useState('');

  const [totalWarga, setTotalWarga] = useState(0);
  const [totalKeluarga, setTotalKeluarga] = useState(0);

  const load = useCallback(async () => {
    try {
      const [p, tw, tk] = await Promise.all([
        db.getFirstAsync<Pengaturan>('SELECT * FROM pengaturan WHERE id = 1'),
        db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM warga'),
        db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM keluarga'),
      ]);
      if (p) {
        setNamaRt(p.nama_rt);
        setKelurahan(p.nama_kelurahan);
        setKecamatan(p.nama_kecamatan);
        setKota(p.nama_kota);
        setNominalIuran(String(p.nominal_iuran));
      }
      setTotalWarga(tw?.c ?? 0);
      setTotalKeluarga(tk?.c ?? 0);
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
    setSaving(true);
    try {
      const nominal = Number(nominalIuran.replace(/[^0-9]/g, '')) || 50000;
      await db.runAsync(
        'UPDATE pengaturan SET nama_rt=?, nama_kelurahan=?, nama_kecamatan=?, nama_kota=?, nominal_iuran=? WHERE id=1',
        namaRt.trim() || 'RT 01',
        kelurahan.trim(),
        kecamatan.trim(),
        kota.trim(),
        nominal
      );
      Alert.alert('Berhasil', 'Pengaturan berhasil disimpan.');
    } finally {
      setSaving(false);
    }
  }

  async function resetData() {
    Alert.alert(
      'Reset Semua Data',
      'PERINGATAN: Semua data warga, keluarga, transaksi, iuran, surat, kegiatan, pengumuman, buku tamu, dan ronda akan DIHAPUS PERMANEN. Tindakan ini tidak dapat dibatalkan.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await db.execAsync(`
              DELETE FROM warga;
              DELETE FROM keluarga;
              DELETE FROM transaksi;
              DELETE FROM iuran;
              DELETE FROM surat;
              DELETE FROM kegiatan;
              DELETE FROM pengumuman;
              DELETE FROM buku_tamu;
              DELETE FROM ronda;
            `);
            Alert.alert('Selesai', 'Semua data telah direset.');
            load();
          },
        },
      ]
    );
  }

  if (loading) return <LoadingState />;

  return (
    <Screen>
      <SectionTitle>Informasi RT</SectionTitle>
      <Card>
        <Field label="Nama RT" value={namaRt} onChangeText={setNamaRt} placeholder="RT 01" />
        <Field label="Kelurahan / Desa" value={kelurahan} onChangeText={setKelurahan} placeholder="Nama kelurahan" />
        <Field label="Kecamatan" value={kecamatan} onChangeText={setKecamatan} placeholder="Nama kecamatan" />
        <Field label="Kota / Kabupaten" value={kota} onChangeText={setKota} placeholder="Nama kota" />
      </Card>

      <SectionTitle>Iuran Bulanan Standar</SectionTitle>
      <Card>
        <Field
          label="Nominal Iuran Standar / Default (Rp)"
          value={nominalIuran}
          onChangeText={(v) => setNominalIuran(v.replace(/[^0-9]/g, ''))}
          placeholder="50000"
          keyboardType="number-pad"
        />
        <Text style={[styles.hint, { color: Colors[scheme].muted }]}>
          💡 Standar default: <b>{formatRupiah(Number(nominalIuran.replace(/[^0-9]/g, '')) || 0)} / KK / bulan</b>. (Digunakan sebagai nilai awal. Tiap KK dapat diatur nominal khusus yang berbeda di menu Data Keluarga / Iuran).
        </Text>
      </Card>

      <PrimaryButton title={saving ? 'Menyimpan...' : 'Simpan Pengaturan'} onPress={simpan} loading={saving} />

      <SectionTitle>Statistik</SectionTitle>
      <Card>
        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: Colors[scheme].muted }]}>Total Warga</Text>
          <Text style={styles.statValue}>{totalWarga}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: Colors[scheme].muted }]}>Total Keluarga (KK)</Text>
          <Text style={styles.statValue}>{totalKeluarga}</Text>
        </View>
      </Card>

      <SectionTitle>Bahaya</SectionTitle>
      <Card style={{ borderColor: Colors[scheme].danger }}>
        <Text style={[styles.dangerTitle, { color: Colors[scheme].danger }]}>Reset Semua Data</Text>
        <Text style={[styles.hint, { color: Colors[scheme].muted }]}>
          Menghapus seluruh data warga, keluarga, transaksi, iuran, surat, kegiatan, pengumuman, buku tamu, dan ronda. Tidak dapat dibatalkan!
        </Text>
        <View style={{ height: 12 }} />
        <PrimaryButton title="Reset Data" onPress={resetData} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontSize: 13,
    marginTop: 4,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  statLabel: {
    fontSize: 14,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  dangerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
});
