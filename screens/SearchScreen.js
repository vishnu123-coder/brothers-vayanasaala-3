import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { searchBooks, CATEGORIES } from '../database/db';
import { COLORS, SPACING, RADIUS } from '../utils/theme';

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

  const onCategoryChange = (v) => {
    setCategoryCode(v);
    runSearch(query, v);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Global Search</Text>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by book, author, or publication"
          value={query}
          onChangeText={onQueryChange}
        />
      </View>

      <View style={styles.pickerWrap}>
        <Picker selectedValue={categoryCode} onValueChange={onCategoryChange}>
          <Picker.Item label="All Categories" value="" />
          {CATEGORIES.map((c) => (
            <Picker.Item key={c.code} label={`${c.label} (${c.code})`} value={c.code} />
          ))}
        </Picker>
      </View>

      <Text style={styles.resultCount}>{results.length} result(s)</Text>

      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={<Text style={styles.emptyText}>No books match your search.</Text>}
        renderItem={({ item }) => (
          <View style={styles.resultCard}>
            <View style={styles.resultTop}>
              <Text style={styles.resultTitle}>{item.book_name}</Text>
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
            <Text style={styles.resultMeta}>Author: {item.author_name || '—'}</Text>
            <Text style={styles.resultMeta}>Publication: {item.publication_name || '—'}</Text>
            <View style={styles.tagsRow}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>
                  {item.category_code}-{item.category_no}
                </Text>
              </View>
              <View style={styles.tag}>
                <Text style={styles.tagText}>ID: {item.book_id}</Text>
              </View>
              {item.cost ? (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>₹{item.cost}</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: SPACING.md },
  header: { fontSize: 20, fontWeight: '800', color: COLORS.navy, marginBottom: SPACING.md },
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
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14 },
  pickerWrap: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  resultCount: { color: COLORS.textMuted, fontSize: 12, marginBottom: SPACING.sm },
  emptyText: { color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.xl },
  resultCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    elevation: 1,
  },
  resultTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1, marginRight: 8 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  resultMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  tagsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  tag: { backgroundColor: COLORS.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tagText: { fontSize: 11, color: COLORS.navy, fontWeight: '600' },
});
