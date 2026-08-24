-- RT Manager cloud schema
-- Run in Supabase SQL Editor after creating a project.

create table if not exists public.rt_settings (
  id bigint not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  primary key (owner_id, id),
  nama_rt text not null default 'RT 01',
  nama_kelurahan text not null default '',
  nama_kecamatan text not null default '',
  nama_kota text not null default '',
  nominal_iuran integer not null default 50000 check (nominal_iuran >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.keluarga (
  id bigint not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  primary key (owner_id, id),
  no_kk text not null,
  kepala_keluarga text not null,
  alamat text not null default '',
  rt text not null default '',
  rw text not null default '',
  telepon text not null default '',
  created_at timestamptz not null default now(),
  unique (owner_id, id),
  unique (owner_id, no_kk)
);

create table if not exists public.warga (
  id bigint not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
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
  created_at timestamptz not null default now(),
  unique (owner_id, id),
  unique (owner_id, nik),
  foreign key (owner_id, keluarga_id) references public.keluarga(owner_id, id) on delete set null
);

create table if not exists public.transaksi (
  id bigint not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
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
  owner_id uuid not null references auth.users(id) on delete cascade,
  primary key (owner_id, id),
  keluarga_id bigint not null,
  bulan text not null,
  tahun integer not null,
  nominal integer not null default 0 check (nominal >= 0),
  status text not null default 'Belum',
  tanggal_bayar text,
  unique (owner_id, id),
  unique (owner_id, keluarga_id, bulan, tahun),
  foreign key (owner_id, keluarga_id) references public.keluarga(owner_id, id) on delete cascade
);

create table if not exists public.surat (
  id bigint not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  primary key (owner_id, id),
  pemohon_id bigint,
  jenis_surat text not null,
  keperluan text not null default '',
  status text not null default 'Diajukan',
  tanggal_pengajuan text not null,
  tanggal_selesai text,
  created_at timestamptz not null default now(),
  foreign key (owner_id, pemohon_id) references public.warga(owner_id, id) on delete set null
);

create table if not exists public.kegiatan (
  id bigint not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
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
  owner_id uuid not null references auth.users(id) on delete cascade,
  primary key (owner_id, id),
  judul text not null,
  isi text not null default '',
  tanggal text not null,
  penting integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.buku_tamu (
  id bigint not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
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
  owner_id uuid not null references auth.users(id) on delete cascade,
  primary key (owner_id, id),
  tanggal text not null,
  pos text not null default '',
  petugas text not null,
  keterangan text not null default ''
);

create table if not exists public.darurat (
  id bigint not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rt_settings_updated_at on public.rt_settings;
create trigger rt_settings_updated_at
before update on public.rt_settings
for each row execute function public.set_updated_at();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'rt_settings', 'keluarga', 'warga', 'transaksi', 'iuran',
    'surat', 'kegiatan', 'pengumuman', 'buku_tamu', 'ronda', 'darurat'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "owner access" on public.%I', table_name);
    execute format(
      'create policy "owner access" on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      table_name
    );
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Data API exposure is explicit for new Supabase projects.
grant select, insert, update, delete on public.rt_settings, public.keluarga, public.warga,
  public.transaksi, public.iuran, public.surat, public.kegiatan, public.pengumuman,
  public.buku_tamu, public.ronda, public.darurat to authenticated;
