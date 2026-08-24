import { useSQLiteContext } from 'expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Card, Field, LoadingState, PrimaryButton, Screen } from '@/components/ui';
import type { Keluarga } from '@/lib/types';

export default function KeluargaFormScreen() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [noKk, setNoKk] = useState('');
  const [kepala, setKepala] = useState('');
  const [alamat, setAlamat] = useState('');
  const [rt, setRt] = useState('01');
  const [rw, setRw] = useState('01');
  const [telepon, setTelepon] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const k = await db.getFirstAsync<Keluarga>('SELECT * FROM keluarga WHERE id = ?', Number(id));
      if (k) {
        setNoKk(k.no_kk);
        setKepala(k.kepala_keluarga);
        setAlamat(k.alamat);
        setRt(k.rt);
        setRw(k.rw);
        setTelepon(k.telepon);
      }
    } finally {
      setLoading(false);
    }
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function simpan() {
    if (!noKk.trim() || !kepala.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await db.runAsync(
          'UPDATE keluarga SET no_kk=?, kepala_keluarga=?, alamat=?, rt=?, rw=?, telepon=? WHERE id=?',
          noKk.trim(),
          kepala.trim(),
          alamat.trim(),
          rt.trim() || '01',
          rw.trim() || '01',
          telepon.trim(),
          Number(id)
        );
      } else {
        await db.runAsync(
          'INSERT INTO keluarga (no_kk, kepala_keluarga, alamat, rt, rw, telepon) VALUES (?, ?, ?, ?, ?, ?)',
          noKk.trim(),
          kepala.trim(),
          alamat.trim(),
          rt.trim() || '01',
          rw.trim() || '01',
          telepon.trim()
        );
      }
      router.back();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>{editing ? 'Edit Keluarga' : 'Tambah Keluarga'}</Text>
        <View style={{ height: 12 }} />
        <Field label="No. Kartu Keluarga (KK)" value={noKk} onChangeText={setNoKk} placeholder="e.g. 3201010101010001" keyboardType="number-pad" />
        <Field label="Nama Kepala Keluarga" value={kepala} onChangeText={setKepala} placeholder="Nama lengkap" />
        <Field label="Alamat" value={alamat} onChangeText={setAlamat} placeholder="Alamat rumah" />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="RT" value={rt} onChangeText={setRt} keyboardType="number-pad" />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Field label="RW" value={rw} onChangeText={setRw} keyboardType="number-pad" />
          </View>
        </View>
        <Field label="No. Telepon" value={telepon} onChangeText={setTelepon} placeholder="08xxxxxxxxxx" keyboardType="phone-pad" />
        <PrimaryButton title={saving ? 'Menyimpan...' : 'Simpan'} onPress={simpan} disabled={!noKk.trim() || !kepala.trim()} loading={saving} />
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
});