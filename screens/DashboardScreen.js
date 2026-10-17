import React, { useMemo, useState } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { booksStore, membersStore, activeIssuesStore, CATEGORIES } from '../database/db';
import { useStore } from '../database/hooks';
import { dueLabel, daysUntil } from '../utils/dates';
import { COLORS, RADIUS, SHADOW, TYPE, useLayout } from '../utils/theme';
import SyncBadge from '../components/SyncBadge';

const TONE = {
  late: { fg: COLORS.danger, bg: COLORS.dangerBg },
  soon: { fg: COLORS.warn, bg: COLORS.warnBg },
  ok: { fg: COLORS.textMuted, bg: COLORS.surface },
};

export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { contentMax, contentWidth, gutter, isTablet } = useLayout();
  const books = useStore(booksStore);
  const members = useStore(membersStore);
  const issues = useStore(activeIssuesStore);
  const [refreshing, setRefreshing] = useState(false);

  const stats = useMemo(() => {
    const byCat = {};
    let issued = 0;
    books.data.forEach((b) => {
      byCat[b.category_code] = (byCat[b.category_code] || 0) + 1;
      if (b.status === 'issued') issued += 1;
    });
    const total = books.data.length;
    const byCategory = Object.entries(byCat)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);
    return { total, issued, available: total - issued, byCategory };
  }, [books.data]);

  const dueList = useMemo(() => {
    const bookMap = {};
    books.data.forEach((b) => {
      bookMap[b.book_id] = b;
    });
    return issues.data
      .map((i) => ({
        ...i,
        book_name: bookMap[i.book_id]?.book_name || '(deleted book)',
        author_name: bookMap[i.book_id]?.author_name || '',
      }))
      .sort((a, b) => (a.due_date > b.due_date ? 1 : -1));
  }, [issues.data, books.data]);

  const overdueCount = useMemo(() => dueList.filter((i) => (daysUntil(i.due_date) ?? 0) < 0).length, [dueList]);
  const memberName = (id) => members.data.find((m) => m.member_id === id)?.name;

  const onRefresh = () => {
    setRefreshing(true);
    booksStore.refresh();
    membersStore.refresh();
    activeIssuesStore.refresh();
    setTimeout(() => setRefreshing(false), 900);
  };

  const goMore = (screen) => navigation.navigate('More', { screen, initial: false });

  const actions = [
    { icon: 'add-circle', label: 'Add Book', onPress: () => goMore('Add Book') },
    { icon: 'repeat', label: 'Issue / Return', onPress: () => navigation.navigate('Issue/Return') },
    { icon: 'search', label: 'Search', onPress: () => navigation.navigate('Search') },
    { icon: 'library', label: 'Stock', onPress: () => navigation.navigate('Stock') },
    { icon: 'people', label: 'Members', onPress: () => goMore('Members') },
    { icon: 'save', label: 'Backup', onPress: () => goMore('Backup') },
  ];

  const cols = isTablet ? 6 : 3;
  const actionGap = 12;
  const actionW = (contentWidth - gutter * 2 - actionGap * (cols - 1)) / cols;
  const maxCat = Math.max(1, ...stats.byCategory.map((c) => c.count));

  return (
    <View style={styles.root}>
      <View style={[styles.hero, { paddingTop: insets.top + 14 }]}>
        <View style={[styles.heroInner, { maxWidth: contentMax, paddingHorizontal: gutter }]}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.brand}>Brothers Vayanasala</Text>
              <Text style={styles.tagline}>Read · Learn · Grow</Text>
            </View>
            <Image source={require('../assets/logo.png')} style={styles.logo} />
          </View>
          <View style={styles.heroBottom}>
            <SyncBadge />
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.navy]} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, { maxWidth: contentMax, paddingHorizontal: gutter }]}>
          <View style={styles.statsRow}>
            <StatCard label="Total books" value={stats.total} icon="library" color={COLORS.navy} />
            <StatCard label="Issued" value={stats.issued} icon="swap-horizontal" color={COLORS.amberDark} />
            <StatCard label="Available" value={stats.available} icon="checkmark-circle" color={COLORS.success} />
          </View>

          {overdueCount > 0 ? (
            <TouchableOpacity style={styles.alertBox} onPress={() => navigation.navigate('Issue/Return')} activeOpacity={0.85}>
              <Ionicons name="alarm" size={22} color={COLORS.danger} />
              <Text style={styles.alertText}>
                {overdueCount} book{overdueCount === 1 ? ' is' : 's are'} overdue — tap to review
              </Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.danger} />
            </TouchableOpacity>
          ) : null}

          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={[styles.actionsWrap, { gap: actionGap }]}>
            {actions.map((a) => (
              <TouchableOpacity key={a.label} style={[styles.action, { width: actionW }]} onPress={a.onPress} activeOpacity={0.85}>
                <View style={styles.actionIcon}>
                  <Ionicons name={a.icon} size={26} color={COLORS.navy} />
                </View>
                <Text style={styles.actionLabel} numberOfLines={1}>
                  {a.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Books by category</Text>
          <View style={styles.card}>
            {stats.byCategory.length === 0 ? (
              <Text style={styles.empty}>{books.loading ? 'Loading…' : 'No books added yet.'}</Text>
            ) : (
              stats.byCategory.map((c, idx) => {
                const cat = CATEGORIES.find((x) => x.code === c.code);
                return (
                  <View key={c.code} style={[styles.catRow, idx === stats.byCategory.length - 1 && { marginBottom: 0 }]}>
                    <View style={styles.catTop}>
                      <Text style={styles.catLabel} numberOfLines={1}>
                        {cat?.label || c.code}
                      </Text>
                      <Text style={styles.catCount}>{c.count.toLocaleString()}</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${(c.count / maxCat) * 100}%`, backgroundColor: cat?.color || COLORS.navy }]} />
                    </View>
                  </View>
                );
              })
            )}
          </View>

          <Text style={styles.sectionTitle}>Due soon</Text>
          <View style={styles.card}>
            {dueList.length === 0 ? (
              <Text style={styles.empty}>No books are currently issued.</Text>
            ) : (
              dueList.slice(0, 6).map((issue, idx) => {
                const due = dueLabel(issue.due_date);
                const tone = TONE[due.tone];
                const name = memberName(issue.member_id);
                return (
                  <View key={issue.id} style={[styles.dueRow, idx === Math.min(dueList.length, 6) - 1 && { borderBottomWidth: 0 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dueBook}>{issue.book_name}</Text>
                      <Text style={styles.dueMember}>{name ? `${name} · ${issue.member_id}` : `Member ${issue.member_id}`}</Text>
                    </View>
                    <View style={[styles.duePill, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.dueText, { color: tone.fg }]}>{due.text}</Text>
                    </View>
                  </View>
                );
              })
            )}
            {dueList.length > 6 ? (
              <TouchableOpacity onPress={() => navigation.navigate('Issue/Return')} style={styles.seeAll}>
                <Text style={styles.seeAllText}>See all {dueList.length} issued books</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  hero: {
    backgroundColor: COLORS.navy,
    paddingBottom: 56,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroInner: { width: '100%', alignSelf: 'center' },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  heroBottom: { flexDirection: 'row', marginTop: 12 },
  brand: { fontSize: 25, lineHeight: 35, fontWeight: '800', color: '#fff' },
  tagline: { ...TYPE.body, color: '#F5C84B', marginTop: 2 },
  logo: { width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' },
  content: { width: '100%', alignSelf: 'center', marginTop: -36 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: 12,
    ...SHADOW,
  },
  statIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: 26, lineHeight: 34, fontWeight: '800', color: COLORS.text, marginTop: 8 },
  statLabel: { ...TYPE.small, color: COLORS.textMuted },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.dangerBg,
    borderRadius: RADIUS.md,
    padding: 14,
    marginTop: 14,
  },
  alertText: { flex: 1, ...TYPE.bodyStrong, color: COLORS.danger },
  sectionTitle: { ...TYPE.h3, color: COLORS.navy, marginTop: 24, marginBottom: 12 },
  actionsWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  action: {
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: 4,
    ...SHADOW,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: { ...TYPE.smallStrong, color: COLORS.text, textAlign: 'center' },
  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: 16, ...SHADOW },
  empty: { ...TYPE.body, color: COLORS.textMuted },
  catRow: { marginBottom: 14 },
  catTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  catLabel: { ...TYPE.body, color: COLORS.text, flex: 1 },
  catCount: { ...TYPE.bodyStrong, color: COLORS.navy },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: COLORS.surface, marginTop: 6, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dueBook: { ...TYPE.bodyStrong, color: COLORS.text },
  dueMember: { ...TYPE.small, color: COLORS.textMuted },
  duePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, maxWidth: 140 },
  dueText: { ...TYPE.caption, textAlign: 'center' },
  seeAll: { paddingTop: 12, alignItems: 'center' },
  seeAllText: { ...TYPE.smallStrong, color: COLORS.navy },
});
