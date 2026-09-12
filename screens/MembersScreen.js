import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { addMember, searchMembers, bulkImportMembers } from '../database/db';
import ScreenHeader from '../utils/ScreenHeader';
import { COLORS, SPACING, RADIUS } from '../utils/theme';

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

export default function MembersScreen() {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState([]);

  const load = async (q = '') => {
    const rows = await searchMembers(q);
    setMembers(rows);
  };

  useFocusEffect(
    useCallback(() => {
      load(query);
    }, [])
  );

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const onSearchChange = (v) => {
    setQuery(v);
    load(v);
  };

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
      Alert.alert('Member Added', `${form.name || form.memberId} has been saved.`);
      setForm(initialForm);
      load(query);
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) {
        Alert.alert('Already exists', 'A member with this Member ID already exists.');
      } else {
        Alert.alert('Error', e.message);
      }
    } finally {
      setSaving(false);
    }
  };

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

      let bestSheet = workbook.SheetNames[0];
      let bestRows = [];
      for (const name of workbook.SheetNames) {
        const r = XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: '' });
        if (r.length > bestRows.length) {
          bestRows = r;
          bestSheet = name;
        }
      }

      const rows = bestRows.map((r) => normalizeMemberRow(r)).filter((r) => r.memberId);

      if (rows.length === 0) {
        Alert.alert('No rows found', 'Check that the file has a Member ID column with data.');
        setImporting(false);
        return;
      }

      const { inserted, failed } = await bulkImportMembers(rows);
      Alert.alert(
        'Import Complete',
        `Sheet used: ${bestSheet}\nInserted/Updated: ${inserted}\nFailed: ${failed.length}`
      );
      load(query);
    } catch (e) {
      Alert.alert('Import failed', e.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title="Members" subtitle={`${members.length} registered`} icon="people" />
      <FlatList
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 60 }}
        data={members}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <>
            <Text style={styles.header}>Add Member</Text>

            <Text style={styles.label}>Member ID</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. BV-M-045"
              value={form.memberId}
              onChangeText={(v) => update('memberId', v)}
            />

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Full name"
              value={form.name}
              onChangeText={(v) => update('name', v)}
            />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 9446726726"
              keyboardType="phone-pad"
              value={form.phone}
              onChangeText={(v) => update('phone', v)}
            />

            <Text style={styles.label}>Address</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="House name, place"
              multiline
              value={form.address}
              onChangeText={(v) => update('address', v)}
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="person-add-outline" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>Save Member</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.helperText}>
              Or upload a .xlsx file with columns: memberId, name, phone, address — existing
              Member IDs are updated, new ones are added.
            </Text>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: COLORS.amberDark }]}
              onPress={handleImportExcel}
              disabled={importing}
            >
              {importing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="document-attach-outline" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>Import Members (.xlsx)</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.divider} />

            <Text style={styles.header}>All Members ({members.length})</Text>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={COLORS.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by ID, name, or phone"
                value={query}
                onChangeText={onSearchChange}
              />
            </View>
          </>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No members added yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.memberCard}>
            <View style={styles.memberAvatar}>
              <Text style={styles.memberAvatarText}>
                {(item.name || item.member_id || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{item.name || '(no name)'}</Text>
              <Text style={styles.memberMeta}>ID: {item.member_id}</Text>
              {item.phone ? <Text style={styles.memberMeta}>📞 {item.phone}</Text> : null}
              {item.address ? <Text style={styles.memberMeta}>📍 {item.address}</Text> : null}
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: SPACING.md },
  header: { fontSize: 20, fontWeight: '800', color: COLORS.navy, marginTop: SPACING.md, marginBottom: SPACING.md },
  label: { fontSize: 13, color: COLORS.textMuted, marginBottom: 4, marginTop: SPACING.sm },
  helperText: { fontSize: 11, color: COLORS.textMuted, marginTop: SPACING.sm, marginBottom: SPACING.xs, lineHeight: 16 },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    fontSize: 15,
  },
  saveBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.navy,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.xl },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14 },
  emptyText: { color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.lg },
  memberCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    alignItems: 'center',
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.amber,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: { fontSize: 18, fontWeight: '800', color: COLORS.navy },
  memberName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  memberMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
});
