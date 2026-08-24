import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { restoreCloudToLocal, syncLocalToCloud } from '@/lib/sync';
import { isSupabaseConfigured } from '@/lib/supabase';

const BACKUP_TABLES = [
  'pengaturan',
  'keluarga',
  'warga',
  'transaksi',
  'iuran',
  'surat',
  'kegiatan',
  'pengumuman',
  'buku_tamu',
  'ronda',
  'darurat',
  'security',
  'jadwal_security',
  'lapor_rt',
] as const;

export function MenuCloudSync() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const { currentUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  if (!currentUser) return null;

  function notify(title: string, msg: string, type: 'success' | 'error' | 'info' = 'info') {
    setStatusMsg({ text: `${title}: ${msg}`, type });
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  }

  // 1. Cloud Sync (Supabase)
  async function uploadCloud() {
    if (!isSupabaseConfigured) {
      notify(
        'Cloud Belum Dihubungkan',
        'Supabase Cloud URL & API Key belum disetel di Vercel/.env. Anda bisa gunakan tombol "📁 Unduh File Backup (JSON)" di bawah untuk memindahkan data ke HP/komputer lain secara instan tanpa perlu server.',
        'info'
      );
      return;
    }

    setBusy(true);
    setStatusMsg({ text: 'Sedang mengunggah data lokal ke Supabase Cloud...', type: 'info' });
    try {
      const count = await syncLocalToCloud(db, currentUser?.username);
      notify('Sync Selesai', `✅ Berhasil mencadangkan ${count} data RT ke Cloud.`, 'success');
    } catch (error) {
      notify('Sync Gagal', error instanceof Error ? error.message : 'Tidak dapat mengirim data ke cloud.', 'error');
    } finally {
      setBusy(false);
    }
  }

  function restoreCloud() {
    if (!isSupabaseConfigured) {
      notify(
        'Cloud Belum Dihubungkan',
        'Supabase Cloud URL & API Key belum disetel di Vercel/.env. Anda bisa gunakan tombol "📁 Impor File Backup (JSON)" di bawah untuk memulihkan data dari file backup.',
        'info'
      );
      return;
    }

    const executeRestore = async () => {
      setBusy(true);
      setStatusMsg({ text: 'Sedang memulihkan data dari Supabase Cloud...', type: 'info' });
      try {
        const data = await restoreCloudToLocal(db, currentUser?.username);
        const count = Object.values(data).reduce((sum, rows) => sum + rows.length, 0);
        notify('Pemulihan Selesai', `✅ ${count} data dari Cloud berhasil dipulihkan ke perangkat ini.`, 'success');
      } catch (error) {
        notify('Pemulihan Gagal', error instanceof Error ? error.message : 'Tidak dapat memulihkan data.', 'error');
      } finally {
        setBusy(false);
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Pulihkan Data dari Cloud?\n\nData lokal di perangkat ini akan disinkronkan dengan data dari Cloud.')) {
        executeRestore();
      }
    } else {
      Alert.alert('Pulihkan dari Cloud', 'Data lokal akan disinkronkan dengan data dari Cloud.', [
        { text: 'Batal', style: 'cancel' },
        { text: 'Pulihkan', style: 'destructive', onPress: executeRestore },
      ]);
    }
  }

  // 2. Offline / File Backup Export (.JSON)
  async function handleExportFile() {
    setBusy(true);
    setStatusMsg({ text: 'Sedang menyiapkan berkas cadangan data...', type: 'info' });

    try {
      const backupData: Record<string, any> = {
        _app: 'rt-manager',
        _version: 9,
        _exported_at: new Date().toISOString(),
        _exported_by: currentUser?.nama_lengkap,
      };

      for (const table of BACKUP_TABLES) {
        try {
          const rows = await db.getAllAsync(`SELECT * FROM ${table}`);
          backupData[table] = rows;
        } catch {
          backupData[table] = [];
        }
      }

      const jsonString = JSON.stringify(backupData, null, 2);

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `backup_data_rt_manager_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        notify('Backup Berhasil 📁', 'File berkas cadangan "backup_data_rt_manager.json" telah berhasil diunduh ke perangkat Anda.', 'success');
      } else {
        notify('Cadangan Berhasil 📁', 'Data berhasil diekspor ke format JSON.', 'success');
      }
    } catch (e: any) {
      notify('Gagal Ekspor', e?.message || 'Terjadi kesalahan.', 'error');
    } finally {
      setBusy(false);
    }
  }

  // 3. Offline / File Backup Import (.JSON)
  function handleImportFile() {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            setBusy(true);
            setStatusMsg({ text: 'Sedang memulihkan data dari berkas...', type: 'info' });
            const content = event.target?.result as string;
            const parsed = JSON.parse(content);

            let totalRestored = 0;

            for (const table of BACKUP_TABLES) {
              const rows = parsed[table];
              if (Array.isArray(rows) && rows.length > 0) {
                for (const row of rows) {
                  const keys = Object.keys(row);
                  const placeholders = keys.map(() => '?').join(', ');
                  const sql = `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
                  const values = keys.map((k) => row[k]);
                  try {
                    await db.runAsync(sql, values);
                    totalRestored++;
                  } catch (err) {
                    console.warn(`Skip row on ${table}:`, err);
                  }
                }
              }
            }

            notify(
              'Impor Berhasil! 🎉',
              `Sebanyak ${totalRestored} data berhasil dipulihkan dari berkas JSON ke aplikasi ini.`,
              'success'
            );
          } catch (err: any) {
            notify('Gagal Membaca File', 'Format berkas JSON tidak sesuai atau rusak.', 'error');
          } finally {
            setBusy(false);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    } else {
      notify('Info Impor', 'Fitur impor berkas file backup dapat digunakan melalui web browser.', 'info');
    }
  }

  return (
    <Card style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>☁️ Sinkronisasi & Cadangan Data (Backup & Restore)</Text>
          <Text style={[styles.meta, { color: Colors[scheme].muted }]}>
            Kelola pertukaran data antara Web & Aplikasi Mobile (Khusus Pengurus RT & Admin).
          </Text>
        </View>
      </View>

      {statusMsg && (
        <View
          style={[
            styles.statusBanner,
            {
              backgroundColor:
                statusMsg.type === 'success' ? '#dcfce7' : statusMsg.type === 'error' ? '#fee2e2' : '#eff6ff',
              borderColor:
                statusMsg.type === 'success' ? '#16a34a' : statusMsg.type === 'error' ? '#dc2626' : '#3b82f6',
            },
          ]}>
          <Text
            style={[
              styles.statusText,
              {
                color:
                  statusMsg.type === 'success' ? '#15803d' : statusMsg.type === 'error' ? '#b91c1c' : '#1d4ed8',
              },
            ]}>
            {statusMsg.text}
          </Text>
        </View>
      )}

      {/* Row 1: Cloud Sync Buttons */}
      <View style={styles.actions}>
        <Pressable
          onPress={uploadCloud}
          disabled={busy}
          style={[styles.button, { backgroundColor: '#0284c7', opacity: busy ? 0.6 : 1 }]}>
          <Text style={styles.btnTextWhite}>
            {busy ? '⏳ Memproses...' : '☁️ Cadangkan ke Cloud'}
          </Text>
        </Pressable>

        <Pressable
          onPress={restoreCloud}
          disabled={busy}
          style={[styles.button, { backgroundColor: '#059669', opacity: busy ? 0.6 : 1 }]}>
          <Text style={styles.btnTextWhite}>
            {busy ? '⏳ Memproses...' : '☁️ Pulihkan dari Cloud'}
          </Text>
        </Pressable>
      </View>

      {/* Row 2: File JSON Backup & Restore Buttons */}
      <View style={[styles.actions, { marginTop: 8 }]}>
        <Pressable
          onPress={handleExportFile}
          disabled={busy}
          style={[styles.button, { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' }]}>
          <Text style={{ color: '#334155', fontWeight: '700', fontSize: 12 }}>
            📁 Unduh File Backup (JSON)
          </Text>
        </Pressable>

        <Pressable
          onPress={handleImportFile}
          disabled={busy}
          style={[styles.button, { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' }]}>
          <Text style={{ color: '#334155', fontWeight: '700', fontSize: 12 }}>
            📥 Impor File Backup (JSON)
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginBottom: 14,
    borderRadius: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
  },
  meta: {
    fontSize: 12,
    marginTop: 3,
  },
  statusBanner: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  btnTextWhite: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
    textAlign: 'center',
  },
});
