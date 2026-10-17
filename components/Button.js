import React from 'react';
import { Text, TouchableOpacity, ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, TYPE } from '../utils/theme';

const VARIANTS = {
  primary: { bg: COLORS.navy, fg: '#fff', border: COLORS.navy },
  accent: { bg: COLORS.amber, fg: COLORS.navyDeep, border: COLORS.amber },
  outline: { bg: '#fff', fg: COLORS.navy, border: COLORS.navy },
  danger: { bg: COLORS.danger, fg: '#fff', border: COLORS.danger },
  soft: { bg: COLORS.surface, fg: COLORS.navy, border: COLORS.surface },
};

export default function Button({ title, icon, onPress, variant = 'primary', loading, disabled, small, style }) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const off = disabled || loading;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={off}
      style={[
        styles.btn,
        small && styles.small,
        { backgroundColor: v.bg, borderColor: v.border, opacity: off && !loading ? 0.5 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={small ? 16 : 19} color={v.fg} /> : null}
          <Text style={[small ? styles.textSmall : styles.text, { color: v.fg }]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 52,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  small: { minHeight: 40, borderRadius: RADIUS.sm, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { ...TYPE.bodyStrong, fontSize: 16 },
  textSmall: { ...TYPE.smallStrong },
});
