import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Badge, Card, EmptyState, LoadingState, Screen, SectionTitle } from '@/components/ui';
import { BULAN } from '@/lib/db';
import { formatRupiah, formatTanggal } from '@/lib/format';
import type { Pengaturan, Transaksi } from '@/lib/types';

interface LaporanRow {
  bulan: string;
  tahun: number;
  masuk: number;
  keluar: number;
}

export default function LaporanScreen() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const [loading, setLoading] = useState(true);
  const [bulanan, setBulanan] = useState<LaporanRow[]>([]);
  const [rows, setRows] = useState<Transaksi[]>([]);
  const [pengaturan, setPengaturan] = useState<Pengaturan | null>(null);

  const load = useCallback(async () => {
    try {
      const bulanRows = await db.getAllAsync<LaporanRow>(
        `SELECT
           strftime('%m', tanggal) as bulan,
           strftime('%Y', tanggal) as tahun,
           COALESCE(SUM(CASE WHEN jenis='Masuk' THEN nominal END),0) as masuk,
           COALESCE(SUM(CASE WHEN jenis='Keluar' THEN nominal END),0) as keluar
         FROM transaksi
         GROUP BY strftime('%Y', tanggal), strftime('%m', tanggal)
         ORDER BY tahun DESC, bulan DESC`
      );
      const all = await db.getAllAsync<Transaksi>('SELECT * FROM transaksi ORDER BY tanggal DESC, id DESC');
      const setting = await db.getFirstAsync<Pengaturan>('SELECT * FROM pengaturan WHERE id = 1');
      setBulanan(bulanRows);
      setRows(all);
      setPengaturan(setting);
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

  const totalMasuk = rows.filter((r) => r.jenis === 'Masuk').reduce((a, b) => a + b.nominal, 0);
  const totalKeluar = rows.filter((r) => r.jenis === 'Keluar').reduce((a, b) => a + b.nominal, 0);
  const saldoAkhir = totalMasuk - totalKeluar;
  const namaRt = pengaturan?.nama_rt ?? 'RT 04';

  function exportExcel() {
    try {
      const today = new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      const excelContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Laporan Keuangan</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8"/>
          <style>
            body { font-family: 'Calibri', Arial, sans-serif; font-size: 11pt; }
            .title-main { font-size: 16pt; font-weight: bold; text-align: center; color: #111827; }
            .title-sub { font-size: 12pt; text-align: center; color: #374151; font-weight: bold; }
            .title-date { font-size: 10pt; text-align: center; color: #6b7280; font-style: italic; }
            .sec-header { font-size: 12pt; font-weight: bold; background-color: #e2e8f0; border: 1px solid #94a3b8; padding: 8px; }
            th { background-color: #0e9f6e; color: #ffffff; font-weight: bold; border: 1px solid #6b7280; text-align: center; padding: 8px; }
            td { border: 1px solid #cbd5e1; padding: 6px 8px; }
            .summary-label { font-weight: bold; background-color: #f8fafc; border: 1px solid #cbd5e1; }
            .summary-masuk { font-weight: bold; color: #15803d; text-align: right; border: 1px solid #cbd5e1; }
            .summary-keluar { font-weight: bold; color: #b91c1c; text-align: right; border: 1px solid #cbd5e1; }
            .summary-saldo { font-weight: bold; color: #1d4ed8; text-align: right; border: 1px solid #cbd5e1; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .green { color: #15803d; font-weight: bold; }
            .red { color: #b91c1c; font-weight: bold; }
          </style>
        </head>
        <body>
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td colspan="6" class="title-main">PENGURUS RUKUN TETANGGA (${namaRt.toUpperCase()})</td>
            </tr>
            <tr>
              <td colspan="6" class="title-sub">PERUMAHAN HANGTUAH - GRAND RESIDENCE CITY</td>
            </tr>
            <tr>
              <td colspan="6" class="title-date">Laporan Pertanggungjawaban Keuangan Kas · Tanggal Unduh: ${today}</td>
            </tr>
            <tr><td colspan="6" style="border:none; height: 15px;"></td></tr>

            <!-- Ringkasan Saldo -->
            <tr>
              <td colspan="6" class="sec-header">RINGKASAN SALDO KAS</td>
            </tr>
            <tr>
              <td colspan="2" class="summary-label">Total Pemasukan</td>
              <td colspan="4" class="summary-masuk">${formatRupiah(totalMasuk)}</td>
            </tr>
            <tr>
              <td colspan="2" class="summary-label">Total Pengeluaran</td>
              <td colspan="4" class="summary-keluar">${formatRupiah(totalKeluar)}</td>
            </tr>
            <tr>
              <td colspan="2" class="summary-label">Saldo Akhir Kas</td>
              <td colspan="4" class="summary-saldo">${formatRupiah(saldoAkhir)}</td>
            </tr>
            <tr><td colspan="6" style="border:none; height: 15px;"></td></tr>

            <!-- Rekap Bulanan -->
            <tr>
              <td colspan="6" class="sec-header">1. REKAP KAS PER BULAN</td>
            </tr>
            <tr style="background-color: #0e9f6e;">
              <th style="width: 50px;">No</th>
              <th colspan="2" style="width: 200px;">Bulan & Tahun</th>
              <th style="width: 140px;">Pemasukan</th>
              <th style="width: 140px;">Pengeluaran</th>
              <th style="width: 150px;">Saldo Kas Bulanan</th>
            </tr>
            ${
              bulanan.length === 0
                ? '<tr><td colspan="6" class="text-center">Belum ada transaksi kas</td></tr>'
                : bulanan
                    .map(
                      (b, idx) => `
              <tr>
                <td class="text-center">${idx + 1}</td>
                <td colspan="2"><b>${BULAN[Number(b.bulan) - 1]} ${b.tahun}</b></td>
                <td class="text-right green">+ ${formatRupiah(b.masuk)}</td>
                <td class="text-right red">− ${formatRupiah(b.keluar)}</td>
                <td class="text-right"><b>${formatRupiah(b.masuk - b.keluar)}</b></td>
              </tr>
            `
                    )
                    .join('')
            }
            <tr><td colspan="6" style="border:none; height: 15px;"></td></tr>

            <!-- Rincian Transaksi -->
            <tr>
              <td colspan="6" class="sec-header">2. RINCIAN RIWAYAT TRANSAKSI</td>
            </tr>
            <tr style="background-color: #0e9f6e;">
              <th style="width: 50px;">No</th>
              <th style="width: 100px;">Tanggal</th>
              <th style="width: 80px;">Jenis</th>
              <th style="width: 120px;">Kategori</th>
              <th style="width: 260px;">Keterangan</th>
              <th style="width: 140px;">Nominal</th>
            </tr>
            ${
              rows.length === 0
                ? '<tr><td colspan="6" class="text-center">Belum ada rincian transaksi</td></tr>'
                : rows
                    .map(
                      (r, idx) => `
              <tr>
                <td class="text-center">${idx + 1}</td>
                <td class="text-center">${formatTanggal(r.tanggal)}</td>
                <td class="text-center ${r.jenis === 'Masuk' ? 'green' : 'red'}"><b>${r.jenis}</b></td>
                <td>${r.kategori}</td>
                <td>${r.keterangan || '-'}</td>
                <td class="text-right ${r.jenis === 'Masuk' ? 'green' : 'red'}">
                  ${r.jenis === 'Masuk' ? '+' : '−'} ${formatRupiah(r.nominal)}
                </td>
              </tr>
            `
                    )
                    .join('')
            }
            <tr><td colspan="6" style="border:none; height: 30px;"></td></tr>

            <!-- Tanda Tangan -->
            <tr>
              <td colspan="3" style="text-align:center; border:none;">Mengetahui,<br><b>Ketua ${namaRt}</b></td>
              <td colspan="3" style="text-align:center; border:none;">Dibuat Oleh,<br><b>Bendahara ${namaRt}</b></td>
            </tr>
            <tr>
              <td colspan="3" style="height: 60px; border:none;">&nbsp;</td>
              <td colspan="3" style="height: 60px; border:none;">&nbsp;</td>
            </tr>
            <tr>
              <td colspan="3" style="text-align:center; border:none;"><b>( .................................... )</b></td>
              <td colspan="3" style="text-align:center; border:none;"><b>( .................................... )</b></td>
            </tr>
          </table>
        </body>
        </html>
      `;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Laporan_Keuangan_${namaRt.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xls`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        Alert.alert('Download Excel', 'Laporan Excel berhasil dibuat.');
      }
    } catch (e: any) {
      Alert.alert('Gagal Download', e?.message || 'Terjadi kesalahan saat mengekspor Excel.');
    }
  }

  function exportPDF() {
    try {
      const today = new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        if (typeof window !== 'undefined') {
          window.alert('Mohon izinkan popup browser untuk mencetak / menyimpan PDF.');
        }
        return;
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Laporan Keuangan Kas ${namaRt} - Hangtuah Grand Residence City</title>
          <style>
            @page { size: A4; margin: 1.5cm; }
            body { font-family: Arial, sans-serif; color: #1f2937; line-height: 1.4; padding: 10px; }
            .header { text-align: center; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; color: #111827; }
            .header h2 { margin: 4px 0 0 0; font-size: 15px; color: #4b5563; font-weight: normal; }
            .header p { margin: 2px 0 0 0; font-size: 12px; color: #6b7280; }
            .title-doc { text-align: center; margin: 15px 0; font-size: 16px; font-weight: bold; text-decoration: underline; text-transform: uppercase; }
            .summary-box { display: flex; justify-content: space-between; gap: 15px; margin-bottom: 20px; }
            .card { flex: 1; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background: #f9fafb; }
            .card-title { font-size: 11px; color: #6b7280; font-weight: bold; text-transform: uppercase; }
            .card-value { font-size: 17px; font-weight: bold; margin-top: 4px; }
            .green { color: #15803d; }
            .red { color: #b91c1c; }
            .blue { color: #1d4ed8; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 7px 10px; text-align: left; }
            th { background-color: #f3f4f6; font-weight: bold; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .section-heading { font-size: 14px; font-weight: bold; margin: 16px 0 8px 0; color: #111827; }
            .signatures { display: flex; justify-content: space-between; margin-top: 40px; page-break-inside: avoid; }
            .sig-block { text-align: center; width: 240px; }
            .sig-space { height: 60px; }
            .sig-name { font-weight: bold; white-space: nowrap; display: inline-block; font-size: 13px; }
            @media print {
              .no-print { display: none; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>PENGURUS RUKUN TETANGGA (${namaRt.toUpperCase()})</h1>
            <h2>PERUMAHAN HANGTUAH - GRAND RESIDENCE CITY</h2>
            <p>Kec. Setu, Kab. Bekasi · Tanggal Cetak: ${today}</p>
          </div>

          <div class="title-doc">LAPORAN PERTANGGUNGJAWABAN KEUANGAN KAS</div>

          <div class="summary-box">
            <div class="card">
              <div class="card-title">Total Pemasukan</div>
              <div class="card-value green">${formatRupiah(totalMasuk)}</div>
            </div>
            <div class="card">
              <div class="card-title">Total Pengeluaran</div>
              <div class="card-value red">${formatRupiah(totalKeluar)}</div>
            </div>
            <div class="card">
              <div class="card-title">Saldo Akhir Kas</div>
              <div class="card-value blue">${formatRupiah(saldoAkhir)}</div>
            </div>
          </div>

          <div class="section-heading">1. Rekap Kas per Bulan</div>
          <table>
            <thead>
              <tr>
                <th style="width: 40px;" class="text-center">No</th>
                <th>Bulan & Tahun</th>
                <th class="text-right">Pemasukan</th>
                <th class="text-right">Pengeluaran</th>
                <th class="text-right">Saldo Kas Bulanan</th>
              </tr>
            </thead>
            <tbody>
              ${
                bulanan.length === 0
                  ? '<tr><td colspan="5" class="text-center">Belum ada transaksi kas</td></tr>'
                  : bulanan
                      .map(
                        (b, idx) => `
                <tr>
                  <td class="text-center">${idx + 1}</td>
                  <td><b>${BULAN[Number(b.bulan) - 1]} ${b.tahun}</b></td>
                  <td class="text-right green">+ ${formatRupiah(b.masuk)}</td>
                  <td class="text-right red">− ${formatRupiah(b.keluar)}</td>
                  <td class="text-right"><b>${formatRupiah(b.masuk - b.keluar)}</b></td>
                </tr>
              `
                      )
                      .join('')
              }
            </tbody>
          </table>

          <div class="section-heading">2. Rincian Riwayat Transaksi</div>
          <table>
            <thead>
              <tr>
                <th style="width: 30px;" class="text-center">No</th>
                <th style="width: 80px;">Tanggal</th>
                <th style="width: 60px;">Jenis</th>
                <th style="width: 100px;">Kategori</th>
                <th>Keterangan</th>
                <th class="text-right" style="width: 110px;">Nominal</th>
              </tr>
            </thead>
            <tbody>
              ${
                rows.length === 0
                  ? '<tr><td colspan="6" class="text-center">Belum ada rincian transaksi</td></tr>'
                  : rows
                      .map(
                        (r, idx) => `
                <tr>
                  <td class="text-center">${idx + 1}</td>
                  <td>${formatTanggal(r.tanggal)}</td>
                  <td><span class="${r.jenis === 'Masuk' ? 'green' : 'red'}"><b>${r.jenis}</b></span></td>
                  <td>${r.kategori}</td>
                  <td>${r.keterangan || '-'}</td>
                  <td class="text-right ${r.jenis === 'Masuk' ? 'green' : 'red'}">
                    ${r.jenis === 'Masuk' ? '+' : '−'} ${formatRupiah(r.nominal)}
                  </td>
                </tr>
              `
                      )
                      .join('')
              }
            </tbody>
          </table>

          <div class="signatures">
            <div class="sig-block">
              <div>Mengetahui,</div>
              <div><b>Ketua ${namaRt}</b></div>
              <div class="sig-space"></div>
              <div class="sig-name">( .................................... )</div>
            </div>
            <div class="sig-block">
              <div>Dibuat Oleh,</div>
              <div><b>Bendahara ${namaRt}</b></div>
              <div class="sig-space"></div>
              <div class="sig-name">( .................................... )</div>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
        </html>
      `;

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (e: any) {
      Alert.alert('Gagal Cetak PDF', e?.message || 'Terjadi kesalahan saat memproses PDF.');
    }
  }

  return (
    <Screen>
      {/* Total Kas Card */}
      <Card style={{ backgroundColor: Colors[scheme].primary, borderColor: 'transparent' }}>
        <Text style={styles.balanceLabel}>Total Pemasukan</Text>
        <Text style={styles.balanceValue}>{formatRupiah(totalMasuk)}</Text>
        <Text style={[styles.balanceLabel, { marginTop: 10 }]}>Total Pengeluaran</Text>
        <Text style={styles.balanceValue}>{formatRupiah(totalKeluar)}</Text>
        <Text style={[styles.balanceLabel, { marginTop: 10 }]}>Saldo Akhir</Text>
        <Text style={styles.balanceValue}>{formatRupiah(saldoAkhir)}</Text>
      </Card>

      {/* Download Action Buttons */}
      <View style={styles.exportRow}>
        <Pressable
          onPress={exportExcel}
          style={[styles.exportBtn, { backgroundColor: '#16a34a' }]}>
          <Text style={styles.exportBtnIcon}>📊</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.exportBtnTitle}>Download Excel (.xlsx / .csv)</Text>
            <Text style={styles.exportBtnSub}>Format spreadsheet rapi untuk pembukuan</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={exportPDF}
          style={[styles.exportBtn, { backgroundColor: '#dc2626' }]}>
          <Text style={styles.exportBtnIcon}>📄</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.exportBtnTitle}>Download / Cetak PDF</Text>
            <Text style={styles.exportBtnSub}>Siap cetak & tanda tangan resmi RT</Text>
          </View>
        </Pressable>
      </View>

      {/* Rekap per Bulan */}
      <SectionTitle>Rekap per Bulan</SectionTitle>
      {bulanan.length === 0 ? (
        <EmptyState message="Belum ada data keuangan" />
      ) : (
        bulanan.map((b) => (
          <Card key={`${b.tahun}-${b.bulan}`}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.name}>
                  {BULAN[Number(b.bulan) - 1]} {b.tahun}
                </Text>
                <Text style={[styles.meta, { color: Colors[scheme].muted }]}>
                  Saldo: {formatRupiah(b.masuk - b.keluar)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.amount, { color: Colors[scheme].success }]}>+ {formatRupiah(b.masuk)}</Text>
                <Text style={[styles.amount, { color: Colors[scheme].danger }]}>− {formatRupiah(b.keluar)}</Text>
              </View>
            </View>
          </Card>
        ))
      )}

      {/* Rincian Transaksi */}
      <SectionTitle>Rincian Semua Transaksi ({rows.length})</SectionTitle>
      {rows.length === 0 ? (
        <EmptyState message="Belum ada riwayat transaksi" />
      ) : (
        rows.map((r) => (
          <Card key={r.id}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Badge label={r.jenis} variant={r.jenis === 'Masuk' ? 'success' : 'danger'} />
                  <Text style={styles.name}>{r.kategori}</Text>
                </View>
                <Text style={[styles.meta, { color: Colors[scheme].muted }]}>
                  {formatTanggal(r.tanggal)} · {r.keterangan || '-'}
                </Text>
              </View>
              <Text
                style={[
                  styles.amount,
                  { color: r.jenis === 'Masuk' ? Colors[scheme].success : Colors[scheme].danger },
                ]}>
                {r.jenis === 'Masuk' ? '+' : '−'} {formatRupiah(r.nominal)}
              </Text>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  balanceLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
  },
  balanceValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  exportRow: {
    gap: 10,
    marginTop: 14,
    marginBottom: 8,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  exportBtnIcon: {
    fontSize: 26,
  },
  exportBtnTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  exportBtnSub: {
    color: 'rgba(255,255,255,0.85)',
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
    marginTop: 4,
  },
  amount: {
    fontSize: 15,
    fontWeight: '800',
  },
});