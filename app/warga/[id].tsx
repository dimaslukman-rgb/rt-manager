import { useSQLiteContext } from 'expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Badge, Card, EmptyState, LoadingState, Screen, SectionTitle } from '@/components/ui';
import type { Warga } from '@/lib/types';

export default function WargaDetailScreen() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [warga, setWarga] = useState<Warga | null>(null);

  const load = useCallback(async () => {
    try {
      const w = await db.getFirstAsync<Warga>('SELECT * FROM warga WHERE id = ?', Number(id));
      setWarga(w);
    } finally {
      setLoading(false);
    }
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function hapus() {
    Alert.alert('Hapus Warga', `Hapus ${warga?.nama}?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await db.runAsync('DELETE FROM warga WHERE id = ?', Number(id));
          router.back();
        },
      },
    ]);
  }

  if (loading) return <LoadingState />;
  if (!warga) {
    return (
      <Screen>
        <EmptyState message="Data warga tidak ditemukan" />
      </Screen>
    );
  }

  const rows: { label: string; value: string }[] = [
    { label: 'NIK', value: warga.nik || '-' },
    { label: 'Nama', value: warga.nama || '-' },
    { label: 'Tempat, Tgl Lahir', value: warga.tempat_lahir ? `${warga.tempat_lahir}, ${warga.tanggal_lahir || '-'}` : warga.tanggal_lahir || '-' },
    { label: 'Jenis Kelamin', value: warga.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan' },
    { label: 'Status Keluarga', value: warga.status_keluarga },
    { label: 'Agama', value: warga.agama || '-' },
    { label: 'Status Perkawinan', value: warga.status_perkawinan },
    { label: 'Pekerjaan', value: warga.pekerjaan || '-' },
    { label: 'Telepon', value: warga.telepon || '-' },
  ];

  return (
    <Screen>
      <Card>
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { backgroundColor: Colors[scheme].primaryMuted }]}>
            <Text style={[styles.avatarText, { color: Colors[scheme].primary }]}>
              {warga.nama.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{warga.nama}</Text>
          <Badge label={warga.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'} variant="info" />
        </View>
      </Card>

      <SectionTitle>Data Diri</SectionTitle>
      <Card>
        {rows.map((r) => (
          <View key={r.label} style={styles.rowBetween}>
            <Text style={[styles.label, { color: Colors[scheme].muted }]}>{r.label}</Text>
            <Text style={styles.value}>{r.value}</Text>
          </View>
        ))}
      </Card>

      <View style={styles.actions}>
        <Pressable
          style={[styles.btn, { backgroundColor: Colors[scheme].primaryMuted }]}
          onPress={() => router.push({ pathname: '/warga/tambah', params: { id: warga.id } })}>
          <Text style={{ color: Colors[scheme].primary, fontWeight: '700' }}>✏️ Edit</Text>
        </Pressable>
        <Pressable style={[styles.btn, { backgroundColor: Colors[scheme].dangerMuted }]} onPress={hapus}>
          <Text style={{ color: Colors[scheme].danger, fontWeight: '700' }}>🗑️ Hapus</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatarWrap: {
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
    gap: 16,
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
});