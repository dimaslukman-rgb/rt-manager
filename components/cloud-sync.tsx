import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { restoreCloudToLocal, syncLocalToCloud } from '@/lib/sync';
import { useSQLiteContext } from 'expo-sqlite';

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

  async function upload() {
    setBusy(true);
    setStatusMsg({ text: 'Sedang mengunggah data lokal ke Supabase Cloud...', type: 'info' });
    try {
      const count = await syncLocalToCloud(db, currentUser?.username);
      notify('Sync Selesai', `✅ Berhasil mencadangkan ${count} data RT ke Cloud.`, 'success');
    } catch (error) {
      notify('Sync Gagal', error instanceof Error ? error.message : 'Tidak dapat mengirim data.', 'error');
    } finally {
      setBusy(false);
    }
  }

  function restore() {
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
      if (window.confirm('Pulihkan Data dari Cloud?\n\nData lokal di perangkat ini akan diperbarui dengan data dari Cloud.')) {
        executeRestore();
      }
    } else {
      Alert.alert('Pulihkan dari Cloud', 'Data lokal akan diperbarui dengan data dari Cloud.', [
        { text: 'Batal', style: 'cancel' },
        { text: 'Pulihkan', style: 'destructive', onPress: executeRestore },
      ]);
    }
  }

  return (
    <Card style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>☁️ Cloud Sync (Backup & Restore)</Text>
          <Text style={[styles.meta, { color: Colors[scheme].muted }]}>
            Akun: <Text style={{ fontWeight: '700', color: Colors[scheme].text }}>{currentUser.nama_lengkap}</Text> ({currentUser.role})
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

      <View style={styles.actions}>
        <Pressable
          onPress={upload}
          disabled={busy}
          style={[styles.button, { backgroundColor: Colors[scheme].primaryMuted, opacity: busy ? 0.6 : 1 }]}>
          <Text style={{ color: Colors[scheme].primary, fontWeight: '700' }}>
            {busy ? '⏳ Memproses...' : '⬆️ Upload ke Cloud'}
          </Text>
        </Pressable>

        <Pressable
          onPress={restore}
          disabled={busy}
          style={[styles.button, { backgroundColor: Colors[scheme].dangerMuted, opacity: busy ? 0.6 : 1 }]}>
          <Text style={{ color: Colors[scheme].danger, fontWeight: '700' }}>
            {busy ? '⏳ Memproses...' : '⬇️ Pulihkan dari Cloud'}
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
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
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
    gap: 10,
    marginTop: 12,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 12,
  },
});
