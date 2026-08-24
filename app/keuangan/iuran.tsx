import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Card, EmptyState, Field, LoadingState, PrimaryButton, Screen, SectionTitle } from '@/components/ui';
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

  // Modal Custom Nominal State
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PembayaranIuran | null>(null);
  const [editNominal, setEditNominal] = useState('');
  const [updatePermanent, setUpdatePermanent] = useState(true);

  const bulan = BULAN[bulanIdx];

  const ensureIuran = useCallback(async (defaultNominal: number) => {
    const kk = await db.getAllAsync<{ id: number; kepala_keluarga: string; nominal_iuran?: number }>(
      'SELECT id, kepala_keluarga, nominal_iuran FROM keluarga ORDER BY kepala_keluarga ASC'
    );
    for (const item of kk) {
      const nominalKk = item.nominal_iuran && item.nominal_iuran > 0 ? item.nominal_iuran : defaultNominal;
      await db.runAsync(
        `INSERT OR IGNORE INTO iuran (keluarga_id, bulan, tahun, nominal, status)
         VALUES (?, ?, ?, ?, 'Belum')`,
        item.id,
        bulan,
        tahun,
        nominalKk
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

  function openCustomNominalModal(item: PembayaranIuran) {
    setSelectedItem(item);
    setEditNominal(String(item.nominal));
    setUpdatePermanent(true);
    setModalVisible(true);
  }

  async function saveCustomNominal() {
    if (!selectedItem) return;
    const nominalNum = Number(editNominal.replace(/[^0-9]/g, '')) || 0;
    if (nominalNum <= 0) return;

    setSaving(true);
    try {
      // 1. Update the iuran row for this month
      await db.runAsync('UPDATE iuran SET nominal = ? WHERE id = ?', nominalNum, selectedItem.id);

      // 2. If update permanent, also update the default nominal_iuran on keluarga table
      if (updatePermanent) {
        await db.runAsync(
          'UPDATE keluarga SET nominal_iuran = ? WHERE id = ?',
          nominalNum,
          selectedItem.keluarga_id
        );
      }

      setModalVisible(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;

  const lunasCount = daftar.filter((d) => d.status === 'Lunas').length;
  const totalNominalBelum = daftar.filter((d) => d.status === 'Belum').reduce((a, b) => a + b.nominal, 0);
  const totalTerkumpul = daftar.filter((d) => d.status === 'Lunas').reduce((a, b) => a + b.nominal, 0);

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Iuran Warga · {bulan} {tahun}</Text>
        <Text style={[styles.sub, { color: Colors[scheme].muted }]}>
          Standar: {formatRupiah(pengaturan?.nominal_iuran ?? 50000)} / bulan · Tiap KK dapat di-custom sesuai kebutuhan.
        </Text>
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
            <Text style={[styles.summaryLabel, { color: Colors[scheme].muted }]}>KK Lunas ({formatRupiah(totalTerkumpul)})</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.summaryValue, { color: Colors[scheme].warning }]}>{formatRupiah(totalNominalBelum)}</Text>
            <Text style={[styles.summaryLabel, { color: Colors[scheme].muted }]}>Belum Dibayar</Text>
          </View>
        </View>
      </Card>

      <SectionTitle>Daftar Pembayaran Iuran Per KK</SectionTitle>
      {daftar.length === 0 ? (
        <EmptyState message="Belum ada keluarga. Tambahkan keluarga di menu Warga." />
      ) : (
        daftar.map((item) => (
          <Card key={item.id}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.kepala_keluarga}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <Pressable
                    onPress={() => openCustomNominalModal(item)}
                    style={styles.nominalBadge}>
                    <Text style={styles.nominalText}>💰 {formatRupiah(item.nominal)} ✏️</Text>
                  </Pressable>
                  {item.tanggal_bayar ? (
                    <Text style={[styles.meta, { color: Colors[scheme].muted }]}>
                      · Lunas {item.tanggal_bayar}
                    </Text>
                  ) : null}
                </View>
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

      {/* Modal Edit Custom Nominal Iuran Per KK */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBody, { backgroundColor: Colors[scheme].card }]}>
            <Text style={styles.modalTitle}>✏️ Atur Iuran Khusus KK</Text>
            <Text style={[styles.modalSub, { color: Colors[scheme].muted }]}>
              Keluarga: <Text style={{ fontWeight: '700', color: Colors[scheme].text }}>{selectedItem?.kepala_keluarga}</Text> ({selectedItem?.bulan} {selectedItem?.tahun})
            </Text>

            <Field
              label="Nominal Iuran (Rp)"
              value={editNominal}
              onChangeText={(v) => setEditNominal(v.replace(/[^0-9]/g, ''))}
              placeholder="Contoh: 100000 atau 75000"
              keyboardType="number-pad"
            />

            <Pressable
              onPress={() => setUpdatePermanent(!updatePermanent)}
              style={styles.checkboxRow}>
              <Text style={{ fontSize: 18 }}>{updatePermanent ? '☑️' : '⬜'}</Text>
              <Text style={styles.checkboxLabel}>
                Jadikan tarif tetap untuk KK ini di bulan-bulan berikutnya
              </Text>
            </Pressable>

            <View style={{ marginTop: 16 }}>
              <PrimaryButton
                title={saving ? 'Menyimpan...' : 'Simpan Nominal Iuran'}
                onPress={saveCustomNominal}
                disabled={saving || !editNominal.trim()}
              />
            </View>

            <Pressable onPress={() => setModalVisible(false)} style={{ marginTop: 12 }}>
              <Text style={{ textAlign: 'center', color: Colors[scheme].muted, fontWeight: '600' }}>Batal</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  },
  nominalBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  nominalText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0e9f6e',
  },
  statusBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBody: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 13,
    marginBottom: 14,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  checkboxLabel: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
});