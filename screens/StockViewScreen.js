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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { searchBooks, CATEGORIES } from '../database/db';
import { COLORS, SPACING, RADIUS } from '../utils/theme';

export default function StockViewScreen() {
  const [books, setBooks] = useState([]);
  const [total, setTotal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [status, setStatus] = useState('');

  const load = async (q = query, cat = categoryCode, st = status) => {
    const rows = await searchBooks({ query: q, categoryCode: cat || null, status: st || null });
    setBooks(rows);
    if (!q && !cat && !st) setTotal(rows.length);
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.header}>Total Stock</Text>
        <Text style={styles.subHeader}>
          {books.length} of {total} books shown
        </Text>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search stock..."
            value={query}
            onChangeText={onQueryChange}
          />
        </View>

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
              label={c.code}
              active={categoryCode === c.code}
              onPress={() => onCategoryPress(c.code)}
            />
          ))}
        </ScrollView>

        <View style={styles.statusRow}>
          <Chip
            label="Available"
            active={status === 'available'}
            color={COLORS.success}
            onPress={() => onStatusPress('available')}
          />
          <Chip
            label="Issued"
            active={status === 'issued'}
            color={COLORS.danger}
            onPress={() => onStatusPress('issued')}
          />
        </View>

        <FlatList
          data={books}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 40, paddingTop: SPACING.sm }}
          ListEmptyComponent={<Text style={styles.emptyText}>No books match this filter.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.idBadge}>
                  <Text style={styles.idBadgeText}>{item.book_id}</Text>
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
                      fontSize: 11,
                      fontWeight: '700',
                    }}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>
                  Category: <Text style={styles.metaValue}>{item.category_code}-{item.category_no}</Text>
                </Text>
                <Text style={styles.metaLabel}>
                  Language: <Text style={styles.metaValue}>{item.category_type || '—'}</Text>
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>
                  Publisher: <Text style={styles.metaValue}>{item.publication_name || '—'}</Text>
                </Text>
                <Text style={styles.metaLabel}>
                  {item.cost ? `₹${item.cost}` : '—'}
                </Text>
              </View>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress, color }) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        active && { backgroundColor: color || COLORS.navy, borderColor: color || COLORS.navy },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg, padding: SPACING.md },
  header: { fontSize: 20, fontWeight: '800', color: COLORS.navy },
  subHeader: { fontSize: 12, color: COLORS.textMuted, marginBottom: SPACING.sm },
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
  chipRow: { marginBottom: SPACING.xs, flexGrow: 0 },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: SPACING.sm },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  emptyText: { color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.xl },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    elevation: 1,
  },
  cardTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  idBadge: {
    backgroundColor: '#EAF1FB',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 44,
    alignItems: 'center',
  },
  idBadgeText: { color: COLORS.navy, fontWeight: '800', fontSize: 14 },
  bookName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  author: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.sm },
  metaLabel: { fontSize: 11, color: COLORS.textMuted },
  metaValue: { color: COLORS.text, fontWeight: '600' },
});
