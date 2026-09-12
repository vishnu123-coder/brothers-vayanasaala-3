import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { searchBooks, CATEGORIES } from '../database/db';
import { COLORS, SPACING, RADIUS } from '../utils/theme';
import ScreenHeader from '../utils/ScreenHeader';

function categoryColor(code) {
  return CATEGORIES.find((c) => c.code === code)?.color || COLORS.navy;
}
function categoryLabel(code) {
  return CATEGORIES.find((c) => c.code === code)?.label || code;
}

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [results, setResults] = useState([]);

  const runSearch = async (q, cat) => {
    const rows = await searchBooks({ query: q, categoryCode: cat || null });
    setResults(rows);
  };

  useEffect(() => {
    runSearch('', '');
  }, []);

  const onQueryChange = (v) => {
    setQuery(v);
    runSearch(v, categoryCode);
  };

  const onCategoryChange = (code) => {
    const next = categoryCode === code ? '' : code;
    setCategoryCode(next);
    runSearch(query, next);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title="Global Search" subtitle={`${results.length} result(s)`} icon="search" />
      <View style={styles.container}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by book, author, or publication"
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRow}
          contentContainerStyle={{ gap: 8, paddingRight: 12 }}
        >
          <Chip label="All" active={categoryCode === ''} onPress={() => onCategoryChange('')} />
          {CATEGORIES.map((c) => (
            <Chip
              key={c.code}
              label={c.code}
              color={c.color}
              active={categoryCode === c.code}
              onPress={() => onCategoryChange(c.code)}
            />
          ))}
        </ScrollView>

        <FlatList
          data={results}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 40, paddingTop: SPACING.sm }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="search-outline" size={40} color={COLORS.border} />
              <Text style={styles.emptyText}>No books match your search.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.resultCard}>
              <View style={[styles.stripe, { backgroundColor: categoryColor(item.category_code) }]} />
              <View style={styles.resultBody}>
                <View style={styles.resultTop}>
                  <Text style={styles.resultTitle} numberOfLines={2}>{item.book_name}</Text>
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
                <Text style={styles.resultMeta}>{item.author_name || 'Unknown author'}</Text>
                <Text style={styles.resultMetaSub}>{item.publication_name || '—'}</Text>

                <View style={styles.tagsRow}>
                  <View style={[styles.tag, { backgroundColor: categoryColor(item.category_code) + '1A' }]}>
                    <Text style={[styles.tagText, { color: categoryColor(item.category_code) }]}>
                      {categoryLabel(item.category_code)} · {item.category_code}-{item.category_no}
                    </Text>
                  </View>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>ID #{item.book_id}</Text>
                  </View>
                  {item.cost ? (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>₹{item.cost}</Text>
                    </View>
                  ) : null}
                </View>
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
    marginBottom: SPACING.sm,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: COLORS.text },
  chipRow: { marginBottom: SPACING.sm, flexGrow: 0 },
  chip: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  emptyWrap: { alignItems: 'center', marginTop: SPACING.xl * 2, gap: 8 },
  emptyText: { color: COLORS.textMuted, textAlign: 'center', fontSize: 13 },
  resultCard: {
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
  resultBody: { flex: 1, padding: SPACING.md },
  resultTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  resultTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1, lineHeight: 20 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  resultMeta: { fontSize: 12.5, color: COLORS.text, marginTop: 4, fontWeight: '600' },
  resultMetaSub: { fontSize: 11.5, color: COLORS.textMuted, marginTop: 1 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { backgroundColor: COLORS.bg, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  tagText: { fontSize: 10.5, color: COLORS.navy, fontWeight: '700' },
});
