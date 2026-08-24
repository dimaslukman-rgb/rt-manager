import { useSQLiteContext } from 'expo-sqlite';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Badge, Card, EmptyState, LoadingState, Screen, SectionTitle } from '@/components/ui';
import { bulanKey, currentTime, todayISO } from '@/lib/db';
import { formatRupiah, formatTanggal } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import type { Kegiatan, Pengaturan, Pengumuman, Warga } from '@/lib/types';

interface DashboardData {
  totalWarga: number;
  totalKeluarga: number;
  kasMasuk: number;
  kasKeluar: number;
  iuranBelum: number;
  iuranLunas: number;
  iuranNominalBelum: number;
  laporanBaru: number;
}

function StatCard({ label, value, color, onPress }: { label: string; value: string; color: string; onPress?: () => void }) {
  const scheme = useColorScheme();
  const inner = (
    <Card style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: Colors[scheme].muted }]}>{label}</Text>
    </Card>
  );
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} style={{ width: '48%' }}>
      {inner}
    </Pressable>
  );
}

export default function BerandaScreen() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const router = useRouter();
  const { currentUser, isWarga, isSecurity, isPengurus } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [pengumuman, setPengumuman] = useState<Pengumuman[]>([]);
  const [kegiatan, setKegiatan] = useState<Kegiatan[]>([]);
  const [pengaturan, setPengaturan] = useState<Pengaturan | null>(null);

  const load = useCallback(async () => {
    try {
      const now = new Date();
      const bulan = bulanKey(now);
      const tahun = now.getFullYear();

      const [
        totalWarga,
        totalKeluarga,
        kasMasuk,
        kasKeluar,
        iuranBelum,
        iuranLunas,
        iuranNominalBelum,
        laporanBaru,
        pengaturanRow,
        pengumumanRows,
        kegiatanRows,
      ] = await Promise.all([
        db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM warga'),
        db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM keluarga'),
        db.getFirstAsync<{ s: number }>('SELECT COALESCE(SUM(nominal),0) as s FROM transaksi WHERE jenis = ?', 'Masuk'),
        db.getFirstAsync<{ s: number }>('SELECT COALESCE(SUM(nominal),0) as s FROM transaksi WHERE jenis = ?', 'Keluar'),
        db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM iuran WHERE bulan = ? AND tahun = ? AND status = ?', bulan, tahun, 'Belum'),
        db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM iuran WHERE bulan = ? AND tahun = ? AND status = ?', bulan, tahun, 'Lunas'),
        db.getFirstAsync<{ s: number }>('SELECT COALESCE(SUM(nominal),0) as s FROM iuran WHERE bulan = ? AND tahun = ? AND status = ?', bulan, tahun, 'Belum'),
        db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM lapor_rt WHERE status = ?', 'Terkirim'),
        db.getFirstAsync<Pengaturan>('SELECT * FROM pengaturan WHERE id = 1'),
        db.getAllAsync<Pengumuman>('SELECT * FROM pengumuman ORDER BY tanggal DESC, id DESC LIMIT 5'),
        db.getAllAsync<Kegiatan>('SELECT * FROM kegiatan WHERE tanggal >= ? ORDER BY tanggal ASC LIMIT 3', todayISO()),
      ]);

      setData({
        totalWarga: totalWarga?.c ?? 0,
        totalKeluarga: totalKeluarga?.c ?? 0,
        kasMasuk: kasMasuk?.s ?? 0,
        kasKeluar: kasKeluar?.s ?? 0,
        iuranBelum: iuranBelum?.c ?? 0,
        iuranLunas: iuranLunas?.c ?? 0,
        iuranNominalBelum: iuranNominalBelum?.s ?? 0,
        laporanBaru: laporanBaru?.c ?? 0,
      });
      setPengumuman(pengumumanRows);
      setKegiatan(kegiatanRows);
      setPengaturan(pengaturanRow);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return <LoadingState />;
  }

  const saldo = (data?.kasMasuk ?? 0) - (data?.kasKeluar ?? 0);
  const roleDisplay = currentUser?.role === 'ADMIN'
    ? '👑 SUPER ADMIN'
    : currentUser?.role === 'SECURITY'
    ? '👮 PETUGAS SECURITY'
    : currentUser?.role === 'WARGA'
    ? '🏡 WARGA / PENGHUNI'
    : currentUser?.role
    ? `🏛️ ${currentUser.role}`
    : 'PENGURUS';

  const cleanName = currentUser?.nama_lengkap
    ? currentUser.nama_lengkap.replace(/\s*\(.*?\)\s*/g, '').trim()
    : 'Warga';

  return (
    <Screen>
      {/* 1. Header Foto Perumahan Hangtuah (Paling Atas) */}
      <View style={[styles.bannerCard, { backgroundColor: Colors[scheme].card, borderColor: Colors[scheme].border }]}>
        <Image
          source={require('@/assets/images/perumahan_header.png')}
          style={styles.bannerImage}
        />
        <View style={styles.bannerInfo}>
          <Text style={styles.bannerTitle}>🏡 Perumahan Hangtuah</Text>
          <Text style={[styles.bannerSub, { color: Colors[scheme].muted }]}>Grand Residence City</Text>
        </View>
      </View>

      {/* 2. Hero Greeting Card */}
      <Card style={styles.hero}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <Text style={styles.heroTitle}>Halo, {cleanName}! 👋</Text>
          <View style={styles.roleHeaderBadge}>
            <Text style={styles.roleHeaderBadgeText}>{roleDisplay}</Text>
          </View>
        </View>
        <Text style={styles.heroSub}>
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </Text>
        {!isWarga && !isSecurity && (
          <View style={styles.heroBadges}>
            <Badge label={`${data?.iuranLunas ?? 0} KK lunas bulan ini`} variant="success" />
            {data && data.iuranBelum > 0 && <Badge label={`${data.iuranBelum} KK belum bayar`} variant="warning" />}
          </View>
        )}
      </Card>

      {/* 3. Panic Button Emergency Card */}
      <Pressable onPress={() => router.push('/darurat')}>
        <Card style={styles.panicBanner}>
          <View style={styles.panicRow}>
            <View style={styles.panicIconCircle}>
              <Text style={{ fontSize: 26 }}>🚨</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.panicBannerTitle}>TOMBOL PANIK (PANIC BUTTON)</Text>
              <Text style={styles.panicBannerSub}>
                Panggil bantuan security & bunyikan alarm darurat
              </Text>
            </View>
            <View style={styles.panicBadge}>
              <Text style={styles.panicBadgeText}>DARURAT</Text>
            </View>
          </View>
        </Card>
      </Pressable>

      {/* 4. Menu Khusus "Lapor Pak RT!" untuk Warga / Pengurus */}
      <Pressable onPress={() => router.push('/lapor-rt')}>
        <Card style={styles.laporBanner}>
          <View style={styles.laporRow}>
            <View style={styles.laporIconCircle}>
              <Text style={{ fontSize: 24 }}>📢</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.laporBannerTitle}>LAPOR PAK RT!</Text>
              <Text style={styles.laporBannerSub}>
                Kirim aduan lingkungan, fasilitas rusak, atau usulan ke pengurus
              </Text>
            </View>
            <View style={styles.laporBadge}>
              <Text style={styles.laporBadgeText}>BUAT ADUAN →</Text>
            </View>
          </View>
        </Card>
      </Pressable>

      {/* 5. Menu Khusus "Petugas Security & Jadwal Shift" di Beranda */}
      <Pressable onPress={() => router.push('/security')}>
        <Card style={styles.securityBanner}>
          <View style={styles.securityRow}>
            <View style={styles.securityIconCircle}>
              <Text style={{ fontSize: 24 }}>👮</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.securityBannerTitle}>SECURITY & JADWAL SHIFT</Text>
                <View style={styles.securityLiveTag}>
                  <Text style={styles.securityLiveTagText}>ON DUTY</Text>
                </View>
              </View>
              <Text style={styles.securityBannerSub}>
                Pos Gerbang Utama · Siaga 24 Jam & Kontak Satpam
              </Text>
            </View>
            <View style={styles.securityBadge}>
              <Text style={styles.securityBadgeText}>JADWAL →</Text>
            </View>
          </View>
        </Card>
      </Pressable>

      {/* 5. Khusus Pengurus RT: Notifikasi Inbox Laporan Masuk */}
      {!isWarga && (data?.laporanBaru ?? 0) > 0 && (
        <Pressable onPress={() => router.push('/inbox')}>
          <Card style={styles.inboxAlertCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <Text style={{ fontSize: 22 }}>📥</Text>
                <View>
                  <Text style={styles.inboxAlertTitle}>Kotak Masuk (Inbox) Warga</Text>
                  <Text style={styles.inboxAlertSub}>
                    Ada <Text style={{ fontWeight: '800', color: '#dc2626' }}>{data?.laporanBaru} laporan baru</Text> dari warga yang perlu ditindaklanjuti.
                  </Text>
                </View>
              </View>
              <View style={styles.inboxCountBadge}>
                <Text style={styles.inboxCountText}>{data?.laporanBaru}</Text>
              </View>
            </View>
          </Card>
        </Pressable>
      )}

      <SectionTitle>Ringkasan</SectionTitle>
      <View style={styles.statsRow}>
        <StatCard label="Warga" value={String(data?.totalWarga ?? 0)} color={Colors[scheme].info} />
        <StatCard label="Keluarga" value={String(data?.totalKeluarga ?? 0)} color={Colors[scheme].primary} />
        <StatCard
          label="Kas RT"
          value={formatRupiah(saldo)}
          color={saldo >= 0 ? Colors[scheme].success : Colors[scheme].danger}
        />
        <StatCard
          label="Tagihan iuran"
          value={formatRupiah(data?.iuranNominalBelum ?? 0)}
          color={Colors[scheme].warning}
        />
      </View>

      <SectionTitle>Pengumuman Terbaru</SectionTitle>
      {pengumuman.length === 0 ? (
        <EmptyState message="Belum ada pengumuman" />
      ) : (
        pengumuman.map((p) => (
          <Card key={p.id}>
            <View style={styles.rowBetween}>
              <Text style={styles.itemTitle}>{p.judul}</Text>
              {p.penting === 1 && <Badge label="Penting" variant="danger" />}
            </View>
            <Text style={[styles.itemMeta, { color: Colors[scheme].muted }]}>
              {formatTanggal(p.tanggal)} · {currentTime()}
            </Text>
          </Card>
        ))
      )}

      <SectionTitle>Kegiatan Mendatang</SectionTitle>
      {kegiatan.length === 0 ? (
        <EmptyState message="Tidak ada kegiatan mendatang" />
      ) : (
        kegiatan.map((k) => (
          <Card key={k.id}>
            <View style={styles.rowBetween}>
              <Text style={styles.itemTitle}>{k.judul}</Text>
              <Badge label={k.jenis} variant="info" />
            </View>
            <Text style={[styles.itemMeta, { color: Colors[scheme].muted }]}>
              {formatTanggal(k.tanggal)} {k.waktu ? `· ${k.waktu}` : ''} {k.lokasi ? `· ${k.lokasi}` : ''}
            </Text>
          </Card>
        ))
      )}

      <Pressable onPress={() => router.push('/menu')}>
        <Card style={[styles.footerCard, { backgroundColor: Colors[scheme].primaryMuted, borderColor: 'transparent' }]}>
          <Text style={{ color: Colors[scheme].primary, fontWeight: '700', textAlign: 'center' }}>
            Buka Menu Lengkap →
          </Text>
        </Card>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  panicBanner: {
    backgroundColor: '#dc2626',
    borderColor: 'transparent',
    padding: 14,
    marginBottom: 10,
  },
  panicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  panicIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panicBannerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  panicBannerSub: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    marginTop: 2,
  },
  panicBadge: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  panicBadgeText: {
    color: '#dc2626',
    fontWeight: '900',
    fontSize: 10,
  },
  laporBanner: {
    backgroundColor: '#0284c7',
    borderColor: 'transparent',
    padding: 14,
    marginBottom: 10,
  },
  laporRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  laporIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  laporBannerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  laporBannerSub: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    marginTop: 2,
  },
  laporBadge: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  laporBadgeText: {
    color: '#0284c7',
    fontWeight: '900',
    fontSize: 10,
  },
  securityBanner: {
    backgroundColor: '#065f46',
    borderColor: 'transparent',
    padding: 14,
    marginBottom: 10,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  securityIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityBannerTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  securityLiveTag: {
    backgroundColor: '#10b981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  securityLiveTagText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  securityBannerSub: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    marginTop: 2,
  },
  securityBadge: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  securityBadgeText: {
    color: '#065f46',
    fontWeight: '900',
    fontSize: 10,
  },
  inboxAlertCard: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    padding: 12,
    marginBottom: 10,
  },
  inboxAlertTitle: {
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '800',
  },
  inboxAlertSub: {
    color: '#7f1d1d',
    fontSize: 11,
    marginTop: 2,
  },
  inboxCountBadge: {
    backgroundColor: '#dc2626',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inboxCountText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  bannerCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  bannerImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  bannerInfo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  bannerSub: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  hero: {
    backgroundColor: '#0e9f6e',
    borderColor: 'transparent',
    marginBottom: 10,
  },
  roleHeaderBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleHeaderBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
    fontSize: 13,
  },
  heroBadges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '100%',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  itemMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  footerCard: {
    marginTop: 8,
  },
});
