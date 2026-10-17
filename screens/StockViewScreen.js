import React, { useDeferredValue, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { booksStore, deleteBook, CATEGORIES } from '../database/db';
import { useStore } from '../database/hooks';
import { filterBooks, SORTS } from '../utils/search';
import { COLORS, RADIUS, TYPE, SHADOW, useLayout } from '../utils/theme';
import Screen from '../components/Screen';
import Chip from '../components/Chip';
import BookCard from '../components/BookCard';
import EmptyState from '../components/EmptyState';

export default function StockViewScreen({ navigation }) {
  const { gutter } = useLayout();
  const store = useStore(booksStore);
  const [query, setQuery] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('newest');
  const [refreshing, setRefreshing] = useState(false);

  const deferredQuery = useDeferredValue(query);
  const books = store.data;

  const results = useMemo(
    () => filterBooks(books, { query: deferredQuery, categoryCode, status, sort }),
    [books, deferredQuery, categoryCode, status, sort]
  );

  const counts = useMemo(() => {
    let issued = 0;
    results.forEach((b) => {
      if (b.status === 'issued') issued += 1;
    });
    return { total: results.length, issued, available: results.length - issued };
  }, [results]);

  const onRefresh = () => {
    setRefreshing(true);
    booksStore.refresh();
    setTimeout(() => setRefreshing(false), 800);
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
            } catch (e) {
              Alert.alert('Cannot delete', e.message);
            }
          },
        },
      ]
    );
  };

  const header = (
    <View>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Filter this list…"
          placeholderTextColor={COLORS.placeholder}
          selectionColor={COLORS.navy}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={22} color={COLORS.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.summary}>
        <SummaryItem label="Shown" value={counts.total} color={COLORS.navy} />
        <SummaryItem label="Available" value={counts.available} color={COLORS.success} />
        <SummaryItem label="Issued" value={counts.issued} color={COLORS.danger} />
      </View>

      <Text style={styles.sectionLabel}>CATEGORY</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipContent} keyboardShouldPersistTaps="handled">
        <Chip label="All" active={categoryCode === ''} onPress={() => setCategoryCode('')} />
        {CATEGORIES.map((c) => (
          <Chip key={c.code} label={c.short} color={c.color} active={categoryCode === c.code} onPress={() => setCategoryCode(categoryCode === c.code ? '' : c.code)} />
        ))}
      </ScrollView>

      <Text style={styles.sectionLabel}>STATUS</Text>
      <View style={styles.wrapRow}>
        <Chip label="Available" icon="checkmark-circle" color={COLORS.success} active={status === 'available'} onPress={() => setStatus(status === 'available' ? '' : 'available')} />
        <Chip label="Issued" icon="swap-horizontal" color={COLORS.danger} active={status === 'issued'} onPress={() => setStatus(status === 'issued' ? '' : 'issued')} />
      </View>

      <Text style={styles.sectionLabel}>SORT BY</Text>
      <View style={[styles.wrapRow, { marginBottom: 12 }]}>
        {SORTS.map((s) => (
          <Chip key={s.key} label={s.label} active={sort === s.key} onPress={() => setSort(s.key)} />
        ))}
      </View>
    </View>
  );

  const listEmpty = () => {
    if (store.loading) {
      return (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={COLORS.navy} />
          <Text style={styles.loadingText}>Loading your library…</Text>
        </View>
      );
    }
    if (store.error) {
      return (
        <EmptyState
          icon="cloud-offline-outline"
          title="Can't read the library"
          message="Open More → Cloud status to run a connection test."
          actionLabel="Retry"
          onAction={() => booksStore.refresh()}
        />
      );
    }
    if (books.length === 0) {
      return (
        <EmptyState
          icon="library-outline"
          title="The library is empty"
          message="Add books one by one, or import an Excel list."
          actionLabel="Add a book"
          onAction={() => navigation.navigate('More', { screen: 'Add Book', initial: false })}
        />
      );
    }
    return <EmptyState icon="file-tray-outline" title="No books match this filter" message="Change or reset the filters above." />;
  };

  return (
    <Screen title="Total Stock" subtitle={store.loading ? 'Loading…' : `${books.length.toLocaleString()} books in total`} icon="library">
      <FlatList
        data={results}
        keyExtractor={(item) => String(item.book_id)}
        renderItem={({ item }) => <BookCard book={item} onDelete={handleDelete} />}
        ListHeaderComponent={header}
        ListEmptyComponent={listEmpty}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.navy]} />}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 4, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={9}
      />
    </Screen>
  );
}

function SummaryItem({ label, value, color }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryValue, { color }]}>{value.toLocaleString()}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
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
    ...SHADOW,
  },
  searchInput: { flex: 1, fontSize: 16, lineHeight: 23, color: COLORS.text, paddingVertical: 10 },
  summary: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    marginTop: 12,
    paddingVertical: 12,
    ...SHADOW,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 22, lineHeight: 30, fontWeight: '800' },
  summaryLabel: { ...TYPE.small, color: COLORS.textMuted },
  sectionLabel: { ...TYPE.caption, color: COLORS.textMuted, marginTop: 14, marginBottom: 8 },
  chipRow: { flexGrow: 0 },
  chipContent: { gap: 8, paddingRight: 16 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  loading: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { ...TYPE.body, color: COLORS.textMuted },
});
