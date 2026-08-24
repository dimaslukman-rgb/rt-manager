import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 6;

export const DATABASE_NAME = 'rtmanager.db';

export async function ensureDefaultAccounts(db: SQLiteDatabase) {
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS pengguna (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        nama_lengkap TEXT NOT NULL,
        no_hp TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'WARGA',
        aktif INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT OR IGNORE INTO pengguna (id, username, nama_lengkap, no_hp, password, role, aktif)
      VALUES
        (1, 'admin', 'Dimas Lukman (Super Admin)', '081234567890', 'admin123', 'ADMIN', 1),
        (2, 'ketuart', 'Bpk. Rudi Santoso (Ketua RT)', '081234567891', 'ketua123', 'KETUA_RT', 1),
        (3, 'wakilrt', 'Bpk. Heri Gunawan (Wakil Ketua)', '081234567892', 'wakil123', 'WAKIL_KETUA', 1),
        (4, 'bendahara', 'Ibu Ratna Dewi (Bendahara)', '081234567893', 'bendahara123', 'BENDAHARA', 1),
        (5, 'sekretaris', 'Bpk. Ahmad Fauzi (Sekretaris)', '081234567894', 'sekretaris123', 'SEKRETARIS', 1),
        (6, 'warga', 'Warga / Penghuni (Anonim)', '081234567895', 'warga123', 'WARGA', 1);

      UPDATE pengguna SET nama_lengkap = 'Warga / Penghuni (Anonim)' WHERE username = 'warga';
    `);
  } catch (e) {
    console.warn('Ensure default accounts error:', e);
  }
}

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentDbVersion = result?.user_version ?? 0;

  if (currentDbVersion >= DATABASE_VERSION) {
    await ensureDefaultAccounts(db);
    return;
  }

  if (currentDbVersion === 0) {
    await db.execAsync(`
PRAGMA journal_mode = 'wal';
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS pengaturan (
  id INTEGER PRIMARY KEY NOT NULL,
  nama_rt TEXT NOT NULL DEFAULT 'RT 01',
  nama_kelurahan TEXT NOT NULL DEFAULT '',
  nama_kecamatan TEXT NOT NULL DEFAULT '',
  nama_kota TEXT NOT NULL DEFAULT '',
  nominal_iuran INTEGER NOT NULL DEFAULT 50000
);

CREATE TABLE IF NOT EXISTS keluarga (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  no_kk TEXT NOT NULL UNIQUE,
  kepala_keluarga TEXT NOT NULL,
  alamat TEXT NOT NULL DEFAULT '',
  rt TEXT NOT NULL DEFAULT '',
  rw TEXT NOT NULL DEFAULT '',
  telepon TEXT NOT NULL DEFAULT '',
  nominal_iuran INTEGER NOT NULL DEFAULT 50000,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS warga (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keluarga_id INTEGER REFERENCES keluarga(id) ON DELETE SET NULL,
  nik TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  tempat_lahir TEXT NOT NULL DEFAULT '',
  tanggal_lahir TEXT NOT NULL DEFAULT '',
  jenis_kelamin TEXT NOT NULL DEFAULT 'L',
  status_keluarga TEXT NOT NULL DEFAULT 'Lainnya',
  pekerjaan TEXT NOT NULL DEFAULT '',
  agama TEXT NOT NULL DEFAULT '',
  status_perkawinan TEXT NOT NULL DEFAULT 'Belum Kawin',
  telepon TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transaksi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tanggal TEXT NOT NULL,
  jenis TEXT NOT NULL DEFAULT 'Masuk',
  kategori TEXT NOT NULL DEFAULT '',
  keterangan TEXT NOT NULL DEFAULT '',
  nominal INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS iuran (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keluarga_id INTEGER NOT NULL REFERENCES keluarga(id) ON DELETE CASCADE,
  bulan TEXT NOT NULL,
  tahun INTEGER NOT NULL,
  nominal INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Belum',
  tanggal_bayar TEXT,
  UNIQUE(keluarga_id, bulan, tahun)
);

CREATE TABLE IF NOT EXISTS surat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pemohon_id INTEGER REFERENCES warga(id) ON DELETE SET NULL,
  jenis_surat TEXT NOT NULL,
  keperluan TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Diajukan',
  tanggal_pengajuan TEXT NOT NULL,
  tanggal_selesai TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kegiatan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  judul TEXT NOT NULL,
  deskripsi TEXT NOT NULL DEFAULT '',
  tanggal TEXT NOT NULL,
  waktu TEXT NOT NULL DEFAULT '',
  lokasi TEXT NOT NULL DEFAULT '',
  jenis TEXT NOT NULL DEFAULT 'Lainnya',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pengumuman (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  judul TEXT NOT NULL,
  isi TEXT NOT NULL DEFAULT '',
  tanggal TEXT NOT NULL,
  penting INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS buku_tamu (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  alamat TEXT NOT NULL DEFAULT '',
  keperluan TEXT NOT NULL DEFAULT '',
  jenis TEXT NOT NULL DEFAULT 'Berkunjung',
  tanggal TEXT NOT NULL,
  jam TEXT NOT NULL DEFAULT '',
  catatan TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ronda (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tanggal TEXT NOT NULL,
  pos TEXT NOT NULL DEFAULT '',
  petugas TEXT NOT NULL,
  keterangan TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS darurat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama_pelapor TEXT NOT NULL,
  alamat_pelapor TEXT NOT NULL DEFAULT '',
  telepon_pelapor TEXT NOT NULL DEFAULT '',
  kategori TEXT NOT NULL DEFAULT 'Bantuan Mendesak',
  keterangan TEXT NOT NULL DEFAULT '',
  foto_uri TEXT NOT NULL DEFAULT '',
  latitude REAL,
  longitude REAL,
  status TEXT NOT NULL DEFAULT 'Aktif',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pengguna (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  nama_lengkap TEXT NOT NULL,
  no_hp TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'WARGA',
  aktif INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lapor_rt (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pengguna_id INTEGER REFERENCES pengguna(id) ON DELETE SET NULL,
  nama_pelapor TEXT NOT NULL,
  no_hp_pelapor TEXT NOT NULL DEFAULT '',
  alamat_pelapor TEXT NOT NULL DEFAULT '',
  judul TEXT NOT NULL,
  kategori TEXT NOT NULL DEFAULT 'Aduan Lingkungan',
  isi TEXT NOT NULL,
  foto_uri TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Terkirim',
  tanggapan TEXT NOT NULL DEFAULT '',
  ditanggapi_oleh TEXT NOT NULL DEFAULT '',
  tanggal TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO pengaturan (id, nama_rt, nama_kelurahan, nama_kecamatan, nama_kota, nominal_iuran)
VALUES (1, 'RT 04', 'Setu', 'Setu', 'Bekasi', 50000);

INSERT OR IGNORE INTO pengguna (id, username, nama_lengkap, no_hp, password, role, aktif)
VALUES
  (1, 'admin', 'Dimas Lukman (Super Admin)', '081234567890', 'admin123', 'ADMIN', 1),
  (2, 'ketuart', 'Bpk. Rudi Santoso (Ketua RT)', '081234567891', 'ketua123', 'KETUA_RT', 1),
  (3, 'wakilrt', 'Bpk. Heri Gunawan (Wakil Ketua)', '081234567892', 'wakil123', 'WAKIL_KETUA', 1),
  (4, 'bendahara', 'Ibu Ratna Dewi (Bendahara)', '081234567893', 'bendahara123', 'BENDAHARA', 1),
  (5, 'sekretaris', 'Bpk. Ahmad Fauzi (Sekretaris)', '081234567894', 'sekretaris123', 'SEKRETARIS', 1),
  (6, 'warga', 'Warga / Penghuni (Anonim)', '081234567895', 'warga123', 'WARGA', 1);
`);
    currentDbVersion = 6;
  }

  if (currentDbVersion < 3) {
    await db.execAsync(`
CREATE TABLE IF NOT EXISTS darurat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama_pelapor TEXT NOT NULL,
  alamat_pelapor TEXT NOT NULL DEFAULT '',
  telepon_pelapor TEXT NOT NULL DEFAULT '',
  kategori TEXT NOT NULL DEFAULT 'Bantuan Mendesak',
  keterangan TEXT NOT NULL DEFAULT '',
  foto_uri TEXT NOT NULL DEFAULT '',
  latitude REAL,
  longitude REAL,
  status TEXT NOT NULL DEFAULT 'Aktif',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pengguna (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  nama_lengkap TEXT NOT NULL,
  no_hp TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'WARGA',
  aktif INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO pengguna (id, username, nama_lengkap, no_hp, password, role, aktif)
VALUES
  (1, 'admin', 'Dimas Lukman (Super Admin)', '081234567890', 'admin123', 'ADMIN', 1),
  (2, 'ketuart', 'Bpk. Rudi Santoso (Ketua RT)', '081234567891', 'ketua123', 'KETUA_RT', 1),
  (3, 'wakilrt', 'Bpk. Heri Gunawan (Wakil Ketua)', '081234567892', 'wakil123', 'WAKIL_KETUA', 1),
  (4, 'bendahara', 'Ibu Ratna Dewi (Bendahara)', '081234567893', 'bendahara123', 'BENDAHARA', 1),
  (5, 'sekretaris', 'Bpk. Ahmad Fauzi (Sekretaris)', '081234567894', 'sekretaris123', 'SEKRETARIS', 1),
  (6, 'warga', 'Bpk. Budi Santoso (Warga/Penghuni)', '081234567895', 'warga123', 'WARGA', 1);
`);
    currentDbVersion = 3;
  }

  if (currentDbVersion < 4) {
    try {
      await db.execAsync('ALTER TABLE keluarga ADD COLUMN nominal_iuran INTEGER NOT NULL DEFAULT 50000;');
    } catch (e) {
      console.log('Column nominal_iuran might already exist:', e);
    }
    currentDbVersion = 4;
  }

  if (currentDbVersion < 5 || currentDbVersion < 6) {
    await db.execAsync(`
CREATE TABLE IF NOT EXISTS lapor_rt (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pengguna_id INTEGER REFERENCES pengguna(id) ON DELETE SET NULL,
  nama_pelapor TEXT NOT NULL,
  no_hp_pelapor TEXT NOT NULL DEFAULT '',
  alamat_pelapor TEXT NOT NULL DEFAULT '',
  judul TEXT NOT NULL,
  kategori TEXT NOT NULL DEFAULT 'Aduan Lingkungan',
  isi TEXT NOT NULL,
  foto_uri TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Terkirim',
  tanggapan TEXT NOT NULL DEFAULT '',
  ditanggapi_oleh TEXT NOT NULL DEFAULT '',
  tanggal TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);
    await ensureDefaultAccounts(db);
    currentDbVersion = 6;
  }

  await ensureDefaultAccounts(db);
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function currentTime(): string {
  return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function bulanKey(date: Date): string {
  return BULAN[date.getMonth()];
}
