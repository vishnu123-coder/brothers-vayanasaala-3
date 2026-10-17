import React, { useDeferredValue, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, ScrollView, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { addMember, bulkImportMembers, deleteMember, membersStore, activeIssuesStore } from '../database/db';
import { useStore } from '../database/hooks';
import { filterMembers } from '../utils/search';
import { pickWorkbook, bestSheetRows } from '../utils/excelPicker';
import { COLORS, RADIUS, SHADOW, TYPE, useLayout } from '../utils/theme';
import Screen from '../components/Screen';
import Button from '../components/Button';
import Field from '../components/Field';
import EmptyState from '../components/EmptyState';

const initialForm = { memberId: '', name: '', phone: '', address: '' };

function normalizeMemberRow(row) {
  const get = (keys) => {
    for (const k of Object.keys(row)) {
      const norm = k.toLowerCase().replace(/[\s_./-]/g, '');
      if (keys.includes(norm)) return row[k];
    }
    return '';
  };
  return {
    memberId: String(get(['memberid', 'id', 'membershipid'])).trim(),
    name: String(get(['name', 'membername'])).trim(),
    phone: String(get(['phone', 'phonenumber', 'mobile', 'contact'])).trim(),
    address: String(get(['address'])).trim(),
  };
}

export default function MembersScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { gutter } = useLayout();
  const members = useStore(membersStore);
  const issues = useStore(activeIssuesStore);

  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const list = useMemo(() => filterMembers(members.data, deferred), [members.data, deferred]);
  const issuedByMember = useMemo(() => {
    const m = {};
    issues.data.forEach((i) => {
      m[i.member_id] = (m[i.member_id] || 0) + 1;
    });
    return m;
  }, [issues.data]);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.memberId.trim()) {
      Alert.alert('Missing info', 'Please enter a Member ID.');
      return;
    }
    setSaving(true);
    try {
      await addMember({
        memberId: form.memberId.trim(),
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
      });
      Alert.alert('Member added ✓', `${form.name.trim() || form.memberId.trim()} has been saved.`);
      setForm(initialForm);
      setFormOpen(false);
    } catch (e) {
      Alert.alert(e.code === 'member-exists' ? 'Already exists' : 'Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async () => {
    try {
      const picked = await pickWorkbook();
      if (!picked) return;
      setImporting(true);
      const { sheetName, rows: raw } = bestSheetRows(picked.workbook);
      const rows = raw.map(normalizeMemberRow).filter((r) => r.memberId);
      if (rows.length === 0) {
        Alert.alert('No members found', 'The file needs a "Member ID" column with data.');
        return;
      }
      const { inserted, failed } = await bulkImportMembers(rows);
      Alert.alert('Import complete', `Sheet: ${sheetName}\nAdded / updated: ${inserted}\nFailed: ${failed.length}`);
    } catch (e) {
      Alert.alert('Import failed', e.message);
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = (item) => {
    Alert.alert('Delete this member?', `${item.name || item.member_id} will be permanently removed. This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMember(item.member_id);
          } catch (e) {
            Alert.alert('Cannot delete', e.message);
          }
        },
      },
    ]);
  };

  const callPhone = (phone) => {
    Linking.openURL(`tel:${String(phone).replace(/\s/g, '')}`).catch(() => {});
  };

  const renderItem = ({ item }) => {
    const issuedCount = issuedByMember[item.member_id] || 0;
    return (
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{String(item.name || item.member_id || '?').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.name || '(no name)'}</Text>
          <Text style={styles.meta}>ID: {item.member_id}</Text>
          {item.phone ? (
            <TouchableOpacity onPress={() => callPhone(item.phone)} style={styles.metaRow}>
              <Ionicons name="call-outline" size={15} color={COLORS.navy} />
              <Text style={[styles.meta, { color: COLORS.navy, fontWeight: '700' }]}>{item.phone}</Text>
            </TouchableOpacity>
          ) : null}
          {item.address ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={15} color={COLORS.textMuted} />
              <Text style={[styles.meta, { flex: 1 }]}>{item.address}</Text>
            </View>
          ) : null}
          {issuedCount > 0 ? (
            <View style={styles.issuedPill}>
              <Text style={styles.issuedText}>
                {issuedCount} book{issuedCount === 1 ? '' : 's'} issued
              </Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)} accessibilityLabel="Delete member">
          <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
        </TouchableOpacity>
      </View>
    );
  };

  const header = (
    <View style={styles.searchBox}>
      <Ionicons name="search" size={20} color={COLORS.textMuted} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search by name, ID or phone"
        placeholderTextColor={COLORS.placeholder}
        selectionColor={COLORS.navy}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
      />
      {query ? (
        <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close-circle" size={22} color={COLORS.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <Screen
      title="Members"
      subtitle={`${members.data.length} registered`}
      icon="people"
      onBack={navigation?.canGoBack?.() ? () => navigation.goBack() : undefined}
    >
      <FlatList
        data={list}
        keyExtractor={(item) => String(item.member_id)}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title={members.data.length === 0 ? 'No members yet' : 'No members match'}
            message={members.data.length === 0 ? 'Add a member, or import a list from Excel.' : 'Try a different name, ID or phone number.'}
            actionLabel={members.data.length === 0 ? 'Add member' : undefined}
            onAction={() => setFormOpen(true)}
          />
        }
        contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 4, paddingBottom: 110 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={12}
        windowSize={9}
      />

      <View style={[styles.fabRow, { paddingBottom: 14 }]} pointerEvents="box-none">
        <TouchableOpacity style={styles.fabSecondary} onPress={handleImport} disabled={importing} activeOpacity={0.9}>
          <Ionicons name="document-attach-outline" size={20} color={COLORS.navy} />
          <Text style={styles.fabSecondaryText}>{importing ? 'Importing…' : 'Import .xlsx'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fab} onPress={() => setFormOpen(true)} activeOpacity={0.9}>
          <Ionicons name="person-add" size={20} color="#fff" />
          <Text style={styles.fabText}>Add member</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={formOpen} animationType="slide" transparent onRequestClose={() => setFormOpen(false)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setFormOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Add member</Text>
              <TouchableOpacity onPress={() => setFormOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={26} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Field label="Member ID *" placeholder="e.g. BV-M-045" value={form.memberId} onChangeText={(v) => update('memberId', v)} autoCapitalize="characters" autoCorrect={false} style={{ marginTop: 4 }} />
              <Field label="Name" placeholder="Full name" value={form.name} onChangeText={(v) => update('name', v)} />
              <Field label="Phone number" placeholder="e.g. 9446726726" keyboardType="phone-pad" value={form.phone} onChangeText={(v) => update('phone', v)} />
              <Field label="Address" placeholder="House name, place" multiline value={form.address} onChangeText={(v) => update('address', v)} />
              <Button title="Save member" icon="checkmark-circle-outline" onPress={handleSave} loading={saving} style={{ marginTop: 20 }} />
              <Text style={styles.helper}>Have a list already? Close this and tap "Import .xlsx" (columns: memberId, name, phone, address). Existing IDs are updated, new ones added.</Text>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    minHeight: 54,
    marginBottom: 12,
    ...SHADOW,
  },
  searchInput: { flex: 1, fontSize: 16, lineHeight: 23, color: COLORS.text, paddingVertical: 10 },
  card: { flexDirection: 'row', gap: 12, backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: 14, marginBottom: 10, alignItems: 'flex-start', ...SHADOW },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.amber, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 20, lineHeight: 28, fontWeight: '800', color: COLORS.navy },
  name: { ...TYPE.h3, color: COLORS.text },
  meta: { ...TYPE.small, color: COLORS.textMuted, marginTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  issuedPill: { alignSelf: 'flex-start', backgroundColor: COLORS.warnBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 8 },
  issuedText: { ...TYPE.caption, color: COLORS.warn },
  deleteBtn: { padding: 8 },
  fabRow: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'center', gap: 10, paddingHorizontal: 16 },
  fab: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.navy, paddingHorizontal: 20, minHeight: 52, borderRadius: 999, ...SHADOW },
  fabText: { ...TYPE.bodyStrong, color: '#fff' },
  fabSecondary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1.5, borderColor: COLORS.navy, paddingHorizontal: 18, minHeight: 52, borderRadius: 999, ...SHADOW },
  fabSecondaryText: { ...TYPE.bodyStrong, color: COLORS.navy },
  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,16,32,0.55)' },
  sheet: { backgroundColor: COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 16, maxHeight: '90%' },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sheetTitle: { ...TYPE.h2, color: COLORS.navy },
  helper: { ...TYPE.small, color: COLORS.textMuted, marginTop: 14, marginBottom: 6 },
});
