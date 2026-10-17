import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { booksStore } from '../database/db';
import { useStore } from '../database/hooks';

// Small live indicator of the Firebase connection:
//   Synced  = talking to the Firebase server, everything saved
//   Syncing = changes waiting to upload
//   Offline = working from the phone's saved copy
//   Error   = Firebase refused / failed (open More → Cloud status)
export default function SyncBadge() {
  const s = useStore(booksStore);

  let label = 'Synced';
  let bg = 'rgba(34,197,94,0.18)';
  let dot = '#4ADE80';

  if (s.error) {
    label = 'Cloud error';
    bg = 'rgba(248,113,113,0.22)';
    dot = '#F87171';
  } else if (s.loading) {
    label = 'Connecting';
    bg = 'rgba(255,255,255,0.14)';
    dot = '#CBD5E1';
  } else if (s.hasPendingWrites) {
    label = 'Syncing';
    bg = 'rgba(96,165,250,0.22)';
    dot = '#60A5FA';
  } else if (s.fromCache) {
    label = 'Offline';
    bg = 'rgba(251,191,36,0.22)';
    dot = '#FBBF24';
  }

  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { color: '#fff', fontSize: 12, lineHeight: 17, fontWeight: '700' },
});
