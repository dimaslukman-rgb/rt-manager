import { useSQLiteContext } from 'expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Card, Field, LoadingState, PrimaryButton, Screen } from '@/components/ui';
import { formatRupiah } from '@/lib/format';
import type { Keluarga, Pengaturan } from '@/lib/types';

export default function KeluargaFormScreen() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [noKk, setNoKk] = useState('');
  const [kepala, setKepala] = useState('');
  const [alamat, setAlamat] = useState('');
  const [rt, setRt] = useState('04');
  const [rw, setRw] = useState('01');
  const [telepon, setTelepon] = useState('');
  const [nominalIuran, setNominalIuran] = useState('50000');

  const load = useCallback(async () => {
    try {
      const p = await db.getFirstAsync<Pengaturan>('SELECT * FROM pengaturan WHERE id = 1');
      if (p && !editing) {
        setNominalIuran(String(p.nominal_iuran || 50000));
        setRt(p.nama_rt.replace(/[^0-9]/g, '') || '04');
      }

      if (id) {
        const k = await db.getFirstAsync<Keluarga>('SELECT * FROM keluarga WHERE id = ?', Number(id));
        if (k) {
          setNoKk(k.no_kk);
          setKepala(k.kepala_keluarga);
          setAlamat(k.alamat);
          setRt(k.rt);
          setRw(k.rw);
          setTelepon(k.telepon);
          setNominalIuran(String(k.nominal_iuran ?? p?.nominal_iuran ?? 50000));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [db, id, editing]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function simpan() {
    if (!noKk.trim() || !kepala.trim()) return;
    setSaving(true);
    const nominal = Number(nominalIuran.replace(/[^0-9]/g, '')) || 50000;

    try {
      if (editing) {
        await db.runAsync(
          'UPDATE keluarga SET no_kk=?, kepala_keluarga=?, alamat=?, rt=?, rw=?, telepon=?, nominal_iuran=? WHERE id=?',
          noKk.trim(),
          kepala.trim(),
          alamat.trim(),
          rt.trim() || '04',
          rw.trim() || '01',
          telepon.trim(),
          nominal,
          Number(id)
        );
        // Also sync active unpaid iuran row for this family with new custom nominal
        await db.runAsync(
          'UPDATE iuran SET nominal=? WHERE keluarga_id=? AND status="Belum"',
          nominal,
          Number(id)
        );
      } else {
        await db.runAsync(
          'INSERT INTO keluarga (no_kk, kepala_keluarga, alamat, rt, rw, telepon, nominal_iuran) VALUES (?, ?, ?, ?, ?, ?, ?)',
          noKk.trim(),
          kepala.trim(),
          alamat.trim(),
          rt.trim() || '04',
          rw.trim() || '01',
          telepon.trim(),
          nominal
        );
      }
      router.back();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;

  const parsedNominal = Number(nominalIuran.replace(/[^0-9]/g, '')) || 0;

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>{editing ? '✏️ Edit Data Keluarga (KK)' : '➕ Tambah Data Keluarga (KK)'}</Text>
        <View style={{ height: 12 }} />
        <Field label="No. Kartu Keluarga (KK)" value={noKk} onChangeText={setNoKk} placeholder="e.g. 3201010101010001" keyboardType="number-pad" />
        <Field label="Nama Kepala Keluarga" value={kepala} onChangeText={setKepala} placeholder="Nama lengkap kepala keluarga" />
        <Field label="Alamat / Blok Rumah" value={alamat} onChangeText={setAlamat} placeholder="Contoh: Blok A3 No. 12" />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="RT" value={rt} onChangeText={setRt} keyboardType="number-pad" />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Field label="RW" value={rw} onChangeText={setRw} keyboardType="number-pad" />
          </View>
        </View>
        <Field label="No. Telepon / WhatsApp" value={telepon} onChangeText={setTelepon} placeholder="08xxxxxxxxxx" keyboardType="phone-pad" />

        {/* Custom Iuran per KK */}
        <View style={{ marginTop: 6, marginBottom: 16 }}>
          <Field
            label="Tarif Iuran Bulanan Khusus KK Ini (Rp)"
            value={nominalIuran}
            onChangeText={(v) => setNominalIuran(v.replace(/[^0-9]/g, ''))}
            placeholder="50000"
            keyboardType="number-pad"
          />
          <Text style={[styles.hint, { color: Colors[scheme].muted }]}>
            💡 Terpasang: <Text style={{ fontWeight: '700', color: Colors[scheme].text }}>{formatRupiah(parsedNominal)} / bulan</Text>. (Dapat diatur berbeda tiap KK untuk rumah tinggal, kontrakan/kos, tempat usaha, atau keringanan).
          </Text>
        </View>

        <PrimaryButton title={saving ? 'Menyimpan...' : 'Simpan Data Keluarga'} onPress={simpan} disabled={!noKk.trim() || !kepala.trim()} loading={saving} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
  },
  hint: {
    fontSize: 12,
    marginTop: -4,
    lineHeight: 16,
  },
});