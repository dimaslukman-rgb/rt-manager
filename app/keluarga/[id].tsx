import { useSQLiteContext } from 'expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Badge, Card, EmptyState, LoadingState, Screen, SectionTitle } from '@/components/ui';
import { formatRupiah } from '@/lib/format';
import type { Keluarga, Warga } from '@/lib/types';

export default function KeluargaDetailScreen() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [keluarga, setKeluarga] = useState<Keluarga | null>(null);
  const [anggota, setAnggota] = useState<Warga[]>([]);

  const load = useCallback(async () => {
    try {
      const k = await db.getFirstAsync<Keluarga>('SELECT * FROM keluarga WHERE id = ?', Number(id));
      const w = await db.getAllAsync<Warga>(
        'SELECT * FROM warga WHERE keluarga_id = ? ORDER BY status_keluarga ASC, nama ASC',
        Number(id)
      );
      setKeluarga(k);
      setAnggota(w);
    } finally {
      setLoading(false);
    }
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function hapusKeluarga() {
    Alert.alert('Hapus Keluarga', 'Hapus keluarga beserta seluruh anggotanya?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await db.runAsync('DELETE FROM keluarga WHERE id = ?', Number(id));
          router.back();
        },
      },
    ]);
  }

  async function hapusWarga(w: Warga) {
    Alert.alert('Hapus Warga', `Hapus ${w.nama} dari daftar warga?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await db.runAsync('DELETE FROM warga WHERE id = ?', w.id);
          load();
        },
      },
    ]);
  }

  if (loading) return <LoadingState />;
  if (!keluarga) {
    return (
      <Screen>
        <EmptyState message="Data keluarga tidak ditemukan" />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>{keluarga.kepala_keluarga}</Text>
        <Text style={[styles.meta, { color: Colors[scheme].muted }]}>No. KK: {keluarga.no_kk}</Text>
        <Text style={[styles.meta, { color: Colors[scheme].muted }]}>
          {keluarga.alamat || '-'} · RT {keluarga.rt || '-'} / RW {keluarga.rw || '-'}
        </Text>
        <Text style={[styles.meta, { color: Colors[scheme].muted }]}>
          💰 Iuran Bulanan: <Text style={{ fontWeight: '700', color: Colors[scheme].text }}>{formatRupiah(keluarga.nominal_iuran ?? 50000)} / bulan</Text>
        </Text>
        {keluarga.telepon ? (
          <Text style={[styles.meta, { color: Colors[scheme].muted }]}>Telp: {keluarga.telepon}</Text>
        ) : null}
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, { backgroundColor: Colors[scheme].primaryMuted }]}
            onPress={() => router.push({ pathname: '/keluarga/tambah', params: { id: keluarga.id } })}>
            <Text style={{ color: Colors[scheme].primary, fontWeight: '700' }}>✏️ Edit</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, { backgroundColor: Colors[scheme].dangerMuted }]}
            onPress={hapusKeluarga}>
            <Text style={{ color: Colors[scheme].danger, fontWeight: '700' }}>🗑️ Hapus</Text>
          </Pressable>
        </View>
      </Card>

      <View style={styles.headerRow}>
        <SectionTitle>Anggota Keluarga ({anggota.length})</SectionTitle>
        <Pressable
          onPress={() =>
            router.push({ pathname: '/warga/tambah', params: { keluarga_id: keluarga.id } })
          }>
          <Text style={{ color: Colors[scheme].primary, fontWeight: '700' }}>+ Tambah</Text>
        </Pressable>
      </View>

      {anggota.length === 0 ? (
        <EmptyState message="Belum ada anggota keluarga" />
      ) : (
        anggota.map((w) => (
          <Card key={w.id}>
            <Pressable
              onPress={() => router.push({ pathname: '/warga/[id]', params: { id: w.id } })}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{w.nama}</Text>
                  <Text style={[styles.meta, { color: Colors[scheme].muted }]}>
                    NIK: {w.nik} · {w.status_keluarga}
                  </Text>
                </View>
                <Badge label={w.jenis_kelamin === 'L' ? 'L' : 'P'} variant="info" />
              </View>
            </Pressable>
            <Pressable onPress={() => hapusWarga(w)} style={{ marginTop: 8 }}>
              <Text style={{ color: Colors[scheme].danger, fontSize: 12 }}>Hapus warga ini</Text>
            </Pressable>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  meta: {
    fontSize: 13,
    marginTop: 3,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  btn: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
  },
});