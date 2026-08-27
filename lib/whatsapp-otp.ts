import type { SQLiteDatabase } from 'expo-sqlite';
import { Linking, Platform } from 'react-native';

export interface SendOtpResult {
  success: boolean;
  message: string;
  method: 'fonnte' | 'simulated' | 'fallback';
}

/**
 * Format nomor telepon lokal Indonesia ke format internasional (628xxx)
 */
export function formatPhoneNumberToWA(phone: string): string {
  let clean = phone.replace(/[^\d]/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  } else if (clean.startsWith('8')) {
    clean = '62' + clean;
  }
  return clean;
}

/**
 * Mengirim pesan OTP otomatis ke WhatsApp pengguna menggunakan Fonnte API
 */
export async function sendWhatsAppOtp(
  db: SQLiteDatabase | null,
  targetPhone: string,
  otpCode: string,
  recipientName: string
): Promise<SendOtpResult> {
  const cleanPhone = formatPhoneNumberToWA(targetPhone);
  if (!cleanPhone) {
    return {
      success: false,
      message: 'Nomor telepon tujuan tidak valid.',
      method: 'fallback',
    };
  }

  // 1. Dapatkan Token API dari database pengaturan atau env var
  let token = process.env.EXPO_PUBLIC_FONNTE_TOKEN?.trim() || '';

  if (!token && db) {
    try {
      const row = await db.getFirstAsync<{ wa_gateway_token?: string }>(
        'SELECT wa_gateway_token FROM pengaturan WHERE id = 1'
      );
      if (row?.wa_gateway_token) {
        token = row.wa_gateway_token.trim();
      }
    } catch {}
  }

  const messageText =
    `🔐 *[KODE OTP RT MANAGER]*\n\n` +
    `Halo *${recipientName}*,\n` +
    `Kode verifikasi login Anda adalah: *${otpCode}*\n\n` +
    `_Gunakan kode ini untuk masuk ke aplikasi RT Manager. Jangan berikan kode ini kepada siapapun demi keamanan._`;

  // 2. Jika Token Fonnte tersedia, kirim langsung via HTTP POST ke Fonnte API
  if (token) {
    try {
      const response = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: cleanPhone,
          message: messageText,
          countryCode: '62',
        }),
      });

      const data = await response.json();

      if (data.status === true || data.status === 'true' || response.ok) {
        return {
          success: true,
          message: `Kode OTP berhasil dikirimkan langsung ke nomor WhatsApp ${cleanPhone}.`,
          method: 'fonnte',
        };
      } else {
        const errorReason = data.reason || data.message || 'Token Fonnte tidak aktif atau nomor belum terhubung.';
        return {
          success: false,
          message: `Gagal mengirim WA otomatis: ${errorReason}`,
          method: 'fallback',
        };
      }
    } catch (e: any) {
      return {
        success: false,
        message: `Koneksi WhatsApp Gateway gagal: ${e?.message || 'Periksa jaringan internet'}`,
        method: 'fallback',
      };
    }
  }

  // 3. Jika belum ada token Fonnte, gunakan mode simulasi informatif
  return {
    success: false,
    message: 'API Token WhatsApp Gateway belum diatur. Masukkan Token Fonnte di menu Pengaturan untuk pengiriman otomatis.',
    method: 'simulated',
  };
}

/**
 * Helper untuk membuka WhatsApp secara manual sebagai cadangan darurat jika Gateway offline
 */
export function openWhatsAppDirect(targetPhone: string, otpCode: string, recipientName: string) {
  const clean = formatPhoneNumberToWA(targetPhone);
  const message = encodeURIComponent(
    `🔐 *[KODE OTP RT MANAGER]*\n` +
    `Halo *${recipientName}*,\n` +
    `Kode verifikasi login Anda adalah: *${otpCode}*\n` +
    `Jangan berikan kode ini kepada siapapun.`
  );
  Linking.openURL(`https://wa.me/${clean}?text=${message}`).catch(() => {});
}
