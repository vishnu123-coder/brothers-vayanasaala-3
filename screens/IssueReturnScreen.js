import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  issueBook,
  returnBook,
  findBookLocal,
  booksStore,
  membersStore,
  activeIssuesStore,
  LOAN_DAYS,
} from '../database/db';
import { useStore } from '../database/hooks';
import { dueLabel, formatDate } from '../utils/dates';
import { norm } from '../utils/search';
import { COLORS, RADIUS, SHADOW, TYPE, useLayout } from '../utils/theme';
import Screen from '../components/Screen';
import Button from '../components/Button';
import Field from '../components/Field';
import BarcodeScannerModal from '../components/BarcodeScannerModal';

const TONE = {
  late: { fg: COLORS.danger, bg: COLORS.dangerBg },
  soon: { fg: COLORS.warn, bg: COLORS.warnBg },
  ok: { fg: COLORS.textMuted, bg: COLORS.surface },
};

export default function IssueReturnScreen() {
  const { gutter } = useLayout();
  const books = useStore(booksStore);
  const members = useStore(membersStore);
  const issues = useStore(activeIssuesStore);

  const [mode, setMode] = useState('issue'); // 'issue' | 'return'
  const [memberId, setMemberId] = useState('');
  const [bookId, setBookId] = useState('');
  const [scanTarget, setScanTarget] = useState(null); // 'book' | 'member' | null
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');

  // Live look-ups so the librarian sees WHAT they are about to issue.
  const book = useMemo(() => (bookId.trim() ? findBookLocal(bookId) : null), [bookId, books.data]);
  const member = useMemo(
    () => (memberId.trim() ? members.data.find((m) => m.member_id === memberId.trim()) : null),
    [memberId, members.data]
  );
  const openIssue = useMemo(
    () => (book ? issues.data.find((i) => i.book_id === book.book_id) : null),
    [book, issues.data]
  );

  const bookMap = useMemo(() => {
    const m = {};
    books.data.forEach((b) => {
      m[b.book_id] = b;
    });
    return m;
  }, [books.data]);
  const memberName = (id) => members.data.find((m) => m.member_id === id)?.name;

  const issuedList = useMemo(() => {
    const q = norm(filter);
    return issues.data
      .map((i) => ({ ...i, book_name: bookMap[i.book_id]?.book_name || '(deleted book)', member_name: memberName(i.member_id) || '' }))
      .filter((i) => !q || norm(`${i.book_name} ${i.member_id} ${i.member_name} ${i.book_id}`).includes(q))
      .sort((a, b) => (a.due_date > b.due_date ? 1 : -1));
  }, [issues.data, bookMap, members.data, filter]);

  const handleScanned = (data) => {
    if (scanTarget === 'book') setBookId(data);
    else setMemberId(data);
    setScanTarget(null);
  };

  const doIssue = async () => {
    setBusy(true);
    try {
      const result = await issueBook({ memberId: memberId.trim(), bookId: bookId.trim() });
      Alert.alert(
        'Book issued ✓',
        `${result.book.book_name}\n\nIssued: ${formatDate(result.issueDate)}\nReturn by: ${formatDate(result.dueDate)}`
      );
      setMemberId('');
      setBookId('');
    } catch (e) {
      Alert.alert('Cannot issue', e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleIssue = () => {
    if (!memberId.trim() || !bookId.trim()) {
      Alert.alert('Missing info', 'Enter both the Member ID and the Book ID / barcode.');
      return;
    }
    if (!members.loading && !member) {
      Alert.alert('Member not registered', `"${memberId.trim()}" is not in the Members list. Issue the book anyway?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Issue anyway', onPress: doIssue },
      ]);
      return;
    }
    doIssue();
  };

  const doReturn = async (idOrBarcode, after) => {
    setBusy(true);
    try {
      const result = await returnBook({ bookId: String(idOrBarcode).trim() });
      Alert.alert('Book returned ✓', `${result.book.book_name}\nReturned on ${formatDate(result.returnDate)}`);
      if (after) after();
    } catch (e) {
      Alert.alert('Cannot return', e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleReturn = () => {
    if (!bookId.trim()) {
      Alert.alert('Missing info', 'Enter the Book ID / barcode to return.');
      return;
    }
    doReturn(bookId, () => setBookId(''));
  };

  const quickReturn = (item) => {
    Alert.alert('Return this book?', `${item.book_name}\nMember: ${item.member_name || item.member_id}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Return', onPress: () => doReturn(item.book_id) },
    ]);
  };

  return (
    <Screen title="Issue / Return" subtitle={`${issues.data.length} book${issues.data.length === 1 ? '' : 's'} currently issued`} icon="repeat" keyboard>
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={styles.toggleRow}>
          {['issue', 'return'].map((m) => (
            <TouchableOpacity key={m} style={[styles.toggleBtn, mode === m && styles.toggleActive]} onPress={() => setMode(m)} activeOpacity={0.85}>
              <Ionicons name={m === 'issue' ? 'arrow-up-circle' : 'arrow-down-circle'} size={20} color={mode === m ? '#fff' : COLORS.textMuted} />
              <Text style={[styles.toggleText, mode === m && { color: '#fff' }]}>{m === 'issue' ? 'Issue' : 'Return'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.formCard}>
          {mode === 'issue' ? (
            <>
              <Field
                label="Member ID"
                placeholder="Scan or type member ID"
                value={memberId}
                onChangeText={setMemberId}
                autoCapitalize="characters"
                autoCorrect={false}
                style={{ marginTop: 0 }}
                right={<ScanButton onPress={() => setScanTarget('member')} />}
              />
              {memberId.trim() ? (
                member ? (
                  <Banner tone="ok" icon="person-circle" text={`${member.name || 'Unnamed member'}${member.phone ? ' · ' + member.phone : ''}`} />
                ) : (
                  <Banner tone="warn" icon="alert-circle" text="Member not found in the Members list" />
                )
              ) : null}
            </>
          ) : null}

          <Field
            label="Book ID / Barcode"
            placeholder="Scan or type book ID"
            value={bookId}
            onChangeText={setBookId}
            autoCapitalize="characters"
            autoCorrect={false}
            style={mode === 'return' ? { marginTop: 0 } : undefined}
            right={<ScanButton onPress={() => setScanTarget('book')} />}
          />

          {bookId.trim() ? (
            book ? (
              <View style={styles.bookPreview}>
                <Text style={styles.previewTitle}>{book.book_name}</Text>
                <Text style={styles.previewMeta}>
                  {book.author_name || 'Unknown author'} · #{book.book_id} · {book.category_code}-{book.category_no}
                </Text>
                {book.status === 'issued' ? (
                  <Text style={[styles.previewStatus, { color: COLORS.danger }]}>
                    Issued to {openIssue ? memberName(openIssue.member_id) || openIssue.member_id : 'a member'}
                    {openIssue ? ` · due ${formatDate(openIssue.due_date)}` : ''}
                  </Text>
                ) : (
                  <Text style={[styles.previewStatus, { color: COLORS.success }]}>Available on the shelf</Text>
                )}
              </View>
            ) : (
              <Banner tone="warn" icon="alert-circle" text="No book found with this ID or barcode" />
            )
          ) : null}

          {mode === 'issue' ? (
            <View style={styles.infoBox}>
              <Ionicons name="calendar-outline" size={18} color={COLORS.navy} />
              <Text style={styles.infoText}>Issue date is today. Return date is set automatically to {LOAN_DAYS} days later.</Text>
            </View>
          ) : null}

          <Button
            title={mode === 'issue' ? 'Issue book' : 'Return book'}
            icon={mode === 'issue' ? 'checkmark-circle-outline' : 'return-down-back'}
            variant={mode === 'issue' ? 'accent' : 'primary'}
            onPress={mode === 'issue' ? handleIssue : handleReturn}
            loading={busy}
            style={{ marginTop: 18 }}
          />
        </View>

        <Text style={styles.sectionTitle}>Currently issued ({issues.data.length})</Text>

        {issues.data.length > 0 ? (
          <View style={styles.filterBox}>
            <Ionicons name="search" size={18} color={COLORS.textMuted} />
            <TextInput
              style={styles.filterInput}
              placeholder="Filter by book or member"
              placeholderTextColor={COLORS.placeholder}
              value={filter}
              onChangeText={setFilter}
              autoCorrect={false}
            />
            {filter ? (
              <TouchableOpacity onPress={() => setFilter('')}>
                <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {issuedList.length === 0 ? (
          <Text style={styles.empty}>{issues.data.length === 0 ? 'No books are currently issued.' : 'No issued books match your filter.'}</Text>
        ) : (
          issuedList.map((item) => {
            const due = dueLabel(item.due_date);
            const tone = TONE[due.tone];
            return (
              <View key={item.id} style={styles.issueCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.issueBook}>{item.book_name}</Text>
                  <Text style={styles.issueMeta}>
                    {item.member_name ? `${item.member_name} · ` : ''}
                    {item.member_id}
                  </Text>
                  <Text style={styles.issueMeta}>Issued {formatDate(item.issue_date)}</Text>
                  <View style={[styles.duePill, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.dueText, { color: tone.fg }]}>{due.text}</Text>
                  </View>
                </View>
                <Button title="Return" small variant="soft" icon="return-down-back" onPress={() => quickReturn(item)} />
              </View>
            );
          })
        )}
      </ScrollView>

      <BarcodeScannerModal visible={!!scanTarget} onClose={() => setScanTarget(null)} onScanned={handleScanned} />
    </Screen>
  );
}

function ScanButton({ onPress }) {
  return (
    <TouchableOpacity style={styles.scanBtn} onPress={onPress} accessibilityLabel="Scan barcode">
      <Ionicons name="barcode-outline" size={24} color="#fff" />
    </TouchableOpacity>
  );
}

function Banner({ tone, icon, text }) {
  const ok = tone === 'ok';
  return (
    <View style={[styles.banner, { backgroundColor: ok ? COLORS.successBg : COLORS.warnBg }]}>
      <Ionicons name={icon} size={20} color={ok ? COLORS.success : COLORS.warn} />
      <Text style={[styles.bannerText, { color: ok ? COLORS.success : COLORS.warn }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 4, marginTop: 4 },
  toggleBtn: { flex: 1, flexDirection: 'row', gap: 8, minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: RADIUS.sm },
  toggleActive: { backgroundColor: COLORS.navy },
  toggleText: { ...TYPE.bodyStrong, color: COLORS.textMuted },
  formCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: 16, marginTop: 14, ...SHADOW },
  scanBtn: { backgroundColor: COLORS.navy, width: 52, height: 52, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: RADIUS.sm, marginTop: 10 },
  bannerText: { flex: 1, ...TYPE.smallStrong },
  bookPreview: { backgroundColor: COLORS.bg, borderRadius: RADIUS.sm, padding: 12, marginTop: 10 },
  previewTitle: { ...TYPE.h3, color: COLORS.text },
  previewMeta: { ...TYPE.small, color: COLORS.textMuted, marginTop: 2 },
  previewStatus: { ...TYPE.smallStrong, marginTop: 6 },
  infoBox: { flexDirection: 'row', gap: 10, backgroundColor: COLORS.infoBg, padding: 12, borderRadius: RADIUS.sm, marginTop: 14, alignItems: 'flex-start' },
  infoText: { flex: 1, ...TYPE.small, color: COLORS.navy },
  sectionTitle: { ...TYPE.h3, color: COLORS.navy, marginTop: 26, marginBottom: 12 },
  filterBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    minHeight: 48,
    marginBottom: 12,
  },
  filterInput: { flex: 1, fontSize: 15, lineHeight: 22, color: COLORS.text, paddingVertical: 8 },
  empty: { ...TYPE.body, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 20 },
  issueCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.card, padding: 14, borderRadius: RADIUS.md, marginBottom: 10, ...SHADOW },
  issueBook: { ...TYPE.bodyStrong, color: COLORS.text },
  issueMeta: { ...TYPE.small, color: COLORS.textMuted },
  duePill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 8 },
  dueText: { ...TYPE.caption },
});
