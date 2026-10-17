import React, { useDeferredValue, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { booksStore, CATEGORIES } from '../database/db';
import { useStore } from '../database/hooks';
import { filterBooks } from '../utils/search';
import { COLORS, RADIUS, TYPE, SHADOW, useLayout } from '../utils/theme';
import Screen from '../components/Screen';
import Chip from '../components/Chip';
import BookCard from '../components/BookCard';
import EmptyState from '../components/EmptyState';
import BarcodeScannerModal from '../components/BarcodeScannerModal';

const STATUS = [
  { key: '', label: 'All' },
  { key: 'available', label: 'Available', icon: 'checkmark-circle', color: COLORS.success },
  { key: 'issued', label: 'Issued', icon: 'swap-horizontal', color: COLORS.danger },
];

export default function SearchScreen({ navigation }) {
  const { gutter } = useLayout();
  const store = useStore(booksStore);
  const [query, setQuery] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [status, setStatus] = useState('');
  const [scanner, setScanner] = useState(false);

  // Typing stays instant; the (cheap) filtering runs on the deferred value.
  const deferredQuery = useDeferredValue(query);
  const books = store.data;

  const results = useMemo(
    () => filterBooks(books, { query: deferredQuery, categoryCode, status }),
    [books, deferredQuery, categoryCode, status]
  );

  const hasFilters = !!(query || categoryCode || status);
  const clearAll = () => {
    setQuery('');
    setCategoryCode('');
    setStatus('');
  };

  const subtitle = store.loading
    ? 'Loading library…'
    : hasFilters
    ? `${results.length.toLocaleString()} of ${books.length.toLocaleString()} books`
    : `${books.length.toLocaleString()} books in the library`;

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
          message={`${store.error.code === 'firestore/permission-denied' ? 'Firebase rules are blocking access. ' : ''}Open More → Cloud status to run a connection test.`}
          actionLabel="Retry"
          onAction={() => booksStore.refresh()}
        />
      );
    }
    if (books.length === 0) {
      return (
        <EmptyState
          icon="library-outline"
          title="No books yet"
          message="Add your first book to start searching."
          actionLabel="Add a book"
          onAction={() => navigation.navigate('More', { screen: 'Add Book', initial: false })}
        />
      );
    }
    return (
      <EmptyState
        icon="search-outline"
        title="No books match"
        message="Try fewer or different words, a Book ID, or a barcode."
        actionLabel="Clear search"
        onAction={clearAll}
      />
    );
  };

  return (
    <Screen title="Global Search" subtitle={subtitle} icon="search">
      <View style={[styles.controls, { paddingHorizontal: gutter }]}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Book, author, publisher, ID, N-20…"
            placeholderTextColor={COLORS.placeholder}
            selectionColor={COLORS.navy}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="never"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.scanBtn} onPress={() => setScanner(true)} accessibilityLabel="Scan barcode to search">
            <Ionicons name="barcode-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRow}
          contentContainerStyle={styles.chipContent}
          keyboardShouldPersistTaps="handled"
        >
          <Chip label="All categories" active={categoryCode === ''} onPress={() => setCategoryCode('')} />
          {CATEGORIES.map((c) => (
            <Chip
              key={c.code}
              label={c.short}
              color={c.color}
              active={categoryCode === c.code}
              onPress={() => setCategoryCode(categoryCode === c.code ? '' : c.code)}
            />
          ))}
        </ScrollView>

        <View style={styles.statusRow}>
          {STATUS.map((s) => (
            <Chip
              key={s.key || 'all'}
              label={s.label}
              icon={s.icon}
              color={s.color}
              active={status === s.key}
              onPress={() => setStatus(s.key)}
            />
          ))}
          {hasFilters ? (
            <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
              <Text style={styles.clearText}>Reset</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => String(item.book_id)}
        renderItem={({ item }) => <BookCard book={item} />}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 6, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={9}
        removeClippedSubviews
        ListEmptyComponent={listEmpty}
      />

      <BarcodeScannerModal
        visible={scanner}
        onClose={() => setScanner(false)}
        onScanned={(code) => {
          setScanner(false);
          setQuery(code);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: { paddingTop: 4 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingLeft: 14,
    paddingRight: 6,
    minHeight: 56,
    ...SHADOW,
  },
  searchInput: { flex: 1, fontSize: 16, lineHeight: 23, color: COLORS.text, paddingVertical: 10 },
  scanBtn: {
    backgroundColor: COLORS.navy,
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipRow: { flexGrow: 0, marginTop: 12 },
  chipContent: { gap: 8, paddingRight: 16 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 6 },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  clearText: { ...TYPE.smallStrong, color: COLORS.danger },
  loading: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { ...TYPE.body, color: COLORS.textMuted },
});
