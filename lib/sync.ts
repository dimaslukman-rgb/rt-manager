import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import { supabase } from '@/lib/supabase';

const TABLES = [
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
  'pengguna',
  'lapor_rt',
  'security',
  'jadwal_security',
] as const;

type CloudTable = (typeof TABLES)[number];
type Row = Record<string, unknown>;

async function getOwnerId(customOwnerId?: string) {
  if (customOwnerId) return customOwnerId;
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user?.id) return data.user.id;
  } catch {}
  return 'rt04_hangtuah';
}

async function uploadTable(db: SQLiteDatabase, table: CloudTable, ownerId: string) {
  const rows = await db.getAllAsync<Row>(`SELECT * FROM ${table}`);
  if (rows.length === 0) return 0;

  const payload = rows.map((row) => ({ ...row, owner_id: ownerId }));
  const { error } = await supabase.from(table).upsert(payload, { onConflict: 'owner_id,id' });
  if (error) throw error;
  return rows.length;
}

export async function syncLocalToCloud(db: SQLiteDatabase, customOwner?: string) {
  const ownerId = await getOwnerId(customOwner);
  const settings = await db.getFirstAsync<Row>('SELECT * FROM pengaturan WHERE id = 1');
  if (settings) {
    const { error } = await supabase.from('rt_settings').upsert(
      { ...settings, owner_id: ownerId },
      { onConflict: 'owner_id,id' }
    );
    if (error) {
      console.warn('Sync settings warning:', error.message);
    }
  }

  let uploaded = settings ? 1 : 0;
  for (const table of TABLES) {
    try {
      uploaded += await uploadTable(db, table, ownerId);
    } catch (e: any) {
      console.warn(`Sync table ${table} warning:`, e?.message);
    }
  }
  return uploaded;
}

async function downloadTable(table: CloudTable, ownerId: string) {
  const { data, error } = await supabase.from(table).select('*').eq('owner_id', ownerId);
  if (error) {
    console.warn(`Download table ${table} warning:`, error.message);
    return [];
  }
  return (data ?? []) as Row[];
}

async function insertRows(db: SQLiteDatabase, table: CloudTable, rows: Row[]) {
  const columns = {
    keluarga: ['id', 'no_kk', 'kepala_keluarga', 'alamat', 'rt', 'rw', 'telepon', 'nominal_iuran', 'created_at'],
    warga: ['id', 'keluarga_id', 'nik', 'nama', 'tempat_lahir', 'tanggal_lahir', 'jenis_kelamin', 'status_keluarga', 'pekerjaan', 'agama', 'status_perkawinan', 'telepon', 'created_at'],
    transaksi: ['id', 'tanggal', 'jenis', 'kategori', 'keterangan', 'nominal', 'created_at'],
    iuran: ['id', 'keluarga_id', 'bulan', 'tahun', 'nominal', 'status', 'tanggal_bayar'],
    surat: ['id', 'pemohon_id', 'nama_pemohon', 'nik_pemohon', 'no_hp_pemohon', 'alamat_pemohon', 'jenis_surat', 'keperluan', 'status', 'catatan_pengurus', 'tanggal_pengajuan', 'tanggal_selesai', 'created_at'],
    kegiatan: ['id', 'judul', 'deskripsi', 'tanggal', 'waktu', 'lokasi', 'jenis', 'created_at'],
    pengumuman: ['id', 'judul', 'isi', 'tanggal', 'penting', 'created_at'],
    buku_tamu: ['id', 'nama', 'alamat', 'keperluan', 'jenis', 'tanggal', 'jam', 'catatan', 'created_at'],
    ronda: ['id', 'tanggal', 'pos', 'petugas', 'keterangan'],
    darurat: ['id', 'nama_pelapor', 'alamat_pelapor', 'telepon_pelapor', 'kategori', 'keterangan', 'foto_uri', 'latitude', 'longitude', 'status', 'created_at'],
    pengguna: ['id', 'username', 'nama_lengkap', 'no_hp', 'password', 'role', 'aktif', 'created_at'],
    lapor_rt: ['id', 'pengguna_id', 'nama_pelapor', 'no_hp_pelapor', 'alamat_pelapor', 'judul', 'kategori', 'isi', 'foto_uri', 'status', 'tanggapan', 'ditanggapi_oleh', 'tanggal', 'created_at'],
    security: ['id', 'nama', 'nik', 'no_hp', 'pos_jaga', 'jabatan', 'shift_tetap', 'status', 'foto_uri', 'created_at'],
    jadwal_security: ['id', 'hari', 'shift', 'petugas_ids', 'petugas_nama', 'pos_jaga', 'keterangan'],
  }[table];
  if (rows.length === 0) return;

  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
  for (const row of rows) {
    await db.runAsync(sql, columns.map((column) => (row[column] as SQLiteBindValue | null) ?? null));
  }
}

export async function restoreCloudToLocal(db: SQLiteDatabase, customOwner?: string) {
  const ownerId = await getOwnerId(customOwner);
  const settings = await supabase.from('rt_settings').select('*').eq('owner_id', ownerId).eq('id', 1).maybeSingle();

  const remoteRows = {} as Record<CloudTable, Row[]>;
  for (const table of TABLES) {
    remoteRows[table] = await downloadTable(table, ownerId);
  }

  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM warga; DELETE FROM iuran; DELETE FROM surat; DELETE FROM transaksi; DELETE FROM kegiatan; DELETE FROM pengumuman; DELETE FROM buku_tamu; DELETE FROM ronda; DELETE FROM darurat; DELETE FROM keluarga;');
    if (settings.data) {
      await db.runAsync(
        'INSERT OR REPLACE INTO pengaturan (id, nama_rt, nama_kelurahan, nama_kecamatan, nama_kota, nominal_iuran) VALUES (?, ?, ?, ?, ?, ?)',
        1,
        settings.data.nama_rt,
        settings.data.nama_kelurahan,
        settings.data.nama_kecamatan,
        settings.data.nama_kota,
        settings.data.nominal_iuran
      );
    }
    for (const table of TABLES) {
      await insertRows(db, table, remoteRows[table]);
    }
  });

  return remoteRows;
}
