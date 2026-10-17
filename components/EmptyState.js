import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPE } from '../utils/theme';
import Button from './Button';

export default function EmptyState({ icon = 'file-tray-outline', title, message, actionLabel, onAction }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.circle}>
        <Ionicons name={icon} size={34} color={COLORS.navyLight} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel ? <Button title={actionLabel} onPress={onAction} small style={{ marginTop: 14 }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  circle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: { ...TYPE.h3, color: COLORS.text, textAlign: 'center' },
  message: { ...TYPE.body, color: COLORS.textMuted, textAlign: 'center', marginTop: 6 },
});
