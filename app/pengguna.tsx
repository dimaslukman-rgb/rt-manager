import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Badge, Card, Chips, EmptyState, FAB, Field, LoadingState, PrimaryButton, Screen, SectionTitle } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { Pengguna, RoleUser } from '@/lib/types';

const ROLES: RoleUser[] = ['ADMIN', 'KETUA_RT', 'WAKIL_KETUA', 'BENDAHARA', 'SEKRETARIS', 'SECURITY', 'WARGA'];

export default function PenggunaScreen() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const { currentUser, hasRole } = useAuth();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Pengguna[]>([]);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [username, setUsername] = useState('');
  const [namaLengkap, setNamaLengkap] = useState('');
  const [noHp, setNoHp] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RoleUser>('KETUA_RT');
  const [saving, setSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const rows = await db.getAllAsync<Pengguna>('SELECT * FROM pengguna ORDER BY id ASC');
      setUsers(rows);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [loadUsers])
  );

  function showAlert(title: string, msg: string) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  }

  function openCreateModal() {
    setEditId(null);
    setUsername('');
    setNamaLengkap('');
    setNoHp('');
    setPassword('rt123456');
    setRole('KETUA_RT');
    setModalVisible(true);
  }

  function openEditModal(u: Pengguna) {
    setEditId(u.id);
    setUsername(u.username);
    setNamaLengkap(u.nama_lengkap);
    setNoHp(u.no_hp);
    setPassword(u.password || '');
    setRole(u.role);
    setModalVisible(true);
  }

  async function handleSave() {
    if (!username.trim() || !namaLengkap.trim() || !noHp.trim() || !password.trim()) {
      showAlert('Wajib Diisi', 'Semua kolom wajib diisi lengkap.');
      return;
    }

    setSaving(true);
    try {
      if (editId) {
        await db.runAsync(
          `UPDATE pengguna SET username = ?, nama_lengkap = ?, no_hp = ?, password = ?, role = ? WHERE id = ?`,
          username.trim().toLowerCase(),
          namaLengkap.trim(),
          noHp.trim(),
          password.trim(),
          role,
          editId
        );
      } else {
        await db.runAsync(
          `INSERT INTO pengguna (username, nama_lengkap, no_hp, password, role, aktif)
           VALUES (?, ?, ?, ?, ?, 1)`,
          username.trim().toLowerCase(),
          namaLengkap.trim(),
          noHp.trim(),
          password.trim(),
          role
        );
      }

      setModalVisible(false);
      await loadUsers();
      showAlert('Berhasil', editId ? 'Data pengurus berhasil diperbarui.' : 'Akun pengurus baru berhasil ditambahkan.');
    } catch (e: any) {
      showAlert('Gagal Menyimpan', e?.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(u: Pengguna) {
    if (u.username === 'admin') {
      showAlert('Dilarang', 'Akun Super Admin utama tidak dapat dihapus.');
      return;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Hapus akun pengurus ${u.nama_lengkap} (${u.username})?`)) {
        await db.runAsync('DELETE FROM pengguna WHERE id = ?', u.id);
        await loadUsers();
      }
    } else {
      Alert.alert('Hapus Akun', `Hapus akun pengurus ${u.nama_lengkap}?`, [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            await db.runAsync('DELETE FROM pengguna WHERE id = ?', u.id);
            await loadUsers();
          },
        },
      ]);
    }
  }

  if (loading) return <LoadingState />;

  if (!hasRole('ADMIN')) {
    return (
      <Screen>
        <EmptyState message="Menu Manajemen Pengurus hanya dapat diakses oleh Super Admin." />
      </Screen>
    );
  }

  function getRoleBadgeVariant(r: RoleUser) {
    switch (r) {
      case 'ADMIN':
        return 'danger';
      case 'KETUA_RT':
        return 'success';
      case 'WAKIL_KETUA':
        return 'info';
      case 'BENDAHARA':
        return 'warning';
      case 'SEKRETARIS':
        return 'info';
      case 'SECURITY':
        return 'warning';
      case 'WARGA':
        return 'primary';
      default:
        return 'info';
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Card style={{ backgroundColor: '#1e293b', borderColor: 'transparent' }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>👑 Manajemen Pengguna & Pengurus RT</Text>
          <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
            Kelola hak akses dan akun login untuk Ketua RT, Wakil, Bendahara, dan Sekretaris.
          </Text>
        </Card>

        <SectionTitle>Daftar Akun Pengurus ({users.length})</SectionTitle>
        {users.map((u) => (
          <Card key={u.id}>
            <View style={styles.userRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Badge label={u.role} variant={getRoleBadgeVariant(u.role)} />
                  <Text style={styles.userName}>{u.nama_lengkap}</Text>
                </View>
                <Text style={[styles.userMeta, { color: Colors[scheme].muted }]}>
                  👤 Username: <Text style={{ fontWeight: '700', color: Colors[scheme].text }}>{u.username}</Text> · 📞 {u.no_hp}
                </Text>
                <Text style={[styles.userMeta, { color: Colors[scheme].muted }]}>
                  🔑 Password: {u.password}
                </Text>
              </View>

              <View style={styles.actionBtns}>
                <Pressable
                  onPress={() => openEditModal(u)}
                  style={[styles.btnSmall, { backgroundColor: Colors[scheme].primaryMuted }]}>
                  <Text style={{ color: Colors[scheme].primary, fontWeight: '700', fontSize: 12 }}>✏️ Edit</Text>
                </Pressable>
                {u.username !== 'admin' && (
                  <Pressable
                    onPress={() => handleDelete(u)}
                    style={[styles.btnSmall, { backgroundColor: '#fee2e2' }]}>
                    <Text style={{ color: '#dc2626', fontWeight: '700', fontSize: 12 }}>🗑️</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </Card>
        ))}
      </Screen>

      <FAB label="Pengurus" onPress={openCreateModal} />

      {/* Modal Add / Edit User */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBody, { backgroundColor: Colors[scheme].card }]}>
            <Text style={styles.modalTitle}>{editId ? '✏️ Edit Akun Pengurus' : '➕ Tambah Akun Pengurus'}</Text>

            <Field label="Username (Huruf Kecil)" value={username} onChangeText={setUsername} placeholder="contoh: bendahara2" />
            <Field label="Nama Lengkap" value={namaLengkap} onChangeText={setNamaLengkap} placeholder="contoh: Ibu Ratna Dewi" />
            <Field label="Nomor HP / WhatsApp" value={noHp} onChangeText={setNoHp} placeholder="081234567890" keyboardType="phone-pad" />
            <Field label="Password Akun" value={password} onChangeText={setPassword} placeholder="Password login" />

            <SectionTitle>Pilih Role / Jabatan</SectionTitle>
            <Chips options={ROLES} value={role} onChange={(r) => setRole(r as RoleUser)} />

            <View style={{ marginTop: 16 }}>
              <PrimaryButton
                title={saving ? 'Menyimpan...' : 'Simpan Akun Pengurus'}
                onPress={handleSave}
                disabled={saving}
              />
            </View>

            <Pressable onPress={() => setModalVisible(false)} style={{ marginTop: 12 }}>
              <Text style={{ textAlign: 'center', color: Colors[scheme].muted, fontWeight: '600' }}>Batal</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  userName: {
    fontSize: 15,
    fontWeight: '800',
  },
  userMeta: {
    fontSize: 12,
    marginTop: 3,
  },
  actionBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  btnSmall: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
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
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
});
