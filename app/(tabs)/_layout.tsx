import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';

import Colors from '@/constants/Colors';
import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useAuth } from '@/lib/auth';

type FloatingTabBarProps = BottomTabBarProps & {
  // Route names hidden via `href: null` (expo-router strips `href` from the
  // screen options before they reach the navigator, so we filter by name).
  hiddenNames: ReadonlySet<string>;
};

// Aurora Glass floating pill tab bar: translucent rounded pill with a real
// backdrop blur on web (`experimental_backdropFilter` is supported by
// react-native-web 0.21 but not declared in RN's ViewStyle type, hence `as any`).
function FloatingPillTabBar({ state, descriptors, navigation, insets, hiddenNames }: FloatingTabBarProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme];
  const routes = state.routes.filter((route) => !hiddenNames.has(route.name));
  const focusedKey = state.routes[state.index]?.key;
  const glassBg = scheme === 'dark' ? 'rgba(22,29,41,0.78)' : 'rgba(255,255,255,0.75)';
  const blurStyle = Platform.OS === 'web' ? ({ experimental_backdropFilter: 'blur(16px)' } as any) : null;

  return (
    <View pointerEvents="box-none" style={[styles.floatWrap, { bottom: insets.bottom + 12 }]}>
      <View
        style={[
          styles.pill,
          { backgroundColor: glassBg, borderColor: colors.glassBorder },
          blurStyle,
        ]}>
        {routes.map((route) => {
          const { options } = descriptors[route.key];
          const isFocused = focusedKey === route.key;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              style={[styles.tab, isFocused && { backgroundColor: colors.primary }]}>
              {options.tabBarIcon?.({
                focused: isFocused,
                color: isFocused ? '#ffffff' : colors.tabIconDefault,
                size: 22,
              })}
              {options.title !== undefined && (
                <Text
                  numberOfLines={1}
                  style={[styles.tabLabel, { color: isFocused ? '#ffffff' : colors.muted }]}>
                  {options.title}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { isWarga, isSecurity } = useAuth();
  const hideAdminTabs = isWarga || isSecurity;

  const hiddenNames = useMemo(
    () => new Set<string>(hideAdminTabs ? ['warga', 'keuangan'] : []),
    [hideAdminTabs]
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].primary,
        headerShown: useClientOnlyValue(false, true),
      }}
      tabBar={(props) => <FloatingPillTabBar {...props} hiddenNames={hiddenNames} />}>
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
          href: hideAdminTabs ? null : '/(tabs)/warga',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'person.3.fill', android: 'group', web: 'group' }} tintColor={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="keuangan"
        options={{
          title: 'Keuangan',
          href: hideAdminTabs ? null : '/(tabs)/keuangan',
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

const styles = StyleSheet.create({
  floatWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    width: '100%',
    maxWidth: 440,
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    padding: 6,
    marginHorizontal: 16,
    shadowColor: '#1a2030',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 999,
    gap: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
});
