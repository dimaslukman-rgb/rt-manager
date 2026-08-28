import { useRouter } from 'expo-router';
import { forwardRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  TextInputProps,
  View as RNView,
  ScrollView,
  View,
} from 'react-native';

import Colors from '@/constants/Colors';
import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const scheme = useColorScheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: Colors[scheme].card, borderColor: Colors[scheme].border },
        style,
      ]}>
      {children}
    </View>
  );
}

type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'primary' | 'muted';

const badgeColors: Record<BadgeVariant, { light: string; dark: string }> = {
  success: { light: '#dcfce7', dark: '#052e16' },
  danger: { light: '#fee2e2', dark: '#450a0a' },
  warning: { light: '#fef3c7', dark: '#451a03' },
  info: { light: '#dbeafe', dark: '#172554' },
  primary: { light: '#d1fae5', dark: '#064e3b' },
  muted: { light: '#f3f4f6', dark: '#1f2937' },
};

const badgeText: Record<BadgeVariant, { light: string; dark: string }> = {
  success: { light: '#15803d', dark: '#4ade80' },
  danger: { light: '#b91c1c', dark: '#f87171' },
  warning: { light: '#b45309', dark: '#fbbf24' },
  info: { light: '#1d4ed8', dark: '#60a5fa' },
  primary: { light: '#047857', dark: '#34d399' },
  muted: { light: '#4b5563', dark: '#9ca3af' },
};

export function Badge({ label, variant = 'primary' }: { label: string; variant?: BadgeVariant }) {
  const scheme = useColorScheme();
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: badgeColors[variant][scheme] },
      ]}>
      <Text style={[styles.badgeText, { color: badgeText[variant][scheme] }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  const scheme = useColorScheme();
  return (
    <View style={styles.empty}>
      <Text style={{ fontSize: 40, marginBottom: 8 }}>🗂️</Text>
      <Text style={{ color: Colors[scheme].muted, textAlign: 'center' }}>{message}</Text>
    </View>
  );
}

export function LoadingState() {
  const scheme = useColorScheme();
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={Colors[scheme].primary} size="large" />
    </View>
  );
}

export function FAB({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const scheme = useColorScheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.fab, { backgroundColor: Colors[scheme].primary }]}>
      <Text style={styles.fabText}>+ {label}</Text>
    </Pressable>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  return (
    <Text style={[styles.sectionTitle, { color: Colors[scheme].muted }]}>{children}</Text>
  );
}

type FieldProps = TextInputProps & { label: string };

export function Field({ label, style, ...rest }: FieldProps) {
  const scheme = useColorScheme();
  return (
    <View style={styles.fieldContainer}>
      <Text style={[styles.fieldLabel, { color: Colors[scheme].muted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={Colors[scheme].muted}
        style={[
          styles.input,
          {
            backgroundColor: Colors[scheme].background,
            borderColor: Colors[scheme].border,
            color: Colors[scheme].text,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  const scheme = useColorScheme();
  return (
    <View style={styles.chips}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={[
              styles.chip,
              {
                borderColor: active ? Colors[scheme].primary : Colors[scheme].border,
                backgroundColor: active ? Colors[scheme].primaryMuted : Colors[scheme].card,
              },
            ]}>
            <Text
              style={[
                styles.chipText,
                { color: active ? Colors[scheme].primary : Colors[scheme].muted },
              ]}>
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const scheme = useColorScheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        { backgroundColor: Colors[scheme].primary, opacity: disabled || loading ? 0.5 : 1 },
      ]}>
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.buttonText}>{title}</Text>
      )}
    </Pressable>
  );
}

export function MenuCard({
  title,
  subtitle,
  emoji,
  href,
}: {
  title: string;
  subtitle: string;
  emoji: string;
  href: string;
}) {
  const scheme = useColorScheme();
  const router = useRouter();
  return (
    <Pressable style={styles.menuCard} onPress={() => router.push(href as any)}>
      {({ pressed }) => (
        <Card style={{ opacity: pressed ? 0.7 : 1, width: '100%', marginBottom: 0 }}>
          <Text style={{ fontSize: 28, marginBottom: 6 }}>{emoji}</Text>
          <Text style={[styles.menuTitle, { color: Colors[scheme].text }]}>{title}</Text>
          <Text style={[styles.menuSubtitle, { color: Colors[scheme].muted }]}>{subtitle}</Text>
        </Card>
      )}
    </Pressable>
  );
}

export function Screen({ children, style }: { children: React.ReactNode; style?: object }) {
  const scheme = useColorScheme();
  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: Colors[scheme].background }, style]}
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled">
      <View style={styles.maxWidthContainer}>
        {children}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    padding: 16,
    paddingBottom: 112,
    flexGrow: 1,
  },
  maxWidthContainer: {
    width: '100%',
    maxWidth: 1140,
    alignSelf: 'center',
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    // Soft diffused bento shadow
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 104,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: '#1a2030',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  fabText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
  },
  fieldContainer: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  menuCard: {
    width: '48%',
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  menuSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});

export { RNView };
