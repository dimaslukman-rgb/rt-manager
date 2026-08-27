export type JenisKelamin = 'L' | 'P';
export type StatusKeluarga = 'Kepala Keluarga' | 'Istri' | 'Anak' | 'Orang Tua' | 'Famili' | 'Lainnya';
export type StatusPerkawinan = 'Kawin' | 'Belum Kawin' | 'Cerai Hidup' | 'Cerai Mati';

export interface Keluarga {
  id: number;
  no_kk: string;
  kepala_keluarga: string;
  alamat: string;
  rt: string;
  rw: string;
  telepon: string;
  nominal_iuran?: number;
  jumlah_anggota?: number;
}

export interface Warga {
  id: number;
  keluarga_id: number | null;
  nik: string;
  nama: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  jenis_kelamin: JenisKelamin;
  status_keluarga: StatusKeluarga;
  pekerjaan: string;
  agama: string;
  status_perkawinan: StatusPerkawinan;
  telepon: string;
}

export type JenisTransaksi = 'Masuk' | 'Keluar';

export interface Transaksi {
  id: number;
  tanggal: string;
  jenis: JenisTransaksi;
  kategori: string;
  keterangan: string;
  nominal: number;
}

export type StatusIuran = 'Lunas' | 'Belum';

export interface PembayaranIuran {
  id: number;
  keluarga_id: number;
  kepala_keluarga: string;
  bulan: string;
  tahun: number;
  nominal: number;
  status: StatusIuran;
  tanggal_bayar: string | null;
}

export type StatusSurat = 'Diajukan' | 'Diproses' | 'Selesai' | 'Ditolak';

export interface Surat {
  id: number;
  pemohon_id?: number | null;
  pemohon_nama?: string;
  nama_pemohon?: string;
  nik_pemohon?: string;
  no_hp_pemohon?: string;
  alamat_pemohon?: string;
  jenis_surat: string;
  keperluan: string;
  status: StatusSurat;
  catatan_pengurus?: string;
  tanggal_pengajuan: string;
  tanggal_selesai: string | null;
}

export type JenisKegiatan = 'Rapat' | 'Kerja Bakti' | 'Sosial' | 'Keagamaan' | 'Perayaan' | 'Lainnya';

export interface Kegiatan {
  id: number;
  judul: string;
  deskripsi: string;
  tanggal: string;
  waktu: string;
  lokasi: string;
  jenis: JenisKegiatan;
}

export interface Pengumuman {
  id: number;
  judul: string;
  isi: string;
  tanggal: string;
  penting: number;
}

export type JenisTamu = 'Tamunan' | 'Berkunjung' | 'Transaksi' | 'Rombongan' | 'Lainnya';

export interface BukuTamu {
  id: number;
  nama: string;
  alamat: string;
  keperluan: string;
  jenis: JenisTamu;
  tanggal: string;
  jam: string;
  catatan: string;
}

export interface Pengaturan {
  id: number;
  nama_rt: string;
  nama_kelurahan: string;
  nama_kecamatan: string;
  nama_kota: string;
  nominal_iuran: number;
  wa_gateway_token?: string;
  wa_sender_number?: string;
}

export type KategoriDarurat =
  | 'Orang Mencurigakan'
  | 'Pencurian/Kejahatan'
  | 'Medis/Sakit Kritis'
  | 'Kebakaran'
  | 'Bencana/Pohon Tumbang'
  | 'Bantuan Mendesak';

export type StatusDarurat = 'Aktif' | 'Ditangani' | 'Selesai';

export interface LaporanDarurat {
  id: number;
  nama_pelapor: string;
  alamat_pelapor: string;
  telepon_pelapor: string;
  kategori: KategoriDarurat;
  keterangan: string;
  foto_uri: string;
  latitude: number | null;
  longitude: number | null;
  status: StatusDarurat;
  created_at: string;
}

export type RoleUser = 'ADMIN' | 'KETUA_RT' | 'WAKIL_KETUA' | 'BENDAHARA' | 'SEKRETARIS' | 'WARGA' | 'SECURITY';

export interface Pengguna {
  id: number;
  username: string;
  nama_lengkap: string;
  no_hp: string;
  password?: string;
  role: RoleUser;
  aktif: number;
  created_at: string;
}

export type KategoriLaporan =
  | 'Aduan Lingkungan'
  | 'Keamanan & Ketertiban'
  | 'Fasilitas & Lampu Jalan'
  | 'Kebersihan & Sampah'
  | 'Administrasi & Iuran'
  | 'Usulan & Saran';

export type StatusLaporan = 'Terkirim' | 'Dibaca' | 'Ditindaklanjuti' | 'Selesai';

export interface LaporPakRT {
  id: number;
  pengguna_id: number | null;
  nama_pelapor: string;
  no_hp_pelapor: string;
  alamat_pelapor: string;
  judul: string;
  kategori: KategoriLaporan;
  isi: string;
  foto_uri: string;
  status: StatusLaporan;
  tanggapan: string;
  ditanggapi_oleh: string;
  tanggal: string;
  created_at: string;
}

export type ShiftSecurity = 'Pagi - Siang (05:00 - 17:00)' | 'Sore - Malam (17:00 - 05:00)';
export type StatusSecurity = 'Aktif' | 'Cuti' | 'Off';

export interface SecurityPersonel {
  id: number;
  nama: string;
  nik?: string;
  no_hp: string;
  pos_jaga: string;
  jabatan: string;
  shift_tetap: ShiftSecurity;
  status: StatusSecurity;
  foto_uri?: string;
  created_at?: string;
}

export interface JadwalSecurity {
  id: number;
  hari: 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu' | 'Minggu';
  shift: ShiftSecurity;
  petugas_ids: string;
  petugas_nama: string;
  pos_jaga: string;
  keterangan: string;
}