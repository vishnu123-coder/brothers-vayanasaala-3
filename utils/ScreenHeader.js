import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPE, useLayout } from './theme';
import SyncBadge from '../components/SyncBadge';

// Navy header used on every screen. It draws behind the status bar (so there
// is never a light gap above it) and includes the live Firebase sync badge.
export default function ScreenHeader({ title, subtitle, icon, right, onBack, hideSync }) {
  const insets = useSafeAreaInsets();
  const { contentMax, gutter } = useLayout();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 10 }]}>
      <View style={[styles.inner, { maxWidth: contentMax, paddingHorizontal: gutter }]}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
        ) : icon ? (
          <View style={styles.iconCircle}>
            <Ionicons name={icon} size={20} color="#fff" />
          </View>
        ) : null}

        <View style={styles.titleBox}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {right ? <View>{right}</View> : null}
        {hideSync ? null : <SyncBadge />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.navy,
    paddingBottom: SPACING.md,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: SPACING.sm,
  },
  inner: {
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleBox: { flex: 1 },
  title: { ...TYPE.h2, color: '#fff' },
  subtitle: { ...TYPE.small, color: '#C9D6E5', marginTop: 1 },
});
