import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getAllBooks, getCategoryLabels } from '../database/db';
import { COLORS, SPACING, RADIUS } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';

export default function StockViewScreen() {
  const [books, setBooks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [categories, setCategories] = useState([]);

  const load = async () => {
    const [rows, cats] = await Promise.all([getAllBooks(), getCategoryLabels()]);
    setBooks(rows);
    setCategories(cats);
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filteredBooks = books.filter((b) => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || [b.book_name, b.author_name, b.publication_name, b.barcode, String(b.book_id)].some((v) => String(v || '').toLowerCase().includes(q));
    const matchesCategory = !category || String(b.category_label || `${b.category_code}-${b.category_no}`).toUpperCase() === category.toUpperCase();
    const matchesStatus = !status || b.status === status;
    return matchesQuery && matchesCategory && matchesStatus;
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.header}>Total Stock</Text>
        <Text style={styles.subHeader}>{filteredBooks.length} of {books.length} books shown</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={17} color={COLORS.textMuted} />
          <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Search stock..." placeholderTextColor="#9CA3AF" />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <Filter label="All" active={!category && !status} onPress={() => { setCategory(''); setStatus(''); }} />
          {categories.map((c) => <Filter key={c} label={c} active={category === c} onPress={() => setCategory(c)} />)}
          <View style={styles.separator} />
          <Filter label="Available" active={status === 'available'} onPress={() => setStatus(status === 'available' ? '' : 'available')} />
          <Filter label="Issued" active={status === 'issued'} onPress={() => setStatus(status === 'issued' ? '' : 'issued')} />
        </ScrollView>
        <FlatList
          data={filteredBooks}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 30 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No books in stock yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.bookCard}>
              <View style={styles.bookTop}>
                <View style={styles.idBox}><Text style={styles.idText}>{item.book_id}</Text></View>
                <View style={styles.bookMain}>
                  <Text style={styles.bookName} numberOfLines={2}>{item.book_name}</Text>
                  <Text style={styles.author} numberOfLines={1}>{item.author_name || 'Author not provided'}</Text>
                </View>
                <View style={[styles.status, item.status === 'issued' ? styles.issued : styles.available]}>
                  <Text style={[styles.statusText, item.status === 'issued' ? styles.issuedText : styles.availableText]}>{item.status}</Text>
                </View>
              </View>
              <View style={styles.detailsRow}>
                <Text style={styles.detail}>Category: <Text style={styles.detailStrong}>{item.category_label || `${item.category_code}-${item.category_no}`}</Text></Text>
                <Text style={styles.detail}>Language: <Text style={styles.detailStrong}>{item.category_type || '—'}</Text></Text>
              </View>
              <View style={styles.detailsRow}>
                <Text style={styles.detail}>Publisher: {item.publication_name || '—'}</Text>
                <Text style={styles.detail}>{item.cost != null ? `₹${item.cost}` : '—'}</Text>
              </View>
              {item.barcode ? <Text style={styles.barcode}>Barcode: {item.barcode}</Text> : null}
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

function Filter({ label, active, onPress }) {
  return <TouchableOpacity onPress={onPress} style={[styles.filter, active && styles.filterActive]}><Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: SPACING.md },
  header: { fontSize: 21, fontWeight: '800', color: COLORS.navy, marginTop: 4 },
  subHeader: { fontSize: 12, color: COLORS.textMuted, marginBottom: SPACING.sm },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, paddingHorizontal: 10, marginBottom: 7 },
  searchInput: { flex: 1, paddingVertical: 9, fontSize: 13, color: COLORS.text },
  filters: { gap: 6, paddingBottom: 8, paddingRight: 10 },
  separator: { width: 1, height: 28, backgroundColor: COLORS.border, marginHorizontal: 2 },
  filter: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  filterActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  filterText: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted },
  filterTextActive: { color: '#fff' },
  bookCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: 13, marginBottom: 9, elevation: 1 },
  bookTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  idBox: { width: 38, height: 38, borderRadius: 9, backgroundColor: '#EAF1FB', justifyContent: 'center', alignItems: 'center' },
  idText: { color: COLORS.navy, fontSize: 12, fontWeight: '800' },
  bookMain: { flex: 1, minWidth: 0 },
  bookName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  author: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  status: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 10 },
  available: { backgroundColor: '#E8F7EE' },
  issued: { backgroundColor: '#FDECEC' },
  statusText: { fontSize: 9, fontWeight: '800' },
  availableText: { color: COLORS.success },
  issuedText: { color: COLORS.danger },
  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  detail: { flex: 1, fontSize: 10, color: COLORS.textMuted },
  detailStrong: { color: COLORS.navy, fontWeight: '700' },
  barcode: { fontSize: 10, color: COLORS.textMuted, marginTop: 7 },
  emptyText: { color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.xl },
});
