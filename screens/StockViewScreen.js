import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAllBooks } from '../database/db';
import { COLORS, SPACING, RADIUS } from '../utils/theme';

export default function StockViewScreen() {
  const [books, setBooks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const rows = await getAllBooks();
    setBooks(rows);
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

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Total Stock</Text>
      <Text style={styles.subHeader}>{books.length} books in the library</Text>

      <View style={styles.tableHeader}>
        <Text style={[styles.th, { flex: 0.7 }]}>ID</Text>
        <Text style={[styles.th, { flex: 0.9 }]}>Cat No</Text>
        <Text style={[styles.th, { flex: 2 }]}>Book</Text>
        <Text style={[styles.th, { flex: 1.3 }]}>Author</Text>
        <Text style={[styles.th, { flex: 0.8, textAlign: 'right' }]}>Cost</Text>
      </View>

      <FlatList
        data={books}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.emptyText}>No books in stock yet.</Text>}
        renderItem={({ item, index }) => (
          <View style={[styles.row, index % 2 === 0 && styles.rowAlt]}>
            <Text style={[styles.td, { flex: 0.7 }]}>{item.book_id}</Text>
            <Text style={[styles.td, { flex: 0.9 }]}>
              {item.category_code}-{item.category_no}
            </Text>
            <View style={{ flex: 2 }}>
              <Text style={styles.tdBook} numberOfLines={1}>{item.book_name}</Text>
              <Text style={styles.tdSub} numberOfLines={1}>{item.publication_name}</Text>
            </View>
            <Text style={[styles.td, { flex: 1.3 }]} numberOfLines={1}>
              {item.author_name}
            </Text>
            <Text style={[styles.td, { flex: 0.8, textAlign: 'right' }]}>
              {item.cost ? `₹${item.cost}` : '—'}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: SPACING.md },
  header: { fontSize: 20, fontWeight: '800', color: COLORS.navy },
  subHeader: { fontSize: 12, color: COLORS.textMuted, marginBottom: SPACING.md },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.navy,
    borderTopLeftRadius: RADIUS.sm,
    borderTopRightRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  th: { color: '#fff', fontSize: 11, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowAlt: { backgroundColor: '#FBFCFE' },
  td: { fontSize: 12, color: COLORS.text },
  tdBook: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  tdSub: { fontSize: 10, color: COLORS.textMuted },
  emptyText: { color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.xl },
});
