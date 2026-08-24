import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Badge, Card, MenuCard, Screen, SectionTitle } from '@/components/ui';
import { MenuCloudSync } from '@/components/cloud-sync';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export default function MenuScreen() {
  const { currentUser, logout, hasRole, isWarga } = useAuth();
  const scheme = useColorScheme();
  const router = useRouter();

  function handleLogout() {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Keluar dari sesi akun saat ini dan kembali ke halaman login?')) {
        logout();
      }
    } else {
      Alert.alert('Keluar Akun', 'Keluar dari sesi akun saat ini?', [
        { text: 'Batal', style: 'cancel' },
        { text: 'Keluar', style: 'destructive', onPress: logout },
      ]);
    }
  }

  function getRoleBadgeVariant(r?: string) {
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
      case 'WARGA':
        return 'primary';
      default:
        return 'info';
    }
  }

  return (
    <Screen>
      {/* Active User Account Profile Card */}
      <Card style={[styles.profileCard, { backgroundColor: Colors[scheme].card }]}>
        <View style={styles.profileRow}>
          <View style={styles.profileAvatar}>
            <Text style={{ fontSize: 24 }}>
              {currentUser?.role === 'ADMIN'
                ? '👑'
                : currentUser?.role === 'BENDAHARA'
                ? '💰'
                : isWarga
                ? '🏡'
                : '👤'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={styles.profileName}>
                {isWarga ? 'Warga / Penghuni (Anonim)' : currentUser?.nama_lengkap || 'Pengurus RT'}
              </Text>
              <Badge
                label={
                  currentUser?.role === 'ADMIN'
                    ? 'SUPER ADMIN'
                    : isWarga
                    ? 'WARGA / PENGHUNI'
                    : currentUser?.role || 'PENGURUS'
                }
                variant={getRoleBadgeVariant(currentUser?.role)}
              />
            </View>
            <Text style={[styles.profileMeta, { color: Colors[scheme].muted }]}>
              {isWarga
                ? 'Akses Publik & Pengaduan Warga RT 04'
                : `@${currentUser?.username} · 📞 ${currentUser?.no_hp}`}
            </Text>
          </View>
        </View>

        <Pressable onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutBtnText}>🚪 Keluar / Ganti Akun</Text>
        </Pressable>
      </Card>

      {/* Menu Navigasi Sesuai Role */}
      {isWarga ? (
        <>
          <SectionTitle>Layanan Warga / Penghuni</SectionTitle>
          <View style={styles.grid}>
            <MenuCard
              title="Lapor Pak RT!"
              subtitle="Kirim aduan & aspirasi"
              emoji="📢"
              href="/lapor-rt"
            />
            <MenuCard
              title="Pusat Darurat"
              subtitle="Panic button & sirine"
              emoji="🚨"
              href="/darurat"
            />
            <MenuCard
              title="Surat & Pengajuan"
              subtitle="Pengajuan surat pengantar"
              emoji="📄"
              href="/surat"
            />
          </View>
        </>
      ) : (
        <>
          <SectionTitle>Manajemen RT</SectionTitle>
          {isSupabaseConfigured && <MenuCloudSync />}

          <View style={styles.grid}>
            {/* Inbox Laporan Warga for all RT Officials */}
            <MenuCard
              title="Inbox Laporan Warga"
              subtitle="Kotak masuk aduan warga"
              emoji="📥"
              href="/inbox"
            />

            {/* Admin only User Management Menu */}
            {hasRole('ADMIN') && (
              <MenuCard
                title="Kelola Pengurus"
                subtitle="Manajemen akun & role RT"
                emoji="👑"
                href="/pengguna"
              />
            )}

            <MenuCard
              title="Lapor Pak RT!"
              subtitle="Kirim aduan warga"
              emoji="📢"
              href="/lapor-rt"
            />
            <MenuCard
              title="Pusat Darurat"
              subtitle="Panic button & sirine"
              emoji="🚨"
              href="/darurat"
            />
            <MenuCard
              title="Surat & Pengajuan"
              subtitle="Pengajuan surat pengantar"
              emoji="📄"
              href="/surat"
            />
            <MenuCard
              title="Agenda & Kegiatan"
              subtitle="Rapat, kerja bakti, dll"
              emoji="📅"
              href="/kegiatan"
            />
            <MenuCard
              title="Berita & Pengumuman"
              subtitle="Informasi untuk warga"
              emoji="📰"
              href="/pengumuman"
            />
            <MenuCard
              title="Buku Tamu"
              subtitle="Catatan kunjungan"
              emoji="📖"
              href="/tamu"
            />
            <MenuCard
              title="Jadwal Ronda"
              subtitle="Keamanan lingkungan"
              emoji="👮"
              href="/ronda"
            />
            <MenuCard
              title="Pengaturan"
              subtitle="Info RT & iuran"
              emoji="⚙️"
              href="/pengaturan"
            />
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    padding: 16,
    marginBottom: 16,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
  },
  profileMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  logoutBtn: {
    marginTop: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtnText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
});
