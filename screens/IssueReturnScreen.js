import React, { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  FlatList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { issueBook, returnBook, getActiveIssues } from '../database/db';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import { COLORS, SPACING, RADIUS } from '../utils/theme';

export default function IssueReturnScreen({ navigation }) {
  const [mode, setMode] = useState('issue'); // 'issue' | 'return'
  const [memberId, setMemberId] = useState('');
  const [bookId, setBookId] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanTarget, setScanTarget] = useState('book'); // 'book' | 'member'
  const [activeIssues, setActiveIssues] = useState([]);

  const load = async () => {
    const rows = await getActiveIssues();
    setActiveIssues(rows);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const openScanner = (target) => {
    setScanTarget(target);
    setScannerVisible(true);
  };

  const handleScanned = (data) => {
    setScannerVisible(false);
    if (scanTarget === 'book') setBookId(data);
    else setMemberId(data);
  };

  const handleIssue = async () => {
    if (!memberId.trim() || !bookId.trim()) {
      Alert.alert('Missing info', 'Enter both Member ID and Book ID / barcode.');
      return;
    }
    try {
      const result = await issueBook({ memberId: memberId.trim(), bookId: bookId.trim() });
      Alert.alert(
        'Book Issued',
        `Book: ${result.book.book_name}\nIssue Date: ${result.issueDate}\nReturn Due: ${result.dueDate}`
      );
      setMemberId('');
      setBookId('');
      load();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const handleReturn = async () => {
    if (!bookId.trim()) {
      Alert.alert('Missing info', 'Enter the Book ID / barcode to return.');
      return;
    }
    try {
      const result = await returnBook({ bookId: bookId.trim() });
      Alert.alert('Book Returned', `${result.book.book_name} returned on ${result.returnDate}`);
      setBookId('');
      load();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}><Text style={styles.header}>Book Issue / Return</Text></View>
        <TouchableOpacity style={styles.memberBtn} onPress={() => navigation.navigate('Members')}>
          <Ionicons name="person-add-outline" size={17} color={COLORS.navy} />
          <Text style={styles.memberBtnText}>Member</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'issue' && styles.toggleBtnActive]}
          onPress={() => setMode('issue')}
        >
          <Text style={[styles.toggleText, mode === 'issue' && styles.toggleTextActive]}>
            Issue
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'return' && styles.toggleBtnActive]}
          onPress={() => setMode('return')}
        >
          <Text style={[styles.toggleText, mode === 'return' && styles.toggleTextActive]}>
            Return
          </Text>
        </TouchableOpacity>
      </View>

      {mode === 'issue' && (
        <>
          <Text style={styles.label}>Member ID</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Scan or enter member ID"
              value={memberId}
              onChangeText={setMemberId}
            />
            <TouchableOpacity style={styles.scanBtn} onPress={() => openScanner('member')}>
              <Ionicons name="barcode-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </>
      )}

      <Text style={styles.label}>Book ID / Barcode</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Scan or enter book ID"
          value={bookId}
          onChangeText={setBookId}
        />
        <TouchableOpacity style={styles.scanBtn} onPress={() => openScanner('book')}>
          <Ionicons name="barcode-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {mode === 'issue' ? (
        <View style={styles.infoBox}>
          <Ionicons name="calendar-outline" size={16} color={COLORS.navy} />
          <Text style={styles.infoText}>
            Issue date will be set to today. Return due date auto-calculates as issue date + 15 days.
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: mode === 'issue' ? COLORS.amberDark : COLORS.navy }]}
        onPress={mode === 'issue' ? handleIssue : handleReturn}
      >
        <Text style={styles.actionBtnText}>
          {mode === 'issue' ? 'Issue Book' : 'Return Book'}
        </Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      <Text style={styles.header}>Currently Issued ({activeIssues.length})</Text>
      <FlatList
        data={activeIssues}
        keyExtractor={(item) => String(item.id)}
        scrollEnabled={false}
        ListEmptyComponent={<Text style={styles.emptyText}>No books currently issued.</Text>}
        renderItem={({ item }) => (
          <View style={styles.issueCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.issueBook}>{item.book_name}</Text>
              <Text style={styles.issueMeta}>
                Member: {item.member_id} · Issued: {item.issue_date}
              </Text>
            </View>
            <Text style={styles.dueDate}>Due {item.due_date}</Text>
          </View>
        )}
      />

      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={handleScanned}
      />
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: SPACING.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  header: { fontSize: 20, fontWeight: '800', color: COLORS.navy },
  memberBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.card, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 18, marginLeft: 8 },
  memberBtnText: { fontSize: 11, color: COLORS.navy, fontWeight: '700' },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    padding: 4,
    marginBottom: SPACING.md,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: RADIUS.sm - 2 },
  toggleBtnActive: { backgroundColor: COLORS.navy },
  toggleText: { color: COLORS.textMuted, fontWeight: '600' },
  toggleTextActive: { color: '#fff' },
  label: { fontSize: 13, color: COLORS.textMuted, marginBottom: 4, marginTop: SPACING.sm },
  row: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    fontSize: 15,
  },
  scanBtn: { backgroundColor: COLORS.navy, padding: 14, borderRadius: RADIUS.sm },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#EAF1FB',
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.md,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 12, color: COLORS.navy },
  actionBtn: {
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.xl },
  emptyText: { color: COLORS.textMuted, fontSize: 13 },
  issueCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  issueBook: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  issueMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 2, lineHeight: 16 },
  dueDate: { fontSize: 11, color: COLORS.amberDark, fontWeight: '700', marginLeft: 8 },
});
