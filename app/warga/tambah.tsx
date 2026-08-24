import { useSQLiteContext } from 'expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Card, Chips, Field, LoadingState, PrimaryButton, Screen } from '@/components/ui';
import type { Keluarga, Warga } from '@/lib/types';

const JENIS_KELAMIN = ['L', 'P'] as const;
const STATUS_KELUARGA = ['Kepala Keluarga', 'Istri', 'Anak', 'Orang Tua', 'Famili', 'Lainnya'] as const;
const STATUS_KAWIN = ['Kawin', 'Belum Kawin', 'Cerai Hidup', 'Cerai Mati'] as const;
const AGAMA = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'] as const;

export default function WargaFormScreen() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const { id, keluarga_id } = useLocalSearchParams<{ id?: string; keluarga_id?: string }>();
  const editing = !!id;
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [keluargaList, setKeluargaList] = useState<Keluarga[]>([]);

  const [nik, setNik] = useState('');
  const [nama, setNama] = useState('');
  const [tempatLahir, setTempatLahir] = useState('');
  const [tanggalLahir, setTanggalLahir] = useState('');
  const [jenisKelamin, setJenisKelamin] = useState<typeof JENIS_KELAMIN[number]>('L');
  const [statusKeluarga, setStatusKeluarga] = useState<typeof STATUS_KELUARGA[number]>('Lainnya');
  const [pekerjaan, setPekerjaan] = useState('');
  const [agama, setAgama] = useState<typeof AGAMA[number]>('Islam');
  const [statusKawin, setStatusKawin] = useState<typeof STATUS_KAWIN[number]>('Belum Kawin');
  const [telepon, setTelepon] = useState('');
  const [famId, setFamId] = useState<string>('');

  const load = useCallback(async () => {
    try {
      const kk = await db.getAllAsync<Keluarga>('SELECT * FROM keluarga ORDER BY kepala_keluarga ASC');
      setKeluargaList(kk);
      if (keluarga_id) setFamId(keluarga_id);
      if (id) {
        const w = await db.getFirstAsync<Warga>('SELECT * FROM warga WHERE id = ?', Number(id));
        if (w) {
          setNik(w.nik);
          setNama(w.nama);
          setTempatLahir(w.tempat_lahir);
          setTanggalLahir(w.tanggal_lahir);
          setJenisKelamin(w.jenis_kelamin);
          setStatusKeluarga(w.status_keluarga as any);
          setPekerjaan(w.pekerjaan);
          setAgama(w.agama as any);
          setStatusKawin(w.status_perkawinan as any);
          setTelepon(w.telepon);
          setFamId(w.keluarga_id ? String(w.keluarga_id) : '');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [db, id, keluarga_id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function simpan() {
    if (!nik.trim() || !nama.trim()) return;
    setSaving(true);
    try {
      const famIdNum = famId ? Number(famId) : null;
      if (editing) {
        await db.runAsync(
          `UPDATE warga SET keluarga_id=?, nik=?, nama=?, tempat_lahir=?, tanggal_lahir=?,
           jenis_kelamin=?, status_keluarga=?, pekerjaan=?, agama=?, status_perkawinan=?, telepon=?
           WHERE id=?`,
          famIdNum,
          nik.trim(),
          nama.trim(),
          tempatLahir.trim(),
          tanggalLahir.trim(),
          jenisKelamin,
          statusKeluarga,
          pekerjaan.trim(),
          agama,
          statusKawin,
          telepon.trim(),
          Number(id)
        );
      } else {
        await db.runAsync(
          `INSERT INTO warga (keluarga_id, nik, nama, tempat_lahir, tanggal_lahir, jenis_kelamin,
           status_keluarga, pekerjaan, agama, status_perkawinan, telepon)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          famIdNum,
          nik.trim(),
          nama.trim(),
          tempatLahir.trim(),
          tanggalLahir.trim(),
          jenisKelamin,
          statusKeluarga,
          pekerjaan.trim(),
          agama,
          statusKawin,
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
        <Text style={styles.title}>{editing ? 'Edit Warga' : 'Tambah Warga'}</Text>
        <View style={{ height: 12 }} />
        <Field label="NIK" value={nik} onChangeText={setNik} placeholder="Nomor Induk Kependudukan" keyboardType="number-pad" />
        <Field label="Nama Lengkap" value={nama} onChangeText={setNama} placeholder="Nama sesuai KTP" />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Tempat Lahir" value={tempatLahir} onChangeText={setTempatLahir} />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Field label="Tgl Lahir (YYYY-MM-DD)" value={tanggalLahir} onChangeText={setTanggalLahir} placeholder="1990-01-01" />
          </View>
        </View>

        <Text style={[styles.fieldLabel, { color: Colors[scheme].muted }]}>Jenis Kelamin</Text>
        <Chips options={JENIS_KELAMIN} value={jenisKelamin} onChange={(v) => setJenisKelamin(v)} />

        <Text style={[styles.fieldLabel, { color: Colors[scheme].muted }]}>Status dalam Keluarga</Text>
        <Chips options={STATUS_KELUARGA} value={statusKeluarga} onChange={(v) => setStatusKeluarga(v)} />

        <Field label="Pekerjaan" value={pekerjaan} onChangeText={setPekerjaan} placeholder="e.g. Wiraswasta" />

        <Text style={[styles.fieldLabel, { color: Colors[scheme].muted }]}>Agama</Text>
        <Chips options={AGAMA} value={agama} onChange={(v) => setAgama(v)} />

        <Text style={[styles.fieldLabel, { color: Colors[scheme].muted }]}>Status Perkawinan</Text>
        <Chips options={STATUS_KAWIN} value={statusKawin} onChange={(v) => setStatusKawin(v)} />

        <Field label="No. Telepon" value={telepon} onChangeText={setTelepon} keyboardType="phone-pad" />

        <Text style={[styles.fieldLabel, { color: Colors[scheme].muted }]}>Keluarga (KK)</Text>
        <Chips
          options={['', ...keluargaList.map((k) => String(k.id))] as never}
          value={famId}
          onChange={(v) => setFamId(v)}
        />
        {keluargaList.length > 0 && (
          <Text style={[styles.kkHint, { color: Colors[scheme].muted }]}>
            {keluargaList.map((k) => `${k.id}: ${k.kepala_keluarga}`).join('  ·  ')}
          </Text>
        )}

        <View style={{ height: 12 }} />
        <PrimaryButton
          title={saving ? 'Menyimpan...' : 'Simpan'}
          onPress={simpan}
          disabled={!nik.trim() || !nama.trim()}
          loading={saving}
        />
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
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  kkHint: {
    fontSize: 12,
    marginTop: -6,
    marginBottom: 8,
  },
});