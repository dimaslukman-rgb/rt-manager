import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useAuth } from '@/lib/auth';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { isWarga } = useAuth();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].primary,
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'house.fill', android: 'home', web: 'home' }} tintColor={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="warga"
        options={{
          title: 'Warga',
          href: isWarga ? null : '/(tabs)/warga',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'person.3.fill', android: 'group', web: 'group' }} tintColor={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="keuangan"
        options={{
          title: 'Keuangan',
          href: isWarga ? null : '/(tabs)/keuangan',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'indianrupeesign.circle.fill', android: 'payments', web: 'payments' }} tintColor={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'square.grid.2x2.fill', android: 'grid_view', web: 'grid_view' }} tintColor={color} size={24} />
          ),
        }}
      />
    </Tabs>
  );
}