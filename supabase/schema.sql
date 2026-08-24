-- RT Manager Cloud Schema for Supabase
-- Buka Supabase Dashboard -> SQL Editor -> New Query -> Paste seluruh isi file ini -> Klik RUN.

create table if not exists public.rt_settings (
  id bigint not null,
  owner_id text not null default 'rt04_hangtuah',
  primary key (owner_id, id),
  nama_rt text not null default 'RT 04',
  nama_kelurahan text not null default '',
  nama_kecamatan text not null default '',
  nama_kota text not null default '',
  nominal_iuran integer not null default 50000 check (nominal_iuran >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.keluarga (
  id bigint not null,
  owner_id text not null default 'rt04_hangtuah',
  primary key (owner_id, id),
  no_kk text not null,
  kepala_keluarga text not null,
  alamat text not null default '',
  rt text not null default '',
  rw text not null default '',
  telepon text not null default '',
  nominal_iuran integer not null default 50000,
  created_at timestamptz not null default now()
);

create table if not exists public.warga (
  id bigint not null,
  owner_id text not null default 'rt04_hangtuah',
  primary key (owner_id, id),
  keluarga_id bigint,
  nik text not null,
  nama text not null,
  tempat_lahir text not null default '',
  tanggal_lahir text not null default '',
  jenis_kelamin text not null default 'L',
  status_keluarga text not null default 'Lainnya',
  pekerjaan text not null default '',
  agama text not null default '',
  status_perkawinan text not null default 'Belum Kawin',
  telepon text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.transaksi (
  id bigint not null,
  owner_id text not null default 'rt04_hangtuah',
  primary key (owner_id, id),
  tanggal text not null,
  jenis text not null default 'Masuk',
  kategori text not null default '',
  keterangan text not null default '',
  nominal integer not null default 0 check (nominal >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.iuran (
  id bigint not null,
  owner_id text not null default 'rt04_hangtuah',
  primary key (owner_id, id),
  keluarga_id bigint not null,
  bulan text not null,
  tahun integer not null,
  nominal integer not null default 0 check (nominal >= 0),
  status text not null default 'Belum',
  tanggal_bayar text
);

create table if not exists public.surat (
  id bigint not null,
  owner_id text not null default 'rt04_hangtuah',
  primary key (owner_id, id),
  pemohon_id bigint,
  nama_pemohon text not null default '',
  nik_pemohon text not null default '',
  no_hp_pemohon text not null default '',
  alamat_pemohon text not null default '',
  jenis_surat text not null,
  keperluan text not null default '',
  status text not null default 'Diajukan',
  catatan_pengurus text not null default '',
  tanggal_pengajuan text not null,
  tanggal_selesai text,
  created_at timestamptz not null default now()
);

create table if not exists public.kegiatan (
  id bigint not null,
  owner_id text not null default 'rt04_hangtuah',
  primary key (owner_id, id),
  judul text not null,
  deskripsi text not null default '',
  tanggal text not null,
  waktu text not null default '',
  lokasi text not null default '',
  jenis text not null default 'Lainnya',
  created_at timestamptz not null default now()
);

create table if not exists public.pengumuman (
  id bigint not null,
  owner_id text not null default 'rt04_hangtuah',
  primary key (owner_id, id),
  judul text not null,
  isi text not null default '',
  tanggal text not null,
  penting integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.buku_tamu (
  id bigint not null,
  owner_id text not null default 'rt04_hangtuah',
  primary key (owner_id, id),
  nama text not null,
  alamat text not null default '',
  keperluan text not null default '',
  jenis text not null default 'Berkunjung',
  tanggal text not null,
  jam text not null default '',
  catatan text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.ronda (
  id bigint not null,
  owner_id text not null default 'rt04_hangtuah',
  primary key (owner_id, id),
  tanggal text not null,
  pos text not null default '',
  petugas text not null,
  keterangan text not null default ''
);

create table if not exists public.darurat (
  id bigint not null,
  owner_id text not null default 'rt04_hangtuah',
  primary key (owner_id, id),
  nama_pelapor text not null,
  alamat_pelapor text not null default '',
  telepon_pelapor text not null default '',
  kategori text not null default 'Bantuan Mendesak',
  keterangan text not null default '',
  foto_uri text not null default '',
  latitude double precision,
  longitude double precision,
  status text not null default 'Aktif',
  created_at timestamptz not null default now()
);

create table if not exists public.pengguna (
  id bigint not null,
  owner_id text not null default 'rt04_hangtuah',
  primary key (owner_id, id),
  username text not null,
  nama_lengkap text not null,
  no_hp text not null,
  password text not null,
  role text not null default 'WARGA',
  aktif integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.lapor_rt (
  id bigint not null,
  owner_id text not null default 'rt04_hangtuah',
  primary key (owner_id, id),
  pengguna_id bigint,
  nama_pelapor text not null,
  no_hp_pelapor text not null default '',
  alamat_pelapor text not null default '',
  judul text not null,
  kategori text not null default 'Aduan Lingkungan',
  isi text not null,
  foto_uri text not null default '',
  status text not null default 'Terkirim',
  tanggapan text not null default '',
  ditanggapi_oleh text not null default '',
  tanggal text not null default now()::text,
  created_at timestamptz not null default now()
);

create table if not exists public.security (
  id bigint not null,
  owner_id text not null default 'rt04_hangtuah',
  primary key (owner_id, id),
  nama text not null,
  nik text not null default '',
  no_hp text not null,
  pos_jaga text not null default 'Pos Gerbang Utama',
  jabatan text not null default 'Anggota Security',
  shift_tetap text not null default 'Pagi - Siang (05:00 - 17:00)',
  status text not null default 'Aktif',
  foto_uri text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.jadwal_security (
  id bigint not null,
  owner_id text not null default 'rt04_hangtuah',
  primary key (owner_id, id),
  hari text not null,
  shift text not null,
  petugas_ids text not null default '',
  petugas_nama text not null,
  pos_jaga text not null default 'Pos Gerbang Utama',
  keterangan text not null default ''
);

-- Memberikan izin akses penuh ke tabel untuk sinkronisasi anon/authenticated
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
