import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

import {
  getBackupData,
  restoreFullBackup,
  bulkImportLibraryBooks,
} from '../database/db';
import { parseLibraryRow } from '../utils/excelImport';
import { COLORS, SPACING, RADIUS } from '../utils/theme';

export default function BackupRestoreScreen() {
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // ---------------- BACKUP ----------------
  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const { books, members, issues } = await getBackupData();

      const wb = XLSX.utils.book_new();
      const booksSheet = XLSX.utils.json_to_sheet(books);
      const membersSheet = XLSX.utils.json_to_sheet(members);
      const issuesSheet = XLSX.utils.json_to_sheet(issues);

      XLSX.utils.book_append_sheet(wb, booksSheet, 'Books');
      XLSX.utils.book_append_sheet(wb, membersSheet, 'Members');
      XLSX.utils.book_append_sheet(wb, issuesSheet, 'Issues');

      const wbBase64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

      const dateStamp = new Date().toISOString().split('T')[0];
      const fileUri = `${FileSystem.documentDirectory}BrothersVayanasala_Backup_${dateStamp}.xlsx`;

      await FileSystem.writeAsStringAsync(fileUri, wbBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
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
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const fileUri = result.assets[0].uri;
      const b64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const workbook = XLSX.read(b64, { type: 'base64' });

      const sheetNames = workbook.SheetNames.map((n) => n.toLowerCase());
      const hasFullBackupShape = sheetNames.includes('books') && sheetNames.includes('issues');

      if (hasFullBackupShape) {
        // Full backup file (has Books + Members + Issues sheets, with book_id etc.)
        Alert.alert(
          'Restore Full Backup',
          'This will REPLACE all current books, members, and issue history with the data in this file. This cannot be undone. Continue?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Replace All Data',
              style: 'destructive',
              onPress: () => runFullRestore(workbook),
            },
          ]
        );
      } else {
        // Looks like a plain book-list file (e.g. the Add Book import template)
        Alert.alert(
          'Import Books',
          'This file will be added as new books (existing data is kept). Continue?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Import', onPress: () => runPlainImport(workbook) },
          ]
        );
      }
    } catch (e) {
      Alert.alert('Restore failed', e.message);
    }
  };

  const runFullRestore = async (workbook) => {
    setRestoring(true);
    try {
      const getSheet = (name) => {
        const actualName = workbook.SheetNames.find(
          (n) => n.toLowerCase() === name
        );
        return actualName ? XLSX.utils.sheet_to_json(workbook.Sheets[actualName], { defval: null }) : [];
      };

      const books = getSheet('books');
      const members = getSheet('members');
      const issues = getSheet('issues');

      const summary = await restoreFullBackup({ books, members, issues });
      Alert.alert(
        'Restore Complete',
        `Books: ${summary.books}\nMembers: ${summary.members}\nIssues: ${summary.issues}`
      );
    } catch (e) {
      Alert.alert('Restore failed', e.message);
    } finally {
      setRestoring(false);
    }
  };

  const runPlainImport = async (workbook) => {
    setRestoring(true);
    try {
      // Pick the sheet with the most data rows (real exports often have small
      // "summary" sheets alongside the main book list).
      let bestSheet = workbook.SheetNames[0];
      let bestRows = [];
      for (const name of workbook.SheetNames) {
        const r = XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: '' });
        if (r.length > bestRows.length) {
          bestRows = r;
          bestSheet = name;
        }
      }

      const rows = bestRows.map((row) => parseLibraryRow(row)).filter((r) => r.bookName);

      if (rows.length === 0) {
        Alert.alert('No rows found', 'Check that the file has a Book Name column with data.');
        return;
      }

      const { inserted, failed } = await bulkImportLibraryBooks(rows);
      Alert.alert(
        'Import Complete',
        `Sheet used: ${bestSheet}\nInserted: ${inserted}\nFailed: ${failed.length}`
      );
    } catch (e) {
      Alert.alert('Import failed', e.message);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <Text style={styles.header}>Backup & Restore</Text>
      <Text style={styles.helperText}>
        Keep a safe copy of your entire library — books, members, and issue history — as a
        single Excel file you can store in email, Google Drive, or anywhere else.
      </Text>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="cloud-download-outline" size={22} color={COLORS.navy} />
          <Text style={styles.cardTitle}>Create Backup</Text>
        </View>
        <Text style={styles.cardText}>
          Exports every book, member, and issue/return record into one .xlsx file with three
          sheets (Books, Members, Issues), and lets you save or share it.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleBackup} disabled={backingUp}>
          {backingUp ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="download-outline" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Backup Now (.xlsx)</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="cloud-upload-outline" size={22} color={COLORS.amberDark} />
          <Text style={styles.cardTitle}>Restore from File</Text>
        </View>
        <Text style={styles.cardText}>
          Accepts either:{'\n'}
          • A full backup .xlsx (from "Create Backup" above) — restores everything exactly,
          replacing current data.{'\n'}
          • A plain book-list .xlsx/.xls (like the Add Book import template) — adds those books
          without touching existing data.
        </Text>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: COLORS.amberDark }]}
          onPress={handleRestore}
          disabled={restoring}
        >
          {restoring ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="document-attach-outline" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Choose Excel File to Restore</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.warnBox}>
        <Ionicons name="warning-outline" size={16} color={COLORS.danger} />
        <Text style={styles.warnText}>
          Restoring a full backup permanently replaces all current books, members, and issue
          history. Make a fresh backup first if you're unsure.
        </Text>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg, padding: SPACING.md },
  header: { fontSize: 20, fontWeight: '800', color: COLORS.navy, marginBottom: SPACING.sm },
  helperText: { color: COLORS.textMuted, fontSize: 13, lineHeight: 19, marginBottom: SPACING.lg },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  cardText: { fontSize: 12, color: COLORS.textMuted, lineHeight: 18, marginBottom: SPACING.md },
  primaryBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.navy,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  warnBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FDECEC',
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    alignItems: 'flex-start',
  },
  warnText: { flex: 1, fontSize: 12, color: COLORS.danger, lineHeight: 17 },
});
