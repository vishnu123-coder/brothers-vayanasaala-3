import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { booksStore, membersStore, activeIssuesStore, getFirebaseInfo, testFirebaseConnection } from '../database/db';
import { useStore } from '../database/hooks';
import { COLORS, RADIUS, SHADOW, TYPE, useLayout } from '../utils/theme';
import Screen from '../components/Screen';
import Button from '../components/Button';

const appVersion = (() => {
  try {
    return require('../app.json').expo.version;
  } catch (e) {
    return '1.0.0';
  }
})();

export default function MoreScreen({ navigation }) {
  const { gutter } = useLayout();
  const books = useStore(booksStore);
  const members = useStore(membersStore);
  const issues = useStore(activeIssuesStore);
  const info = getFirebaseInfo();

  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      setResult(await testFirebaseConnection());
    } finally {
      setTesting(false);
    }
  };

  let live = { text: 'Connected to Firebase', color: COLORS.success, icon: 'checkmark-circle' };
  if (books.error) live = { text: `Error: ${books.error.code || books.error.message}`, color: COLORS.danger, icon: 'close-circle' };
  else if (books.loading) live = { text: 'Connecting…', color: COLORS.textMuted, icon: 'time' };
  else if (books.fromCache) live = { text: 'Offline — using the copy saved on this phone', color: COLORS.warn, icon: 'cloud-offline' };
  else if (books.hasPendingWrites) live = { text: 'Connected — uploading recent changes', color: COLORS.navyLight, icon: 'sync-circle' };

  const rows = [
    { icon: 'add-circle', label: 'Add Book', hint: 'Add one book or import an Excel list', screen: 'Add Book', color: COLORS.amberDark },
    { icon: 'people', label: 'Members', hint: 'Register and manage library members', screen: 'Members', color: COLORS.navy },
    { icon: 'save', label: 'Backup & Restore', hint: 'Export or restore an Excel backup', screen: 'Backup', color: COLORS.success },
  ];

  return (
    <Screen title="More" subtitle="Tools, members and cloud status" icon="grid">
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: 60 }}>
        <View style={styles.card}>
          {rows.map((r, idx) => (
            <TouchableOpacity
              key={r.label}
              style={[styles.row, idx === rows.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => navigation.navigate(r.screen)}
              activeOpacity={0.8}
            >
              <View style={[styles.rowIcon, { backgroundColor: r.color + '18' }]}>
                <Ionicons name={r.icon} size={24} color={r.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{r.label}</Text>
                <Text style={styles.rowHint}>{r.hint}</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Cloud status (Firebase)</Text>
        <View style={styles.card2}>
          <View style={styles.liveRow}>
            <Ionicons name={live.icon} size={26} color={live.color} />
            <Text style={[styles.liveText, { color: live.color }]}>{live.text}</Text>
          </View>

          <Info label="Firebase project" value={info.projectId} />
          <Info label="App ID" value={info.appId} />
          <Info label="Books loaded" value={String(books.data.length)} />
          <Info label="Members loaded" value={String(members.data.length)} />
          <Info label="Issued books" value={String(issues.data.length)} />

          <Button title={testing ? 'Testing…' : 'Run connection test'} icon="pulse" onPress={runTest} loading={testing} style={{ marginTop: 16 }} />

          {result ? (
            <View style={[styles.result, { backgroundColor: result.ok ? COLORS.successBg : COLORS.dangerBg }]}>
              <Text style={[styles.resultTitle, { color: result.ok ? COLORS.success : COLORS.danger }]}>
                {result.ok ? '✓ Firebase is connected and working' : '✗ Firebase test failed'}
              </Text>
              <ResultLine label="Read from server" value={result.read} />
              <ResultLine label="Write to server" value={result.write ?? 'not tested'} />
              {result.latencyMs != null ? <ResultLine label="Response time" value={`${result.latencyMs} ms`} /> : null}
              {result.hint ? <Text style={styles.hint}>{result.hint}</Text> : null}
            </View>
          ) : null}
        </View>

        <Text style={styles.footer}>Brothers Vayanasala · version {appVersion}</Text>
      </ScrollView>
    </Screen>
  );
}

function Info({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} selectable>
        {value}
      </Text>
    </View>
  );
}

function ResultLine({ label, value }) {
  const ok = value === 'ok';
  return (
    <View style={styles.resultLine}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={[styles.resultValue, { color: ok ? COLORS.success : COLORS.textSecondary }]}>{ok ? 'OK' : String(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, marginTop: 6, ...SHADOW },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { ...TYPE.h3, color: COLORS.text },
  rowHint: { ...TYPE.small, color: COLORS.textMuted },
  sectionTitle: { ...TYPE.h3, color: COLORS.navy, marginTop: 26, marginBottom: 12 },
  card2: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: 16, ...SHADOW },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  liveText: { flex: 1, ...TYPE.bodyStrong },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  infoLabel: { ...TYPE.small, color: COLORS.textMuted },
  infoValue: { ...TYPE.smallStrong, color: COLORS.text, flexShrink: 1, textAlign: 'right' },
  result: { borderRadius: RADIUS.sm, padding: 14, marginTop: 14 },
  resultTitle: { ...TYPE.bodyStrong, marginBottom: 8 },
  resultLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  resultLabel: { ...TYPE.small, color: COLORS.textSecondary },
  resultValue: { ...TYPE.smallStrong },
  hint: { ...TYPE.small, color: COLORS.textSecondary, marginTop: 10 },
  footer: { ...TYPE.small, color: COLORS.textMuted, textAlign: 'center', marginTop: 28 },
});
