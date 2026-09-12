import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../utils/ScreenHeader';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';

import {
  CATEGORIES,
  LANGUAGES,
  addBook,
  bulkImportLibraryBooks,
  getNextBookId,
  getNextCategoryNo,
} from '../database/db';
import { parseLibraryRow } from '../utils/excelImport';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import { COLORS, SPACING, RADIUS } from '../utils/theme';

const initialForm = {
  categoryCode: CATEGORIES[0].code,
  categoryType: LANGUAGES[0],
  bookName: '',
  authorName: '',
  publicationName: '',
  cost: '',
  barcode: '',
};

export default function AddBookScreen() {
  const [form, setForm] = useState(initialForm);
  const [nextBookId, setNextBookId] = useState(null);
  const [nextCategoryNo, setNextCategoryNo] = useState(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const refreshAutoNumbers = async (categoryCode) => {
    const bId = await getNextBookId();
    const cNo = await getNextCategoryNo(categoryCode);
    setNextBookId(bId);
    setNextCategoryNo(cNo);
  };

  useEffect(() => {
    refreshAutoNumbers(form.categoryCode);
  }, []);

  const handleCategoryChange = async (code) => {
    setForm((f) => ({ ...f, categoryCode: code }));
    const cNo = await getNextCategoryNo(code);
    setNextCategoryNo(cNo);
  };

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleScanned = (data) => {
    setScannerVisible(false);
    update('barcode', data);
  };

  const resetForm = async () => {
    setForm(initialForm);
    await refreshAutoNumbers(initialForm.categoryCode);
  };

  const handleSave = async () => {
    if (!form.bookName.trim()) {
      Alert.alert('Missing info', 'Please enter the book name.');
      return;
    }
    setSaving(true);
    try {
      const result = await addBook({
        categoryCode: form.categoryCode,
        categoryType: form.categoryType,
        bookName: form.bookName.trim(),
        authorName: form.authorName.trim(),
        publicationName: form.publicationName.trim(),
        cost: form.cost ? parseFloat(form.cost) : null,
        barcode: form.barcode.trim(),
      });
      Alert.alert(
        'Book Added',
        `Book ID: ${result.bookId}\nCategory No: ${form.categoryCode}-${result.categoryNo}`
      );
      await resetForm();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  // ---- Excel (.xlsx) import ----
  // Expected columns (case-insensitive header row):
  // categoryCode | categoryType | bookName | authorName | publicationName | cost | barcode
  const handleImportExcel = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      setImporting(true);
      const fileUri = result.assets[0].uri;
      const b64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const workbook = XLSX.read(b64, { type: 'base64' });

      // Pick the sheet with the most actual data rows (real exports often have
      // extra small "summary" sheets alongside the main list).
      let bestSheet = workbook.SheetNames[0];
      let bestRows = [];
      for (const name of workbook.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: '' });
        if (rows.length > bestRows.length) {
          bestRows = rows;
          bestSheet = name;
        }
      }
      const json = bestRows;

      const rows = json.map((r) => parseLibraryRow(r)).filter((r) => r.bookName);

      if (rows.length === 0) {
        Alert.alert('No rows found', 'Check that your file has a Book Name column with data.');
        setImporting(false);
        return;
      }

      const { inserted, failed } = await bulkImportLibraryBooks(rows);
      await refreshAutoNumbers(form.categoryCode);
      Alert.alert(
        'Import complete',
        `Sheet used: ${bestSheet}\nInserted: ${inserted}\nFailed: ${failed.length}`
      );
    } catch (e) {
      Alert.alert('Import failed', e.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
    <ScreenHeader title="Add Book" icon="add-circle" />
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>

      <View style={styles.autoRow}>
        <View style={styles.autoBox}>
          <Text style={styles.autoLabel}>Book ID (auto)</Text>
          <Text style={styles.autoValue}>{nextBookId ?? '—'}</Text>
        </View>
        <View style={styles.autoBox}>
          <Text style={styles.autoLabel}>Category No (auto)</Text>
          <Text style={styles.autoValue}>
            {form.categoryCode}-{nextCategoryNo ?? '—'}
          </Text>
        </View>
      </View>

      <FieldLabel text="Barcode" />
      <View style={styles.barcodeRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Scan or type barcode"
          value={form.barcode}
          onChangeText={(v) => update('barcode', v)}
        />
        <TouchableOpacity style={styles.scanBtn} onPress={() => setScannerVisible(true)}>
          <Ionicons name="barcode-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <FieldLabel text="Category" />
      <View style={styles.pickerWrap}>
        <Picker selectedValue={form.categoryCode} onValueChange={handleCategoryChange} mode="dropdown">
          {CATEGORIES.map((c) => (
            <Picker.Item key={c.code} label={`${c.label} (${c.code})`} value={c.code} />
          ))}
        </Picker>
      </View>

      <FieldLabel text="Category Type (Language)" />
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={form.categoryType}
          onValueChange={(v) => update('categoryType', v)}
          mode="dropdown"
        >
          {LANGUAGES.map((l) => (
            <Picker.Item key={l} label={l} value={l} />
          ))}
        </Picker>
      </View>

      <FieldLabel text="Book Name" />
      <TextInput
        style={styles.input}
        placeholder="e.g. The Old Man and the Sea"
        value={form.bookName}
        onChangeText={(v) => update('bookName', v)}
      />

      <FieldLabel text="Author Name" />
      <TextInput
        style={styles.input}
        placeholder="e.g. Ernest Hemingway"
        value={form.authorName}
        onChangeText={(v) => update('authorName', v)}
      />

      <FieldLabel text="Publication Name" />
      <TextInput
        style={styles.input}
        placeholder="e.g. Scribner"
        value={form.publicationName}
        onChangeText={(v) => update('publicationName', v)}
      />

      <FieldLabel text="Cost" />
      <TextInput
        style={styles.input}
        placeholder="e.g. 350"
        keyboardType="numeric"
        value={form.cost}
        onChangeText={(v) => update('cost', v)}
      />

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="save-outline" size={18} color="#fff" />
            <Text style={styles.saveBtnText}>Save Book</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={styles.divider} />

      <Text style={styles.header}>Bulk Import from Excel</Text>
      <Text style={styles.helperText}>
        Upload a .xlsx file with columns: categoryCode, categoryType, bookName, authorName,
        publicationName, cost, barcode (barcode optional). Book ID and Category No are
        generated automatically for every row.
      </Text>
      <TouchableOpacity style={styles.importBtn} onPress={handleImportExcel} disabled={importing}>
        {importing ? (
          <ActivityIndicator color={COLORS.navy} />
        ) : (
          <>
            <Ionicons name="document-attach-outline" size={18} color={COLORS.navy} />
            <Text style={styles.importBtnText}>Choose .xlsx File</Text>
          </>
        )}
      </TouchableOpacity>

      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={handleScanned}
      />
    </ScrollView>
    </SafeAreaView>
  );
}

function FieldLabel({ text }) {
  return <Text style={styles.label}>{text}</Text>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg, padding: SPACING.md },
  header: { fontSize: 20, fontWeight: '800', color: COLORS.navy, marginBottom: SPACING.md },
  autoRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  autoBox: {
    flex: 1,
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  autoLabel: { color: '#C9D6E5', fontSize: 11 },
  autoValue: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 4 },
  label: { fontSize: 13, color: COLORS.textMuted, marginBottom: 4, marginTop: SPACING.sm },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    fontSize: 15,
  },
  barcodeRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  scanBtn: {
    backgroundColor: COLORS.navy,
    padding: 14,
    borderRadius: RADIUS.sm,
  },
  pickerWrap: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 50,
    justifyContent: 'center',
  },
  saveBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.amberDark,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.xl },
  helperText: { color: COLORS.textMuted, fontSize: 12, marginBottom: SPACING.md, lineHeight: 18 },
  importBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.navy,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  importBtnText: { color: COLORS.navy, fontWeight: '700' },
});
