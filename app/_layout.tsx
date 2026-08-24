import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { DATABASE_NAME, migrateDbIfNeeded } from '@/lib/db';
import { AuthGate } from '@/lib/auth';
import { EmergencyAlertListener } from '@/components/emergency-listener';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded}>
      <AuthGate>
        <RootLayoutNav />
      </AuthGate>
    </SQLiteProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style="auto" />
      <EmergencyAlertListener />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="warga/[id]" options={{ title: 'Detail Warga' }} />
        <Stack.Screen name="warga/tambah" options={{ title: 'Tambah Warga' }} />
        <Stack.Screen name="keluarga/[id]" options={{ title: 'Detail Keluarga' }} />
        <Stack.Screen name="keluarga/tambah" options={{ title: 'Tambah Keluarga' }} />
        <Stack.Screen name="keuangan/iuran" options={{ title: 'Iuran Warga' }} />
        <Stack.Screen name="keuangan/kas" options={{ title: 'Kas RT' }} />
        <Stack.Screen name="keuangan/laporan" options={{ title: 'Laporan Keuangan' }} />
        <Stack.Screen name="surat" options={{ title: 'Surat & Pengajuan' }} />
        <Stack.Screen name="kegiatan" options={{ title: 'Agenda & Kegiatan' }} />
        <Stack.Screen name="pengumuman" options={{ title: 'Berita & Pengumuman' }} />
        <Stack.Screen name="tamu" options={{ title: 'Buku Tamu' }} />
        <Stack.Screen name="ronda" options={{ title: 'Jadwal Ronda' }} />
        <Stack.Screen name="darurat" options={{ title: 'Pusat Darurat & Panic Button' }} />
        <Stack.Screen name="lapor-rt" options={{ title: 'Lapor Pak RT!' }} />
        <Stack.Screen name="inbox" options={{ title: 'Inbox Laporan Warga' }} />
        <Stack.Screen name="security" options={{ title: 'Petugas Security & Jadwal' }} />
        <Stack.Screen name="pengguna" options={{ title: 'Manajemen Pengurus' }} />
        <Stack.Screen name="pengaturan" options={{ title: 'Pengaturan' }} />
      </Stack>
    </ThemeProvider>
  );
}
