import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from './theme';

// Consistent navy header bar used at the top of every screen — gives the
// app a unified, professional look instead of a plain text title.
export default function ScreenHeader({ title, subtitle, icon, right }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.left}>
        {icon ? (
          <View style={styles.iconCircle}>
            <Ionicons name={icon} size={18} color="#fff" />
          </View>
        ) : null}
        <View>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 11, color: '#C9D6E5', marginTop: 1 },
});
