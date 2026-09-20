import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { searchBooks, deleteBook, CATEGORIES } from '../database/db';
import { COLORS, SPACING, RADIUS } from '../utils/theme';
import ScreenHeader from '../utils/ScreenHeader';

function categoryColor(code) {
  return CATEGORIES.find((c) => c.code === code)?.color || COLORS.navy;
}

export default function StockViewScreen() {
  const [books, setBooks] = useState([]);
  const [totalShown, setTotalShown] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [status, setStatus] = useState('');
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [cappedSearch, setCappedSearch] = useState(false);

  // Fresh load — replaces the list (used on open, refresh, or when a
  // filter/search term changes).
  const load = async (q = query, cat = categoryCode, st = status) => {
    const res = await searchBooks({ query: q, categoryCode: cat || null, status: st || null });
    setBooks(res.results);
    setCursor(res.nextCursor);
    setHasMore(res.hasMore);
    setCappedSearch(res.cappedSearch);
    setTotalShown(res.results.length);
  };

  // Loads the next page and appends it — only fetches what's actually about
  // to be shown, not the whole collection.
  const loadMore = async () => {
    if (!hasMore || loadingMore || query) return;
    setLoadingMore(true);
    try {
      const res = await searchBooks({
        query,
        categoryCode: categoryCode || null,
        status: status || null,
        cursor,
      });
      setBooks((prev) => [...prev, ...res.results]);
      setCursor(res.nextCursor);
      setHasMore(res.hasMore);
      setTotalShown((prev) => prev + res.results.length);
    } finally {
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onQueryChange = (v) => {
    setQuery(v);
    load(v, categoryCode, status);
  };

  const onCategoryPress = (code) => {
    const next = categoryCode === code ? '' : code;
    setCategoryCode(next);
    load(query, next, status);
  };

  const onStatusPress = (st) => {
    const next = status === st ? '' : st;
    setStatus(next);
    load(query, categoryCode, next);
  };

  const handleDelete = (item) => {
    Alert.alert(
      'Delete this book?',
      `"${item.book_name}" (ID #${item.book_id}) will be permanently removed for everyone. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBook(item.book_id);
              load();
            } catch (e) {
              Alert.alert('Cannot delete', e.message);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader
        title="Total Stock"
        subtitle={
          cappedSearch
            ? `Showing matches in the most recent 500 books`
            : `${totalShown} book${totalShown === 1 ? '' : 's'} shown${hasMore ? ' — scroll for more' : ''}`
        }
        icon="library"
      />
      <View style={styles.container}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search stock..."
            placeholderTextColor={COLORS.textMuted}
            value={query}
            onChangeText={onQueryChange}
          />
          {query ? (
            <TouchableOpacity onPress={() => onQueryChange('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.sectionLabel}>Category</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRow}
          contentContainerStyle={{ gap: 8, paddingRight: 12 }}
        >
          <Chip label="All" active={categoryCode === ''} onPress={() => onCategoryPress('')} />
          {CATEGORIES.map((c) => (
            <Chip
              key={c.code}
              label={c.short}
              active={categoryCode === c.code}
              color={c.color}
              onPress={() => onCategoryPress(c.code)}
            />
          ))}
        </ScrollView>

        <Text style={styles.sectionLabel}>Status</Text>
        <View style={styles.statusRow}>
          <Chip
            label="Available"
            icon="checkmark-circle"
            active={status === 'available'}
            color={COLORS.success}
            onPress={() => onStatusPress('available')}
          />
          <Chip
            label="Issued"
            icon="swap-horizontal"
            active={status === 'issued'}
            color={COLORS.danger}
            onPress={() => onStatusPress('issued')}
          />
        </View>

        <FlatList
          data={books}
          keyExtractor={(item) => String(item.book_id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 40, paddingTop: SPACING.sm }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: SPACING.md, alignItems: 'center' }}>
                <Text style={styles.emptyText}>Loading more…</Text>
              </View>
            ) : hasMore && !query ? (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore}>
                <Text style={styles.loadMoreText}>Load more books</Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="file-tray-outline" size={40} color={COLORS.border} />
              <Text style={styles.emptyText}>No books match this filter.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={[styles.stripe, { backgroundColor: categoryColor(item.category_code) }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <View style={[styles.idBadge, { backgroundColor: categoryColor(item.category_code) + '1A' }]}>
                    <Text style={[styles.idBadgeText, { color: categoryColor(item.category_code) }]}>
                      #{item.book_id}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bookName} numberOfLines={2}>{item.book_name}</Text>
                    {item.author_name ? (
                      <Text style={styles.author} numberOfLines={1}>{item.author_name}</Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: item.status === 'issued' ? '#FDECEC' : '#E8F7EE' },
                    ]}
                  >
                    <Text
                      style={{
                        color: item.status === 'issued' ? COLORS.danger : COLORS.success,
                        fontSize: 10,
                        fontWeight: '700',
                        textTransform: 'uppercase',
                      }}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.metaGrid}>
                  <MetaItem label="Category" value={`${item.category_code}-${item.category_no}`} />
                  <MetaItem label="Language" value={item.category_type || '—'} />
                  <MetaItem label="Publisher" value={item.publication_name || '—'} />
                  <MetaItem label="Cost" value={item.cost ? `₹${item.cost}` : '—'} />
                </View>

                <TouchableOpacity style={styles.deleteRow} onPress={() => handleDelete(item)}>
                  <Ionicons name="trash-outline" size={14} color={COLORS.danger} />
                  <Text style={styles.deleteRowText}>Delete this book</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

function MetaItem({ label, value }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function Chip({ label, active, onPress, color, icon }) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        active && { backgroundColor: color || COLORS.navy, borderColor: color || COLORS.navy },
      ]}
      onPress={onPress}
    >
      {icon ? (
        <Ionicons name={icon} size={13} color={active ? '#fff' : COLORS.textMuted} style={{ marginRight: 4 }} />
      ) : null}
      <Text style={[styles.chipText, active && { color: '#fff' }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: SPACING.md },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: COLORS.text },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  chipRow: { marginBottom: SPACING.sm, flexGrow: 0 },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: SPACING.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  chipText: { fontSize: 13, fontWeight: '700', color: COLORS.text, letterSpacing: 0.2 },
  emptyWrap: { alignItems: 'center', marginTop: SPACING.xl * 2, gap: 8 },
  emptyText: { color: COLORS.textMuted, fontSize: 13 },
  loadMoreBtn: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    alignSelf: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  loadMoreText: { color: COLORS.navy, fontWeight: '700', fontSize: 13 },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  stripe: { width: 5 },
  cardBody: { flex: 1, padding: SPACING.md },
  cardTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  idBadge: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
    minWidth: 48,
    alignItems: 'center',
  },
  idBadgeText: { fontWeight: '800', fontSize: 12 },
  bookName: { fontSize: 14, fontWeight: '700', color: COLORS.text, lineHeight: 19 },
  author: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem: { width: '46%' },
  metaLabel: { fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  metaValue: { fontSize: 12.5, color: COLORS.text, fontWeight: '600', marginTop: 1 },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignSelf: 'flex-start',
  },
  deleteRowText: { fontSize: 11.5, color: COLORS.danger, fontWeight: '600' },
});
