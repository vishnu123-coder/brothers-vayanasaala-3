import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { COLORS, RADIUS, TYPE } from '../utils/theme';

// Labelled text input. Text and placeholder colours are set EXPLICITLY so
// they stay readable even when the phone forces dark mode.
export default function Field({ label, right, multiline, style, inputStyle, ...props }) {
  return (
    <View style={[styles.wrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <TextInput
          placeholderTextColor={COLORS.placeholder}
          selectionColor={COLORS.navy}
          multiline={multiline}
          style={[styles.input, multiline && styles.multiline, inputStyle]}
          {...props}
        />
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  label: { ...TYPE.label, color: COLORS.textSecondary, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    flex: 1,
    minHeight: 52,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    lineHeight: 23,
    color: COLORS.text,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
});
