import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { getBackupData, restoreFullBackup, bulkImportLibraryBooks } from '../database/db';
import { parseLibraryRow } from '../utils/excelImport';
import { pickWorkbook, bestSheetRows, sheetByName, XLSX } from '../utils/excelPicker';
import { COLORS, RADIUS, SHADOW, TYPE, useLayout } from '../utils/theme';
import { todayStr } from '../utils/dates';
import Screen from '../components/Screen';
import Button from '../components/Button';

export default function BackupRestoreScreen({ navigation }) {
  const { gutter } = useLayout();
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [progress, setProgress] = useState('');

  // ---------------- BACKUP ----------------
  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const { books, members, issues } = await getBackupData();

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(books), 'Books');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(members), 'Members');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(issues), 'Issues');
      const wbBase64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

      const fileUri = `${FileSystem.documentDirectory}BrothersVayanasala_Backup_${todayStr()}.xlsx`;
      await FileSystem.writeAsStringAsync(fileUri, wbBase64, { encoding: FileSystem.EncodingType.Base64 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Save your library backup',
        });
      } else {
        Alert.alert('Backup created', `Saved to: ${fileUri}`);
      }
    } catch (e) {
      Alert.alert('Backup failed', e.message);
    } finally {
      setBackingUp(false);
    }
  };

  // ---------------- RESTORE ----------------
  const handleRestore = async () => {
    try {
      const picked = await pickWorkbook();
      if (!picked) return;
      const { workbook } = picked;

      const names = workbook.SheetNames.map((n) => n.toLowerCase());
      const isFullBackup = names.includes('books') && names.includes('issues');

      if (isFullBackup) {
        Alert.alert(
          'Restore full backup',
          'This will REPLACE all current books, members and issue history with the data in this file. It cannot be undone. Continue?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Replace all data', style: 'destructive', onPress: () => runFullRestore(workbook) },
          ]
        );
      } else {
        Alert.alert('Import books', 'This file will be ADDED as new books. Existing data is kept. Continue?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Import', onPress: () => runPlainImport(workbook) },
        ]);
      }
    } catch (e) {
      Alert.alert('Restore failed', e.message);
    }
  };

  const runFullRestore = async (workbook) => {
    setRestoring(true);
    setProgress('Restoring…');
    try {
      const summary = await restoreFullBackup(
        {
          books: sheetByName(workbook, 'books'),
          members: sheetByName(workbook, 'members'),
          issues: sheetByName(workbook, 'issues'),
        },
        (done, total) => setProgress(`Restored ${done} of ${total}…`)
      );
      Alert.alert('Restore complete ✓', `Books: ${summary.books}\nMembers: ${summary.members}\nIssues: ${summary.issues}`);
    } catch (e) {
      Alert.alert('Restore failed', e.message);
    } finally {
      setRestoring(false);
      setProgress('');
    }
  };

  const runPlainImport = async (workbook) => {
    setRestoring(true);
    setProgress('Importing…');
    try {
      const { sheetName, rows: raw } = bestSheetRows(workbook);
      const rows = raw.map((r) => parseLibraryRow(r)).filter((r) => r.bookName);
      if (rows.length === 0) {
        Alert.alert('No rows found', 'Check that the file has a Book Name column with data.');
        return;
      }
      const { inserted, failed } = await bulkImportLibraryBooks(rows, (done, total) =>
        setProgress(`Saved ${done} of ${total}…`)
      );
      Alert.alert('Import complete ✓', `Sheet used: ${sheetName}\nImported: ${inserted}\nFailed: ${failed.length}`);
    } catch (e) {
      Alert.alert('Import failed', e.message);
    } finally {
      setRestoring(false);
      setProgress('');
    }
  };

  return (
    <Screen
      title="Backup & Restore"
      subtitle="Keep a safe copy of your library"
      icon="save"
      onBack={navigation?.canGoBack?.() ? () => navigation.goBack() : undefined}
    >
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: 60 }}>
        <Text style={styles.intro}>
          Your data already lives safely in the cloud. A backup adds an extra copy — one Excel file with every book, member and issue record that you can keep in email or Google Drive.
        </Text>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={[styles.iconBox, { backgroundColor: COLORS.infoBg }]}>
              <Ionicons name="cloud-download-outline" size={24} color={COLORS.navy} />
            </View>
            <Text style={styles.cardTitle}>Create backup</Text>
          </View>
          <Text style={styles.cardText}>Exports everything to one .xlsx file (sheets: Books, Members, Issues) and opens the share menu so you can save it.</Text>
          <Button title="Backup now (.xlsx)" icon="download-outline" onPress={handleBackup} loading={backingUp} style={{ marginTop: 14 }} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={[styles.iconBox, { backgroundColor: COLORS.warnBg }]}>
              <Ionicons name="cloud-upload-outline" size={24} color={COLORS.amberDark} />
            </View>
            <Text style={styles.cardTitle}>Restore from file</Text>
          </View>
          <Text style={styles.cardText}>
            Choose either:{'\n'}• A full backup made here — restores everything exactly and replaces current data.{'\n'}• A plain book list (like the Add Book template) — adds those books and keeps existing data.
          </Text>
          <Button
            title={restoring ? progress || 'Working…' : 'Choose Excel file'}
            icon="document-attach-outline"
            variant="accent"
            onPress={handleRestore}
            loading={restoring}
            style={{ marginTop: 14 }}
          />
        </View>

        <View style={styles.warn}>
          <Ionicons name="warning-outline" size={20} color={COLORS.danger} />
          <Text style={styles.warnText}>Restoring a full backup permanently replaces all books, members and issue history for everyone using the app. Make a fresh backup first if you are unsure.</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { ...TYPE.body, color: COLORS.textSecondary, marginTop: 6, marginBottom: 6 },
  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: 16, marginTop: 14, ...SHADOW },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  iconBox: { width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { ...TYPE.h3, color: COLORS.text },
  cardText: { ...TYPE.small, color: COLORS.textMuted },
  warn: { flexDirection: 'row', gap: 10, backgroundColor: COLORS.dangerBg, padding: 14, borderRadius: RADIUS.md, marginTop: 14, alignItems: 'flex-start' },
  warnText: { flex: 1, ...TYPE.small, color: COLORS.danger },
});
