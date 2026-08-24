import { useSQLiteContext } from 'expo-sqlite';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View, TextInput } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Card, EmptyState, LoadingState, Screen, Badge } from '@/components/ui';
import type { Keluarga, Warga } from '@/lib/types';

export default function WargaScreen() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [keluarga, setKeluarga] = useState<Keluarga[]>([]);
  const [warga, setWarga] = useState<Warga[]>([]);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try {
      const [kRows, wRows] = await Promise.all([
        db.getAllAsync<Keluarga>(
          `SELECT k.*, (SELECT COUNT(*) FROM warga w WHERE w.keluarga_id = k.id) as jumlah_anggota
           FROM keluarga k ORDER BY k.kepala_keluarga ASC`
        ),
        db.getAllAsync<Warga>('SELECT * FROM warga ORDER BY nama ASC'),
      ]);
      setKeluarga(kRows);
      setWarga(wRows);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) return <LoadingState />;

  const filtered = warga.filter(
    (w) => w.nama.toLowerCase().includes(q.toLowerCase()) || w.nik.includes(q)
  );

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <TextInput
          placeholder="Cari warga / NIK..."
          placeholderTextColor={Colors[scheme].muted}
          value={q}
          onChangeText={setQ}
          style={[
            styles.search,
            {
              backgroundColor: Colors[scheme].card,
              borderColor: Colors[scheme].border,
              color: Colors[scheme].text,
            },
          ]}
        />

        {q ? (
          <>
            <SectionTitleLocal>Hasil Pencarian ({filtered.length})</SectionTitleLocal>
            {filtered.length === 0 ? (
              <EmptyState message="Warga tidak ditemukan" />
            ) : (
              filtered.map((w) => (
                <Pressable
                  key={w.id}
                  onPress={() => router.push({ pathname: '/warga/[id]', params: { id: w.id } })}>
                  {({ pressed }) => (
                    <Card style={{ opacity: pressed ? 0.7 : 1 }}>
                      <View style={styles.row}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>{w.nama.charAt(0)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.name}>{w.nama}</Text>
                          <Text style={[styles.meta, { color: Colors[scheme].muted }]}>
                            NIK: {w.nik}
                          </Text>
                        </View>
                        <Badge label={w.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'} variant="info" />
                      </View>
                    </Card>
                  )}
                </Pressable>
              ))
            )}
          </>
        ) : (
          <>
            <SectionTitleLocal>Keluarga ({keluarga.length})</SectionTitleLocal>
            {keluarga.length === 0 ? (
              <EmptyState message="Belum ada data keluarga. Tambahkan keluarga terlebih dahulu." />
            ) : (
              keluarga.map((k) => (
                <Pressable
                  key={k.id}
                  onPress={() => router.push({ pathname: '/keluarga/[id]', params: { id: k.id } })}>
                  {({ pressed }) => (
                    <Card style={{ opacity: pressed ? 0.7 : 1 }}>
                      <View style={styles.row}>
                        <View style={[styles.avatar, { backgroundColor: Colors[scheme].primaryMuted }]}>
                          <Text style={[styles.avatarText, { color: Colors[scheme].primary }]}>KK</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.name}>{k.kepala_keluarga}</Text>
                          <Text style={[styles.meta, { color: Colors[scheme].muted }]}>
                            No. KK: {k.no_kk} · {k.jumlah_anggota} anggota
                          </Text>
                        </View>
                      </View>
                    </Card>
                  )}
                </Pressable>
              ))
            )}
          </>
        )}
      </Screen>
      <View style={styles.fabRow}>
        <Pressable
          onPress={() => router.push('/keluarga/tambah')}
          style={[styles.fabBtn, { backgroundColor: Colors[scheme].primary }]}>
          <Text style={styles.fabBtnText}>+ Keluarga</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/warga/tambah')}
          style={[styles.fabBtn, { backgroundColor: Colors[scheme].info }]}>
          <Text style={styles.fabBtnText}>+ Warga</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SectionTitleLocal({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  return (
    <Text style={[styles.section, { color: Colors[scheme].muted }]}>{children}</Text>
  );
}

const styles = StyleSheet.create({
  search: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
  },
  section: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.infoMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.info,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    marginTop: 2,
  },
  fabRow: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    gap: 10,
  },
  fabBtn: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 13,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
