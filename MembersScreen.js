import React, { useCallback, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { addMember, getAllMembers } from '../database/db';
import { COLORS, SPACING, RADIUS } from '../utils/theme';

const EMPTY = { memberId: '', name: '', phone: '', address: '' };

export default function MembersScreen({ navigation }) {
  const [form, setForm] = useState(EMPTY);
  const [members, setMembers] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setMembers(await getAllMembers());
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.memberId.trim() || !form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      Alert.alert('Missing information', 'Please enter Member ID, Name, Phone number and Address.');
      return;
    }
    setSaving(true);
    try {
      await addMember(form);
      Alert.alert('Member Added', `${form.name.trim()} has been registered.`);
      setForm(EMPTY);
      await load();
    } catch (e) {
      Alert.alert('Could not add member', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.header}>Members</Text>
            <Text style={styles.subHeader}>Register library members before issuing books.</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.navy} />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add New Member</Text>
          <Field label="Member ID" value={form.memberId} onChangeText={(v) => update('memberId', v)} placeholder="e.g. M001" />
          <Field label="Name" value={form.name} onChangeText={(v) => update('name', v)} placeholder="Full name" />
          <Field label="Phone number" value={form.phone} onChangeText={(v) => update('phone', v)} placeholder="10-digit phone number" keyboardType="phone-pad" />
          <Field label="Address" value={form.address} onChangeText={(v) => update('address', v)} placeholder="House name, place, etc." multiline />

          <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <><Ionicons name="person-add-outline" size={18} color="#fff" /><Text style={styles.saveText}>Add Member</Text></>}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Registered Members ({members.length})</Text>
        {members.length === 0 ? (
          <View style={styles.emptyCard}><Text style={styles.empty}>No members registered yet.</Text></View>
        ) : members.map((m) => (
          <View style={styles.memberCard} key={m.member_id}>
            <View style={styles.avatar}><Ionicons name="person" size={20} color={COLORS.navy} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{m.name}</Text>
              <Text style={styles.meta}>ID: {m.member_id} · {m.phone}</Text>
              <Text style={styles.address}>{m.address || 'No address'}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, multiline, ...props }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={[styles.input, multiline && styles.multiline]} multiline={multiline} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.md, paddingBottom: 50 },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  header: { fontSize: 22, fontWeight: '800', color: COLORS.navy },
  subHeader: { fontSize: 12, color: COLORS.textMuted, marginTop: 3, lineHeight: 17 },
  closeBtn: { padding: 10, borderRadius: 22, backgroundColor: COLORS.card, marginLeft: 8 },
  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, elevation: 1, marginBottom: SPACING.lg },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  label: { fontSize: 12, color: COLORS.textMuted, marginTop: 10, marginBottom: 4 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: COLORS.text },
  multiline: { minHeight: 78, textAlignVertical: 'top' },
  saveBtn: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.amberDark, borderRadius: RADIUS.sm, padding: 13, marginTop: SPACING.md },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.navy, marginBottom: SPACING.sm },
  emptyCard: { backgroundColor: COLORS.card, padding: SPACING.md, borderRadius: RADIUS.md },
  empty: { color: COLORS.textMuted, fontSize: 13 },
  memberCard: { flexDirection: 'row', gap: 12, backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, elevation: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EAF1FB', justifyContent: 'center', alignItems: 'center' },
  memberName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  meta: { fontSize: 11, color: COLORS.textMuted, marginTop: 3 },
  address: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
});
