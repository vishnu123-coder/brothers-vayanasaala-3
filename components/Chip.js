import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPE } from '../utils/theme';

export default function Chip({ label, active, onPress, color, icon }) {
  const tint = color || COLORS.navy;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: tint, borderColor: tint }]}
    >
      {icon ? (
        <Ionicons name={icon} size={15} color={active ? '#fff' : COLORS.textMuted} style={{ marginRight: 5 }} />
      ) : null}
      <Text style={[styles.text, active && { color: '#fff' }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  text: { ...TYPE.smallStrong, color: COLORS.textSecondary },
});
