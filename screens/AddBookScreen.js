import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { CATEGORIES, LANGUAGES, addBook, bulkImportLibraryBooks, getNextBookId, getNextCategoryNo, booksStore } from '../database/db';
import { parseLibraryRow } from '../utils/excelImport';
import { pickWorkbook, bestSheetRows } from '../utils/excelPicker';
import { COLORS, RADIUS, SHADOW, TYPE, useLayout } from '../utils/theme';
import Screen from '../components/Screen';
import Button from '../components/Button';
import Field from '../components/Field';
import Chip from '../components/Chip';
import BarcodeScannerModal from '../components/BarcodeScannerModal';

const initialForm = {
  categoryCode: CATEGORIES[0].code,
  categoryType: LANGUAGES[0],
  bookName: '',
  authorName: '',
  publicationName: '',
  cost: '',
  barcode: '',
};

export default function AddBookScreen({ navigation }) {
  const { gutter } = useLayout();
  const [form, setForm] = useState(initialForm);
  const [nextBookId, setNextBookId] = useState(null);
  const [nextCategoryNo, setNextCategoryNo] = useState(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');

  const refreshAutoNumbers = async (categoryCode) => {
    setNextBookId(await getNextBookId());
    setNextCategoryNo(await getNextCategoryNo(categoryCode));
  };

  useFocusEffect(
    useCallback(() => {
      refreshAutoNumbers(form.categoryCode);
    }, [form.categoryCode])
  );

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const resetForm = async () => {
    setForm(initialForm);
    await refreshAutoNumbers(initialForm.categoryCode);
  };

  const save = async () => {
    setSaving(true);
    try {
      const cost = form.cost.trim() ? parseFloat(form.cost.replace(/,/g, '')) : null;
      const result = await addBook({
        categoryCode: form.categoryCode,
        categoryType: form.categoryType,
        bookName: form.bookName.trim(),
        authorName: form.authorName.trim(),
        publicationName: form.publicationName.trim(),
        cost,
        barcode: form.barcode.trim(),
      });
      Alert.alert('Book added ✓', `Book ID: ${result.bookId}\nCategory No: ${form.categoryCode}-${result.categoryNo}`);
      await resetForm();
    } catch (e) {
      Alert.alert('Could not save', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (!form.bookName.trim()) {
      Alert.alert('Missing info', 'Please enter the book name.');
      return;
    }
    if (form.cost.trim() && isNaN(parseFloat(form.cost.replace(/,/g, '')))) {
      Alert.alert('Check the cost', 'Cost must be a number, e.g. 350');
      return;
    }
    // Warn about duplicate barcodes (two physical books should never share one).
    const code = form.barcode.trim().toLowerCase();
    if (code) {
      const dup = booksStore.getSnapshot().data.find((b) => b.barcode && String(b.barcode).toLowerCase() === code);
      if (dup) {
        Alert.alert('Barcode already used', `This barcode belongs to "${dup.book_name}" (ID #${dup.book_id}). Save anyway?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save anyway', onPress: save },
        ]);
        return;
      }
    }
    save();
  };

  const handleCategory = async (code) => {
    update('categoryCode', code);
    setNextCategoryNo(await getNextCategoryNo(code));
  };

  const handleImportExcel = async () => {
    try {
      const picked = await pickWorkbook();
      if (!picked) return;
      setImporting(true);
      setProgress('Reading file…');

      const { sheetName, rows: raw } = bestSheetRows(picked.workbook);
      const rows = raw.map((r) => parseLibraryRow(r)).filter((r) => r.bookName);
      if (rows.length === 0) {
        Alert.alert('No rows found', 'Check that your file has a Book Name column with data.');
        return;
      }

      setProgress(`Importing ${rows.length} books…`);
      const { inserted, failed } = await bulkImportLibraryBooks(rows, (done, total) =>
        setProgress(`Saved ${done} of ${total}…`)
      );
      await refreshAutoNumbers(form.categoryCode);
      Alert.alert('Import complete ✓', `Sheet used: ${sheetName}\nImported: ${inserted}\nFailed: ${failed.length}`);
    } catch (e) {
      Alert.alert('Import failed', e.message);
    } finally {
      setImporting(false);
      setProgress('');
    }
  };

  const selectedCat = CATEGORIES.find((c) => c.code === form.categoryCode);

  return (
    <Screen
      title="Add Book"
      subtitle="New books get their numbers automatically"
      icon="add-circle"
      keyboard
      onBack={navigation?.canGoBack?.() ? () => navigation.goBack() : undefined}
    >
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={styles.autoRow}>
          <View style={styles.autoBox}>
            <Text style={styles.autoLabel}>BOOK ID (AUTO)</Text>
            <Text style={styles.autoValue}>{nextBookId ?? '—'}</Text>
          </View>
          <View style={[styles.autoBox, { backgroundColor: selectedCat?.color || COLORS.navyLight }]}>
            <Text style={styles.autoLabel}>CATEGORY NO (AUTO)</Text>
            <Text style={styles.autoValue}>
              {form.categoryCode}-{nextCategoryNo ?? '—'}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Field
            label="Barcode"
            placeholder="Scan or type barcode (optional)"
            value={form.barcode}
            onChangeText={(v) => update('barcode', v)}
            autoCorrect={false}
            style={{ marginTop: 0 }}
            right={
              <TouchableOpacity style={styles.scanBtn} onPress={() => setScannerVisible(true)} accessibilityLabel="Scan barcode">
                <Ionicons name="barcode-outline" size={24} color="#fff" />
              </TouchableOpacity>
            }
          />

          <Text style={styles.groupLabel}>Category</Text>
          <View style={styles.wrapRow}>
            {CATEGORIES.map((c) => (
              <Chip key={c.code} label={`${c.short} (${c.code})`} color={c.color} active={form.categoryCode === c.code} onPress={() => handleCategory(c.code)} />
            ))}
          </View>

          <Text style={styles.groupLabel}>Language</Text>
          <View style={styles.wrapRow}>
            {LANGUAGES.map((l) => (
              <Chip key={l} label={l} active={form.categoryType === l} onPress={() => update('categoryType', l)} />
            ))}
          </View>

          <Field label="Book name *" placeholder="e.g. The Old Man and the Sea" value={form.bookName} onChangeText={(v) => update('bookName', v)} />
          <Field label="Author name" placeholder="e.g. Ernest Hemingway" value={form.authorName} onChangeText={(v) => update('authorName', v)} />
          <Field label="Publication name" placeholder="e.g. Scribner" value={form.publicationName} onChangeText={(v) => update('publicationName', v)} />
          <Field label="Cost (₹)" placeholder="e.g. 350" keyboardType="decimal-pad" value={form.cost} onChangeText={(v) => update('cost', v)} />

          <Button title="Save book" icon="save-outline" variant="accent" onPress={handleSave} loading={saving} style={{ marginTop: 22 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bulk import from Excel</Text>
          <Text style={styles.helper}>
            Choose an .xlsx file with columns: categoryCode, categoryType, bookName, authorName, publicationName, cost, barcode
            (barcode optional). Book ID and Category No are generated automatically. A register that already has stock numbers keeps them.
          </Text>
          <Button
            title={importing ? progress || 'Importing…' : 'Choose Excel file'}
            icon="document-attach-outline"
            variant="outline"
            onPress={handleImportExcel}
            loading={importing}
            style={{ marginTop: 14 }}
          />
          {importing ? <Text style={styles.progress}>{progress}</Text> : null}
        </View>

        <BarcodeScannerModal
          visible={scannerVisible}
          onClose={() => setScannerVisible(false)}
          onScanned={(data) => {
            setScannerVisible(false);
            update('barcode', data);
          }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  autoRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  autoBox: { flex: 1, backgroundColor: COLORS.navy, borderRadius: RADIUS.md, padding: 14, ...SHADOW },
  autoLabel: { ...TYPE.caption, color: 'rgba(255,255,255,0.8)' },
  autoValue: { fontSize: 26, lineHeight: 34, fontWeight: '800', color: '#fff', marginTop: 2 },
  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: 16, marginTop: 14, ...SHADOW },
  cardTitle: { ...TYPE.h3, color: COLORS.navy },
  groupLabel: { ...TYPE.label, color: COLORS.textSecondary, marginTop: 18, marginBottom: 8 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scanBtn: { backgroundColor: COLORS.navy, width: 52, height: 52, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  helper: { ...TYPE.small, color: COLORS.textMuted, marginTop: 6 },
  progress: { ...TYPE.small, color: COLORS.textMuted, textAlign: 'center', marginTop: 10 },
});
