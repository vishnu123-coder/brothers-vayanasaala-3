import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { searchBooks, CATEGORIES, LANGUAGES } from '../database/db';
import { COLORS, SPACING, RADIUS } from '../utils/theme';

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Available', value: 'available' },
  { label: 'Issued', value: 'issued' },
];

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [categoryType, setCategoryType] = useState('');
  const [status, setStatus] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await searchBooks({ query, categoryCode, categoryType, status });
      setResults(rows);
    } finally {
      setLoading(false);
    }
  }, [query, categoryCode, categoryType, status]);

  useEffect(() => { runSearch(); }, [runSearch]);

  const clearFilters = () => {
    setQuery('');
    setCategoryCode('');
    setCategoryType('');
    setStatus('');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.header}>Search Books</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Book, author, publication, barcode or ID"
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query ? <TouchableOpacity onPress={() => setQuery('')}><Ionicons name="close-circle" size={18} color="#9CA3AF" /></TouchableOpacity> : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <FilterButton label="All Categories" active={!categoryCode} onPress={() => setCategoryCode('')} />
          {CATEGORIES.map((c) => (
            <FilterButton key={c.code} label={`${c.code} · ${c.label}`} active={categoryCode === c.code} onPress={() => setCategoryCode(c.code)} />
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRowSmall}>
          <FilterButton label="All Languages" active={!categoryType} onPress={() => setCategoryType('')} />
          {LANGUAGES.map((l) => (
            <FilterButton key={l} label={l} active={categoryType === l} onPress={() => setCategoryType(l)} small />
          ))}
        </ScrollView>

        <View style={styles.statusLine}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
            {STATUS_FILTERS.map((s) => (
              <FilterButton key={s.value || 'all'} label={s.label} active={status === s.value} onPress={() => setStatus(s.value)} small />
            ))}
          </ScrollView>
          {(categoryCode || categoryType || status || query) ? (
            <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
              <Ionicons name="refresh" size={14} color={COLORS.navy} />
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.countRow}>
          <Text style={styles.resultCount}>{results.length} result(s)</Text>
          {loading ? <ActivityIndicator size="small" color={COLORS.navy} /> : null}
        </View>

        <FlatList
          data={results}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 30 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={!loading ? <Text style={styles.emptyText}>No books match the selected filters.</Text> : null}
          renderItem={({ item }) => (
            <View style={styles.resultCard}>
              <View style={styles.resultTop}>
                <Text style={styles.resultTitle} numberOfLines={2}>{item.book_name}</Text>
                <View style={[styles.statusPill, { backgroundColor: item.status === 'issued' ? '#FDECEC' : '#E8F7EE' }]}>
                  <Text style={{ color: item.status === 'issued' ? COLORS.danger : COLORS.success, fontSize: 10, fontWeight: '700' }}>
                    {item.status === 'issued' ? 'ISSUED' : 'AVAILABLE'}
                  </Text>
                </View>
              </View>
              <Text style={styles.resultMeta}>Author: {item.author_name || '—'}</Text>
              <Text style={styles.resultMeta}>Publication: {item.publication_name || '—'}</Text>
              <View style={styles.tagsRow}>
                <Tag text={`${item.category_code}-${item.category_no}`} />
                <Tag text={`ID: ${item.book_id}`} />
                {item.category_type ? <Tag text={item.category_type} /> : null}
                {item.cost != null ? <Tag text={`₹${item.cost}`} /> : null}
              </View>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

function FilterButton({ label, active, onPress, small }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.filterButton, small && styles.filterButtonSmall, active && styles.filterButtonActive]}>
      <Text style={[styles.filterText, active && styles.filterTextActive]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

function Tag({ text }) {
  return <View style={styles.tag}><Text style={styles.tagText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: SPACING.md },
  header: { fontSize: 21, fontWeight: '800', color: COLORS.navy, marginTop: 4, marginBottom: SPACING.sm },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.card, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, marginBottom: 8 },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: COLORS.text },
  filterRow: { gap: 7, paddingVertical: 3, paddingRight: 10 },
  filterRowSmall: { gap: 7, paddingVertical: 3, paddingRight: 10 },
  filterButton: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7, maxWidth: 180 },
  filterButtonSmall: { paddingHorizontal: 10, paddingVertical: 6 },
  filterButtonActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  filterText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  statusLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 4 },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5 },
  clearText: { color: COLORS.navy, fontSize: 11, fontWeight: '700' },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24 },
  resultCount: { color: COLORS.textMuted, fontSize: 12 },
  emptyText: { color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.xl },
  resultCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, elevation: 1 },
  resultTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  resultTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },
  statusPill: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 10 },
  resultMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  tag: { backgroundColor: COLORS.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tagText: { fontSize: 10, color: COLORS.navy, fontWeight: '600' },
});
