import { useSQLiteContext } from 'expo-sqlite';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Badge, Card, EmptyState, LoadingState, Screen, SectionTitle } from '@/components/ui';
import { GlassCard, StaggerIn } from '@/components/fx';
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

function BentoTile({
  index,
  emoji,
  label,
  value,
  chipColor,
  valueColor,
  onPress,
  children,
}: {
  index: number;
  emoji: string;
  label: string;
  value: string;
  chipColor: string;
  valueColor: string;
  onPress?: () => void;
  children?: React.ReactNode;
}) {
  const scheme = useColorScheme();
  const inner = (
    <Card style={styles.tileCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <View style={[styles.tileIcon, { backgroundColor: chipColor }]}>
          <Text style={{ fontSize: 16 }}>{emoji}</Text>
        </View>
        <Text style={[styles.tileLabel, { color: Colors[scheme].muted }]}>{label}</Text>
      </View>
      <Text style={[styles.tileValue, { color: valueColor }]}>{value}</Text>
      {children}
    </Card>
  );
  const content = onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {inner}
    </Pressable>
  ) : (
    inner
  );
  return (
    <View style={styles.tileWrapper}>
      <StaggerIn index={index}>{content}</StaggerIn>
    </View>
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
  const iuranTotal = (data?.iuranLunas ?? 0) + (data?.iuranBelum ?? 0);
  const iuranPct = iuranTotal > 0 ? Math.round(((data?.iuranLunas ?? 0) / iuranTotal) * 100) : 0;
  const canManage = !isWarga && !isSecurity;
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
      <StaggerIn index={0}>
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
      </StaggerIn>

      {/* 2. Hero Greeting Card (bento hero) */}
      <StaggerIn index={1}>
        <GlassCard style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={[styles.heroTitle, { color: Colors[scheme].text }]} numberOfLines={1}>
              Halo, {cleanName}! 👋
            </Text>
            <View style={[styles.roleBadge, { backgroundColor: Colors[scheme].primaryMuted }]}>
              <Text style={[styles.roleBadgeText, { color: Colors[scheme].primary }]}>{roleDisplay}</Text>
            </View>
          </View>
          <Text style={[styles.heroSub, { color: Colors[scheme].muted }]}>
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
          {!isWarga && !isSecurity && (
            <View style={styles.heroBadges}>
              <Badge label={`${data?.iuranLunas ?? 0} KK lunas bulan ini`} variant="success" />
              {data && data.iuranBelum > 0 && <Badge label={`${data.iuranBelum} KK belum bayar`} variant="warning" />}
            </View>
          )}
        </GlassCard>
      </StaggerIn>

      {/* 3. Hero Saldo Kas (Aurora Glass: gradient base via layered Views) */}
      <StaggerIn index={2}>
        <GlassCard>
          <View style={styles.kasBanner}>
            <View style={[styles.kasBase, { backgroundColor: Colors[scheme].heroFrom }]} />
            <View style={[styles.kasShade, { backgroundColor: Colors[scheme].heroTo }]} />
            <View style={styles.kasGlowA} />
            <View style={styles.kasGlowB} />
            <View style={styles.kasContent}>
              <Text style={styles.kasLabel}>💰 Saldo Kas RT</Text>
              <Text style={styles.kasValue}>{formatRupiah(saldo)}</Text>
              <View style={styles.kasFlowRow}>
                <View style={styles.kasFlowChip}>
                  <Text style={styles.kasFlowText}>▲ Masuk {formatRupiah(data?.kasMasuk ?? 0)}</Text>
                </View>
                <View style={styles.kasFlowChip}>
                  <Text style={styles.kasFlowText}>▼ Keluar {formatRupiah(data?.kasKeluar ?? 0)}</Text>
                </View>
              </View>
            </View>
          </View>
        </GlassCard>
      </StaggerIn>

      {/* 4. Panic Button Emergency Card (Aurora Glowing Red Accent) */}
      <StaggerIn index={3}>
        <Pressable onPress={() => router.push('/darurat')}>
          <View style={styles.auroraPanicCard}>
            <View style={styles.panicRow}>
              <View style={styles.panicIconCircle}>
                <Text style={{ fontSize: 24 }}>🚨</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.panicBannerTitle}>
                  TOMBOL PANIK (PANIC BUTTON)
                </Text>
                <Text style={styles.panicBannerSub}>
                  Panggil bantuan security & bunyikan alarm darurat
                </Text>
              </View>
              <View style={styles.panicBadge}>
                <Text style={styles.panicBadgeText}>DARURAT</Text>
              </View>
            </View>
          </View>
        </Pressable>
      </StaggerIn>

      {/* 5. Menu Khusus "Lapor Pak RT!" untuk Warga / Pengurus */}
      <StaggerIn index={4}>
        <Pressable onPress={() => router.push('/lapor-rt')}>
          <Card style={styles.actionBanner}>
            <View style={styles.actionRow}>
              <View style={[styles.actionIcon, { backgroundColor: Colors[scheme].infoMuted }]}>
                <Text style={{ fontSize: 22 }}>📢</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionBannerTitle, { color: Colors[scheme].info }]}>LAPOR PAK RT!</Text>
                <Text style={[styles.actionBannerSub, { color: Colors[scheme].muted }]}>
                  Kirim aduan lingkungan, fasilitas rusak, atau usulan ke pengurus
                </Text>
              </View>
              <View style={[styles.actionBadge, { backgroundColor: Colors[scheme].infoMuted }]}>
                <Text style={[styles.actionBadgeText, { color: Colors[scheme].info }]}>BUAT ADUAN →</Text>
              </View>
            </View>
          </Card>
        </Pressable>
      </StaggerIn>

      {/* 6. Menu Khusus "Petugas Security & Jadwal Shift" di Beranda */}
      <StaggerIn index={5}>
        <Pressable onPress={() => router.push('/security')}>
          <Card style={styles.actionBanner}>
            <View style={styles.actionRow}>
              <View style={[styles.actionIcon, { backgroundColor: Colors[scheme].primaryMuted }]}>
                <Text style={{ fontSize: 22 }}>👮</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.actionTitleRow}>
                  <Text style={[styles.actionBannerTitle, { color: Colors[scheme].text }]}>
                    SECURITY & JADWAL SHIFT
                  </Text>
                  <View style={[styles.securityLiveTag, { backgroundColor: Colors[scheme].success }]}>
                    <Text style={styles.securityLiveTagText}>ON DUTY</Text>
                  </View>
                </View>
                <Text style={[styles.actionBannerSub, { color: Colors[scheme].muted }]}>
                  Pos Gerbang Utama · Siaga 24 Jam & Kontak Satpam
                </Text>
              </View>
              <View style={[styles.actionBadge, { backgroundColor: Colors[scheme].primaryMuted }]}>
                <Text style={[styles.actionBadgeText, { color: Colors[scheme].primary }]}>JADWAL →</Text>
              </View>
            </View>
          </Card>
        </Pressable>
      </StaggerIn>

      {/* 7. Khusus Pengurus RT: Notifikasi Inbox Laporan Masuk */}
      {!isWarga && (data?.laporanBaru ?? 0) > 0 && (
        <StaggerIn index={6}>
          <Pressable onPress={() => router.push('/inbox')}>
            <Card
              style={[
                styles.inboxAlertCard,
                { backgroundColor: Colors[scheme].dangerMuted, borderColor: 'rgba(220,38,38,0.25)' },
              ]}>
              <View style={styles.inboxRow}>
                <View style={styles.inboxLeft}>
                  <Text style={{ fontSize: 22 }}>📥</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inboxAlertTitle, { color: Colors[scheme].text }]}>
                      Kotak Masuk (Inbox) Warga
                    </Text>
                    <Text style={[styles.inboxAlertSub, { color: Colors[scheme].muted }]}>
                      Ada{' '}
                      <Text style={{ fontWeight: '800', color: Colors[scheme].danger }}>
                        {data?.laporanBaru} laporan baru
                      </Text>{' '}
                      dari warga yang perlu ditindaklanjuti.
                    </Text>
                  </View>
                </View>
                <View style={[styles.inboxCountBadge, { backgroundColor: Colors[scheme].danger }]}>
                  <Text style={styles.inboxCountText}>{data?.laporanBaru}</Text>
                </View>
              </View>
            </Card>
          </Pressable>
        </StaggerIn>
      )}

      <SectionTitle>Ringkasan Informasi</SectionTitle>
      <View style={styles.statsGrid}>
        <BentoTile
          index={7}
          emoji="👥"
          label="Total Warga"
          value={`${data?.totalWarga ?? 0} Jiwa`}
          chipColor={Colors[scheme].infoMuted}
          valueColor={Colors[scheme].info}
          onPress={canManage ? () => router.push('/(tabs)/warga') : undefined}
        />
        <BentoTile
          index={8}
          emoji="👨‍👩‍👧‍👦"
          label="Total Keluarga"
          value={`${data?.totalKeluarga ?? 0} KK`}
          chipColor={Colors[scheme].primaryMuted}
          valueColor={Colors[scheme].primary}
          onPress={canManage ? () => router.push('/(tabs)/warga') : undefined}
        />
        <BentoTile
          index={9}
          emoji="🧾"
          label="Iuran Bulan Ini"
          value={`${iuranPct}% lunas`}
          chipColor={Colors[scheme].warningMuted}
          valueColor={Colors[scheme].text}
          onPress={canManage ? () => router.push('/(tabs)/keuangan') : undefined}>
          <View style={[styles.progressTrack, { backgroundColor: Colors[scheme].primaryMuted }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${iuranPct}%`, backgroundColor: Colors[scheme].primary },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: Colors[scheme].muted }]}>
            {data?.iuranLunas ?? 0}/{iuranTotal} KK lunas
          </Text>
        </BentoTile>
        <BentoTile
          index={10}
          emoji="📣"
          label="Laporan Baru"
          value={String(data?.laporanBaru ?? 0)}
          chipColor={Colors[scheme].dangerMuted}
          valueColor={(data?.laporanBaru ?? 0) > 0 ? Colors[scheme].danger : Colors[scheme].muted}
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
  bannerCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#1a2030',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
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
    fontSize: 17,
    fontWeight: '800',
  },
  bannerSub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  hero: {
    padding: 16,
    marginBottom: 12,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: '800',
    flexShrink: 1,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroSub: {
    marginTop: 4,
    fontSize: 13,
  },
  heroBadges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  kasBanner: {},
  kasBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  kasShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '65%',
    opacity: 0.55,
  },
  kasGlowA: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.16)',
    top: -50,
    right: -30,
  },
  kasGlowB: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(0,0,0,0.12)',
    bottom: -40,
    left: -25,
  },
  kasContent: {
    padding: 16,
  },
  kasLabel: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '600',
  },
  kasValue: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    marginTop: 2,
  },
  kasFlowRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  kasFlowChip: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  kasFlowText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  auroraPanicCard: {
    backgroundColor: '#dc2626',
    borderRadius: 22,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(254, 202, 202, 0.4)',
    shadowColor: '#dc2626',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
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
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panicBannerTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  panicBannerSub: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    marginTop: 2,
  },
  panicBadge: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  panicBadgeText: {
    color: '#dc2626',
    fontWeight: '900',
    fontSize: 10,
  },
  actionBanner: {
    padding: 14,
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  actionBannerSub: {
    fontSize: 11,
    marginTop: 2,
  },
  actionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  actionBadgeText: {
    fontWeight: '800',
    fontSize: 10,
  },
  securityLiveTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  securityLiveTagText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  inboxAlertCard: {
    padding: 12,
    marginBottom: 10,
  },
  inboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  inboxLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  inboxAlertTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  inboxAlertSub: {
    fontSize: 11,
    marginTop: 2,
  },
  inboxCountBadge: {
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  tileWrapper: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 200,
    maxWidth: '100%',
  },
  tileCard: {
    marginBottom: 0,
    padding: 16,
    borderRadius: 20,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileValue: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
  },
  tileLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 10,
    marginTop: 4,
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
