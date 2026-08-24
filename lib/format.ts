export function formatRupiah(value: number): string {
  return 'Rp ' + value.toLocaleString('id-ID');
}

export function formatTanggal(iso: string): string {
  if (!iso) return '-';
  const [y, m, d] = iso.slice(0, 10).split('-');
  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${Number(d)} ${bulan[Number(m) - 1]} ${y}`;
}

export function formatTanggalLengkap(iso: string): string {
  if (!iso) return '-';
  const [y, m, d] = iso.slice(0, 10).split('-');
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${Number(d)} ${bulan[Number(m) - 1]} ${y}`;
}
