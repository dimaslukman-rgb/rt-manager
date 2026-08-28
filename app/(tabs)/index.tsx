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
      {/* 1. Header Foto Perumahan Hangtuah */}
      <StaggerIn index={0}>
        <View style={[styles.bannerCard, { backgroundColor: Colors[scheme].card, borderColor: Colors[scheme].border }]}>
          <Image
            source={require('@/assets/images/perumahan_header.png')}
            style={styles.bannerImage}
          />
          <View style={styles.bannerOverlay}>
            <View style={styles.bannerBadge}>
              <Text style={styles.bannerBadgeText}>RT 04 / RW 08</Text>
            </View>
            <Text style={styles.bannerTitle}>Perumahan Hangtuah</Text>
            <Text style={styles.bannerSub}>Grand Residence City · Lingkungan Nyaman, Sejuk & Bersih</Text>
          </View>
        </View>
      </StaggerIn>

      {/* 2. Hero Greeting Card */}
      <StaggerIn index={1}>
        <Card style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={[styles.heroAvatar, { backgroundColor: Colors[scheme].primaryMuted }]}>
              <Text style={{ fontSize: 20 }}>👑</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={[styles.heroTitle, { color: Colors[scheme].text }]} numberOfLines={1}>
                  Halo, {cleanName}! 👋
                </Text>
                <View style={[styles.roleBadge, { backgroundColor: Colors[scheme].primaryMuted }]}>
                  <Text style={[styles.roleBadgeText, { color: Colors[scheme].primary }]}>{roleDisplay}</Text>
                </View>
              </View>
              <Text style={[styles.heroSub, { color: Colors[scheme].muted }]}>
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · Sistem & Database Cloud Sinkron
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/pengaturan')}
              style={[styles.syncButton, { backgroundColor: Colors[scheme].primaryMuted }]}>
              <Text style={[styles.syncButtonText, { color: Colors[scheme].primary }]}>☁️ Cloud</Text>
            </Pressable>
          </View>
        </Card>
      </StaggerIn>

      {/* 3. Hero Saldo Kas (Aurora Glass) */}
      <StaggerIn index={2}>
        <View style={styles.auroraHeroCard}>
          <View style={styles.kasTopRow}>
            <Text style={styles.kasLabel}>💰 SALDO KAS RT 04 · AGUSTUS 2026</Text>
            <View style={styles.kasPill}>
              <Text style={styles.kasPillText}>Kas Masuk Lunas</Text>
            </View>
          </View>
          <Text style={styles.kasValue}>{formatRupiah(saldo)}</Text>
          <View style={styles.kasSubRow}>
            <View style={styles.kasChip}>
              <Text style={styles.kasChipText}>▲ {formatRupiah(data?.kasMasuk ?? 0)}</Text>
            </View>
            <Text style={styles.kasSubText}>Pemasukan iuran bulan ini</Text>
          </View>
          <View style={styles.kasBottomGrid}>
            <View style={styles.kasMiniBox}>
              <Text style={styles.kasMiniLabel}>Total Kas Masuk</Text>
              <Text style={styles.kasMiniValue}>{formatRupiah(data?.kasMasuk ?? 0)}</Text>
            </View>
            <View style={styles.kasMiniBox}>
              <Text style={styles.kasMiniLabelRed}>Total Pengeluaran</Text>
              <Text style={styles.kasMiniValue}>{formatRupiah(data?.kasKeluar ?? 0)}</Text>
            </View>
          </View>
        </View>
      </StaggerIn>

      {/* 4. Action Deck: Tombol Panik + Lapor Pak RT + Security On-Duty */}
      <View style={styles.actionDeckRow}>
        {/* Panic Button */}
        <Pressable onPress={() => router.push('/darurat')} style={styles.deckColPanic}>
          <StaggerIn index={3}>
            <View style={styles.auroraPanicCard}>
              <View style={styles.panicTop}>
                <View style={styles.panicIconCircle}>
                  <Text style={{ fontSize: 20 }}>🚨</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.panicBannerTitle}>TOMBOL PANIK</Text>
                  <Text style={styles.panicBannerSub}>Bantuan Darurat & Sirine Pos</Text>
                </View>
                <View style={styles.panicBadge}>
                  <Text style={styles.panicBadgeText}>DARURAT</Text>
                </View>
              </View>
              <View style={styles.panicBottom}>
                <Text style={styles.panicBottomText}>Satpam: Sirine Otomatis</Text>
                <Text style={styles.panicBottomLink}>Tekan Darurat →</Text>
              </View>
            </View>
          </StaggerIn>
        </Pressable>

        {/* Lapor Pak RT */}
        <Pressable onPress={() => router.push('/lapor-rt')} style={styles.deckCol}>
          <StaggerIn index={4}>
            <Card style={styles.actionCard}>
              <View style={styles.actionTop}>
                <View style={[styles.actionIcon, { backgroundColor: Colors[scheme].warningMuted }]}>
                  <Text style={{ fontSize: 18 }}>📢</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={[styles.actionCardTitle, { color: Colors[scheme].text }]}>LAPOR PAK RT!</Text>
                    {(data?.laporanBaru ?? 0) > 0 && (
                      <View style={styles.actionCountBadge}>
                        <Text style={styles.actionCountText}>{data?.laporanBaru} Baru</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.actionCardSub, { color: Colors[scheme].muted }]}>
                    Kirim aduan warga anonim
                  </Text>
                </View>
              </View>
              <View style={styles.actionBottom}>
                <Text style={[styles.actionBottomText, { color: Colors[scheme].muted }]}>Tanggapan Pengurus</Text>
                <Text style={[styles.actionBottomLink, { color: Colors[scheme].primary }]}>Buat Aduan →</Text>
              </View>
            </Card>
          </StaggerIn>
        </Pressable>

        {/* Security On-Duty */}
        <Pressable onPress={() => router.push('/security')} style={styles.deckCol}>
          <StaggerIn index={5}>
            <Card style={styles.actionCard}>
              <View style={styles.securityTop}>
                <Text style={[styles.securityTitle, { color: Colors[scheme].muted }]}>SECURITY ON DUTY</Text>
                <View style={styles.securityPingDot} />
              </View>
              <Text style={[styles.securityName, { color: Colors[scheme].text }]}>Pak Joko Susilo</Text>
              <Text style={[styles.securityShift, { color: Colors[scheme].primary }]}>Shift Pagi – Siang</Text>
              <View style={[styles.securityWaBtn, { backgroundColor: Colors[scheme].primaryMuted }]}>
                <Text style={[styles.securityWaBtnText, { color: Colors[scheme].primary }]}>💬 WhatsApp Pos</Text>
              </View>
            </Card>
          </StaggerIn>
        </Pressable>
      </View>

      {/* 5. Khusus Pengurus RT: Notifikasi Inbox Laporan Masuk */}
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

      <SectionTitle>Ringkasan Informasi Lingkungan</SectionTitle>
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
          label="Keluarga"
          value={`${data?.totalKeluarga ?? 0} KK`}
          chipColor={Colors[scheme].primaryMuted}
          valueColor={Colors[scheme].primary}
          onPress={canManage ? () => router.push('/(tabs)/warga') : undefined}
        />
        <BentoTile
          index={9}
          emoji="🧾"
          label="Iuran Bln Ini"
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
          value={`${data?.laporanBaru ?? 0} Aduan`}
          chipColor={Colors[scheme].dangerMuted}
          valueColor={(data?.laporanBaru ?? 0) > 0 ? Colors[scheme].danger : Colors[scheme].muted}
        />
      </View>

      <SectionTitle>Pengumuman Terbaru</SectionTitle>
      {pengumuman.length === 0 ? (
        <EmptyState message="Belum ada pengumuman" />
      ) : (
        pengumuman.map((p) => (
          <Card key={p.id} style={styles.itemCard}>
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
          <Card key={k.id} style={styles.itemCard}>
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
    marginBottom: 10,
    borderWidth: 1,
    height: 150,
    position: 'relative',
    shadowColor: '#1c1917',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bannerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: 'rgba(28, 25, 23, 0.45)',
    justifyContent: 'flex-end',
    padding: 14,
  },
  bannerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  bannerBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  bannerTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#ffffff',
  },
  bannerSub: {
    fontSize: 11,
    color: '#f5f5f4',
    marginTop: 1,
    fontWeight: '500',
  },
  hero: {
    padding: 12,
    marginBottom: 10,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroSub: {
    marginTop: 2,
    fontSize: 11,
  },
  syncButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  syncButtonText: {
    fontSize: 11,
    fontWeight: '800',
  },
  auroraHeroCard: {
    backgroundColor: '#047857',
    borderRadius: 22,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#047857',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  kasTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  kasLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  kasPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  kasPillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  kasValue: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  kasSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  kasChip: {
    backgroundColor: 'rgba(52, 211, 153, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  kasChipText: {
    color: '#a7f3d0',
    fontSize: 10,
    fontWeight: '800',
  },
  kasSubText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
  },
  kasBottomGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  kasMiniBox: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  kasMiniLabel: {
    color: '#a7f3d0',
    fontSize: 10,
    fontWeight: '600',
  },
  kasMiniLabelRed: {
    color: '#fecaca',
    fontSize: 10,
    fontWeight: '600',
  },
  kasMiniValue: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  actionDeckRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  deckColPanic: {
    flexGrow: 1.2,
    flexBasis: 260,
  },
  deckCol: {
    flexGrow: 1,
    flexBasis: 220,
  },
  auroraPanicCard: {
    backgroundColor: '#dc2626',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(254, 202, 202, 0.4)',
    shadowColor: '#dc2626',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    minHeight: 116,
    justifyContent: 'space-between',
  },
  panicTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  panicIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panicBannerTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  panicBannerSub: {
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: 10,
    marginTop: 1,
  },
  panicBadge: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  panicBadgeText: {
    color: '#dc2626',
    fontWeight: '900',
    fontSize: 9,
  },
  panicBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  panicBottomText: {
    color: '#fee2e2',
    fontSize: 10,
  },
  panicBottomLink: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  actionCard: {
    marginBottom: 0,
    padding: 12,
    borderRadius: 20,
    minHeight: 116,
    justifyContent: 'space-between',
  },
  actionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCardTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  actionCountBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  actionCountText: {
    color: '#dc2626',
    fontSize: 9,
    fontWeight: '900',
  },
  actionCardSub: {
    fontSize: 10,
    marginTop: 1,
  },
  actionBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  actionBottomText: {
    fontSize: 10,
  },
  actionBottomLink: {
    fontSize: 10,
    fontWeight: '800',
  },
  securityTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  securityTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  securityPingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  securityName: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  securityShift: {
    fontSize: 10,
    fontWeight: '700',
  },
  securityWaBtn: {
    marginTop: 6,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityWaBtnText: {
    fontSize: 10,
    fontWeight: '800',
  },
  inboxAlertCard: {
    padding: 10,
    marginBottom: 10,
    borderRadius: 16,
  },
  inboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  inboxLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  inboxAlertTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  inboxAlertSub: {
    fontSize: 10,
    marginTop: 1,
  },
  inboxCountBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inboxCountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  tileWrapper: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 140,
    maxWidth: '100%',
  },
  tileCard: {
    marginBottom: 0,
    padding: 12,
    borderRadius: 18,
    minHeight: 90,
    justifyContent: 'space-between',
  },
  tileIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileValue: {
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 9,
    marginTop: 2,
  },
  itemCard: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 16,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  itemMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  footerCard: {
    marginTop: 4,
    padding: 12,
    borderRadius: 16,
  },
});
